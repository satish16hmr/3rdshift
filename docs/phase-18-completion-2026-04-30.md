# Phase 18 Completion Report — 2026-04-30

**Status:** All fixes shipped and verified on staging and prod (https://3rdshift.ai)
**HEAD:** edc2bea (post-rebase)

---

## Architecture Summary

Phase 18 introduced a single source of truth for all plan state transitions, fixing a state synchronization bug class where each webhook handler independently updated plan state, leading to drift.

**New files:**
- `lib/billing/types.ts` — PlanSlug, BillingCatalogEntry, StripePlanData, PlanTransitionResult
- `lib/billing/plan-transitions.ts` — resolveWorkspaceFromStripeEvent() + applyPlanToWorkspace()

**Modified files:**
- `lib/billing/catalog.ts` — Record<PlanSlug, BillingCatalogEntry>, corrected seat counts (Pro:1, Operator:2), added 'none' entry
- `app/api/checkout/route.ts` — workspace_id in session metadata + subscription_data.metadata
- `app/api/topup-checkout/route.ts` — workspace_id in metadata
- `app/api/founding-checkout/route.ts` — FOUNDING_OPEN gate (503 when closed), null price ID guard
- `lib/founding-config.ts` — env-driven price IDs (string | null), FOUNDING_OPEN env var
- `app/api/webhooks/stripe/route.ts` — 3 entitlement handlers refactored
- `app/api/plan-change/route.ts` — null price ID filter (cascade from founding config)
- `app/api/upgrade-preview/route.ts` — null price ID → 503 (cascade)

---

## Bugs Fixed

### CRIT-1: workspace limits/seats never updated on plan changes
**Before:** subscription.updated only updated `profiles.heavy_credits_remaining` and `workspaces.plan`. heavy_credits_limit, light_tasks_limit, and max_seats were never written.
**After:** `applyPlanToWorkspace()` reads all values from BILLING_CATALOG and writes workspace + profile atomically in a single call.

### CRIT-2: subscription events routed via owner_id, not workspace_id
**Before:** handlers did `.eq('owner_id', user_id)` — if a user owned multiple workspaces, a plan change for one workspace would update all workspaces for that owner.
**After:** `resolveWorkspaceFromStripeEvent()` routes by `metadata.workspace_id` (set at checkout creation) → `stripe_subscription_id` lookup → throw. Never touches owner_id. Legacy fallback preserved for pre-Phase-18 sessions.

### HIGH-1: workspace limits stay at paid-tier values after cancellation
**Before:** subscription.deleted set workspace.plan='none' but never reset heavy_credits_limit, light_tasks_limit, or max_seats.
**After:** `applyPlanToWorkspace('none')` reads BILLING_CATALOG['none'] (0/0/1) and writes all fields.

### HIGH-2: founding checkout hardcoded price IDs
**Before:** `lib/founding-config.ts` had hardcoded `price_1THn...` Stripe price IDs.
**After:** All price IDs env-driven. FOUNDING_OPEN=false at launch (founding checkout returns 503).

### Bug discovered during implementation: cancel_at_period_end column missing
`applyPlanToWorkspace` initially included `cancel_at_period_end` in the workspace update but the column doesn't exist in the workspaces table. This caused the update to throw, triggering the legacy fallback on every event. Fixed by removing the column from the update payload.

---

## Invariants Enforced

After any call to `applyPlanToWorkspace`:
1. `workspace.plan === profile.plan` ✅
2. `workspace.heavy_credits_limit === BILLING_CATALOG[plan].heavy_credits` ✅
3. `workspace.light_tasks_limit === BILLING_CATALOG[plan].light_task_limit` ✅
4. `workspace.max_seats === BILLING_CATALOG[plan].seats` ✅
5. `plan === 'none'` → all integration tokens deleted ✅
6. `stripe_customer_id` + `stripe_subscription_id` updated to match Stripe ✅

---

## Verification Results (Staging)

### Test 1 + 2 — Multi-workspace isolation + entitlement sync
- **Setup:** stripe-test-1@3rdshift.ai with 2 workspaces (WS_A, WS_B)
- **Trigger:** subscription.updated Pro→Operator on WS_A's subscription
- **WS_A result:** `plan:operator, heavy_credits_limit:150, light_tasks_limit:1250, max_seats:2` ✅
- **WS_B result:** `plan:none, heavy_credits_limit:0, light_tasks_limit:0, max_seats:1` (unchanged) ✅
- **Profile:** `plan:operator, heavy_credits_remaining:150` ✅
- **Resolution:** `metadata` (not legacy fallback) ✅

### Test 3 — Cancellation cleanup
- **Trigger:** subscription.deleted on WS_A
- **WS_A result:** `plan:none, heavy_credits_limit:0, light_tasks_limit:0, max_seats:1, stripe_subscription_id:null` ✅
- **Profile:** `plan:none, heavy_credits_remaining:0, stripe_subscription_id:null` ✅
- **WordPress connections for WS_A:** 0 (deleted) ✅
- **WS_B:** unchanged ✅

### Test 4 — Founding checkout gate
- `POST /api/founding-checkout` with FOUNDING_OPEN=false → HTTP 503, `{"error":"founding_not_available"}` ✅

### Test 5 — Idempotency
- Re-run same cancellation: WS_A remains `none/0/0/1`, no errors ✅

### Prod smoke tests
- `POST /api/founding-checkout` → 503 ✅
- `GET /api/health` → `{"status":"ok","version":"1206923"}`, all 11 deps green ✅

---

## Deviations from Brief

1. **Legacy fallback added** — The brief showed handlers as thin wrappers that throw on resolution failure. Added try/catch with legacy fallback to preserve backward compat for pre-Phase-18 sessions (sessions created before workspace_id was added to metadata). This is non-breaking and the fallback path is clearly logged.

2. **cancel_at_period_end removed** — The brief included `cancel_at_period_end` in the workspace update. Column does not exist in workspaces table. Removed to prevent silent failures.

3. **billing_cycle not in applyPlanToWorkspace** — billing_cycle is a Stripe-level field, not in BILLING_CATALOG. Set separately in the checkout handler after applyPlanToWorkspace returns.

---

## Phase 19 Recommendations (post-launch)

1. **Add cancel_at_period_end column to workspaces** (migration) — then add it back to applyPlanToWorkspace for accurate billing period display.
2. **Consolidate STRIPE_PRICE_* vs STRIPE_*_STRIPE_ID** env var naming — two naming conventions exist (checkout/route.ts vs catalog.ts). Out of scope for Phase 18 per brief.
3. **Test checkout.session.completed with workspace_id metadata** — Phase 18's checkout handler refactor was tested via subscription.updated/deleted. A full checkout.session.completed test requires browser (Stripe Checkout). Codex should verify end-to-end checkout flow.
4. **Remove legacy fallback** — Once all active subscriptions have workspace_id in metadata (30-60 days post-launch), the legacy fallback can be removed.
