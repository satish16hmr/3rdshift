-- Phase 1 close-out: prod policy cleanup
-- Applied after Phase 1+1.5 v2 deploy — three findings from policy audit
-- See: docs/audit-prod-policy-cleanup-2026-04-27.md

-- F1: users UPDATE policy — unnecessary, all auth writes via service role
DROP POLICY IF EXISTS "Users can update their own profile." ON users;

-- F2: user_alerts FOR ALL → SELECT only
-- Writes confirmed service-role-only: execute-task uses createBrowserClient(SERVICE_ROLE_KEY)
DROP POLICY IF EXISTS "user_alerts_own" ON user_alerts;
CREATE POLICY "user_alerts_select"
  ON user_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- F3: user_notification_reads FOR ALL → SELECT only
-- Writes confirmed service-role-only: user-alerts/route.ts uses createClient(SERVICE_ROLE_KEY)
DROP POLICY IF EXISTS "user_notification_reads_own" ON user_notification_reads;
CREATE POLICY "user_notification_reads_select"
  ON user_notification_reads FOR SELECT
  USING (auth.uid() = user_id);

-- F6: tasks stale policy names (already dropped in prod during deploy, no-ops here)
DROP POLICY IF EXISTS "Users create own tasks" ON tasks;
DROP POLICY IF EXISTS "Users read own tasks" ON tasks;
