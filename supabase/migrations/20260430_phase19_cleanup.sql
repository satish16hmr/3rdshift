-- Phase 19: Account-level billing cleanup
-- Removes per-workspace stripe_subscription_id data from Phase 18 testing.
-- Subscriptions are now account-level (on profiles table only).
-- Production has 0 customers, so this should be a no-op.
-- Run the diagnostic query first, verify the result, then apply cleanup.

-- ── Step 1: Diagnostic — identify any users with multiple subscriptions ─────
-- Expected: 0 rows (no real customers)
SELECT
  owner_id,
  COUNT(DISTINCT stripe_subscription_id) AS sub_count,
  array_agg(DISTINCT stripe_subscription_id) AS sub_ids
FROM workspaces
WHERE stripe_subscription_id IS NOT NULL
GROUP BY owner_id
HAVING COUNT(DISTINCT stripe_subscription_id) > 1;

-- ── Step 2: Null out workspace.stripe_subscription_id ────────────────────────
-- Stripe subscription IDs now live on profiles only.
-- workspaces.stripe_subscription_id becomes unused (can be dropped in a later migration).
UPDATE workspaces
  SET stripe_subscription_id = NULL
  WHERE stripe_subscription_id IS NOT NULL;

-- ── Step 3: Null out workspace.stripe_customer_id ────────────────────────────
-- stripe_customer_id is also account-level (profiles.stripe_customer_id).
UPDATE workspaces
  SET stripe_customer_id = NULL
  WHERE stripe_customer_id IS NOT NULL;

-- ── Step 4: Verify ────────────────────────────────────────────────────────────
-- Expected: 0 rows for each
SELECT COUNT(*) AS stripe_sub_ids_remaining FROM workspaces WHERE stripe_subscription_id IS NOT NULL;
SELECT COUNT(*) AS stripe_customer_ids_remaining FROM workspaces WHERE stripe_customer_id IS NOT NULL;
