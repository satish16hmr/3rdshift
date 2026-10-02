-- Phase 15 F4: Add workspace_id to custom_playbooks
-- The route already inserts workspace_id — this makes the column exist in DB.

ALTER TABLE custom_playbooks
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Backfill existing rows: set workspace_id to the user's first owned workspace (by created_at)
UPDATE custom_playbooks cp
SET workspace_id = (
  SELECT w.id
  FROM workspaces w
  WHERE w.owner_id = cp.user_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE cp.workspace_id IS NULL;

-- Index for workspace-scoped lookups
CREATE INDEX IF NOT EXISTS custom_playbooks_workspace_id_idx
  ON custom_playbooks (workspace_id);

CREATE INDEX IF NOT EXISTS custom_playbooks_user_workspace_idx
  ON custom_playbooks (user_id, workspace_id);

-- RLS: already enabled on custom_playbooks (from original migration)
-- Update RLS policies to scope by workspace membership

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage own playbooks" ON custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_select" ON custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_insert" ON custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_update" ON custom_playbooks;
DROP POLICY IF EXISTS "custom_playbooks_delete" ON custom_playbooks;

-- Members can read workspace's custom playbooks (Operator plan gated at API layer)
CREATE POLICY "custom_playbooks_select"
  ON custom_playbooks FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Only workspace owners can create/update/delete (enforced at API layer too, belt+suspenders)
CREATE POLICY "custom_playbooks_insert"
  ON custom_playbooks FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "custom_playbooks_update"
  ON custom_playbooks FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "custom_playbooks_delete"
  ON custom_playbooks FOR DELETE
  USING (user_id = auth.uid());
