-- ============================================================
-- D6: Atomic Credit Ledger
-- debit_credits: row-locked debit, plan first then topup FIFO
-- refund_credits: source-aware refund — reads original debit
--   split from credit_transactions and refunds to correct buckets
-- ============================================================

-- ── credit_transactions: audit log + refund source of truth ──────────────
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  amount          INT NOT NULL,             -- positive = debit, negative = refund
  debited_plan    INT NOT NULL DEFAULT 0,   -- how much came from plan credits
  debited_topup   INT NOT NULL DEFAULT 0,   -- how much came from topup credits
  source          TEXT NOT NULL CHECK (source IN ('plan', 'topup', 'mixed')),
  reference_type  TEXT NOT NULL,            -- 'task' | 'chain_step' | 'website_section' | 'stale_task' | 'video_failure'
  reference_id    TEXT,                     -- task_id, run_id, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
-- Service role only — no user-facing reads (billing page uses profiles.heavy_credits_remaining)
CREATE POLICY "Service role only" ON public.credit_transactions
  USING (false);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx
  ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_reference_id_idx
  ON public.credit_transactions(reference_id);

-- ── debit_credits ──────────────────────────────────────────────────────────
-- Atomically debits p_amount credits from the user.
-- Deducts plan credits first (profiles.heavy_credits_remaining), then topup FIFO.
-- Uses SELECT ... FOR UPDATE to prevent concurrent race on profiles row.
-- Stores debited_plan + debited_topup split in credit_transactions so
-- refund_credits can route refunds to the correct buckets.
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

  -- Lock the profiles row to prevent concurrent debits
  SELECT heavy_credits_remaining INTO v_plan_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'user_not_found'::TEXT;
    RETURN;
  END IF;

  -- Sum available topup credits (not locked yet — just checking total)
  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_topup_total
  FROM credit_topups
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND credits_remaining > 0;

  IF (v_plan_credits + v_topup_total) < p_amount THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'insufficient_credits'::TEXT;
    RETURN;
  END IF;

  -- Deduct from plan credits first
  v_debit_from_plan := LEAST(v_plan_credits, p_amount);
  v_remaining := p_amount - v_debit_from_plan;

  IF v_debit_from_plan > 0 THEN
    UPDATE profiles
    SET heavy_credits_remaining = heavy_credits_remaining - v_debit_from_plan
    WHERE id = p_user_id;
  END IF;

  -- Deduct remainder from topups FIFO (oldest created_at first), with row lock
  IF v_remaining > 0 THEN
    FOR v_topup IN
      SELECT id, credits_remaining
      FROM credit_topups
      WHERE user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > NOW())
        AND credits_remaining > 0
      ORDER BY created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_topup_deduct     := LEAST(v_remaining, v_topup.credits_remaining);
      UPDATE credit_topups
      SET credits_remaining = credits_remaining - v_topup_deduct
      WHERE id = v_topup.id;
      v_remaining        := v_remaining - v_topup_deduct;
      v_debit_from_topup := v_debit_from_topup + v_topup_deduct;
    END LOOP;
  END IF;

  -- Determine source label
  IF v_debit_from_plan > 0 AND v_debit_from_topup > 0 THEN
    v_source := 'mixed';
  ELSIF v_debit_from_topup > 0 THEN
    v_source := 'topup';
  ELSE
    v_source := 'plan';
  END IF;

  -- Audit log — store the split so refund_credits can route correctly
  INSERT INTO credit_transactions(
    user_id, workspace_id, amount,
    debited_plan, debited_topup,
    source, reference_type, reference_id
  )
  VALUES (
    p_user_id, p_workspace_id, p_amount,
    v_debit_from_plan, v_debit_from_topup,
    v_source, p_reference_type, p_reference_id
  );

  RETURN QUERY SELECT TRUE, v_debit_from_plan, v_debit_from_topup, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) TO service_role;

-- ── refund_credits ─────────────────────────────────────────────────────────
-- Source-aware: reads the original debit split from credit_transactions
-- and refunds plan portion to profiles, topup portion to active topup rows (LIFO).
-- Fallback: if original debit transaction not found, or all topups expired,
-- refunds entirely to plan credits.
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
  v_orig_plan    INT := 0;
  v_orig_topup   INT := 0;
  v_refund_plan  INT := 0;
  v_refund_topup INT := 0;
  v_topup_placed INT := 0;
  v_topup        RECORD;
  v_place        INT;
  v_found        BOOLEAN := FALSE;
  v_total_debited INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT TRUE, 0;
    RETURN;
  END IF;

  -- Look up the original debit transaction to determine source split
  SELECT debited_plan, debited_topup
  INTO v_orig_plan, v_orig_topup
  FROM credit_transactions
  WHERE reference_id = p_reference_id
    AND user_id = p_user_id
    AND amount > 0          -- debit rows only
  ORDER BY created_at DESC
  LIMIT 1;

  v_found := FOUND;
  v_total_debited := v_orig_plan + v_orig_topup;

  IF v_found AND v_total_debited > 0 THEN
    -- Scale split proportionally to the refund amount (handles partial refunds)
    v_refund_plan  := ROUND(p_amount::NUMERIC * v_orig_plan  / v_total_debited);
    v_refund_topup := p_amount - v_refund_plan;  -- remainder to topup bucket
  ELSE
    -- No original transaction found — refund entirely to plan (safe fallback)
    v_refund_plan  := p_amount;
    v_refund_topup := 0;
  END IF;

  -- Refund plan credits (atomic add)
  IF v_refund_plan > 0 THEN
    UPDATE profiles
    SET heavy_credits_remaining = heavy_credits_remaining + v_refund_plan
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 0;
      RETURN;
    END IF;
  END IF;

  -- Refund topup credits: distribute LIFO to active topup rows
  -- (most recently created active topup gets credits back first)
  IF v_refund_topup > 0 THEN
    FOR v_topup IN
      SELECT id
      FROM credit_topups
      WHERE user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC   -- LIFO for refunds
      FOR UPDATE
    LOOP
      EXIT WHEN v_topup_placed >= v_refund_topup;
      v_place := v_refund_topup - v_topup_placed;
      UPDATE credit_topups
      SET credits_remaining = credits_remaining + v_place
      WHERE id = v_topup.id;
      v_topup_placed := v_topup_placed + v_place;
    END LOOP;

    -- Fallback: if no active topups exist (all expired), credit to plan instead
    IF v_topup_placed < v_refund_topup THEN
      UPDATE profiles
      SET heavy_credits_remaining = heavy_credits_remaining + (v_refund_topup - v_topup_placed)
      WHERE id = p_user_id;
    END IF;
  END IF;

  -- Audit log (negative amount = refund)
  INSERT INTO credit_transactions(
    user_id, workspace_id, amount,
    debited_plan, debited_topup,
    source, reference_type, reference_id
  )
  VALUES (
    p_user_id, p_workspace_id, -p_amount,
    v_refund_plan, v_refund_topup,
    'plan', p_reference_type, p_reference_id
  );

  RETURN QUERY SELECT TRUE, p_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) TO service_role;
