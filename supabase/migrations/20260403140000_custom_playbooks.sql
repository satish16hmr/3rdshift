-- ============================================================
-- Phase 8: Custom Playbooks
-- 3rdShift · April 3, 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_playbooks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  workers      JSONB NOT NULL DEFAULT '[]',   -- same format as agent_mode_chains.workers
  schedule_days TEXT[] DEFAULT '{}',
  heavy_credits_per_run INTEGER DEFAULT 0,
  light_tasks_per_run   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_playbooks_user ON custom_playbooks(user_id);

ALTER TABLE custom_playbooks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'custom_playbooks' AND policyname = 'Users manage own playbooks'
  ) THEN
    CREATE POLICY "Users manage own playbooks" ON custom_playbooks
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
