-- F6: WordPress integration workspace scoping
--
-- Problem: connect stores by user_id only; send/push read by workspace_id.
-- Write key ≠ read key → "WordPress not connected" for all users.
--
-- Fix:
-- 1. Add workspace_id column (nullable initially for backfill safety)
-- 2. Backfill: set workspace_id = user's first owned workspace
-- 3. Drop user_id UNIQUE constraint
-- 4. Add (user_id, workspace_id) UNIQUE constraint
-- 5. Make workspace_id NOT NULL after backfill

-- Step 1: Add workspace_id column (nullable)
ALTER TABLE public.wordpress_connections
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Step 2: Backfill existing rows with user's first owned workspace
UPDATE public.wordpress_connections wc
SET workspace_id = (
  SELECT w.id
  FROM workspaces w
  WHERE w.owner_id = wc.user_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE workspace_id IS NULL;

-- Step 3: Drop old user_id UNIQUE constraint (name may vary — drop both possible names)
ALTER TABLE public.wordpress_connections
  DROP CONSTRAINT IF EXISTS wordpress_connections_user_id_key;
ALTER TABLE public.wordpress_connections
  DROP CONSTRAINT IF EXISTS wordpress_connections_user_id_unique;

-- Step 4: Add composite unique constraint
ALTER TABLE public.wordpress_connections
  DROP CONSTRAINT IF EXISTS wordpress_connections_user_workspace_unique;
ALTER TABLE public.wordpress_connections
  ADD CONSTRAINT wordpress_connections_user_workspace_unique
  UNIQUE (user_id, workspace_id);

-- Step 5: Make workspace_id NOT NULL (all rows backfilled or new inserts must include it)
-- Note: rows with no workspace (user has no workspaces) will remain NULL.
-- These are edge cases and will be handled gracefully by the code.
-- We do NOT force NOT NULL here to avoid breaking orphaned rows.

-- Verification
SELECT
  COUNT(*) as total_rows,
  COUNT(workspace_id) as rows_with_workspace,
  COUNT(*) - COUNT(workspace_id) as rows_without_workspace
FROM public.wordpress_connections;
