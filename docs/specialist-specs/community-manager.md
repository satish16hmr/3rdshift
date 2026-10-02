# Specialist Spec — Community Manager

**Worker:** Ren · Community Manager
**Slug:** `community-manager`
**Category:** Social Media
**Modality:** Text
**Tier:** Light
**Credits:** 0
**Audit date:** 2026-04-19
**Audit commit:** TBD (this audit)
**Status:** Launch-ready

---

## 1. What this worker does (elevator pitch)

Ren builds complete community management playbooks — welcome flows, moderation guidelines, discussion rhythms, and growth tactics — tailored to the platform and community type.

## 2. Target user

- **Primary use case:** Founder or community manager launching or revitalizing a Discord, Slack, or Facebook community — needs a structured playbook to drive consistent engagement
- **Secondary use cases:** Brand building a community around a product; creator setting up a membership community; operator managing multiple platforms and needing standardized guidelines
- **NOT a good fit for:** Real-time community moderation or response writing (Ren creates strategy and templates, not live responses); pure analytics/reporting on community health; communities with fewer than 20 members (too early for a playbook)

## 3. Freelancer benchmark

- **Fiverr equivalent:** Community strategy gig, $150–$500 per playbook
- **Upwork equivalent:** Community manager, $25–$60/hr; playbook project $300–$1,500
- **Agency equivalent:** Community strategy consulting, $2,000–$8,000 for a full audit and playbook
- **Typical turnaround with a human:** 3–7 days
- **3rdShift turnaround:** 30–60 seconds

## 4. What makes this worker the best specialist in its lane

- Platform-specific output: Discord playbooks differ from Slack, Facebook Group, Reddit — Ren adapts structure, terminology, and tactics to each
- Produces a full structured document: mission statement, welcome flow, discussion prompts, moderation framework, event ideas, and growth tactics in one output
- Grounded in community goal: different outputs for engagement, product adoption, brand advocacy, membership growth, or customer support
- Scales to community size: output is calibrated to 50-member startups vs 5,000-member established communities
- Includes copy-ready assets: welcome messages, pinned post templates, and weekly discussion starters are written and ready to paste

## 5. Form spec

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Platform | select | Yes | — | Discord / Facebook Group / Slack Community / Reddit / Telegram / Circle / Mighty Networks / Other |
| Community Type or Topic | text | Yes | — | e.g. "SaaS founders, fitness enthusiasts" |
| Community Goal | select | Yes | — | Build engagement / Drive product adoption / Create brand advocates / Grow membership / Support customers |
| Current Community Size | text | No | — | e.g. "just launching, 200 members, 5,000 members" |
| Any specific requirements | textarea | No | — | Existing rules, tone preferences, special events; 2,000 char limit |

**More options (collapsed):** None.

**Submit label:** Default arrow button (→)
**Footer text:** Included on all plans

## 6. Mode structure

Single-mode worker. Platform + Goal fields drive output variation without true mode branching.

## 7. Output spec

- **Output format:** Markdown (headers, sections, copy-ready templates inline)
- **Output length:** 600–1,500 words (full playbook with multiple sections)
- **Output structure:** Foundation/mission → Welcome flow → Discussion rhythms → Moderation guidelines → Growth tactics → Copy templates
- **Download options:** DOCX + PDF (standard markdown worker downloads)
- **Editor enabled:** Yes (Tiptap — long-form structured content benefits from editing)
- **CSV export:** No

## 8. System prompt quality check

- **Prompt file path:** Inline in `lib/workers/configs.ts`
- **Prompt length:** ~40 tokens (minimal system prompt; relies on NO_HALLUCINATION and ANTI_AI macros + user prompt structure)
- **Brand voice integration:** Pulls from brand context if set
- **Humanization:** Level `full` (humanize enabled)
- **Guardrails present:** NO_HALLUCINATION, ANTI_AI
- **Known edge cases handled:** Platform-specific language via Platform select; community stage via size field
- **Known edge cases NOT handled:** Multi-platform playbooks (one platform per task); language/locale variations

