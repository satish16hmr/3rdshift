# Specialist Spec — LinkedIn Ghostwriter

**Worker:** Elliot · LinkedIn Ghostwriter
**Slug:** `linkedin-ghostwriter`
**Category:** Social Media
**Modality:** Text
**Tier:** Light
**Credits:** 0
**Audit date:** 2026-04-19
**Audit commit:** TBD (this audit)
**Status:** Launch-ready

---

## 1. What this worker does (elevator pitch)

Elliot writes LinkedIn posts that sound like the user on a good day — human, opinionated, and ready to publish without editing.

## 2. Target user

- **Primary use case:** Founder, executive, or professional who wants a consistent LinkedIn presence but can't write polished posts consistently — needs 1-2 posts per week on topics they care about
- **Secondary use cases:** B2B marketer ghostwriting for a C-suite executive; consultant building thought leadership in a niche; job seeker wanting to signal expertise before interviews
- **NOT a good fit for:** Viral engagement-bait posts ("hot take" content divorced from real insight); posts that require live industry data; company page content (Elliot writes in a personal voice)

## 3. Freelancer benchmark

- **Fiverr equivalent:** LinkedIn ghostwriter gig, $75–$250 per post
- **Upwork equivalent:** $30–$80/hr, $500–$2,000/month for consistent posting
- **Agency equivalent:** Executive ghostwriting packages, $2,000–$5,000/month for 8–12 posts
- **Typical turnaround with a human:** 1–3 days per post
- **3rdShift turnaround:** 15–30 seconds

## 4. What makes this worker the best specialist in its lane

- Writes with genuine storytelling structure — hook, tension, payoff — not the "5 tips" listicle format that LinkedIn has trained people to ignore
- Understands mobile-first formatting: short paragraphs, line breaks, no walls of text
- Tone selector covers the full professional spectrum: Professional but human / Storytelling / Educational / Bold and opinionated / Humble
- CTA field drives actual engagement — pushes toward comments, not just impressions
- Humanize enabled at full level — outputs pass the "did a founder write this?" test

## 5. Form spec

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Topic or Story | textarea | Yes | — | 4-row textarea; place for topic, stories, data, or insights |
| Tone | select | No | Professional but human | Professional but human / Storytelling / Educational / Bold and opinionated / Humble |
| Goal | select | No | Build thought leadership | Build thought leadership / Drive followers / Generate leads / Share a win / Share a lesson |
| Call to Action | text | No | — | e.g. "Drop your thoughts below, DM me for the full guide" |

**More options (collapsed):** None.

**Submit label:** Default arrow button (→)
**Footer text:** Included on all plans

## 6. Mode structure

Single-mode worker. Tone and Goal fields create variant outputs but no true mode branching.

## 7. Output spec

- **Output format:** Markdown (short paragraphs, bold for emphasis, no bullet abuse)
- **Output length:** 150–400 words (LinkedIn sweet spot for reach)
- **Output structure:** Hook (1-2 lines) → tension/story → payoff/insight → CTA
- **Download options:** None — copy-only (paste directly into LinkedIn)
- **Editor enabled:** Yes (Tiptap rich text editor)
- **CSV export:** No

## 8. System prompt quality check

- **Prompt file path:** Inline in `lib/workers/configs.ts`
- **Prompt length:** ~40 tokens (minimal — relies on ANTI_AI and NO_HALLUCINATION macros)
- **Brand voice integration:** Pulls from brand context if set in profile
- **Humanization:** Level `full` (humanize button enabled)
- **Guardrails present:** NO_HALLUCINATION, ANTI_AI (no em dashes, no corporate phrases)
- **Known edge cases handled:** Storytelling, thought leadership, educational, opinionated — all via tone field
- **Known edge cases NOT handled:** Carousel post format (Elliot writes single posts only); no character limit enforcement (LinkedIn has 3,000 char limit — rarely an issue but not enforced)

## 9. API pipeline

