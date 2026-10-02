# Slug Change Master Tracker

**Purpose:** Every slug rename, deprecation, or orphan removal on every 3rdShift worker gets logged here. No silent changes. No exceptions.

**Rule:** No slug changes hit `main` without being logged here first with a gating shipment assigned.

---

## Impact checklist (run on every slug change)

### Code
- [ ] `lib/workers/registry.ts` — registry entry slug field
- [ ] `lib/workers/configs.ts` — config entry (if pattern requires)
- [ ] System prompt file path
- [ ] `NON_HUMANIZABLE_SLUGS` list
- [ ] `DEPRECATED_SLUGS` constant
- [ ] Any hardcoded refs: `grep -r "<old-slug>" app/ lib/ components/`
- [ ] URL routes

### Database
- [ ] `tasks.worker_slug` — historical rows
- [ ] `ai_call_log.worker_slug` — historical rows
- [ ] Other Supabase tables referencing the slug

### UI / Copy
- [ ] Worker card display
- [ ] JARVIS slug map (`components/jarvis/JarvisChat.tsx`)
- [ ] Result page download formats map (`app/dashboard/tasks/result/page.jsx`)
- [ ] `/help` articles

### Verification
- [ ] Build passes (zero errors)
- [ ] Test task runs cleanly on new slug
- [ ] Historical task lookup still works
- [ ] Screenshot trail filed

---

## Migration strategy

**Option A: Hard rename** — update all code + SQL migrate DB rows. Use when no external dependencies.

**Option B: Deprecation (dual-slug)** — add old slug to `DEPRECATED_SLUGS`, preserve DB history. Use when slug appeared in URLs or has real user task history.

---

## Pending slug changes

| Worker | Persona | Current slug | Target slug | Reason | Gating shipment | Migration | Status | Identified |
|---|---|---|---|---|---|---|---|---|
| Kai | SEO Strategist | `seo-writer` | `seo-strategist` | Role expanded — slug under-represents capability | Registry consolidation shipment | Option A | Pending | 2026-04-19 |
| Ash | Social Media Creator | `social-media-manager` | `social-media-creator` | Role shift — pair rename with CMO rebuild | Ash CMO rebuild shipment | TBD | Pending | 2026-04-19 |

---

## Shipped slug changes

| Worker | Persona | Old slug | New slug / status | Shipped date | Commit SHA | Migration | Notes |
|---|---|---|---|---|---|---|---|
| Ember (Image Cleanup) | Ember | `brand-voice-guide-writer` | `image-cleanup` | Role change from text worker (Brand Voice Guide Writer) to image worker (Image Cleanup). Old role absorbed by Piper Mode 3 (Voice Guide). 7 historical tasks preserved via Option B dual-slug. | V28 Worker 3 | Option B | Shipped | 2026-04-24 |
| Ash (Short-Form Video Script Writer) | Ash | `social-media-creator` | no slug change — role title change only: Social Media Creator → Short-Form Video Script Writer. Full form rebuild + prompt rebuild. Slug kept for data continuity (Option A). | 2026-04-24 | TBD | N/A | Slug cleanup post-launch if needed |
| Piper (Brand Strategist) | Piper | `brand-strategist` | no slug change — tier promotion + 3-mode rebuild: Heavy 1cr → Light 0cr, modes: positioning/messaging/full-strategy → positioning/messaging/voice-guide (all 0cr) | 2026-04-24 | TBD | N/A | 0 historical tasks, no DB migration needed. INTERIM: Piper Mode 3 (Voice Guide) now duplicates Ember’s role. Ember deprecation happens during Ember reshape commit (V28 Worker 3). |
| Alice (Funnel Strategist) | Alice | `funnel-strategist` | no slug change — tier promotion only: Heavy 1cr → Light 0cr, minPlan pro→starter | 2026-04-24 | TBD | N/A | 0 historical tasks, no DB migration needed |
| Rio (old caption role) | Rio | `caption-writer` | deprecated → `scene-director` | 2026-04-19 | `c82efb5` | Option B | 4 historical tasks preserved; redirects to scene-director via DEPRECATED_SLUGS |
| Darcy (old thank-you role) | Darcy | `thank-you-note-writer` | removed | 2026-04-19 | `c82efb5` | Option A | 0 tasks, Mira absorbed |
| Joss (old action-item role) | Joss | `action-item-extractor` | removed | 2026-04-19 | `c82efb5` | Option A | 0 tasks, Macy absorbed |
| Paul (old proposals role) | Paul | `proposal-bid-writer` | removed | 2026-04-19 | `c82efb5` | Option A | 0 tasks, Vera absorbed |

---

## Unauthorized capability removals — investigation log

*Forensics completed 2026-04-19. Finding: no unauthorized deletion. Audio/video workers were built on `workspace-architecture` branch which was never merged to `main`. Main was simply a stale pointer. Branch hygiene fix merged main to workspace-architecture tip (c541cdd) on 2026-04-19.*

| Capability | Files | Deletion commit | Author | Date | Status |
|---|---|---|---|---|---|
| Audio & Voice pipeline | `lib/elevenlabs.ts` + execute-task handlers | N/A — never deleted | N/A | N/A | Always present on workspace-architecture — forensics cleared |
| Video pipeline | `lib/atlascloud.ts` + execute-task handlers | N/A — never deleted | N/A | N/A | Always present on workspace-architecture — forensics cleared |
| 9 worker registry entries | registry.ts + configs.ts + chat-intros.ts | N/A — never deleted | N/A | N/A | Always present on workspace-architecture — forensics cleared |

---

## Related deferred work

- **Apple Developer enrollment** ($99/yr) + APNs `.p8` key — JR action, gates iOS push
- **fal.ai top-up** — auto-top-up active at $11.67 balance, monitoring
- **Delete `bold-media.sintra.site`** — JR email exposed in Commet test footer
- **Delete test accounts from Supabase Auth** — JR manual (API-blocked)
- **Lenny RocketReach upgrade** Pro → Ultimate — gates launch day
- **`3rdshift-v18-polished.html`** canonical deployment — pending
- **Language capability testing** — 3 flagship workers × 10 languages before "100+ languages" claim
- **V28 brief math re-run** — CMO to re-run on true 85 baseline after this ships

---

---

## Nash — Site Auditor (V28 Phase 2 Worker 2)

| Persona | Old Slug | New Slug | Notes | Phase | Option | Status | Shipped |
|---|---|---|---|---|---|---|---|
| Nash (Site Auditor) | customer-review-responder | site-auditor | Role change from Customer Review Responder to Site Auditor. 5-mode card picker (Performance/SEO/Mobile/Competitor/Full). Google PageSpeed Insights + Serper integration. Historical tasks preserved via Option A dual-slug. | V28 Phase 2 Worker 2 | Option A | Shipped | 2026-04-25 |

## Silas — Website Builder (V28 Phase 2 Worker 3)

| Persona | Old Slug | New Slug | Notes | Phase | Option | Status | Shipped |
|---|---|---|---|---|---|---|---|
| Silas (Website Builder) | personal-brand-strategist | website-builder | Role change from Personal Brand Strategist to Website Builder. 5-card picker (Landing/Coming Soon/Lead Magnet/Sales Page/Service Business). Section-based generation with refinement-via-chat. fal.ai for AI images optional. WordPress + GDrive push integrations. Historical tasks preserved via Option A dual-slug. 0 historical tasks to migrate. | V28 Phase 2 Worker 3 | Option A | Shipped | 2026-04-25 |

*Living document. Last updated: 2026-04-25, Silas reshape (personal-brand-strategist → website-builder).*
