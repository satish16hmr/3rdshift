-- Audit finding #2: add an immutable server-side audit trail for every
-- add_heavy_credits() mutation. This restores traceability for Stripe plan grants,
-- top-up grants, and any future manual/backend grants.

CREATE TABLE IF NOT EXISTS public.heavy_credit_grant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  balance_before INT NOT NULL,
  balance_after INT NOT NULL,
  invoked_by_role TEXT NOT NULL DEFAULT current_user,
  session_role TEXT NOT NULL DEFAULT session_user,
  auth_uid UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.heavy_credit_grant_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.heavy_credit_grant_audit_log;
CREATE POLICY "Service role only" ON public.heavy_credit_grant_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.heavy_credit_grant_audit_log FROM PUBLIC;
REVOKE ALL ON TABLE public.heavy_credit_grant_audit_log FROM anon;
REVOKE ALL ON TABLE public.heavy_credit_grant_audit_log FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.heavy_credit_grant_audit_log TO service_role;

CREATE INDEX IF NOT EXISTS heavy_credit_grant_audit_log_user_id_idx
  ON public.heavy_credit_grant_audit_log(user_id, created_at DESC);

-- Keep the existing public.add_heavy_credits(UUID, INT) API for backend callers,
-- but make the mutation row-locked and auditable.
CREATE OR REPLACE FUNCTION public.add_heavy_credits(p_user_id UUID, p_amount INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before INT;
  v_balance_after INT;
BEGIN
  SELECT heavy_credits_remaining
    INTO v_balance_before
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found for add_heavy_credits user_id=%', p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  v_balance_after := v_balance_before + COALESCE(p_amount, 0);

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
    COALESCE(p_amount, 0),
    v_balance_before,
    v_balance_after,
    current_user,
    session_user,
    auth.uid()
  );
END;
$$;

-- Preserve the security fix: service_role only.
REVOKE ALL ON FUNCTION public.add_heavy_credits(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_heavy_credits(UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION public.add_heavy_credits(UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_heavy_credits(UUID, INT) TO service_role;
