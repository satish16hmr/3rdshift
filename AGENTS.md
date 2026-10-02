# AGENTS.md — 3rdShift Codebase Rules for AI Agents

This file is read at the start of every Codex session. These rules guide AI agent behavior. JR (Josh Rager) is the sole owner and can override any rule with a direct instruction.

## Project context

3rdShift is an AI workforce SaaS platform (Next.js, Tailwind, Supabase, Stripe, Inngest, Vercel) targeting May 15 2026 launch. Solo founder. Pre-launch sprint. Production has live users coming soon. Live database is shared between staging and prod web apps — there is no real DB isolation. Treat every change as touching production data.

## Rule 1 — Blanket Execution Approval

Blanket approval for all file edits, builds, commits, pushes, deploys, and re-aliasing. Never stop and wait. Fix errors and keep going.

## Rule 2 — Fix Unexpected Failures

When any test fails, any command errors unexpectedly, or any output deviates from what you predicted: diagnose it, fix it, rerun the relevant checks, and keep going. Report what happened after the task is handled.

## Rule 3 — Verify form fields BEFORE writing test scripts

Worker form fields live in lib/workers/[slug]/configs.ts. Read the actual config file before writing any test that POSTs to /api/tasks/create. Do not assume field names. Do not infer from the worker's behavior. Open the file, list the fields, then write the test.

## Rule 4 — Database evidence on every billing/credit test

For any test that touches credit_transactions, profiles.heavy_credits_remaining, plan_credit_grants, credit_topups, stripe_webhook_events, or any billing column: capture the row state BEFORE the test, run the test, capture the row state AFTER. Both go in the report.

## Rule 5 — Quality grades on every output test

When testing worker output, grade A/B/C/F:
- A: matches expected structure, complete, would ship to a paying user
- B: usable but minor gaps, mention them
- C: structurally wrong or noticeably off, do not ship
- F: broken, missing, or hallucinated content

Include the grade and one-sentence justification.

## Rule 6 — Execute Without Checkpoint Gates

Before editing any file, inspect the relevant code and make a concrete plan internally. Do not stop for checkpoint approval. Implement, verify, fix errors, and keep going.

## Rule 7 — Worker Registry Changes

The worker registry (lib/workers/registry.ts and adjacent files) controls which workers exist, their slugs, plan tiers, and credit costs. Blanket approval applies to registry edits when they are required by the user’s task. Make the smallest correct change, verify behavior, and keep going.

## Rule 8 — Telegram trailing-newline pattern

When setting environment variables read by shell scripts hitting Telegram or similar APIs, always use printf, never echo.

## Rule 9 — Supabase project ref must match the service role key

Public Supabase env vars (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY) MUST belong to the same project as SUPABASE_SERVICE_ROLE_KEY. The live project ref is ytqflszzzkkriqhyrroy (3rdshift_backend). The audit_3rdshift project (jsksbcyuijwonwxpfvtx) is separate and disconnected — do NOT use it for any test that interacts with the live app.

## Rule 10 — No subagents, no parallel runs

You operate as a single agent in this session. Do not spawn subagents. Do not run parallel Codex instances against this repo.

## File scope conventions

- Workers: lib/workers/[slug]/ — configs.ts, prompt.ts, schema.ts
- Worker registry: lib/workers/registry.ts
- API routes: app/api/
- Pages: app/dashboard/, app/(marketing)/
- DB types: types/supabase.ts
- Stripe webhooks: app/api/webhooks/stripe/
- Inngest functions: lib/inngest/

## High-risk zones

- app/api/webhooks/stripe/ — billing pipeline, real money
- lib/billing/ — credit deduction logic
- lib/workers/registry.ts — worker assignments
- supabase/migrations/ — schema changes
- middleware.ts — auth gating
- .env files — never commit, never read aloud, never log

Blanket approval still applies to high-risk zones when the task requires changes there. Handle them with extra verification, but do not stop and wait.

## Verification expectations

- /api/health returns 11/11 green before any test run
- Use the codex-audit@3rdshift.ai user (operator plan, 150 credits) for authenticated tests
- Tag test rows with "[CODEX-TEST]" prefix in any free-text field where possible
- Report task_id of every row created so cleanup is possible

## Post-deploy regression protocol

After every future deploy, run this regression check:
- JARVIS concierge — ask 3 basic questions, confirm correct answers
- Billing page — load, check plan displays, click Manage Plan and Downgrade
- Cancel flow — open modal, confirm all 3 steps render correctly
- Settings page — load, check integrations render for the plan tier
- Help page — submit a test ticket via contact form
- 3 random worker forms — load form, submit task, confirm result renders
- Team Chat — send a message, confirm response
- Auth — log out, log back in, confirm dashboard loads

If any check fails after a deploy, diagnose it, fix it, redeploy, and re-test. Do not stop and wait for approval.

## Session hygiene

- Do not narrate planning steps in output. No "I'm going to check..." or "I'll now look at..." paragraphs. Just do the work and report results.
- Plan before acting. For every brief, create a numbered task list before writing any code. Track progress against the list. Do not start coding until the plan is complete.
- Keep the codebase clean. No tmp files, no dead code, no test artifacts, no unused imports, no commented-out blocks left behind. Delete any temporary files created during audits or debugging before committing. If you create a file for testing, delete it when done.
- Stay organized. Follow the existing file structure. Do not create unnecessary folders, subfolders, or files. If a file doesn't belong, don't create it.
- Before committing, run: git status and remove any files that shouldn't be in the repo. Every commit should be clean.

## Communication style

- Direct. No hedging. No filler.
- When you don't know, say "I don't know" and ask.
- When you find something unexpected, fix it and summarize it after the task is handled.
- The user is non-technical. Explain technical findings in plain English with the technical detail in a code block below.

## Operator

Working with JR (Josh Rager), solo founder. Pushes hard, wants honesty over yes-manning. Push back when decisions look bad.
