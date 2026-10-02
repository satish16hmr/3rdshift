-- Phase 2: auth_denials table for authorization failure logging
-- Records every 403 returned by requireWorkspaceRole.
-- Service-role-only reads/writes — no user-context policies.
-- Future: add SELECT policy scoped to workspace owners if UI surfacing is needed.

CREATE TABLE IF NOT EXISTS auth_denials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID,
  route TEXT NOT NULL,
  required_role TEXT NOT NULL,
  actual_role TEXT,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE auth_denials ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_denials_user ON auth_denials(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_denials_workspace ON auth_denials(workspace_id, attempted_at DESC);
