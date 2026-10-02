-- C-2/H-1/H-2 security hardening.
--
-- C-2: same-period subscription.updated events must not overwrite spent plan
-- credits. claim_plan_credit_grant now mutates profiles.heavy_credits_remaining
-- only for a genuinely new period grant or a same-period upgrade delta.
--
-- H-1/M-9: top-up refunds zero the matching credit_topups row atomically under
-- row lock. Purchased top-ups remain the single source of truth in credit_topups.
--
-- H-2: remove blanket authenticated SELECT for generated audio outputs. Playback
-- is served through app-issued service-role signed URLs after membership checks.

CREATE OR REPLACE FUNCTION public.claim_plan_credit_grant(
  p_user_id UUID,
  p_stripe_subscription_id TEXT,
  p_stripe_period_start TIMESTAMPTZ,
  p_stripe_period_end TIMESTAMPTZ,
  p_plan TEXT,
  p_plan_credits INT
)
RETURNS TABLE(granted_delta INT, granted_credits INT, balance_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_credits INT;
  v_new_granted_credits INT;
  v_delta INT;
  v_balance_before INT;
  v_balance_after INT;
  v_balance_delta INT;
  v_inserted BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'claim_plan_credit_grant requires p_user_id' USING ERRCODE = '22023';
  END IF;
  IF p_stripe_subscription_id IS NULL OR p_stripe_period_start IS NULL OR p_stripe_period_end IS NULL THEN
    RAISE EXCEPTION 'claim_plan_credit_grant requires subscription id and period bounds' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.plan_credit_grants (
    user_id,
    stripe_subscription_id,
    stripe_period_start,
    stripe_period_end,
    plan,
    granted_credits
  ) VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_period_start,
    p_stripe_period_end,
    p_plan,
    GREATEST(COALESCE(p_plan_credits, 0), 0)
  )
  ON CONFLICT (user_id, stripe_subscription_id, stripe_period_start) DO NOTHING
  RETURNING public.plan_credit_grants.granted_credits
    INTO v_new_granted_credits;

  IF v_new_granted_credits IS NULL THEN
    SELECT pcg.granted_credits
      INTO v_existing_credits
    FROM public.plan_credit_grants pcg
    WHERE pcg.user_id = p_user_id
      AND pcg.stripe_subscription_id = p_stripe_subscription_id
      AND pcg.stripe_period_start = p_stripe_period_start
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'plan_credit_grant row disappeared for user=% subscription=% period=%',
        p_user_id, p_stripe_subscription_id, p_stripe_period_start
        USING ERRCODE = 'P0002';
    END IF;

    v_new_granted_credits := GREATEST(COALESCE(v_existing_credits, 0), GREATEST(COALESCE(p_plan_credits, 0), 0));

    IF v_new_granted_credits > COALESCE(v_existing_credits, 0) THEN
      UPDATE public.plan_credit_grants
      SET granted_credits = v_new_granted_credits,
          stripe_period_end = p_stripe_period_end,
          plan = p_plan
      WHERE user_id = p_user_id
        AND stripe_subscription_id = p_stripe_subscription_id
        AND stripe_period_start = p_stripe_period_start;
    END IF;

    v_delta := v_new_granted_credits - COALESCE(v_existing_credits, 0);
  ELSE
    v_inserted := TRUE;
    v_delta := v_new_granted_credits;
  END IF;

  SELECT p.heavy_credits_remaining
    INTO v_balance_before
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found for claim_plan_credit_grant user_id=%', p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_delta > 0 THEN
    -- New period grant resets the monthly plan bucket. Same-period upgrades add
    -- only the missing upgrade delta, preserving credits already spent in the
    -- current period. Same-period no-op replay leaves the balance untouched.
    IF v_inserted THEN
      v_balance_after := GREATEST(COALESCE(p_plan_credits, 0), 0);
    ELSE
      v_balance_after := GREATEST(COALESCE(v_balance_before, 0) + v_delta, 0);
    END IF;
  ELSE
    v_balance_after := COALESCE(v_balance_before, 0);
  END IF;

  v_balance_delta := v_balance_after - COALESCE(v_balance_before, 0);

  IF v_balance_delta <> 0 THEN
    UPDATE public.profiles
    SET heavy_credits_remaining = v_balance_after
    WHERE id = p_user_id;

    INSERT INTO public.heavy_credit_grant_audit_log (
      user_id,
      amount,
      balance_before,
      balance_after,
      invoked_by_role,
      session_role,
      auth_uid
    ) VALUES (
      p_user_id,
      v_balance_delta,
      v_balance_before,
      v_balance_after,
      current_user,
      session_user,
      auth.uid()
    );
  END IF;

  granted_delta := v_delta;
  granted_credits := v_new_granted_credits;
  balance_after := v_balance_after;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_plan_credit_grant(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_plan_credit_grant(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_plan_credit_grant(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_plan_credit_grant(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT) TO service_role;

ALTER TABLE public.credit_topups
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_by_stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_event_id TEXT;

CREATE OR REPLACE FUNCTION public.zero_refunded_credit_topup(
  p_user_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_stripe_charge_id TEXT,
  p_stripe_event_id TEXT
)
RETURNS TABLE(ok BOOLEAN, topup_id UUID, credits_zeroed INT, credits_remaining_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'zero_refunded_credit_topup requires p_user_id' USING ERRCODE = '22023';
  END IF;
  IF p_stripe_payment_intent_id IS NULL OR btrim(p_stripe_payment_intent_id) = '' THEN
    RAISE EXCEPTION 'zero_refunded_credit_topup requires p_stripe_payment_intent_id' USING ERRCODE = '22023';
  END IF;

  SELECT ct.id, ct.credits_remaining
    INTO v_topup
  FROM public.credit_topups ct
  WHERE ct.user_id = p_user_id
    AND ct.stripe_payment_id = p_stripe_payment_intent_id
  ORDER BY ct.purchased_at DESC NULLS LAST, ct.id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    ok := FALSE;
    topup_id := NULL;
    credits_zeroed := 0;
    credits_remaining_after := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  credits_zeroed := GREATEST(COALESCE(v_topup.credits_remaining, 0), 0);

  UPDATE public.credit_topups
  SET credits_remaining = 0,
      is_expired = TRUE,
      refunded_at = COALESCE(refunded_at, now()),
      refunded_by_stripe_charge_id = COALESCE(refunded_by_stripe_charge_id, p_stripe_charge_id),
      refund_event_id = COALESCE(refund_event_id, p_stripe_event_id)
  WHERE id = v_topup.id;

  ok := TRUE;
  topup_id := v_topup.id;
  credits_remaining_after := 0;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.zero_refunded_credit_topup(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.zero_refunded_credit_topup(UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.zero_refunded_credit_topup(UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.zero_refunded_credit_topup(UUID, TEXT, TEXT, TEXT) TO service_role;

DROP POLICY IF EXISTS "Authenticated users read audio-outputs" ON storage.objects;
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'audio-outputs';
