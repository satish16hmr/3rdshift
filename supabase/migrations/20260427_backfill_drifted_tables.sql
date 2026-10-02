-- =============================================================
-- Backfill: Tables Present in Prod But Missing from Migrations
-- Created: 2026-04-27
-- Author: Roger (audit T2A-1 resolution)
--
-- Schema extracted from prod 2026-04-27 by JR via Supabase SQL editor.
-- Authoritative queries:
--   Q1  notion_tokens columns
--   Q2  enums
--   Q3  worker_ratings FK delete rules
--   Q4  policies on 14 drifted tables
--   Q5  indexes on 14 drifted tables (28 rows)
--   Q6  RLS enabled state on 14 drifted tables
--   Q7  worker_ratings CHECK constraint
--   Q8  workspaces full column definitions
--   Query A  FK delete rules across all 14 tables
--   Query B  Full column definitions for 11 remaining tables
--
-- All statements idempotent. Safe to re-run.
-- v8 SQL and Phase 1.5 v2 SQL run AFTER this migration.
-- =============================================================

-- ============================
-- Enum: public.task_type (Q2)
-- ============================
DO $$ BEGIN
  CREATE TYPE public.task_type AS ENUM ('light', 'heavy');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================
-- 1. users (V1 legacy, RLS enabled, 2 policies in prod)
-- Q4 policies preserved verbatim
-- ============================
CREATE TABLE IF NOT EXISTS users (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  email                 TEXT        NOT NULL UNIQUE,
  display_name          TEXT,
  subscription_tier     TEXT        NOT NULL DEFAULT 'Starter',
  heavy_tasks_remaining INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile." ON users;
CREATE POLICY "Users can view their own profile."
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON users;
CREATE POLICY "Users can update their own profile."
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- ============================
-- 2. workspaces (Q8 columns, Q6 rls=false)
-- v8 C3 will enable RLS + add SELECT policy
-- ============================
CREATE TABLE IF NOT EXISTS workspaces (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL DEFAULT 'My Workspace',
  owner_id               UUID        NOT NULL REFERENCES users(id),
  plan                   TEXT        NOT NULL DEFAULT 'starter',
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  max_seats              INTEGER     NOT NULL DEFAULT 1,
  light_tasks_limit      INTEGER     NOT NULL DEFAULT 200,
  heavy_credits_limit    INTEGER     NOT NULL DEFAULT 0,
  light_tasks_used       INTEGER     NOT NULL DEFAULT 0,
  heavy_credits_used     INTEGER     NOT NULL DEFAULT 0,
  billing_period_start   TIMESTAMPTZ,
  billing_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- ============================
-- 3. workspace_members (Q6 rls=false)
-- v8 C4 will enable RLS + add SELECT policy
-- ============================
CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id),
  role         TEXT        NOT NULL DEFAULT 'member',
  joined_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user      ON workspace_members(user_id);

-- ============================
-- 4. workspace_invites (Q6 rls=false)
-- v8 C5 will enable RLS + add SELECT policy
-- ============================
CREATE TABLE IF NOT EXISTS workspace_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  invited_by   UUID        NOT NULL REFERENCES users(id),
  token        UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted     BOOLEAN     DEFAULT false
);

-- ============================
-- 5. buffer_tokens (Q6 rls=true, Q4 no policies)
-- Phase 1.5 v2 Group A
-- NOTE Phase 8: prod has UNIQUE(user_id) but app code does upsert onConflict:'workspace_id'.
-- Schema reproduces prod as-is. App-code bug fixed in Phase 8.
-- ============================
CREATE TABLE IF NOT EXISTS buffer_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id),
  access_token TEXT        NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE buffer_tokens ENABLE ROW LEVEL SECURITY;

-- ============================
-- 6. mailchimp_tokens (Q6 rls=true, Q4 no policies)
-- Phase 1.5 v2 Group A
-- ============================
CREATE TABLE IF NOT EXISTS mailchimp_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id),
  access_token TEXT        NOT NULL,
  dc           TEXT        DEFAULT 'us1',
  login_email  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mailchimp_tokens ENABLE ROW LEVEL SECURITY;

