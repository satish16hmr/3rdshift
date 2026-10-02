-- Security hardening: OAuth/social integration tokens are service-role-only.
-- All app access goes through authenticated API routes using supabaseAdmin.

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own integrations" ON public.user_integrations;