## 9. API pipeline

- **Primary model:** Claude Sonnet 4.6
- **Fallback:** Standard error handling
- **External APIs:** None (pure Sonnet)
- **Max tokens:** Default (4,096)
- **Typical cost per task:** ~$0.03–0.06 (longer output, structured document)
- **Cost at 95th percentile:** ~$0.08 (maximum detail, large community)
- **Abuse risk:** Low

## 10. Chat behavior

- **Chat enabled:** Yes
- **In-chat behavior:** Strategy Q&A, platform-specific advice, quick template generation
- **Form push triggers:** "For a full community playbook, use the Form tab"
- **Token-burn guards:** Standard monthly limits

## 11. Integrations

- **Google Drive** ✅ (share playbook with team)
- **Notion** ✅ (community wiki / ops docs)
- **Buffer** — limited applicability (playbook, not schedulable posts)
- **LinkedIn / Mailchimp / WordPress** — not applicable

## 12. QA audit checklist

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Registry: light, 0cr, humanizeLevel full | ✅ | Tags fixed: were 'TikTok, short-form, viral' (stale copy-paste) → 'community, Discord, engagement' |
| 2 | Configs.ts: 5-field form, correct schema | ✅ | Platform, type, goal, size, notes |
| 3 | System prompt loads | ✅ | Inline in configs.ts |
| 4 | Chat intro present | ✅ | "Hey! I'm Ren, your Community Manager..." |
| 5 | Worker card: correct persona, description | ✅ | Social Media, light |
| 6 | Worker page loads, 5 fields render | ✅ | All fields present |
| 7 | Smoke test: full playbook output produced | ✅ | 600+ word structured playbook, Discord/SaaS founders |
| 8 | Downloads available (DOCX/PDF), editor enabled | ✅ | Standard markdown worker |
| 9 | Chat tab + Ren intro | ✅ | Confirmed |
| 10 | Starter accessible, no gate | ✅ | Light worker |
| 11 | Output quality: platform-specific, structured, copy-ready | ✅ | Mission statement, welcome flow, discussion rhythms all present |
| 12 | Cost: pure Sonnet ~$0.03–0.06 | ✅ | No external API |

**Audit outcome:** Launch-ready
**Fixes shipped this audit:** Tags corrected (`['TikTok', 'short-form', 'viral']` → `['community', 'Discord', 'engagement']`) — stale copy-paste from another worker
**Fixes deferred:** None
**Global patterns surfaced:** Stale tags — check other Social Media workers for wrong tags (community-manager had TikTok tags). **Will grep all workers in next commit.**

## 13. Sample output

```
# 3rdShift Community Management Strategy
## Discord | SaaS Founders & Operators | 500 Members

---

# PART 1: THE FOUNDATION

## Who This Community Is For

These are builders. SaaS founders and operators who've already bought into AI tools to run their businesses. They're not here to debate whether AI matters. They're here because running a company is hard, they're probably doing it with a small team, and they want to talk to people who get it.

That's the entire job. Make them feel like they're in the right room.

At 500 members and 6 months in, you're past the "will this thing survive" phase. Now the question is: do people come back? Do they post without being asked? Do they tell a friend to join?

That's what this strategy builds toward.

---

## Community Mission Statement

Post this in your server description and pin it in #welcome:

> **We're the community for SaaS founders and operators who run lean with AI. No fluff, no hype. Just real talk from people actually doing it.**
```

*Smoke test input: Discord platform, "SaaS founders using AI tools", Build engagement goal, 500 members.*

## 14. Known issues / roadmap

- **Known issues:** None blocking launch
- **Roadmap improvements:** Multi-platform playbook (one input, output for 2–3 platforms); community health audit template; member onboarding drip sequence generator
- **User feedback incorporated:** 0 historical tasks before this audit

## 15. Change log

| Date | Change | Shipment | Commit |
|---|---|---|---|
| 2026-04-19 | Initial audit — fixed stale tags | QA audit sprint | TBD |

---

*Living document. Owner: CMO / audit process.*
