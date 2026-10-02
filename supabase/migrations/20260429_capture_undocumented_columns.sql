-- 20260429_capture_undocumented_columns.sql
-- Captures columns that exist in production but were never shipped via a migration file.
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS).
-- Safe to apply on prod (no-op) and required for fresh DB clones to match prod schema.
--
-- Columns discovered via schema diff between prod and migration-reconstructed DB:
-- 1. agent_mode_chains.workspace_id
-- 2. agent_mode_presets.workspace_id
-- 3. brand_profile.compressed_at + compressed_profile
-- 4. custom_playbooks.workspace_id
-- 5. founding_members.stripe_session_id
-- 6. google_workspace_tokens.workspace_id
-- 7. support_requests.workspace_id
-- 8. workspace_invites: invited_by, token, accepted (replaced old inviter_id/role/status schema)

-- ── 1. agent_mode_chains.workspace_id ────────────────────────────────────────
ALTER TABLE public.agent_mode_chains
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Backfill: set workspace_id from the chain owner's first owned workspace
UPDATE public.agent_mode_chains ac
SET workspace_id = (
  SELECT w.id FROM public.workspaces w
  WHERE w.owner_id = ac.user_id
  ORDER BY w.created_at
  LIMIT 1
)
WHERE ac.workspace_id IS NULL;

-- ── 2. agent_mode_presets.workspace_id ───────────────────────────────────────
-- System presets (workspace_id IS NULL) are global; user presets are workspace-scoped.
-- Column already captured in 20260429_custom_playbooks_workspace.sql for custom_playbooks,
-- but agent_mode_presets.workspace_id was missed.
ALTER TABLE public.agent_mode_presets
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ── 3. brand_profile.compressed_at + compressed_profile ──────────────────────
ALTER TABLE public.brand_profile
  ADD COLUMN IF NOT EXISTS compressed_profile TEXT,
  ADD COLUMN IF NOT EXISTS compressed_at TIMESTAMPTZ;

-- ── 4. custom_playbooks.workspace_id ─────────────────────────────────────────
-- Already in 20260429_custom_playbooks_workspace.sql — idempotent no-op here.
ALTER TABLE public.custom_playbooks
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ── 5. founding_members.stripe_session_id ────────────────────────────────────
-- Already added in 20260428_phase13.sql — idempotent no-op here.
ALTER TABLE public.founding_members
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- ── 6. google_workspace_tokens.workspace_id ──────────────────────────────────
ALTER TABLE public.google_workspace_tokens
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ── 7. support_requests.workspace_id ─────────────────────────────────────────
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- ── 8. workspace_invites schema: add invited_by + token + accepted ────────────
-- Production refactored workspace_invites to use:
--   invited_by (NOT NULL, FK to auth.users) — replaces inviter_id
--   token (UUID, default gen_random_uuid()) — for invite URL generation
--   accepted (BOOLEAN, default false)       — replaces status='accepted'
-- The old columns (inviter_id, role, status) remain as nullable for backward compat.
ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS accepted BOOLEAN DEFAULT false;

-- Backfill invited_by from inviter_id (old column) where present
UPDATE public.workspace_invites
SET invited_by = inviter_id
WHERE invited_by IS NULL AND inviter_id IS NOT NULL;

-- Backfill accepted from status (old column) where present
UPDATE public.workspace_invites
SET accepted = (status = 'accepted')
WHERE accepted IS NULL AND status IS NOT NULL;

-- ── Verification queries ──────────────────────────────────────────────────────
SELECT 'agent_mode_chains.workspace_id' AS check,
  COUNT(*) FILTER (WHERE workspace_id IS NULL) AS missing,
  COUNT(*) AS total
FROM public.agent_mode_chains

UNION ALL

SELECT 'workspace_invites.token',
  COUNT(*) FILTER (WHERE token IS NULL) AS missing,
  COUNT(*) AS total
FROM public.workspace_invites

UNION ALL

SELECT 'brand_profile.compressed_profile',
  0 AS missing,
  COUNT(*) AS total
FROM public.brand_profile;