- **Primary model:** Claude Sonnet 4.6
- **Fallback if primary fails:** Standard error handling
- **External APIs called:** None (pure Sonnet)
- **Max tokens:** Default (4,096)
- **Typical cost per task:** ~$0.02–0.04
- **Cost per task at 95th percentile:** ~$0.05 (longer storytelling posts)
- **Abuse risk:** Low — text output, no external API

## 10. Chat behavior

- **Chat enabled:** Yes
- **In-chat behavior:** Topic brainstorming, hook refinement, LinkedIn strategy advice; can workshop a single post
- **Form push triggers:** "For a full polished post, use the Form tab" when user pastes a topic
- **Token-burn guards:** Standard monthly limits for Starter

## 11. Integrations

- **LinkedIn** ✅ (direct publish integration — primary platform match)
- **Buffer** ✅ (schedule LinkedIn posts)
- **Google Drive** ✅ (save post drafts)
- **Notion** ✅ (content calendar)
- **Mailchimp / WordPress** — not applicable

## 12. QA audit checklist

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Registry: light, 0cr, humanizeLevel full | ✅ | Correct |
| 2 | Configs.ts: 4 fields, correct form schema | ✅ | topic, tone, goal, cta |
| 3 | System prompt exists and loads | ✅ | Inline in configs.ts |
| 4 | Chat intro present in chat-intros.ts | ✅ | "Hey! I'm Elliot, your LinkedIn Ghostwriter..." |
| 5 | Worker card: correct persona, title, description | ✅ | Social Media, light, no PRO+ badge |
| 6 | Worker page loads clean, 4 form fields render | ✅ | All fields present |
| 7 | Smoke test: post output produced, storytelling format | ✅ | Quality output, hook-tension-payoff structure |
| 8 | Copy-only (no downloads), Tiptap editor renders | ✅ | Consistent with Case |
| 9 | Chat tab + intro fires correctly | ✅ | Elliot name in intro |
| 10 | Starter access: form accessible, no gate | ✅ | Light worker |
| 11 | Output quality: human voice, LinkedIn-native format | ✅ | Short paragraphs, no bullet abuse, genuine voice |
| 12 | Cost: pure Sonnet, ~$0.02–0.04 | ✅ | No external API |

**Audit outcome:** Launch-ready
**Fixes shipped this audit:** None
**Fixes deferred:** LinkedIn 3,000-char limit not enforced (extremely rare issue); carousel format not supported (roadmap)
**Global patterns surfaced:** None new

## 13. Sample output

```
90 days ago I made a decision that made my content team uncomfortable.

I replaced our freelance writers with AI workers.

Not partially. Fully.

Here's what actually happened.

**Output quality**

The first two weeks were rough. The content was technically correct but flat. No edge. No personality. I almost pulled the plug.

Then I figured out the real problem. I was treating the AI like a vending machine instead of a team member. Once I built proper workflows, brand context, and feedback loops — the quality jumped. Not to "pretty good." To genuinely better than some of our freelancers on their off weeks.

The consistency was the surprise. No sick days. No "I'm swamped this week." Same output on a Tuesday as a Sunday at midnight.

**Speed**

This one wasn't even close.

What took 4-5 days from brief to published was happening in under 6 hours. First draft in minutes. Revisions same-day.
```

*Smoke test input: Storytelling tone, "Build thought leadership" goal, topic about 90-day experiment replacing freelancers with AI workers.*

## 14. Known issues / roadmap

- **Known issues:** None blocking launch
- **Roadmap improvements:** Carousel post format (numbered slides, hook + 5-7 insights + CTA); LinkedIn-specific hashtag suggestions; multi-post series support
- **User feedback incorporated:** 9 historical completed tasks — all producing quality output

## 15. Change log

| Date | Change | Shipment | Commit |
|---|---|---|---|
| 2026-04-19 | Initial audit | QA audit sprint | TBD |

---

*Living document. Owner: CMO / audit process.*
