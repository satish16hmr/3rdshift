# Worker Launch Checklist

Every new worker (Batch 2 additions, future workers) must pass all checks before shipping.

---

## Standing Rule: Deliverable output must never contain handoff language

**Non-negotiable. No exceptions.**

Worker outputs must NEVER include:
- "Route to [worker name]" instructions
- "Next steps" sections referencing other workers
- "What to do next" routing sections
- References to other 3rdShift workers by name as handoff targets
- Arrow notation (→) pointing to other workers
- "Send this to [worker]" / "Pass to [worker]" / "Continue with [worker]"
- "Keep going with [worker]" in the output body

**Why:** The "Keep going with your team" UI cards at the bottom of every result page handle worker-to-worker referrals. That IS the feature. The deliverable text stays clean and copy-paste ready.

**Enforcement:** Every system prompt must include `${NO_HANDOFF_IN_OUTPUT}` before `${DELIVERABLE_RULE}` for any worker that previously had routing language, and any strategy worker that might be tempted to add it.

---

## Standing Rule: Deliverable output must be copy-paste clean

Deliverables ship to users who copy them directly into their work. Any meta-content in the output creates friction:
- No preamble ("Here's your [deliverable]:")
- No word counts in output text
- No "Let me know if you need revisions"
- No meta-commentary about structure choices
- No trailing "I hope this helps!" sign-offs
- The output IS the deliverable — nothing before it, nothing after

---

## Standing Rule: Platform compliance requirements

For commercial copy workers (Dex, Ellis, Finch, etc.):
1. A forcing field for specificity (anti-generic input guard)
2. A specific-buyer field (one person, not demographic)
3. A hero benefit / hero outcome field (single sentence, required)
4. A platform/context selector that meaningfully changes output structure
5. Tone options anchored on real brand examples, not generic adjectives

---

## Standing Rule: Humanize policy

- Content workers (LinkedIn posts, social media, creative writing): `humanizeLevel: 'full'`
- Strategy/reference documents (research, guides, SOPs, market analysis): add to `NON_HUMANIZABLE_SLUGS`
- Compliance-sensitive workers (Eve for JDs, legal doc workers): add to `NON_HUMANIZABLE_SLUGS`
- Commercial copy with strict formatting (Amazon TFSD, press releases): add to `NON_HUMANIZABLE_SLUGS`

---

## Standing Rule: max_tokens right-sizing

Per Platform Reliability Audit (2026-04-22):
- Every worker's `max_tokens` must be justified by observed worst-case × 1.3
- Never copy from a neighboring worker
- `maxDuration` must be explicitly set in route file, never default
- Truncation detection must be tested with deliberate under-sized run before shipping
- Heavy workers: minimum 8,000 tokens (triggers streaming threshold)

---

## Standing Rule: Worker-to-worker handoff plumbing

For handoffs that pass long-form context (e.g., Eve JD → Dale interview questions):
- Use sessionStorage with key `handoff_context_{slug}`
- Store: `{ field_name: value, ... }`
- Read on form init, clear after read (prevents stale context)
- Convention: `storeHandoffContext(workerSlug, context)` in HandoffCards.jsx
- Document in runbook (#14 when added)

For short context (mode, single field): use URL params (`?mode=X&field=Y`).

---

## Standing Rule: Compliance-sensitive workers

Workers producing documents with legal or regulatory implications:
1. Must default to inclusive/compliant language where applicable
2. Must support compliance requirements (salary transparency, equal opportunity)
3. Must produce system-compatible output (no tables if ATS-parseable required)
4. Must NOT humanize (add to `NON_HUMANIZABLE_SLUGS`)
5. Must include structured sections that compliance teams can review

---

## Standing Rule: Pricing decision required before ship

Every new worker needs a pricing decision per `docs/worker-pricing-framework.md` before shipping:

- [ ] Output-size-to-credit mapping applied per mode (see framework table)
- [ ] Light count impact assessed (still 50+?)
- [ ] Forbidden patterns checked (no "1 Light + all Heavy")
- [ ] FA validation if margin math is unclear (if compute > 5% of expected revenue)
- [ ] Pricing documented in worker's evidence doc before ship

---

## Launch checklist per worker

- [ ] System prompt has `${NO_HANDOFF_IN_OUTPUT}` if strategy/routing-prone worker
- [ ] System prompt ends with `${DELIVERABLE_RULE}`
- [ ] Zero routing language in output structure (grep confirmed)
- [ ] Zero banned AI phrases (test confirmed)
- [ ] `max_tokens` set to worst-case × 1.3 in `lib/ai/router.ts`
- [ ] `maxDuration` explicitly set in route file
- [ ] Form has specificity-forcing fields (for commercial copy workers)
- [ ] `humanizeLevel` or `NON_HUMANIZABLE_SLUGS` correctly set
- [ ] Registry: `handoffWorkers` / `handoffWorkersByMode` registered
- [ ] `tsc --noEmit` clean
- [ ] 7+ test scenarios run with screenshots
- [ ] Evidence doc committed under `docs/specialist-rebuild-evidence/`
- [ ] No regression on other workers verified
