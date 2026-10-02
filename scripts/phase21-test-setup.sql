-- ════════════════════════════════════════════════════════════════
-- PHASE 21 — STAGING TEST SETUP SQL
-- Run each block immediately before its corresponding test.
-- All blocks use email lookup so no hardcoded UUIDs needed.
-- ════════════════════════════════════════════════════════════════


-- ── TESTS 21-1, 21-2, 21-4 SETUP ────────────────────────────────
-- Profile in resolution state. Plan stays 'pro' so plan gate passes;
-- only the resolution gate blocks.

UPDATE profiles
SET
  plan                          = 'pro',
  requires_workspace_resolution = true,
  resolution_target_plan        = 'pro',
  resolution_excess_count       = 2
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');


-- ── TEST 21-3 SETUP ──────────────────────────────────────────────
-- Owner (test-roger) stays in resolution from block above.
-- Add test-starter as a member of one of owner's workspaces.
-- Gate must fire on test-starter's request because OWNER is in resolution.

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT
  w.id,
  (SELECT id FROM auth.users WHERE email = 'test-starter@3rdshift.ai'),
  'member'
FROM workspaces w
WHERE w.owner_id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai')
ORDER BY w.created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;


-- ── TEST 21-5 SETUP ──────────────────────────────────────────────
-- Resolution set with excess=1 so ONE workspace deletion clears it.

UPDATE profiles
SET
  requires_workspace_resolution = true,
  resolution_target_plan        = 'pro',
  resolution_excess_count       = 1
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');


-- ── TEST 21-5 TEARDOWN (run AFTER gate clears + task succeeds) ───
-- Restore full operator state for subsequent tests.

UPDATE profiles
SET
  plan                          = 'operator',
  requires_workspace_resolution = false,
  resolution_target_plan        = null,
  resolution_excess_count       = null,
  heavy_credits_remaining       = 150
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');


-- ── TEST 21-6 SETUP ──────────────────────────────────────────────
-- Pro profile, credits partially consumed (20 remaining).
-- One active top-up: 25 credits_remaining.
-- Expected after invoice.paid: 50 (plan) + 25 (topup) = 75.

DELETE FROM credit_topups
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');

UPDATE profiles
SET
  plan                          = 'pro',
  heavy_credits_remaining       = 20,
  requires_workspace_resolution = false,
  resolution_target_plan        = null,
  resolution_excess_count       = null
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');

INSERT INTO credit_topups
  (user_id, pack_name, credits_purchased, credits_remaining, price_paid, stripe_payment_id, expires_at)
SELECT
  id,
  'test-pack-21-6',
  50,
  25,
  4900,
  'pi_test_21_6',
  NULL
FROM auth.users
WHERE email = 'test-roger@3rdshift.ai';


-- ── TEST 21-7 SETUP ──────────────────────────────────────────────
-- Pro profile, credits partially consumed (20 remaining).
-- No active top-ups. Expected after invoice.paid: 50 exactly.

DELETE FROM credit_topups
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');

UPDATE profiles
SET
  plan                          = 'pro',
  heavy_credits_remaining       = 20,
  requires_workspace_resolution = false,
  resolution_target_plan        = null,
  resolution_excess_count       = null
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');


-- ── TEST 21-8 SETUP ──────────────────────────────────────────────
-- Operator profile, credits partially consumed (80 of 150 remaining).
-- Two active top-ups: 25 + 50. Expected after invoice.paid: 150 + 25 + 50 = 225.

DELETE FROM credit_topups
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');

UPDATE profiles
SET
  plan                          = 'operator',
  heavy_credits_remaining       = 80,
  requires_workspace_resolution = false,
  resolution_target_plan        = null,
  resolution_excess_count       = null
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');

INSERT INTO credit_topups
  (user_id, pack_name, credits_purchased, credits_remaining, price_paid, stripe_payment_id, expires_at)
SELECT id, 'test-pack-21-8a', 25, 25, 2400, 'pi_test_21_8a', NULL
  FROM auth.users WHERE email = 'test-roger@3rdshift.ai'
UNION ALL
SELECT id, 'test-pack-21-8b', 50, 50, 4900, 'pi_test_21_8b', NULL
  FROM auth.users WHERE email = 'test-roger@3rdshift.ai';


-- ── POST-TEST-21-8 TEARDOWN ──────────────────────────────────────
-- Restore clean operator state after all tests complete.

DELETE FROM credit_topups
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai')
  AND stripe_payment_id LIKE 'pi_test_21_%';

UPDATE profiles
SET
  plan                          = 'operator',
  heavy_credits_remaining       = 150,
  requires_workspace_resolution = false,
  resolution_target_plan        = null,
  resolution_excess_count       = null
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-roger@3rdshift.ai');
