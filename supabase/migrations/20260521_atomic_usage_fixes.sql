-- Atomic usage helpers for task/chat billing safety.

CREATE OR REPLACE FUNCTION decrement_light_task_count(
  p_workspace_id UUID,
  p_amount INT DEFAULT 1
)
RETURNS TABLE(ok BOOLEAN, current_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_amount INT;
BEGIN
  v_amount := GREATEST(COALESCE(p_amount, 1), 0);

  UPDATE workspaces
  SET light_task_count = GREATEST(light_task_count - v_amount, 0)
  WHERE id = p_workspace_id
  RETURNING light_task_count INTO v_count;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count;
END;
$$;

REVOKE ALL ON FUNCTION decrement_light_task_count(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decrement_light_task_count(UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION increment_chat_rate_limit(
  p_user_id UUID,
  p_member_id TEXT,
  p_window_type TEXT,
  p_window_start TIMESTAMPTZ,
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
  INSERT INTO chat_rate_limits (
    user_id,
    member_id,
    window_type,
    window_start,
    msg_count,
    updated_at
  )
  VALUES (
    p_user_id,
    p_member_id,
    p_window_type,
    p_window_start,
    1,
    now()
  )
  ON CONFLICT (user_id, member_id, window_type, window_start)
  DO UPDATE SET
    msg_count = chat_rate_limits.msg_count + 1,
    updated_at = now()
  RETURNING msg_count INTO v_count;

  IF v_count > p_limit THEN
    UPDATE chat_rate_limits
    SET msg_count = GREATEST(msg_count - 1, 0),
        updated_at = now()
    WHERE user_id = p_user_id
      AND member_id = p_member_id
      AND window_type = p_window_type
      AND window_start = p_window_start;
    RETURN QUERY SELECT false, p_limit, true;
  ELSE
    RETURN QUERY SELECT true, v_count, false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION increment_chat_rate_limit(UUID, TEXT, TEXT, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_chat_rate_limit(UUID, TEXT, TEXT, TIMESTAMPTZ, INT) TO service_role;

CREATE OR REPLACE FUNCTION decrement_chat_rate_limit(
  p_user_id UUID,
  p_member_id TEXT,
  p_window_type TEXT,
  p_window_start TIMESTAMPTZ,
  p_amount INT DEFAULT 1
)
RETURNS TABLE(ok BOOLEAN, current_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_amount INT;
BEGIN
  v_amount := GREATEST(COALESCE(p_amount, 1), 0);

  UPDATE chat_rate_limits
  SET msg_count = GREATEST(msg_count - v_amount, 0),
      updated_at = now()
  WHERE user_id = p_user_id
    AND member_id = p_member_id
    AND window_type = p_window_type
    AND window_start = p_window_start
  RETURNING msg_count INTO v_count;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_count;
END;
$$;

REVOKE ALL ON FUNCTION decrement_chat_rate_limit(UUID, TEXT, TEXT, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decrement_chat_rate_limit(UUID, TEXT, TEXT, TIMESTAMPTZ, INT) TO service_role;

CREATE TABLE IF NOT EXISTS blog_subscribe_rate_limits (
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, window_start)
);

CREATE OR REPLACE FUNCTION increment_blog_subscribe_rate_limit(
  p_ip_hash TEXT,
  p_window_start TIMESTAMPTZ,
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
  INSERT INTO blog_subscribe_rate_limits (ip_hash, window_start, request_count, updated_at)
  VALUES (p_ip_hash, p_window_start, 1, now())
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET
    request_count = blog_subscribe_rate_limits.request_count + 1,
    updated_at = now()
  RETURNING request_count INTO v_count;

  IF v_count > p_limit THEN
    RETURN QUERY SELECT false, p_limit, true;
  ELSE
    RETURN QUERY SELECT true, v_count, false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION increment_blog_subscribe_rate_limit(TEXT, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_blog_subscribe_rate_limit(TEXT, TIMESTAMPTZ, INT) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS credit_topups_stripe_payment_id_unique
  ON credit_topups (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL AND stripe_payment_id <> '';
