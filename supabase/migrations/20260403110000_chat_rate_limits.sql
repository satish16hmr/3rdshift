-- ============================================================
-- Phase 2: Chat Rate Limits Table
-- 3rdShift · April 3, 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL,
  window_type  TEXT NOT NULL,   -- "day" | "hour"
  msg_count    INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_unique
  ON chat_rate_limits(user_id, member_id, window_type, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_user
  ON chat_rate_limits(user_id, window_start DESC);

ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_rate_limits' AND policyname = 'Users manage own rate limits'
  ) THEN
    CREATE POLICY "Users manage own rate limits" ON chat_rate_limits
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
