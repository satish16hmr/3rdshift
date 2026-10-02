-- v8 RLS Lockdown — Phase 1 Security Remediation
-- Applied: 2026-04-27 on branch rls-fix-test (nwouqhjndtouyizixvtn)
-- Covers: C2–C12 (16 tables)
-- All SQL in this file was applied to the non-prod branch and tested adversarially
-- before being captured here. Apply to prod only after JR sign-off.

-- ─── C2: tasks — DROP broken FOR ALL update policy, SELECT only ──────────────
-- Dropped: "Service role update tasks" (using (true) — broken, exposed to anon)
-- Dropped: any other permissive tasks policies
-- New: tasks_select — user sees own tasks OR workspace tasks
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Service role update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_workspace_select" ON tasks;

CREATE POLICY "tasks_select"
  ON tasks FOR SELECT
  USING (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );

-- ─── C3: workspaces — ENABLE RLS, SELECT for members ────────────────────────
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
CREATE POLICY "workspaces_select"
  ON workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()));

-- ─── C4: workspace_members — ENABLE RLS, SELECT via SECURITY DEFINER helper ─
-- Note: cannot use raw subquery here (causes infinite recursion).
-- Uses is_workspace_member() SECURITY DEFINER helper (see companion migration).
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_select" ON workspace_members;
CREATE POLICY "workspace_members_select"
  ON workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- ─── C5: workspace_invites — ENABLE RLS, owner-only SELECT ──────────────────
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_invites_select" ON workspace_invites;
CREATE POLICY "workspace_invites_select"
  ON workspace_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invites.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
    )
  );

-- ─── C6: support_requests + account_deletion_requests — cleanup broken policies
-- Dropped broken "Service role full access" (using (true)) and "Users can create"
-- which allowed any authenticated user to INSERT. All writes now service-role-only.
DROP POLICY IF EXISTS "Service role full access" ON support_requests;
DROP POLICY IF EXISTS "Users can create support requests" ON support_requests;
DROP POLICY IF EXISTS "support_requests_select" ON support_requests;

DROP POLICY IF EXISTS "Service role full access" ON account_deletion_requests;
DROP POLICY IF EXISTS "Users can create deletion requests" ON account_deletion_requests;

-- ─── C7: agent_mode_presets — ENABLE RLS, no user policies (service-role-only) ─
ALTER TABLE agent_mode_presets ENABLE ROW LEVEL SECURITY;
-- No SELECT policies — presets are read/written by service role only (cron, chain execution)

-- ─── C8: ai_call_log — ENABLE RLS, no policies (service-role-only) ───────────
ALTER TABLE ai_call_log ENABLE ROW LEVEL SECURITY;
-- No policies — all writes are internal service-role only (callAI logging)

-- ─── C9: system_config — ENABLE RLS, no policies (service-role-only) ─────────
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
-- No policies — system configuration, never user-accessible

-- ─── C10: profiles — DROP "Users update own profile" (plan escalation exploit) ─
-- This policy allowed users to self-set plan, credits, stripe IDs.
-- All profile billing writes now go through service role only (Stripe webhook).
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- ─── C11: agent_mode_settings — DROP FOR ALL, SELECT only ────────────────────
DROP POLICY IF EXISTS "Users CRUD own settings" ON agent_mode_settings;
CREATE POLICY "agent_mode_settings_select"
  ON agent_mode_settings FOR SELECT
  USING (auth.uid() = user_id);

-- ─── C12a: brand_profile — SELECT only, workspace-scoped via helper ──────────
-- (RLS was already enabled; dropping prior FOR ALL policies)
DROP POLICY IF EXISTS "Users manage own brand profile" ON brand_profile;
DROP POLICY IF EXISTS "brand_profile_access" ON brand_profile;
CREATE POLICY "brand_profile_select"
  ON brand_profile FOR SELECT
  USING (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );

-- ─── C12b: team_chat_messages — SELECT only, workspace-scoped via helper ─────
DROP POLICY IF EXISTS "Users manage own messages" ON team_chat_messages;
DROP POLICY IF EXISTS "chat_messages_access" ON team_chat_messages;
ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_chat_messages_select"
  ON team_chat_messages FOR SELECT
  USING (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );

-- ─── C12c: team_member_memories — SELECT only, workspace-scoped via helper ───
DROP POLICY IF EXISTS "Users manage own memories" ON team_member_memories;
DROP POLICY IF EXISTS "memories_access" ON team_member_memories;
ALTER TABLE team_member_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_member_memories_select"
  ON team_member_memories FOR SELECT
  USING (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );

-- ─── C12d: worker_ratings — DROP both FOR ALL, SELECT only (personal) ────────
DROP POLICY IF EXISTS "users own their ratings" ON worker_ratings;
DROP POLICY IF EXISTS "worker_ratings_access" ON worker_ratings;
ALTER TABLE worker_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "worker_ratings_select"
  ON worker_ratings FOR SELECT
  USING (auth.uid() = user_id);

-- ─── C12e: pinned_workers — DROP existing FOR ALL, SELECT only (personal) ────
DROP POLICY IF EXISTS "pinned_workers_access" ON pinned_workers;
DROP POLICY IF EXISTS "users own their pins" ON pinned_workers;
DROP POLICY IF EXISTS "Users manage own pins" ON pinned_workers;
ALTER TABLE pinned_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pinned_workers_select"
  ON pinned_workers FOR SELECT
  USING (auth.uid() = user_id);