-- ============================
-- 7. notion_tokens (Q1 columns, Q6 rls=true, Q4 no policies)
-- workspace_id is TEXT (Notion's own workspace ID), NO FK
-- Phase 1.5 v2 Group A
-- ============================
CREATE TABLE IF NOT EXISTS notion_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  access_token   TEXT        NOT NULL,
  workspace_id   TEXT,
  workspace_name TEXT,
  bot_id         TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notion_tokens ENABLE ROW LEVEL SECURITY;

-- ============================
-- 8. wordpress_connections (Q6 rls=true, Q4 no policies)
-- Phase 1.5 v2 Group A
-- ============================
CREATE TABLE IF NOT EXISTS wordpress_connections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id),
  site_url     TEXT        NOT NULL,
  username     TEXT        NOT NULL,
  app_password TEXT        NOT NULL,
  site_name    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;

-- ============================
-- 9. zapier_api_keys (Q6 rls=true, Q4 no policies)
-- Phase 1.5 v2 Group A
-- Note: Q5 shows BOTH a UNIQUE constraint and a non-unique index on api_key. Preserve both.
-- ============================
CREATE TABLE IF NOT EXISTS zapier_api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id),
  api_key      TEXT        NOT NULL UNIQUE,
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zapier_api_keys_api_key_idx ON zapier_api_keys(api_key);
CREATE INDEX IF NOT EXISTS zapier_api_keys_user_id_idx ON zapier_api_keys(user_id);

ALTER TABLE zapier_api_keys ENABLE ROW LEVEL SECURITY;

-- ============================
-- 10. zapier_webhook_subscriptions (Q6 rls=true, Q4 no policies)
-- Phase 1.5 v2 Group A
-- ============================
CREATE TABLE IF NOT EXISTS zapier_webhook_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID        REFERENCES workspaces(id),
  event        TEXT        NOT NULL DEFAULT 'task.completed',
  target_url   TEXT        NOT NULL,
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE zapier_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================
-- 11. workers (V1 stale, Q6 rls=true, Q4 1 open SELECT policy)
-- Phase 1.5 v2 Group D (dead)
-- ============================
CREATE TABLE IF NOT EXISTS workers (
  id                          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ      NOT NULL DEFAULT now(),
  name                        TEXT             NOT NULL,
  category                    TEXT             NOT NULL,
  description                 TEXT             NOT NULL,
  task_type                   public.task_type NOT NULL,
  cost_per_heavy_task_credit  INTEGER          DEFAULT 1,
  instructions                TEXT
);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON workers;
CREATE POLICY "Enable read access for all users"
  ON workers FOR SELECT
  USING (true);

-- ============================
-- 12. worker_ratings (Q6 rls=true, Q4 2 FOR ALL policies)
-- Q3 FK delete rules: user_id NO ACTION, task_id SET NULL, workspace_id NO ACTION
-- Q7 CHECK: rating between 1 and 5
-- v8 C12d will drop "users own their ratings"
-- Phase 1.5 v2 will also drop "worker_ratings_access" (added F24 finding)
-- ============================
CREATE TABLE IF NOT EXISTS worker_ratings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id),
  workspace_id UUID        REFERENCES workspaces(id),
  worker_slug  TEXT        NOT NULL,
  task_id      UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  rating       INTEGER     NOT NULL CHECK ((rating >= 1) AND (rating <= 5)),
  feedback     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_ratings_user_worker_idx
  ON worker_ratings(user_id, worker_slug, created_at DESC);

ALTER TABLE worker_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own their ratings" ON worker_ratings;
CREATE POLICY "users own their ratings"
  ON worker_ratings FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "worker_ratings_access" ON worker_ratings;
CREATE POLICY "worker_ratings_access"
  ON worker_ratings FOR ALL
  USING (
    (user_id = auth.uid())
    OR (workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    ))
  );

-- ============================
-- 13. jarvis_usage (Q6 rls=true, Q4 1 user-self SELECT policy)
-- Q5: PK is user_id (no separate id column)
-- ============================
CREATE TABLE IF NOT EXISTS jarvis_usage (
  user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  message_count        INTEGER     NOT NULL DEFAULT 0,
  last_reset_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  consecutive_refusals INTEGER     NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE jarvis_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own usage" ON jarvis_usage;
CREATE POLICY "Users can read own usage"
  ON jarvis_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ============================
-- 14. _migration_log (Q6 rls=false, Q4 no policies)
-- Phase 1.5 v2 Group E (no action — internal)
-- ============================
CREATE TABLE IF NOT EXISTS _migration_log (
  id             SERIAL      PRIMARY KEY,
  migration_name TEXT        NOT NULL,
  started_at     TIMESTAMPTZ DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  status         TEXT        DEFAULT 'started',
  rollback_notes TEXT
);
