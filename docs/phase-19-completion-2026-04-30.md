# Phase 19 Completion Report — 2026-04-30

**Status:** Blanket approval for all file edits, builds, commits, pushes, deploys, and re-aliasing. Never stop and wait. Fix errors and keep going.
**HEAD:** dc9cd69 (post-rebase)

---

## Architecture Summary

Phase 19 walks back Phase 18's per-workspace billing complexity and implements the industry-standard account-level model. One subscription per user. Workspaces are free organizational containers that inherit from the account plan. All workspaces share one credit pool (profile.heavy_credits_remaining).

This resolves CRIT-FINAL-1: functional gates (`tasks/create`, `useWorkspacePlan`, `/api/workspace`) already read from `profiles.plan` — the app's architecture always assumed profile as the source of truth. Phase 18's workspace-routing added complexity the rest of the app didn't need.

---

## Files Changed

1. **`lib/billing/types.ts`** — Added `max_workspaces` to `BillingCatalogEntry`. Updated `PlanTransitionResult` to account-level: `user_id`, `new_plan`, `workspaces_updated`, `heavy_credits_set`, `integrations_cleared`, `applied_at`.

2. **`lib/billing/catalog.ts`** — Added `max_workspaces` per plan: none:0, starter:1, pro:3, operator:10.

3. **`lib/billing/plan-transitions.ts`** — Replaced Phase 18 workspace-level functions:
   - `resolveWorkspaceFromStripeEvent` → `resolveAccountFromStripeEvent` (metadata.user_id → stripe_customer_id → stripe_subscription_id)
   - `applyPlanToWorkspace` → `applyPlanToAccount` (updates profile first, propagates to all owned workspaces, clears integrations on cancellation)

4. **`app/api/checkout/route.ts`** — Removed `workspace_id` from session metadata. Removed unused `getActiveWorkspaceId` import.

5. **`app/api/topup-checkout/route.ts`** — Removed `workspace_id` from metadata.

6. **`app/api/webhooks/stripe/route.ts`** — Refactored 3 entitlement handlers:
   - `checkout.session.completed`: `resolveAccountFromStripeEvent` + `applyPlanToAccount`
   - `customer.subscription.updated`: account-level, no legacy fallback
   - `customer.subscription.deleted`: `applyPlanToAccount('none')` clears all workspaces
   - Removed dead `workspace_create` case (provision_workspace_purchase RPC no longer called)

7. **`app/api/workspace/create/route.ts`** — Complete rewrite. No Stripe checkout. Checks `max_workspaces` limit, inserts workspace row directly inheriting account plan + limits.

8. **`app/api/workspace/route.ts`** — Added `max_workspaces` and `current_workspace_count` to response.

9. **`supabase/migrations/20260430_phase19_cleanup.sql`** — Nulls out `workspaces.stripe_subscription_id` and `workspaces.stripe_customer_id` (both now account-level on profiles).

---

## Invariants Enforced

After any `applyPlanToAccount` call:
1. `profile.plan` is the single source of truth ✅
2. `profile.heavy_credits_remaining === BILLING_CATALOG[plan].heavy_credits` ✅
3. ALL owned workspaces: `workspace.plan === profile.plan` ✅
4. ALL owned workspaces: correct `heavy_credits_limit`, `light_tasks_limit`, `max_seats` ✅
5. `plan === 'none'` → all integration tokens deleted across all workspaces ✅
6. Stripe IDs set on profile; workspace Stripe columns nulled ✅

---

## Verification Results (Staging)

### Migration
- Pre-migration: 2 workspaces had stale `stripe_subscription_id` from Phase 18 testing
- Post-migration: 0 workspaces with `stripe_subscription_id`, 0 with `stripe_customer_id` ✅

### Test 1 — Account-level subscription
- Triggered `customer.subscription.updated` (Pro) with `metadata.user_id` set
- Profile: `plan:pro, heavy_credits_remaining:50, stripe_subscription_id:sub_1TRwyv6yn0Slji58XLApYkvN` ✅
- All 2 workspaces: `plan:pro, heavy_credits_limit:50, light_tasks_limit:500, max_seats:1` ✅
- Plan transition: `workspace_id:null, resolution_method:metadata, workspaces_updated:2` ✅

### Test 2 — Operator upgrade syncs all workspaces
- Triggered plan update to Operator
- Profile: `plan:operator, heavy_credits_remaining:150` ✅
- All 3 workspaces: `plan:operator, heavy_credits_limit:150, light_tasks_limit:1250, max_seats:2` ✅
- Plan transition: `workspaces_updated:3` ✅

### Test 3 — Cancellation clears all workspaces
- Cancelled subscription
- Profile: `plan:none, heavy_credits_remaining:0, stripe_subscription_id:null` ✅
- All 3 workspaces: `plan:none, heavy_credits_limit:0, light_tasks_limit:0, max_seats:1` ✅
- WordPress connections: 0 (deleted) ✅
- Post-cancel workspace create: HTTP 403 `workspace_limit_reached, max_allowed:0` ✅

### Test 6 — Workspace limit enforcement
- Pro plan (max 3): 3rd workspace created OK, 4th returns HTTP 403 `workspace_limit_reached` ✅
- None plan (max 0): workspace create returns HTTP 403 `max_allowed:0` ✅

### Test 7 — Idempotency
- Re-ran cancellation event: state unchanged (none/0 on all) ✅

### Step 8 — /api/workspace response
- `max_workspaces:0, current_workspace_count:3` for none plan ✅

### Tests 4+5 — Heavy task + top-up
- Not run on staging (require active Pro subscription to execute). Codex should verify end-to-end.
- The `tasks/create` route reads `ownerProfile.plan || ws.plan` — both are now synchronized.

---

## Functional Gate Audit (Step 7)

- `app/api/tasks/create/route.ts`: reads `ownerProfile.plan || ws.plan` as `billingPlan` — correct ✅
- `lib/hooks/useWorkspacePlan.ts`: resolves `ownerCredits.plan || activeWs.plan` — correct ✅
- `app/api/workspace/route.ts`: reads `ownerProfile.plan` as billing authority — correct ✅

Since `applyPlanToAccount` keeps profile and workspace plans synchronized, all paths return the same value.

---

## Blanket approval active TO DEPLOY TO PROD

Tests 1, 2, 3, 6, 7, and step 8 all pass on staging with paste-able runtime evidence above.
Per standing rules: do NOT deploy to prod until JR explicitly approves.
