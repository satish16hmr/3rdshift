-- Phase 19.5: Plan Enforcement + Downgrade Resolution Flow
-- Adds workspace resolution state to profiles for post-downgrade blocking.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS requires_workspace_resolution BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolution_target_plan TEXT,
  ADD COLUMN IF NOT EXISTS resolution_excess_count INTEGER;

-- Backfill: mark any existing accounts that are currently over-limit.
-- Covers any Codex test accounts or real users who bypassed pre-flight.
UPDATE profiles p
SET
  requires_workspace_resolution = TRUE,
  resolution_target_plan = p.plan,
  resolution_excess_count = (
    (SELECT COUNT(*) FROM workspaces w WHERE w.owner_id = p.id) -
    CASE p.plan
      WHEN 'none'     THEN 0
      WHEN 'starter'  THEN 1
      WHEN 'pro'      THEN 3
      WHEN 'operator' THEN 10
      ELSE 0
    END
  )
WHERE (SELECT COUNT(*) FROM workspaces w WHERE w.owner_id = p.id) >
  CASE p.plan
    WHEN 'none'     THEN 0
    WHEN 'starter'  THEN 1
    WHEN 'pro'      THEN 3
    WHEN 'operator' THEN 10
    ELSE 0
  END;
