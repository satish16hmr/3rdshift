-- Fix top-up credit RPC ordering to match the live public function signatures.
--
-- Production note: these function bodies were already live in production on
-- 2026-07-02 before this migration was committed. This migration reconciles
-- the repository with production state.
--
-- Live production signatures:
--   public.debit_credits(uuid, integer, text, text, uuid)
--     RETURNS TABLE(ok boolean, debited_plan integer, debited_topup integer, error_code text)
--   public.refund_credits(uuid, integer, text, text, uuid)
--     RETURNS TABLE(ok boolean, refunded integer, error_code text)
--
-- credit_topups uses purchased_at as its timestamp column; it does not have
-- created_at. The top-up branches must order by purchased_at so purchased credits
-- are spendable/refundable when the plan bucket is depleted.

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

CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_amount integer, p_reference_id text, p_reference_type text, p_workspace_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(ok boolean, refunded integer, error_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT debited_plan, debited_topup INTO v_orig_plan, v_orig_topup
  FROM credit_transactions
  WHERE reference_id = p_reference_id AND user_id = p_user_id AND amount > 0
  ORDER BY created_at DESC LIMIT 1;
  v_found := FOUND;
  v_total_debited := v_orig_plan + v_orig_topup;

  IF NOT v_found OR v_total_debited = 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'no_original_debit'::TEXT;
    RETURN;
  END IF;

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
      ORDER BY purchased_at DESC, id DESC FOR UPDATE
    LOOP
      EXIT WHEN v_topup_placed >= v_refund_topup;
      v_place := v_refund_topup - v_topup_placed;
      UPDATE credit_topups SET credits_remaining = credits_remaining + v_place WHERE id = v_topup.id;
      v_topup_placed := v_topup_placed + v_place;
    END LOOP;
    IF v_topup_placed < v_refund_topup THEN
      UPDATE profiles
        SET heavy_credits_remaining = heavy_credits_remaining + (v_refund_topup - v_topup_placed)
        WHERE id = p_user_id;
    END IF;
  END IF;

  INSERT INTO credit_transactions(user_id, workspace_id, amount, debited_plan, debited_topup, source, reference_type, reference_id)
  VALUES (p_user_id, p_workspace_id, -p_amount, v_refund_plan, v_refund_topup, 'plan', p_reference_type, p_reference_id);

  RETURN QUERY SELECT TRUE, p_amount, NULL::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_credits(uuid, integer, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(uuid, integer, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refund_credits(uuid, integer, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, text, uuid) TO service_role;
