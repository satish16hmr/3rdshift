-- Team Updates: proactive worker suggestions delivered via Team Chat
-- Part of the Proactive Team Updates feature (V20)

CREATE TABLE IF NOT EXISTS team_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  worker_slug TEXT NOT NULL,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('idea', 'reminder', 'encouragement', 'alert')),
  suggestion_text TEXT NOT NULL,
  preview_text TEXT NOT NULL,
  source_data JSONB,
  chat_message_id UUID, -- FK to team_chat_messages after insertion
  read BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_team_updates_workspace ON team_updates(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_updates_user_worker ON team_updates(user_id, worker_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_updates_unread ON team_updates(workspace_id, read) WHERE read = FALSE;

-- RLS: workspace-scoped, customers can only see their own workspace's updates
ALTER TABLE team_updates ENABLE ROW LEVEL SECURITY;

-- Customers can read their own workspace's suggestions
CREATE POLICY "team_updates_read_own_workspace"
  ON team_updates FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE owner_id = auth.uid()
         OR id IN (
           SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
         )
    )
  );

-- Customers can update read/dismissed on their own workspace's suggestions
CREATE POLICY "team_updates_update_own_workspace"
  ON team_updates FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE owner_id = auth.uid()
         OR id IN (
           SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
         )
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces
      WHERE owner_id = auth.uid()
         OR id IN (
           SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
         )
    )
  );

-- Service role (cron) can insert
-- (Service role bypasses RLS by default — no additional policy needed)

-- Settings: store per-user team updates preferences in profiles
-- Add team_updates_settings JSONB column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_updates_settings JSONB DEFAULT '{
  "enabled": true,
  "frequency": "few_times_weekly",
  "worker_overrides": {}
}'::jsonb;

-- Track which customers have been "activated" for proactive updates
-- Activation: signed up 7+ days ago AND completed 3+ tasks
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_updates_activated BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_updates_activated_at TIMESTAMPTZ;
