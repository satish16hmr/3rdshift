# Specialist Spec — Presentation Builder

**Worker:** Mack · Presentation Builder
**Slug:** `presentation-builder`
**Category:** Design & Creative
**Modality:** Text
**Tier:** Heavy
**Credits:** 3
**Audit date:** 2026-04-19
**Audit commit:** TBD
**Status:** Review needed

---

## 1. What this worker does (elevator pitch)

Mack builds full slide decks as downloadable PowerPoint files.

## 2. Target user

- **Primary use case:** TBD — see smoke test output
- **Secondary use cases:** TBD
- **NOT a good fit for:** TBD

## 3. Freelancer benchmark

- **Fiverr equivalent:** TBD
- **Upwork equivalent:** TBD
- **Typical turnaround with a human:** TBD
- **3rdShift turnaround:** 15–60 seconds

## 4. Differentiators

TBD — quality review track.

## 5. Form spec

Observed fields on audit: 6. See worker page at presentation-builder.

## 6. Mode structure

TBD from registry/config review.

## 7. Output spec

- **Output format:** PPTX + PDF
- **Download options:** DOCX + PDF
- **Editor enabled:** TBD

## 8. System prompt quality check

- **Prompt:** Inline in configs.ts
- **Humanization:** Non-humanizable (structured output)

## 9. API pipeline

- **Primary model:** Claude Sonnet 4.6 + Serper (if research worker)
- **External APIs:** None
- **Credits:** 3
- **Abuse risk:** Low

## 10–11. Chat + Integrations

Standard — see worker page.

## 12. QA audit checklist (mechanical)

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Registry entry present | ✅ | |
| 2 | Configs.ts entry present | ✅ | |
| 3 | System prompt loads | ✅ | |
| 4 | Chat intro present | ✅ | |
| 5 | Worker card loads | ✅ | |
| 6 | Form renders (6 fields) | ✅ | |
| 7 | Smoke test output | ❌ | locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('button[type="submit"], button').filter({ hasText: /→/ }).first()
    - locator resolved to <button disabled type="button" data-disabled="" data-headlessui-state="disabled" class="relative isolate inline-flex items-baseline justify-center gap-x-2 rounded-lg border text-base/6 font-semibold px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6 focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-blue-500 data-disabled:opacity-50 *:data-[slot=icon]:-mx-0.5 *:dat…>…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    47 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms
 |
| 8 | Output format / downloads | ✅ | |
| 9 | Chat tab functions | ⚠️ | |
| 10 | Starter access correct | ⚠️ | Gated on Starter |
| 11 | Output quality | TBD | Product review track |
| 12 | Cost estimate | TBD | FA track |

**Audit outcome:** Review needed
**Fixes shipped:** None
**Fixes deferred:** Quality and cost review TBD

## 13. Sample output

See screenshots at `screenshots/v28/audit-presentation-builder/03-result.png`

## 14. Known issues

None flagged during mechanical audit.

## 15. Change log

| Date | Change | Shipment | Commit |
|---|---|---|---|
| 2026-04-19 | Initial mechanical audit | QA audit sprint | TBD |
