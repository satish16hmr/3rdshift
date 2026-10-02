-- Top-up single-source-of-truth fix.
--
-- Purchased top-up credits live only in public.credit_topups. The profile column
-- public.profiles.heavy_credits_remaining is the monthly plan bucket only.
-- debit_credits remains the spend-time aggregator: plan bucket first, then
-- credit_topups.credits_remaining.
--
-- This migration updates claim_plan_credit_grant so subscription/plan changes set
-- the profile plan bucket to the new plan allowance without adding top-up rows
-- into profiles.heavy_credits_remaining. It intentionally does not mutate any
-- existing profile or credit_topups data.

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

  -- profiles.heavy_credits_remaining stores only the plan bucket. Purchased
  -- top-ups stay in credit_topups and are summed by debit_credits at spend time.
  IF p_plan = 'starter' THEN
    v_balance_after := 0;
  ELSE
    v_balance_after := GREATEST(COALESCE(p_plan_credits, 0), 0);
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
