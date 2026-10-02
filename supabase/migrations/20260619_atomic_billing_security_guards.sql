-- Atomic security/billing guards for Stripe and founding flows.
-- 1. Plan credit grants: atomically claim the billing-period grant before adding credits.
-- 2. Refund replay: prevent two charge.refunded events for the same Stripe charge from re-running side effects.
-- 3. Founding member spots: reserve a wave spot with a DB-side cap check in one transaction.

-- ─── Plan credit grants: atomic claim + grant ────────────────────────────────

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
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'claim_plan_credit_grant requires p_user_id' USING ERRCODE = '22023';
  END IF;
  IF p_stripe_subscription_id IS NULL OR p_stripe_period_start IS NULL OR p_stripe_period_end IS NULL THEN
    RAISE EXCEPTION 'claim_plan_credit_grant requires subscription id and period bounds' USING ERRCODE = '22023';
  END IF;

  -- Fast path: first handler for this user/subscription/period creates the grant row.
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
    -- Existing row: lock it so concurrent upgrade/delta decisions serialize.
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
    v_balance_after := v_balance_before + v_delta;

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
      v_delta,
      v_balance_before,
      v_balance_after,
      current_user,
      session_user,
      auth.uid()
    );
  ELSE
    v_balance_after := v_balance_before;
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

-- ─── Refund replay: one charge.refunded side-effect per Stripe charge ────────

-- If historical duplicate charge.refunded rows exist, keep the earliest row so the
-- unique replay guard can be created safely.
DELETE FROM public.refund_events dup
USING public.refund_events keep
WHERE dup.event_type = 'charge.refunded'
  AND keep.event_type = 'charge.refunded'
  AND dup.stripe_charge_id IS NOT NULL
  AND keep.stripe_charge_id = dup.stripe_charge_id
  AND keep.id < dup.id;

CREATE UNIQUE INDEX IF NOT EXISTS refund_events_charge_refunded_unique
  ON public.refund_events (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL
    AND event_type = 'charge.refunded';

-- ─── Founding spot reservations: atomic cap-checked reservation ──────────────

ALTER TABLE public.founding_members
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS reservation_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS founding_members_stripe_session_id_unique
  ON public.founding_members (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS founding_members_wave_reservation_idx
  ON public.founding_members (wave, reservation_status, reservation_expires_at);

CREATE OR REPLACE FUNCTION public.reserve_founding_member_spot(
  p_user_id UUID,
  p_wave INT,
  p_wave_cap INT,
  p_plan TEXT,
  p_locked_price INT,
  p_expires_at TIMESTAMPTZ DEFAULT now() + interval '1 hour'
)
RETURNS public.founding_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved public.founding_members;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'reserve_founding_member_spot requires p_user_id' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_wave_cap, 0) <= 0 THEN
    RAISE EXCEPTION 'reserve_founding_member_spot requires positive p_wave_cap' USING ERRCODE = '22023';
  END IF;

  -- Serialize reservations per wave, then do the cap check and insert in the DB.
  PERFORM pg_advisory_xact_lock(hashtext('founding_members_wave'), p_wave);

  INSERT INTO public.founding_members (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    plan,
    wave,
    locked_price,
    reservation_status,
    reservation_expires_at
  )
  SELECT
    p_user_id,
    'reserved:' || gen_random_uuid()::TEXT,
    'pending',
    p_plan,
    p_wave,
    p_locked_price,
    'checkout_pending',
    p_expires_at
  WHERE (
    SELECT COUNT(*)
    FROM public.founding_members fm
    WHERE fm.wave = p_wave
      AND (
        fm.reservation_status = 'active'
        OR (
          fm.reservation_status = 'checkout_pending'
          AND COALESCE(fm.reservation_expires_at, now()) > now()
        )
      )
  ) < p_wave_cap
  RETURNING * INTO v_reserved;

  IF v_reserved.id IS NULL THEN
    RAISE EXCEPTION 'founding_wave_closed' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_reserved;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_founding_member_spot(UUID, INT, INT, TEXT, INT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_founding_member_spot(UUID, INT, INT, TEXT, INT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_founding_member_spot(UUID, INT, INT, TEXT, INT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_founding_member_spot(UUID, INT, INT, TEXT, INT, TIMESTAMPTZ) TO service_role;
