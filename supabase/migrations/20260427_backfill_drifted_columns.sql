-- =============================================================
-- Backfill: Columns Present in Prod But Missing from Migrations
-- Created: 2026-04-27
-- Author: Roger (audit T2A-1 resolution — column drift)
--
-- Schema extracted from prod 2026-04-27 by JR via Supabase SQL editor.
-- Authoritative queries:
--   Query C  Drifted column definitions (5 columns)
--   Query D  FK delete rules (all NO ACTION → workspaces.id)
--   Query E  Indexes on drifted columns (4 of 5 — pinned_workers has none)
--
-- All statements idempotent. Safe to re-run.
-- This migration is a no-op for brand_profile.workspace_id (already added
-- inline to rls-fix-test branch during initial backfill apply); the migration
-- file is the durable fix that ships to prod later.
--
-- NOTE: Roger flagged worker_slug on team_chat_messages and team_member_memories
-- as drifted. Verified against prod — those columns DO NOT exist on either
-- table. Both tables use member_id (TEXT) for worker identification. No
-- worker_slug migration needed.
-- =============================================================

-- 1. brand_profile.workspace_id
ALTER TABLE brand_profile
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

CREATE INDEX IF NOT EXISTS idx_brand_profile_workspace
  ON brand_profile(workspace_id);

-- 2. pinned_workers.workspace_id  (no index in prod)
ALTER TABLE pinned_workers
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

-- 3. tasks.workspace_id
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace
  ON tasks(workspace_id);

-- 4. team_chat_messages.workspace_id
ALTER TABLE team_chat_messages
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

CREATE INDEX IF NOT EXISTS idx_team_chat_messages_workspace
  ON team_chat_messages(workspace_id);

-- 5. team_member_memories.workspace_id
ALTER TABLE team_member_memories
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

CREATE INDEX IF NOT EXISTS idx_team_member_memories_workspace
  ON team_member_memories(workspace_id);
