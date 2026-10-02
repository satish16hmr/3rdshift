-- Phase 7/8: Atomic workspace member insert with seat check
-- Eliminates TOCTOU race between seat count check and INSERT in workspace/join.
--
-- Returns TRUE if the member was inserted, FALSE if seats are full.
-- Uses advisory lock on workspace_id to serialize concurrent joins.

CREATE OR REPLACE FUNCTION insert_workspace_member_if_seat_available(
  p_workspace_id UUID,
  p_user_id      UUID,
  p_role         TEXT,
  p_max_seats    INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Advisory lock scoped to this workspace to serialize concurrent join attempts
  PERFORM pg_advisory_xact_lock(hashtext(p_workspace_id::text));

  SELECT count(*) INTO current_count
  FROM workspace_members
  WHERE workspace_id = p_workspace_id;

  IF current_count >= p_max_seats THEN
    RETURN FALSE;
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace_id, p_user_id, p_role);

  RETURN TRUE;
END;
$$;

-- Revoke public execute, grant only to authenticated and service_role
-- NI-C01 fix: revoke from PUBLIC and authenticated — only service_role (server code) may call this.
-- Granting to authenticated would allow any logged-in user to call the RPC directly via REST
-- with arbitrary p_workspace_id, p_user_id, p_role values, bypassing all RLS.
REVOKE ALL ON FUNCTION insert_workspace_member_if_seat_available(UUID, UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION insert_workspace_member_if_seat_available(UUID, UUID, TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION insert_workspace_member_if_seat_available(UUID, UUID, TEXT, INTEGER) TO service_role;
