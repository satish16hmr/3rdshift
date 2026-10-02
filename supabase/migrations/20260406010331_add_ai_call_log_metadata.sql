-- Add metadata and task_id columns to ai_call_log
-- Used to log full details of external API calls (Serper, Apollo, fal.ai)
-- without exposing stack details to customers

ALTER TABLE ai_call_log
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS task_id uuid;

-- Index for fast task-based lookup in admin dashboard
CREATE INDEX IF NOT EXISTS idx_ai_call_log_task_id ON ai_call_log(task_id);
