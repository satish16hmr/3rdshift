-- ============================================================
-- Phase 7: Google Workspace Integration
-- 3rdShift · April 3, 2026
-- ============================================================

-- Store Google OAuth tokens per user
CREATE TABLE IF NOT EXISTS google_workspace_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  TEXT,               -- short-lived, refreshed automatically
  refresh_token TEXT NOT NULL,      -- long-lived, used to get new access tokens
  token_expiry  TIMESTAMPTZ,        -- when access_token expires
  scope         TEXT,               -- granted scopes
  connected_at  TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_tokens_user ON google_workspace_tokens(user_id);

ALTER TABLE google_workspace_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'google_workspace_tokens' AND policyname = 'Users manage own google tokens'
  ) THEN
    CREATE POLICY "Users manage own google tokens" ON google_workspace_tokens
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Track per-member auto-save preferences
CREATE TABLE IF NOT EXISTS google_workspace_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL,
  auto_save    BOOLEAN DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, member_id)
);

ALTER TABLE google_workspace_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'google_workspace_settings' AND policyname = 'Users manage own workspace settings'
  ) THEN
    CREATE POLICY "Users manage own workspace settings" ON google_workspace_settings
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
