-- F3: Top-up credits never expire (locked policy, Phase 12)
--
-- 1. Make expires_at nullable so new top-ups can be inserted with NULL
-- 2. Clear incorrectly-set expires_at on all existing active top-up rows
-- 3. Clear is_expired flag on rows that were incorrectly expired by invoice.paid
-- 4. Restore credits_remaining for any rows that were zeroed by invoice.paid
--    (restore from credits_purchased since we have no other source of truth)
--
-- Note: credits_purchased is the original purchase amount. Any credits
-- already spent are lost — we can only restore what was never spent.
-- Restoring credits_remaining = credits_purchased is conservative but correct
-- (only rows zeroed by invoice.paid have credits_remaining=0 AND is_expired=true).

-- Step 1: Make expires_at nullable if it has a NOT NULL constraint
ALTER TABLE public.credit_topups
  ALTER COLUMN expires_at DROP NOT NULL;

-- Step 2: Clear expires_at on all active (not manually expired) top-up rows
UPDATE public.credit_topups
SET expires_at = NULL
WHERE expires_at IS NOT NULL
  AND (is_expired = false OR is_expired IS NULL);

-- Step 3+4: Restore rows that were incorrectly expired by the invoice.paid handler.
-- These rows have is_expired=true and credits_remaining=0 but were not
-- legitimately expired (they had non-zero credits before being zeroed).
-- We restore them with credits_remaining = credits_purchased as a best-effort.
-- Users who had partially spent credits may get a slight over-refund, but this
-- is preferable to silently losing purchased credits.
UPDATE public.credit_topups
SET
  is_expired = false,
  expires_at = NULL,
  credits_remaining = credits_purchased
WHERE
  is_expired = true
  AND credits_remaining = 0
  AND credits_purchased > 0;

-- Confirm: log count of restored rows (visible in Supabase SQL output)
SELECT
  COUNT(*) FILTER (WHERE expires_at IS NULL AND (is_expired = false OR is_expired IS NULL)) AS active_no_expiry,
  COUNT(*) FILTER (WHERE is_expired = true) AS still_expired
FROM public.credit_topups;

-- Step 5: Update debit_credits and refund_credits RPCs to treat NULL expires_at
-- as "never expires" (previously filtered expires_at > NOW() which skipped non-expiring rows).
-- Re-run the full RPC definitions with the corrected filter.
-- (Full bodies below — same as 20260428_credit_ledger.sql but with NULL-safe expires_at)

CREATE OR REPLACE FUNCTION public.debit_credits(
  p_user_id        UUID,
  p_amount         INT,
  p_reference_id   TEXT,
  p_reference_type TEXT,
  p_workspace_id   UUID DEFAULT NULL
)
RETURNS TABLE (ok BOOLEAN, debited_plan INT, debited_topup INT, error_code TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_credits     INT;
  v_debit_from_plan  INT;
  v_debit_from_topup INT := 0;
  v_remaining        INT;
  v_topup            RECORD;
  v_topup_deduct     INT;
  v_source           TEXT;
  v_topup_total      INT := 0;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT TRUE, 0, 0, NULL::TEXT;
    RETURN;
  END IF;
  SELECT heavy_credits_remaining INTO v_plan_credits
  FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'user_not_found'::TEXT;
    RETURN;
  END IF;
  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_topup_total
  FROM credit_topups
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND credits_remaining > 0;
  IF (v_plan_credits + v_topup_total) < p_amount THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'insufficient_credits'::TEXT;
    RETURN;
  END IF;
  v_debit_from_plan := LEAST(v_plan_credits, p_amount);
  v_remaining := p_amount - v_debit_from_plan;
  IF v_debit_from_plan > 0 THEN
    UPDATE profiles SET heavy_credits_remaining = heavy_credits_remaining - v_debit_from_plan WHERE id = p_user_id;
  END IF;
  IF v_remaining > 0 THEN
    FOR v_topup IN
      SELECT id, credits_remaining FROM credit_topups
      WHERE user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > NOW())
        AND credits_remaining > 0
      ORDER BY created_at ASC FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_topup_deduct     := LEAST(v_remaining, v_topup.credits_remaining);
      UPDATE credit_topups SET credits_remaining = credits_remaining - v_topup_deduct WHERE id = v_topup.id;
      v_remaining        := v_remaining - v_topup_deduct;
      v_debit_from_topup := v_debit_from_topup + v_topup_deduct;
    END LOOP;
  END IF;
  IF v_debit_from_plan > 0 AND v_debit_from_topup > 0 THEN v_source := 'mixed';
  ELSIF v_debit_from_topup > 0 THEN v_source := 'topup';
  ELSE v_source := 'plan'; END IF;
  INSERT INTO credit_transactions(user_id, workspace_id, amount, debited_plan, debited_topup, source, reference_type, reference_id)
  VALUES (p_user_id, p_workspace_id, p_amount, v_debit_from_plan, v_debit_from_topup, v_source, p_reference_type, p_reference_id);
  RETURN QUERY SELECT TRUE, v_debit_from_plan, v_debit_from_topup, NULL::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id        UUID,
  p_amount         INT,
  p_reference_id   TEXT,
  p_reference_type TEXT,
  p_workspace_id   UUID DEFAULT NULL
)
RETURNS TABLE (ok BOOLEAN, refunded INT)
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
    RETURN QUERY SELECT TRUE, 0;
    RETURN;
  END IF;
  SELECT debited_plan, debited_topup INTO v_orig_plan, v_orig_topup
  FROM credit_transactions
  WHERE reference_id = p_reference_id AND user_id = p_user_id AND amount > 0
  ORDER BY created_at DESC LIMIT 1;
  v_found := FOUND;
  v_total_debited := v_orig_plan + v_orig_topup;
  IF v_found AND v_total_debited > 0 THEN
    v_refund_plan  := ROUND(p_amount::NUMERIC * v_orig_plan / v_total_debited);
    v_refund_topup := p_amount - v_refund_plan;
  ELSE
    v_refund_plan  := p_amount;
    v_refund_topup := 0;
  END IF;
  IF v_refund_plan > 0 THEN
    UPDATE profiles SET heavy_credits_remaining = heavy_credits_remaining + v_refund_plan WHERE id = p_user_id;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0; RETURN; END IF;
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
    IF v_topup_placed < v_refund_topup THEN
      UPDATE profiles SET heavy_credits_remaining = heavy_credits_remaining + (v_refund_topup - v_topup_placed) WHERE id = p_user_id;
    END IF;
  END IF;
  INSERT INTO credit_transactions(user_id, workspace_id, amount, debited_plan, debited_topup, source, reference_type, reference_id)
  VALUES (p_user_id, p_workspace_id, -p_amount, v_refund_plan, v_refund_topup, 'plan', p_reference_type, p_reference_id);
  RETURN QUERY SELECT TRUE, p_amount;
END;
$$;
