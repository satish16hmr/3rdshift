-- Phase 15 F10: Light task usage tracking per workspace
-- Adds light_task_count and light_task_period_start to workspaces table.
-- Counter is incremented atomically in tasks/create for light tasks.
-- Reset cron resets counter at each workspace's billing period anchor.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS light_task_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS light_task_period_start TIMESTAMPTZ;

-- Index for efficient reset queries (cron looks up by period_start + plan)
CREATE INDEX IF NOT EXISTS workspaces_light_task_period_idx
  ON workspaces (light_task_period_start);

-- RPC: atomically increment light_task_count and check against limit.
-- Returns: { ok: boolean, current_count: int, limit: int }
-- Called from tasks/create for light (0-credit) tasks.
CREATE OR REPLACE FUNCTION increment_light_task_count(
  p_workspace_id UUID,
  p_limit INT
)
RETURNS TABLE(ok BOOLEAN, current_count INT, hit_limit BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Lock the row and increment atomically
  UPDATE workspaces
  SET light_task_count = light_task_count + 1
  WHERE id = p_workspace_id
  RETURNING light_task_count INTO v_count;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  -- If we just went over the limit, decrement back and return hit_limit=true
  IF v_count > p_limit THEN
    UPDATE workspaces
    SET light_task_count = light_task_count - 1
    WHERE id = p_workspace_id;
    RETURN QUERY SELECT false, p_limit, true;
  ELSE
    RETURN QUERY SELECT true, v_count, false;
  END IF;
END;
$$;

-- REVOKE public access, allow service_role only
REVOKE ALL ON FUNCTION increment_light_task_count(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_light_task_count(UUID, INT) TO service_role;
