# Specialist Spec — Market Research Analyst

**Worker:** Duncan · Market Research Analyst
**Slug:** `market-research-analyst`
**Category:** Research & Strategy
**Modality:** Text
**Tier:** Heavy
**Credits:** 2
**Audit date:** 2026-04-19
**Audit commit:** TBD
**Status:** Review needed

---

## 1. What this worker does (elevator pitch)

Duncan builds market research reports with industry sizing and competitive landscape.

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

Observed fields on audit: 4. See worker page at market-research-analyst.

## 6. Mode structure

TBD from registry/config review.

## 7. Output spec

- **Output format:** Markdown (DOCX + PDF downloads)
- **Download options:** DOCX + PDF
- **Editor enabled:** TBD

## 8. System prompt quality check

- **Prompt:** Inline in configs.ts
- **Humanization:** Full (humanize button enabled)

## 9. API pipeline

- **Primary model:** Claude Sonnet 4.6 + Serper (if research worker)
- **External APIs:** Serper
- **Credits:** 2
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
| 6 | Form renders (4 fields) | ✅ | |
| 7 | Smoke test output | ⚠️ | Output present but not marked completed |
| 8 | Output format / downloads | ✅ | |
| 9 | Chat tab functions | ✅ | |
| 10 | Starter access correct | ✅ | Gated on Starter |
| 11 | Output quality | TBD | Product review track |
| 12 | Cost estimate | TBD | FA track |

**Audit outcome:** Review needed
**Fixes shipped:** None
**Fixes deferred:** Quality and cost review TBD

## 13. Sample output

See screenshots at `screenshots/v28/audit-market-research-analyst/03-result.png`

## 14. Known issues

None flagged during mechanical audit.

## 15. Change log

| Date | Change | Shipment | Commit |
|---|---|---|---|
| 2026-04-19 | Initial mechanical audit | QA audit sprint | TBD |
