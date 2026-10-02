-- Add worker_title_at_creation column to tasks table
-- Forward-only, no backfill. Existing rows stay NULL.
-- Purpose: snapshot the worker's display title at the time the task was created,
-- so task history remains accurate even if the worker is later renamed or cut.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS worker_title_at_creation TEXT;

COMMENT ON COLUMN tasks.worker_title_at_creation IS
  'Worker display title at the time the task was created. Populated on new tasks. NULL on historical tasks (pre-April 26 2026). Render logic: prefer this snapshot; fall back to current registry title; never crash on missing slug.';
