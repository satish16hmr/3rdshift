-- Add edited_at column to tasks for tracking user edit timestamps
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_edited_at
  ON tasks(edited_at) WHERE edited_at IS NOT NULL;
