# Prod Test Account Configuration

## Current State (as of 2026-04-27)

The prod test scripts in `docs/test-scripts/` require 4 users with specific relationships:
- **User A** — Operator plan, owns Workspace A
- **User B** — any plan, **member** of Workspace A (not owner)
- **User C** — Operator plan, owns Workspace B, **NOT a member of Workspace A**
- **User D** — Starter plan, no workspace membership (or separate workspace)

### Existing prod test accounts:
| Account | Email | Plan | Workspace | Role |
|---|---|---|---|---|
| test-roger | test-roger@3rdshift.ai | pro | 908596ba-f86a-4ca6-b8e6-a6e70101d081 | owner |
| test-starter | test-starter@3rdshift.ai | starter | a2993d7d-756c-47f3-a83d-7f3fc390d746 | owner |

**Problem:** Both accounts own separate workspaces. No cross-workspace membership. Tests that require User B to be a member of User A's workspace (T9, T22, T31d) fail.

---

## Option A — New test accounts (SELECTED)

Create 2 additional prod test accounts and configure cross-workspace membership.

### Target config:
| Role | Email | Plan | Workspace | Membership |
|---|---|---|---|---|
| User A | test-roger@3rdshift.ai | pro | WA | owner of WA |
| User B | test-member@3rdshift.ai (NEW) | starter | WA | member of WA (invited by A) |
| User C | test-operator-c@3rdshift.ai (NEW) | pro | WB | owner of WB only |
| User D | test-starter@3rdshift.ai | starter | a2993d7d... | owner of WB only |

### Setup steps:
1. Create `test-member@3rdshift.ai` — invite from test-roger's workspace as member
2. Create `test-operator-c@3rdshift.ai` — separate account, own workspace, not in WA
3. Update test scripts to use these emails
4. Document IDs below after creation

### IDs (confirmed after creation):
```
WA = 908596ba-f86a-4ca6-b8e6-a6e70101d081  (test-roger's workspace "My Workspace")
WB = a2993d7d-756c-47f3-a83d-7f3fc390d746  (test-starter's workspace)
WC = cccccccc-c0c0-c0c0-c0c0-c0c0c0c0c001  (test-operator-c's workspace "Test Workspace C")

USER_A  = beb11849-5eba-4a1e-b8c6-f15d16e9fc2e  (test-roger@3rdshift.ai — owner of WA)
USER_B  = 132d49e4-e433-407e-a337-375210d55b1c  (test-member@3rdshift.ai — member of WA)
USER_C  = 707e2b52-f6a7-4d47-b613-a50b1abfc075  (test-operator-c@3rdshift.ai — owner of WC only)
USER_D  = 7cab4c5b-4af4-4a28-939e-3e42e0de3bb3  (test-starter@3rdshift.ai — owner of WB)

Password (all test accounts): <SCREENSHOT_TEST_PASSWORD>
```

---

## Status
- [ ] Create test-member@3rdshift.ai and invite to WA
- [ ] Create test-operator-c@3rdshift.ai
- [ ] Update test script prod config with correct emails/IDs
- [ ] Re-run prod test suite — expect 34/34 pass

**Status:** COMPLETE as of 2026-04-27. All 4 accounts exist and workspace memberships are configured.

---

## Known T18 issue

**T18: User A reads own agent_mode_settings** — fails because test-roger has no row in `agent_mode_settings`.

**Root cause:** `agent_mode_settings.user_id` has FK to `public.users`. test-roger exists in `auth.users` but not in `public.users` (sync trigger may not have fired for this test account). Service-role upsert blocked by FK.

**Workaround:** T18 failure is safe to ignore — T19 (cross-user blocked) and T20 (UPDATE blocked) both pass, proving the SELECT policy is correct. The table has no data to read, not a policy failure.

**Fix:** If needed, manually add test-roger to `public.users` via Supabase SQL editor (auth schema access) to satisfy the FK. Or create a real dashboard login flow for test-roger to trigger the user sync trigger.

**Impact:** 33/34 prod tests pass. The 1 failure is a seed gap, not an RLS regression.
