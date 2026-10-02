-- Phase 1.5 v2 RLS — Security Remediation
-- Applied: 2026-04-27 on branch rls-fix-test (nwouqhjndtouyizixvtn)
-- All SQL tested adversarially on non-prod branch before capture.
-- Apply to prod only after JR sign-off and T1-T33 full suite passing.
-- Code gates: CC1 (founding-checkout) and CC2 (founding-link) migrated to service role first.

-- ─── Group B: credit_topups — user-self SELECT policy ───────────────────────
ALTER TABLE credit_topups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own topups" ON credit_topups;
DROP POLICY IF EXISTS "credit_topups_select_own" ON credit_topups;
CREATE POLICY "credit_topups_select_own"
  ON credit_topups FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Group C: 9 verify-and-fix tables — FOR ALL → FOR SELECT ────────────────
-- All writes confirmed service-role-only. UPDATE policies dropped per Option A.

-- agent_mode_notifications: SELECT only
-- Executor writes via service role (createAdminClient). Mark-read computed server-side.
ALTER TABLE agent_mode_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON agent_mode_notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON agent_mode_notifications;
DROP POLICY IF EXISTS "agent_mode_notifications_select" ON agent_mode_notifications;
DROP POLICY IF EXISTS "agent_mode_notifications_update" ON agent_mode_notifications;
CREATE POLICY "agent_mode_notifications_select"
  ON agent_mode_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- credit_alert_state: SELECT only
ALTER TABLE credit_alert_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users CRUD own alert state" ON credit_alert_state;
DROP POLICY IF EXISTS "credit_alert_state_own" ON credit_alert_state;
DROP POLICY IF EXISTS "credit_alert_state_select" ON credit_alert_state;
CREATE POLICY "credit_alert_state_select"
  ON credit_alert_state FOR SELECT
  USING (auth.uid() = user_id);

-- chat_rate_limits: SELECT only
ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own rate limits" ON chat_rate_limits;
DROP POLICY IF EXISTS "chat_rate_limits_own" ON chat_rate_limits;
DROP POLICY IF EXISTS "chat_rate_limits_select" ON chat_rate_limits;
CREATE POLICY "chat_rate_limits_select"
  ON chat_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- chat_conversation_summaries: service-role-only (USING false blocks all user-context access)
ALTER TABLE chat_conversation_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON chat_conversation_summaries;
DROP POLICY IF EXISTS "chat_summaries_service_only" ON chat_conversation_summaries;
CREATE POLICY "chat_summaries_service_only"
  ON chat_conversation_summaries FOR ALL
  USING (false);

-- team_updates: SELECT only, workspace-scoped via is_workspace_member() helper (per F30)
-- Mark-read and dismiss via /api/team-updates PATCH (supabaseAdmin) — confirmed.
ALTER TABLE team_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_updates_read_own_workspace" ON team_updates;
DROP POLICY IF EXISTS "team_updates_update_own_workspace" ON team_updates;
DROP POLICY IF EXISTS "team_updates_select" ON team_updates;
DROP POLICY IF EXISTS "team_updates_update_own" ON team_updates;
CREATE POLICY "team_updates_select"
  ON team_updates FOR SELECT
  USING (
    auth.uid() = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );

-- scheduled_tasks: SELECT only
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own schedules" ON scheduled_tasks;
DROP POLICY IF EXISTS "scheduled_tasks_own" ON scheduled_tasks;
DROP POLICY IF EXISTS "scheduled_tasks_select" ON scheduled_tasks;
CREATE POLICY "scheduled_tasks_select"
  ON scheduled_tasks FOR SELECT
  USING (auth.uid() = user_id);

-- worker_memory: SELECT only (no workspace_id column — user_id only)
ALTER TABLE worker_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own memory" ON worker_memory;
DROP POLICY IF EXISTS "worker_memory_own" ON worker_memory;
DROP POLICY IF EXISTS "worker_memory_select" ON worker_memory;
CREATE POLICY "worker_memory_select"
  ON worker_memory FOR SELECT
  USING (auth.uid() = user_id);

-- google_workspace_settings: SELECT only (no workspace_id column — user_id only)
ALTER TABLE google_workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own workspace settings" ON google_workspace_settings;
DROP POLICY IF EXISTS "google_workspace_settings_own" ON google_workspace_settings;
DROP POLICY IF EXISTS "google_workspace_settings_select" ON google_workspace_settings;
CREATE POLICY "google_workspace_settings_select"
  ON google_workspace_settings FOR SELECT
  USING (auth.uid() = user_id);

-- custom_playbooks: SELECT only (no workspace_id column — user_id only)
ALTER TABLE custom_playbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own playbooks" ON custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_own" ON custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_select" ON custom_playbooks;
CREATE POLICY "custom_playbooks_select"
  ON custom_playbooks FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Group A: 12 service-role-only tables — RLS enable, no user policies ─────
-- Service role bypasses RLS entirely. All writes confirmed service-role-only.

-- google_workspace_tokens: drop FOR ALL user policy
ALTER TABLE google_workspace_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own google tokens" ON google_workspace_tokens;

-- zapier_webhook_subscriptions: no prior policies
ALTER TABLE zapier_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- zapier_api_keys: no prior policies
ALTER TABLE zapier_api_keys ENABLE ROW LEVEL SECURITY;

-- buffer_tokens: no prior policies
ALTER TABLE buffer_tokens ENABLE ROW LEVEL SECURITY;

-- mailchimp_tokens: no prior policies
ALTER TABLE mailchimp_tokens ENABLE ROW LEVEL SECURITY;

-- notion_tokens: no prior policies
ALTER TABLE notion_tokens ENABLE ROW LEVEL SECURITY;

-- wordpress_connections: no prior policies
ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;

-- push_tokens: drop FOR ALL user policy
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_tokens_own" ON push_tokens;

-- founding_members: ENABLE RLS (was disabled) — CC1/CC2 migrated to service role first
ALTER TABLE founding_members ENABLE ROW LEVEL SECURITY;

-- system_notifications: drop SELECT policy (service-role-only)
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_notifications_read" ON system_notifications;

-- agent_mode_chains: drop FOR ALL user policy (all writes via createAdminClient confirmed)
ALTER TABLE agent_mode_chains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users CRUD own chains" ON agent_mode_chains;

-- agent_mode_runs: drop SELECT policy (all access via createAdminClient confirmed)
ALTER TABLE agent_mode_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own runs" ON agent_mode_runs;

-- ─── Group D: dead tables — RLS enable, no policies ─────────────────────────
-- Note: top_up_purchases, seat_invites, activity_log, integrations not present in branch.
-- workers (shadow/stale registry table): enable RLS, drop public SELECT policy.
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON workers;
