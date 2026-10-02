-- Platform Hardening: Task 1, 3, 4 columns
-- 2026-04-21

-- Task 1: refund_applied — prevents double-refund in auto-refund sweep
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS refund_applied boolean DEFAULT false;

-- Task 3: output_status — 'complete' | 'potentially_truncated'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_status text DEFAULT 'complete';

-- Task 4: task_type already exists (was defaulting to 'light') — no schema change needed,
-- fixed at insert time in page.jsx

-- Index for refund sweep query (failed + credits_charged > 0 + not refunded)
CREATE INDEX IF NOT EXISTS idx_tasks_refund_sweep
  ON tasks (status, credits_charged, refund_applied, created_at)
  WHERE status = 'failed' AND credits_charged > 0 AND refund_applied = false;
