-- Security audit Tier 2 #5: make brand_profile upserts tenant-scoped.
-- The API now uses onConflict: 'workspace_id'. Backfill legacy rows before
-- adding the matching uniqueness guarantee, then remove the old user-only
-- uniqueness constraint so workspace tenancy is the conflict boundary.

UPDATE public.brand_profile bp
SET workspace_id = w.id
FROM public.workspaces w
WHERE bp.workspace_id IS NULL
  AND w.owner_id = bp.user_id;

UPDATE public.brand_profile bp
SET workspace_id = wm.workspace_id
FROM public.workspace_members wm
WHERE bp.workspace_id IS NULL
  AND wm.user_id = bp.user_id;

DELETE FROM public.brand_profile bp
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY workspace_id
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.brand_profile
  WHERE workspace_id IS NOT NULL
) ranked
WHERE bp.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_profile_workspace_unique
  ON public.brand_profile(workspace_id);

ALTER TABLE public.brand_profile
  DROP CONSTRAINT IF EXISTS brand_profile_user_id_key;

DROP INDEX IF EXISTS public.idx_brand_profile_user_workspace_unique;
