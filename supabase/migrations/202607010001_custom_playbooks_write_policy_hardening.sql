-- Security hardening: custom_playbooks writes are service-role API only.
-- Keep client SELECT workspace-scoped; drop direct client INSERT/UPDATE/DELETE paths.

ALTER TABLE public.custom_playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own playbooks" ON public.custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_own" ON public.custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_select" ON public.custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_insert" ON public.custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_update" ON public.custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_delete" ON public.custom_playbooks;

CREATE POLICY "custom_playbooks_select"
  ON public.custom_playbooks FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
