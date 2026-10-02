-- Phase 13 — F1 + F2 + F3 fixes
-- F1: Add processing_started_at + owner_token to stripe_webhook_events for atomic reclaim
-- F1: Add partial UNIQUE index on credit_topups(stripe_payment_id) for idempotency
-- F3: Update refund_credits RPC — guard against minting credits when no matching debit exists

-- ── F1a: stripe_webhook_events new columns ───────────────────────────────────
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_token UUID;

-- ── F1b: idempotency constraints for Stripe side-effects ────────────────────

-- credit_topups: unique per payment_intent (stripe_payment_id).
-- Partial: only for non-null, non-empty values (subscription events have no payment_intent).
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_topups_stripe_payment_id
  ON public.credit_topups(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL AND stripe_payment_id != '';

-- founding_members: already has UNIQUE on stripe_subscription_id (from migration v2).
-- Add session_id column + unique index for additional defense (checkout.session.completed).
ALTER TABLE public.founding_members
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_founding_members_stripe_session_id
  ON public.founding_members(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL AND stripe_session_id != '';

-- workspaces: provision_workspace_purchase RPC already uses stripe_subscription_id UNIQUE
-- check internally (SELECT WHERE stripe_subscription_id = p_stripe_sub_id).
-- Add explicit DB constraint as defense in depth.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription_id
  ON public.workspaces(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != '';

-- ── F3: refund_credits — add error_code to return, guard against minting ──────
-- Q3=error: if no matching debit found for reference_id, return ok=false, error_code='no_original_debit'.
-- Never fall through to mint plan credits for an unmatched refund.
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id        UUID,
  p_amount         INT,
  p_reference_id   TEXT,
  p_reference_type TEXT,
  p_workspace_id   UUID DEFAULT NULL
)
RETURNS TABLE (ok BOOLEAN, refunded INT, error_code TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_orig_plan     INT := 0;
  v_orig_topup    INT := 0;
  v_refund_plan   INT := 0;
  v_refund_topup  INT := 0;
  v_topup_placed  INT := 0;
  v_topup         RECORD;
  v_place         INT;
  v_found         BOOLEAN := FALSE;
  v_total_debited INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT TRUE, 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Look up the original debit to determine how to route the refund
  SELECT debited_plan, debited_topup INTO v_orig_plan, v_orig_topup
  FROM credit_transactions
  WHERE reference_id = p_reference_id AND user_id = p_user_id AND amount > 0
  ORDER BY created_at DESC LIMIT 1;
  v_found := FOUND;
  v_total_debited := v_orig_plan + v_orig_topup;

  -- F3 guard: if no matching debit found, return error — NEVER mint credits
  IF NOT v_found OR v_total_debited = 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'no_original_debit'::TEXT;
    RETURN;
  END IF;

  -- Proportional split: refund plan/topup in same ratio as original debit
  v_refund_plan  := ROUND(p_amount::NUMERIC * v_orig_plan / v_total_debited);
  v_refund_topup := p_amount - v_refund_plan;

  IF v_refund_plan > 0 THEN
    UPDATE profiles SET heavy_credits_remaining = heavy_credits_remaining + v_refund_plan WHERE id = p_user_id;
    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 0, 'profile_not_found'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_refund_topup > 0 THEN
    FOR v_topup IN
      SELECT id FROM credit_topups
      WHERE user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC FOR UPDATE
    LOOP
      EXIT WHEN v_topup_placed >= v_refund_topup;
      v_place := v_refund_topup - v_topup_placed;
      UPDATE credit_topups SET credits_remaining = credits_remaining + v_place WHERE id = v_topup.id;
      v_topup_placed := v_topup_placed + v_place;
    END LOOP;
    -- If no active topup rows to credit back into, add remainder to plan pool
    IF v_topup_placed < v_refund_topup THEN
      UPDATE profiles
        SET heavy_credits_remaining = heavy_credits_remaining + (v_refund_topup - v_topup_placed)
        WHERE id = p_user_id;
    END IF;
  END IF;

  -- Audit log — record the refund
  INSERT INTO credit_transactions(user_id, workspace_id, amount, debited_plan, debited_topup, source, reference_type, reference_id)
  VALUES (p_user_id, p_workspace_id, -p_amount, v_refund_plan, v_refund_topup, 'plan', p_reference_type, p_reference_id);

  RETURN QUERY SELECT TRUE, p_amount, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) TO service_role;
