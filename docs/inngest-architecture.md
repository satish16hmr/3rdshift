# Inngest Architecture — Heavy Worker Background Jobs

## Overview

Heavy workers (those with `taskType: 'heavy'` in the registry) run AI generation that can take 2–10+ minutes. Running these synchronously on Vercel's serverless functions risks timeout at 800s under load.

**Solution:** Inngest background job queue — no duration limit, retry logic, step-level observability.

## Current Status

| Worker | Path | Status |
|--------|------|--------|
| Charlie (course-outline-builder) | Inngest | ✅ Live (pilot passed 2026-04-22) |
| Remaining 34 Heavy workers | Vercel synchronous | 📋 Rollout pending |

## Architecture Pattern (Charlie Pilot)

```
User clicks Submit
  → POST /api/tasks/create — inserts DB row (status: pending)
  → POST /api/execute-task
  → [feature flag check: USE_INNGEST_FOR_CHARLIE]
  → DB: status = queued
  → inngest.send('charlie/course.generate', { task_id, system_prompt, ... })
  → return { status: 'queued', taskId } — immediately (< 2s)

Frontend:
  → receives queued response → navigates to result page
  → result page polls DB every 10s

Inngest worker (no timeout):
  → step 1: mark-processing → DB: status = processing
  → step 2: generate → callAI() → result text
  → step 3: complete → DB: status = completed, output = text
  → step 4: notify → Resend email to user

On failure (after 2 retries):
  → charlieFailureHandler fires
  → marks task failed, refunds credits, emails user
```

## Feature Flag

```
USE_INNGEST_FOR_CHARLIE=true   → Charlie routes through Inngest
USE_INNGEST_FOR_CHARLIE=false  → Charlie uses synchronous Vercel path (fallback)
```

To enable/disable:
```bash
vercel env rm USE_INNGEST_FOR_CHARLIE production --yes
vercel env add USE_INNGEST_FOR_CHARLIE production  # enter: true or false
vercel --prod
```

## Files

| File | Purpose |
|------|---------|
| `lib/inngest/client.ts` | Inngest SDK client singleton |
| `lib/inngest/functions/charlie.ts` | charlieGenerate + charlieFailureHandler functions |
| `app/api/inngest/route.ts` | Inngest serve endpoint (GET/POST/PUT) |
| `app/api/execute-task/route.ts` | Feature flag branch (search: `USE_INNGEST_FOR_CHARLIE`) |

## Credentials

| Key | Vercel env var | Source |
|-----|---------------|--------|
| Event key | `INNGEST_EVENT_KEY` | app.inngest.com → Manage → Keys |
| Signing key | `INNGEST_SIGNING_KEY` | app.inngest.com → Manage → Signing Key |

## Heavy Worker Rollout Checklist (future)

When rolling out Inngest to a new Heavy worker:

1. Create `lib/inngest/functions/<worker>.ts` following charlie.ts pattern
2. Register function in `app/api/inngest/route.ts`
3. Add feature flag `USE_INNGEST_FOR_<WORKER>=false` to Vercel
4. Add Inngest branch in `execute-task/route.ts`
5. Test with feature flag `true` on test account
6. Flip flag, monitor for 24h
7. Add to this doc

## Activation Test Results

See [inngest-charlie-pilot-activation-2026-04-22.md](./inngest-charlie-pilot-activation-2026-04-22.md)

**Key metrics from pilot:**
- Output: 76,012 chars (vs 65K baseline — +17%)
- Runtime: ~90 seconds
- Truncation: none
- Errors: zero
