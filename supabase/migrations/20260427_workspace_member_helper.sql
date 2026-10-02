-- v8 RLS: SECURITY DEFINER helper for workspace membership checks
-- Created: 2026-04-27 (Phase 1 security remediation)
-- Purpose: Avoids infinite recursion when workspace_members table policies
--          reference workspace_members themselves. All workspace-scoped RLS
--          policies must use this function instead of raw subquery.

-- Revoke public execute, then grant only to authenticated role
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
