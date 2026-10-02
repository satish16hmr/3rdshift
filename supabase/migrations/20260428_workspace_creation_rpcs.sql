-- ============================================================
-- Batch A: Workspace creation RPCs
-- A1: create_user_workspace — called from auth/callback after email verification
-- A2: provision_workspace_purchase — called from Stripe webhook (workspace_create branch)
-- ============================================================

-- ── A1: create_user_workspace ──────────────────────────────
-- Atomically: upserts profile + creates workspace + inserts owner membership.
-- Idempotent: if user already has any workspace_members row, returns that workspace_id.
CREATE OR REPLACE FUNCTION public.create_user_workspace(
  p_user_id    UUID,
  p_user_email TEXT,
  p_user_name  TEXT
)
RETURNS TABLE (workspace_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_workspace_id UUID;
  v_display_name TEXT;
BEGIN
  -- Idempotency: return existing workspace if user already has one
  SELECT wm.workspace_id INTO v_workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = p_user_id
  ORDER BY wm.joined_at ASC
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    RETURN QUERY SELECT v_workspace_id;
    RETURN;
  END IF;

  -- Upsert profile — auth trigger may have already created it; don't overwrite existing fields
  INSERT INTO profiles (id, email, full_name, plan)
  VALUES (
    p_user_id,
    p_user_email,
    COALESCE(NULLIF(TRIM(p_user_name), ''), 'User'),
    'none'
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = COALESCE(NULLIF(EXCLUDED.email, ''), profiles.email),
    full_name = CASE
      WHEN profiles.full_name IS NULL OR TRIM(profiles.full_name) = ''
      THEN COALESCE(NULLIF(TRIM(EXCLUDED.full_name), ''), 'User')
      ELSE profiles.full_name
    END;

  -- Workspace display name: "[Name]'s Workspace"
  v_display_name := COALESCE(NULLIF(TRIM(p_user_name), ''), 'My') || '''s Workspace';

  -- Create workspace (plan=none — Stripe checkout sets the real plan)
  INSERT INTO workspaces (
    name, owner_id, plan,
    max_seats, heavy_credits_limit, light_tasks_limit,
    billing_period_start, billing_period_end
  )
  VALUES (
    v_display_name,
    p_user_id,
    'none',
    1, 0, 0,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_workspace_id;

  -- Insert owner membership
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_user_id, 'owner');

  RETURN QUERY SELECT v_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_workspace(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_user_workspace(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_user_workspace(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_workspace(UUID, TEXT, TEXT) TO service_role;

-- ── A2: provision_workspace_purchase ──────────────────────────────────────
-- Atomically: creates workspace + inserts owner membership + updates profile entitlements.
-- Idempotent: if stripe_subscription_id already exists on a workspace row, returns early.
CREATE OR REPLACE FUNCTION public.provision_workspace_purchase(
  p_user_id            UUID,
  p_workspace_name     TEXT,
  p_plan               TEXT,
  p_heavy_credits      INT,
  p_max_seats          INT,
  p_light_tasks_limit  INT,
  p_stripe_customer_id TEXT,
  p_stripe_sub_id      TEXT,
  p_billing_cycle      TEXT DEFAULT 'annual'
)
RETURNS TABLE (workspace_id UUID, already_provisioned BOOLEAN)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_workspace_id  UUID;
  v_billing_end   TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  -- Idempotency: check if this subscription was already provisioned
  SELECT w.id INTO v_workspace_id
  FROM workspaces w
  WHERE w.stripe_subscription_id = p_stripe_sub_id
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    RETURN QUERY SELECT v_workspace_id, TRUE;
    RETURN;
  END IF;

  -- Insert workspace (this also updates an existing no-plan workspace if one exists from signup)
  -- Strategy: if user already has a workspace with plan='none', upgrade it in place.
  -- Otherwise create a new one.
  SELECT w.id INTO v_workspace_id
  FROM workspaces w
  WHERE w.owner_id = p_user_id AND w.plan = 'none'
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    -- Upgrade existing signup workspace in place
    UPDATE workspaces SET
      name                   = COALESCE(NULLIF(p_workspace_name, ''), name),
      plan                   = p_plan,
      stripe_subscription_id = p_stripe_sub_id,
      stripe_customer_id     = p_stripe_customer_id,
      max_seats              = p_max_seats,
      heavy_credits_limit    = p_heavy_credits,
      light_tasks_limit      = p_light_tasks_limit,
      billing_period_start   = NOW(),
      billing_period_end     = v_billing_end
    WHERE id = v_workspace_id;
  ELSE
    -- Create brand new workspace
    INSERT INTO workspaces (
      name, owner_id, plan,
      stripe_subscription_id, stripe_customer_id,
      max_seats, heavy_credits_limit, light_tasks_limit,
      billing_period_start, billing_period_end
    )
    VALUES (
      COALESCE(NULLIF(p_workspace_name, ''), 'My Workspace'),
      p_user_id, p_plan,
      p_stripe_sub_id, p_stripe_customer_id,
      p_max_seats, p_heavy_credits, p_light_tasks_limit,
      NOW(), v_billing_end
    )
    RETURNING id INTO v_workspace_id;

    -- Insert owner membership (only needed for brand-new workspace)
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Update profile with plan + Stripe entitlements
  UPDATE profiles SET
    plan                    = p_plan,
    billing_cycle           = p_billing_cycle,
    stripe_customer_id      = p_stripe_customer_id,
    stripe_subscription_id  = p_stripe_sub_id,
    heavy_credits_remaining = p_heavy_credits,
    heavy_credits_reset_at  = v_billing_end
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_workspace_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_workspace_purchase(UUID, TEXT, TEXT, INT, INT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_workspace_purchase(UUID, TEXT, TEXT, INT, INT, INT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.provision_workspace_purchase(UUID, TEXT, TEXT, INT, INT, INT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.provision_workspace_purchase(UUID, TEXT, TEXT, INT, INT, INT, TEXT, TEXT, TEXT) TO service_role;
