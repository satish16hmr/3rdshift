-- C-2 remediation: make task credit debits idempotent at the ledger/RPC layer.
--
-- App routes now call debit_credits from both creation and execution paths so a
-- direct /api/execute-task call for a legacy/unreserved task is charged before
-- provider spend, while retries of an already-reserved task are no-ops.
-- This function preserves the existing signature and return shape.

CREATE OR REPLACE FUNCTION public.debit_credits(p_user_id uuid, p_amount integer, p_reference_id text, p_reference_type text, p_workspace_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(ok boolean, debited_plan integer, debited_topup integer, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_credits     INT;
  v_debit_from_plan  INT;
  v_debit_from_topup INT := 0;
  v_remaining        INT;
  v_topup            RECORD;
  v_topup_deduct     INT;
  v_source           TEXT;
  v_topup_total      INT := 0;
  v_existing_amount  INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT TRUE, 0, 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Lock the billing row first. This serializes all debits for the same account,
  -- including concurrent retries for the same task reference.
  SELECT heavy_credits_remaining INTO v_plan_credits
  FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 0, 'user_not_found'::TEXT;
    RETURN;
  END IF;

  -- Idempotency: if this task/chain/section already has a positive debit, do
  -- not charge again. A different amount for the same reference is a caller bug.
  SELECT amount INTO v_existing_amount
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND reference_id = p_reference_id
    AND reference_type = p_reference_type
    AND amount > 0
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_amount = p_amount THEN
      RETURN QUERY SELECT TRUE, 0, 0, NULL::TEXT;
    ELSE
      RETURN QUERY SELECT FALSE, 0, 0, 'duplicate_reference'::TEXT;
    END IF;
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
    UPDATE profiles
    SET heavy_credits_remaining = heavy_credits_remaining - v_debit_from_plan
    WHERE id = p_user_id;
  END IF;

  IF v_remaining > 0 THEN
    FOR v_topup IN
      SELECT id, credits_remaining FROM credit_topups
      WHERE user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > NOW())
        AND credits_remaining > 0
      ORDER BY purchased_at ASC, id ASC FOR UPDATE
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
$function$;

REVOKE ALL ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.debit_credits(uuid, integer, text, text, uuid) TO service_role;

-- One-time de-dup needed before adding the idempotency index.
-- Production check on 2026-07-03 found only internal test-account duplicates,
-- all reference_type='chain_step' and all duplicate debit allocations were plan
-- credits (duplicate debited_topup = 0). Keep the earliest ledger row for each
-- positive debit reference, restore the duplicate plan debits to profiles, then
-- delete the later duplicate ledger rows.
DO $$
BEGIN
  IF EXISTS (
    WITH ranked AS (
      SELECT
        id,
        debited_topup,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, reference_type, reference_id
          ORDER BY created_at ASC, id ASC
        ) AS rn
      FROM public.credit_transactions
      WHERE amount > 0
        AND reference_id IS NOT NULL
    )
    SELECT 1
    FROM ranked
    WHERE rn > 1
      AND COALESCE(debited_topup, 0) <> 0
  ) THEN
    RAISE EXCEPTION 'Duplicate positive debit rows include top-up debits; restore affected credit_topups manually before creating credit_transactions_debit_unique.';
  END IF;
END $$;

WITH ranked AS (
  SELECT
    id,
    user_id,
    reference_type,
    reference_id,
    amount,
    debited_plan,
    debited_topup,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, reference_type, reference_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.credit_transactions
  WHERE amount > 0
    AND reference_id IS NOT NULL
), duplicate_plan_refunds AS (
  SELECT
    user_id,
    SUM(COALESCE(debited_plan, 0))::integer AS credits_to_restore
  FROM ranked
  WHERE rn > 1
  GROUP BY user_id
), restored_profiles AS (
  UPDATE public.profiles p
  SET heavy_credits_remaining = COALESCE(p.heavy_credits_remaining, 0) + d.credits_to_restore
  FROM duplicate_plan_refunds d
  WHERE p.id = d.user_id
    AND d.credits_to_restore > 0
  RETURNING p.id AS user_id, d.credits_to_restore
), deleted_duplicates AS (
  DELETE FROM public.credit_transactions ct
  USING ranked r
  WHERE ct.id = r.id
    AND r.rn > 1
  RETURNING ct.id, ct.user_id, ct.reference_type, ct.reference_id, ct.amount, ct.debited_plan, ct.debited_topup
)
SELECT
  (SELECT COUNT(*) FROM deleted_duplicates) AS duplicate_ledger_rows_deleted,
  (SELECT COALESCE(SUM(COALESCE(debited_plan, 0)), 0) FROM deleted_duplicates) AS plan_credits_restored,
  (SELECT COALESCE(SUM(COALESCE(debited_topup, 0)), 0) FROM deleted_duplicates) AS topup_credits_deleted_not_restored,
  (SELECT COUNT(*) FROM restored_profiles) AS profiles_corrected;

-- Verification after de-dup: must return zero rows.
-- SELECT user_id, reference_type, reference_id, COUNT(*) AS duplicate_count
-- FROM public.credit_transactions
-- WHERE amount > 0
--   AND reference_id IS NOT NULL
-- GROUP BY user_id, reference_type, reference_id
-- HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_debit_unique
  ON public.credit_transactions (user_id, reference_id, reference_type)
  WHERE amount > 0 AND reference_id IS NOT NULL;
