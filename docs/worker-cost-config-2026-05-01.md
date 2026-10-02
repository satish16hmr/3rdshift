# 3rdShift Worker Cost Config — 2026-05-01

> **Purpose:** Per-worker cost configuration table for all 78 active workers.
> Used as input to cost/margin audits. Cross-reference with `docs/cost-reference-2026-05-01.md` for provider rates.
>
> **Data sources:**
> - `OBSERVED` — pulled from `tasks` table (completed tasks, up to last 500). Output tokens estimated at chars/4 (English prose). Input tokens are still estimates (not stored in DB).
> - `ESTIMATE` — no completed task rows found for this worker; all token figures are estimates only.
>
> **Columns in flat summary table:**
> - `slug` — worker identifier
> - `persona` — worker name
> - `task_type` — light (free) or heavy (credits charged)
> - `credits` — credits per task (flat, or "by mode" if variable; see section tables for per-mode detail)
> - `min_plan` — minimum plan required
> - `ai_model` — AI model(s) used (from DB `model_used` field where observed)
> - `external_apis` — non-LLM API calls
> - `data_src` — OBSERVED (N) = N completed task samples; ESTIMATE = no observed data
> - `obs_avg_out_tok` — avg observed output tokens (chars/4); "—" if estimate only
> - `obs_out_range` — min–max observed output tokens
> - `~input_tok_est` — estimated input tokens (system + user prompt); always estimate

---

## Flat Summary Table — 78 Active Workers

> ⚠️ Input tokens are ALWAYS estimates (not stored in DB).
> Output tokens are observed where noted; estimates elsewhere.
> Workers marked with ⚠️ have a credits discrepancy between config and observed DB value — see Notes column.

| # | slug | persona | task_type | credits | min_plan | ai_model (observed) | external_apis | data_src | obs_avg_out_tok | obs_out_range | ~input_tok_est | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | content-writer | Ava | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (32) | 1,443 | 207–4,140 | 1,500–3,000 | |
| 2 | seo-strategist | Kai | heavy | 1 | starter | claude-sonnet-4-6 | Serper | OBSERVED (5) | 1,786 | 641–2,569 | 2,000–4,000 | |
| 3 | hook-specialist | Sam | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (20) | 653 | 3–1,128 | 800–1,500 | |
| 4 | email-copywriter | Mira | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (14) | 826 | 223–1,864 | 1,000–2,000 | |
| 5 | creative-editor | Remy | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (4) | 79 | 41–185 | 2,000–8,000 | Low output — feedback mode returns short critiques |
| 6 | script-writer | Jules | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (5) | 2,467 | 2,234–2,710 | 1,000–2,000 | |
| 7 | newsletter-writer | Oscar | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (16) | 1,157 | 261–2,340 | 1,000–2,000 | |
| 8 | ad-copywriter | Tate | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (5) | 740 | 533–1,475 | 800–1,500 | |
| 9 | landing-page-copywriter | Quinn | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (11) | 1,500 | 815–2,090 | 1,000–2,000 | |
| 10 | grant-writer | Sage | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 1,061 | 350–2,406 | 1,500–3,000 | |
| 11 | interview-question-writer | Dale | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (17) | 1,969 | 829–3,838 | 800–1,500 | |
| 12 | x-twitter-ghostwriter | Case | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (19) | 301 | 33–840 | 800–1,500 | |
| 13 | linkedin-ghostwriter | Elliot | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (25) | 436 | 244–1,325 | 800–2,000 | |
| 14 | social-media-creator | Ash | heavy | 1 | pro | claude-sonnet-4-6 | Serper | OBSERVED (7) | 1,275 | 820–2,114 | 2,000–4,000 | |
| 15 | community-manager | Ren | light | 0 | starter | claude-sonnet-4-6 | — | ESTIMATE | — | — | 1,000–2,000 | |
| 16 | instagram-strategist | Peyton | heavy | 1 | pro | claude-sonnet-4-6 | Serper | OBSERVED (1) | 5,356 | 5,356–5,356 | 1,500–3,000 | Only 1 sample |
| 17 | email-marketing-strategist | Ellis | heavy | 1 | starter | claude-sonnet-4-6 | Serper | OBSERVED (9) | 3,959 | 3,237–6,693 | 1,500–3,000 | |
| 18 | funnel-strategist | Alice | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (4) | 3,148 | 2,391–3,849 | 1,000–2,000 | |
| 19 | competitor-analyst | Zane | heavy | 2 | pro | claude-sonnet-4-6 | Serper | OBSERVED (3) | 1,608 | 1,336–1,759 | 3,000–6,000 | |
| 20 | trend-analyst | Jett | light/heavy | 0–1 (by mode) | starter | claude-sonnet-4-6 | Serper | ESTIMATE | — | — | 2,000–4,000 | |
| 21 | audience-persona-builder | Nora | heavy | 0–1 (by mode) | starter | claude-sonnet-4-6 | — | OBSERVED (2) | 2,595 | 1,272–3,918 | 1,500–3,000 | Only 2 samples |
| 22 | market-research-analyst | Duncan | heavy | 2 | starter | claude-sonnet-4-6 | Serper | OBSERVED (10) | 2,955 | 2,377–3,737 | 3,000–6,000 | |
| 23 | pricing-strategist | Cruz | heavy | 2 | starter | claude-sonnet-4-6 | Serper | OBSERVED (18) | 3,275 | 2,737–4,149 | 2,000–4,000 | |
| 24 | content-strategist | Lane | heavy | 1–2 (by mode) | starter | claude-sonnet-4-6 | — | ESTIMATE | — | — | 1,500–3,000 | |
| 25 | report-writer | Iris | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (2) | 757 | 680–834 | 2,000–5,000 | Only 2 samples |
| 26 | resume-writer | Beck | light | 0 | starter | claude-sonnet-4-6 | — | ESTIMATE | — | — | 1,500–4,000 | |
| 27 | kpi-dashboard-writer | Brody | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 4,424 | 4,265–4,553 | 1,000–2,000 | Higher output than expected — full dashboard spec |
| 28 | legal-document-drafter | Jude | heavy | 2 | starter | claude-sonnet-4-6 | — | OBSERVED (6) | 564 | 238–1,969 | 1,500–3,000 | Wide range — short NDAs vs full contracts |
| 29 | thumbnail-designer | Reed | heavy | 2 | pro | flux-pro/kontext + sharp.js | OpenAI DALL-E 3, remove.bg (pending) | OBSERVED (1) | 162 | 162–162 | 800–1,500 | ⚠️ model_used shows flux-pro/kontext, not dall-e-3. Only 1 sample. |
| 30 | presentation-builder | Mack | heavy | 3 | starter | n/a (PPTX pipeline) | — | OBSERVED (2) | 283 | 266–300 | 2,000–5,000 | Output is PPTX file; text col holds minimal metadata |
| 31 | brand-strategist | Piper | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (7) | 1,687 | 752–3,714 | 1,000–2,000 | |
| 32 | product-naming-specialist | Sully | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 2,330 | 1,535–3,716 | 800–1,500 | |
| 33 | product-description-writer | Dex | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (9) | 416 | 123–754 | 800–1,500 | |
| 34 | business-plan-writer | Marlo | heavy | 1 | starter | claude-sonnet-4-6 | — | OBSERVED (6) | 3,298 | 3,061–3,632 | 2,000–4,000 | Very consistent output length |
| 35 | case-study-writer | Thea | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 742 | 580–863 | 1,500–3,000 | |
| 36 | whitepaper-writer | Naru | heavy | 1 | pro | claude-sonnet-4-6 | Serper | OBSERVED (9) | 4,328 | 1,144–5,074 | 2,000–5,000 | Wide range — short and long modes |
| 37 | proposal-writer | Vera | heavy | 1 | pro | claude-sonnet-4-6 | — | OBSERVED (4) | 659 | 232–848 | 1,500–3,000 | |
| 38 | site-auditor | Nash | heavy | 1–2 (by mode) | pro | claude-sonnet-4-6 | Serper, Google PageSpeed (free) | OBSERVED (2) | 2,636 | 2,117–3,156 | 2,000–4,000 | Only 2 samples |
| 39 | ad-creative-generator | Darcy | heavy | 5 | pro | Seedance 2.0 / Wan 2.7 | fal.ai video | ESTIMATE | — | — | 800–1,500 | No completed tasks in sample window |
| 40 | scene-director | Rio | heavy | 4 | pro | Seedance 2.0 / Wan 2.7 | fal.ai video | ESTIMATE | — | — | 800–1,500 | No completed tasks in sample window |
| 41 | technical-writer | Penn | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 2,196 | 1,966–2,644 | 2,000–6,000 | |
| 42 | ux-writer | Lena | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 181 | 165–205 | 800–2,000 | Low output — targeted microcopy; intentional |
| 43 | job-description-writer | Eve | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 625 | 611–639 | 800–1,500 | Very consistent output |
| 44 | standard-operating-procedure-writer | Flynn | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 1,604 | 1,392–1,786 | 800–2,000 | |
| 45 | resume-screener | Knox | heavy | 1 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 399 | 373–428 | 3,000–8,000 | Short output — structured pass/fail + notes |
| 46 | creative-brief-writer | Bree | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (5) | 1,175 | 259–1,621 | 1,000–2,000 | |
| 47 | b-roll-generator | Joss | heavy | 3 (+1 for 10s) | pro | Seedance 2.0 / Wan 2.7 | fal.ai video | ESTIMATE | — | — | 1,000–2,000 | No completed tasks in sample window |
| 48 | onboarding-document-creator | Zeke | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 1,203 | 1,103–1,315 | 800–1,500 | |
| 49 | training-material-writer | Ivy | light/heavy | 0–1 (by mode) | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 3,650 | 3,252–3,930 | 1,000–2,000 | |
| 50 | research-assistant | Joe | heavy | 2 | starter | claude-sonnet-4-6 | Serper | OBSERVED (7) | 1,581 | 1,411–1,716 | 3,000–6,000 | |
| 51 | data-analyst | Tess | heavy | 2 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 847 | 757–959 | 5,000–15,000 | ⚠️ DB shows 0 credits charged — may be pre-billing tasks |
| 52 | lead-generator | Lenny | heavy | 2–5 (by mode) | starter | rocketreach | RocketReach API | OBSERVED (1) | 56 | 56–56 | 1,000–2,000 | Output is JSON result row; 1 sample only. ⚠️ Observed 5 credits |
| 53 | translator | Nico | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 80 | 76–88 | 1,000–5,000 | Very short test inputs in sample |
| 54 | customer-support-writer | Cara | light | 0 | starter | claude-sonnet-4-6 | — | ESTIMATE | — | — | 1,000–2,000 | |
| 55 | ad-campaign-strategist | Trey | heavy | 0–1 (by mode) | starter | claude-sonnet-4-6 | — | OBSERVED (8) | 2,176 | 426–3,698 | 1,000–2,000 | ⚠️ DB shows 1 credit; quick-angle mode (0cr) not represented |
| 56 | automation-blueprint-writer | Wes | heavy | 0–1 (by mode) | starter | claude-sonnet-4-6 | — | OBSERVED (5) | 2,010 | 978–3,174 | 1,000–2,000 | ⚠️ DB shows 1 credit; free mode (0cr) not represented |
| 57 | content-repurposer | Holly | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (4) | 251 | 59–807 | 2,000–6,000 | Short avg — test tasks with minimal input |
| 58 | website-builder | Silas | heavy | 2 | pro | n/a (HTML pipeline) | Unsplash (fallback: Lorem Picsum) | OBSERVED (2) | 14,616 | 12,714–16,518 | 2,000–5,000 | ⚠️ model_used = n/a; output is full HTML document. Highest output of all text workers. |
| 59 | video-repurposer | Vince | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 77 | 72–81 | 3,000–8,000 | Very low output — structured timestamps/clips list |
| 60 | pitch-deck-writer | Blair | heavy | 1 | starter | n/a (PPTX pipeline) | — | OBSERVED (7) | 247 | 211–300 | 2,000–5,000 | Output is PPTX; text col holds minimal metadata |
| 61 | ecommerce-strategist | Emma | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (13) | 3,441 | 306–6,440 | 1,000–2,000 | |
| 62 | pinterest-strategist | Lyra | heavy | 1 | pro | claude-sonnet-4-6 | — | OBSERVED (5) | 6,102 | 4,605–8,400 | 1,500–3,000 | High output — full board + pin strategy |
| 63 | product-video-creator | Paul | heavy | 3 | pro | Seedance 2.0 / Wan 2.7 | fal.ai video | ESTIMATE | — | — | 800–1,500 | No completed tasks in sample window |
| 64 | image-cleanup | Ember | heavy | 1 | pro | fal-ai/clarity-upscaler | fal-ai/birefnet, fal-ai/rembg, fal-ai/inpaint, fal-ai/flux-pro variants | OBSERVED (5) | 229 | 221–238 | 0 | Output is image URL only; no LLM call |
| 65 | podcast-show-notes-writer | Heath | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (13) | 1,191 | 235–2,003 | 2,000–6,000 | |
| 66 | course-outline-builder | Charlie | heavy | 0–4 (by mode) | starter | n/a (special pipeline) | — | OBSERVED (30) | 14,566 | 746–21,229 | 1,500–3,000 | ⚠️ model_used = n/a. Highest output volume of any worker. Wide range by mode. |
| 67 | prompt-engineer | Pete | light | 0 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 3,409 | 3,248–3,650 | 800–1,500 | |
| 68 | sales-outreach-writer | Wilma | heavy | 1 | pro | claude-sonnet-4-6 | — | OBSERVED (3) | 2,102 | 1,955–2,290 | 1,000–2,000 | ⚠️ DB shows 0 credits — may be pre-billing or test tasks |
| 69 | logo-concept-generator | Shay | heavy | 2 | starter | fal-ai/nano-banana-pro | fal.ai images | OBSERVED (2) | 503 | 436–570 | 600–1,200 | Output is image URLs + prompt text; low token count |
| 70 | social-media-graphics-designer | Gus | heavy | 1–4 (by mode) | starter | fal-ai/nano-banana-2 or pro | fal.ai images | ESTIMATE | — | — | 1,000–2,000 | No completed tasks in sample window |
| 71 | data-cleaner | Cade | heavy | 2 | starter | claude-sonnet-4-6 | — | OBSERVED (3) | 1,210 | 1,096–1,367 | 3,000–10,000 | ⚠️ DB shows 0 credits — may be pre-billing tasks |
| 72 | bookkeeping-summarizer | Bella | heavy | 2 | starter | claude-sonnet-4-6 | — | ESTIMATE | — | — | 3,000–10,000 | No completed tasks in sample window |
| 73 | spreadsheet-builder | Sienna | heavy | 2 | pro | claude-sonnet-4-6 | — | OBSERVED (3) | 949 | 894–1,013 | 1,000–2,000 | ⚠️ DB shows 0 credits — may be pre-billing tasks |
| 74 | voiceover-artist | Clay | heavy | 3 | pro | ElevenLabs TTS | ElevenLabs TTS API | ESTIMATE | — | — | 500–1,000 | No completed tasks in sample window |
| 75 | transcription-specialist | Opal | heavy | 1 | pro | ElevenLabs Scribe + claude-sonnet-4-6 | ElevenLabs Scribe | ESTIMATE | — | — | 500–2,000 | No completed tasks in sample window |
| 76 | meeting-notes-writer | Dina | heavy | 1–2 | pro | claude-sonnet (legacy string) | ElevenLabs Scribe | OBSERVED (12) | 585 | 206–1,080 | 1,000–4,000 | ⚠️ model_used = "claude-sonnet" (legacy); current model is claude-sonnet-4-6 |
| 77 | sound-effects-designer | Koa | heavy | 1 | pro | ElevenLabs SFX v2 | ElevenLabs SFX | ESTIMATE | — | — | 200–500 | No completed tasks in sample window |
| 78 | content-translator | Tala | heavy | 3–6 (by duration) | pro | ElevenLabs Dubbing + claude-sonnet-4-6 | ElevenLabs Dubbing | ESTIMATE | — | — | 500–2,000 | No completed tasks in sample window |

---

## Coverage Summary

| Category | Count |
|---|---|
| Workers with OBSERVED data | 63 |
| Workers with ESTIMATE only | 15 |
| Total active workers | 78 |

**15 workers with no observed data (estimate only):**
community-manager, trend-analyst, content-strategist, resume-writer, ad-creative-generator, scene-director, b-roll-generator, customer-support-writer, product-video-creator, social-media-graphics-designer, bookkeeping-summarizer, voiceover-artist, transcription-specialist, sound-effects-designer, content-translator

Most are either audio/video workers (ElevenLabs, fal.ai video) or newer workers not yet exercised in the last 500 completed tasks.

---

## Key Findings from Observed Data

### Output volume outliers
| Worker | Avg Output Tokens | Flag |
|---|---|---|
| course-outline-builder | 14,566 | Highest of any worker — max mode generates 21K+ tokens |
| website-builder | 14,616 | Full HTML document output — comparable to course-outline-builder |
| instagram-strategist | 5,356 | Higher than expected; full content calendar + strategy |
| pinterest-strategist | 6,102 | Full board + pin strategy; highest social worker |
| kpi-dashboard-writer | 4,424 | Higher than expected — full dashboard specification |
| whitepaper-writer | 4,328 | As expected for long-form research doc |
| training-material-writer | 3,650 | As expected for full program mode |

### Very low output (notable)
| Worker | Avg Output Tokens | Reason |
|---|---|---|
| creative-editor | 79 | Feedback mode returns concise critique |
| x-twitter-ghostwriter | 301 | Tweets are short by design |
| video-repurposer | 77 | Outputs structured clip timestamps, not prose |
| ux-writer | 181 | Targeted microcopy — intentionally minimal |
| translator | 80 | Sample inputs were very short |
| image-cleanup | 229 | Image URL + metadata only; no LLM text |
| pitch-deck-writer | 247 | PPTX output; text col holds slide metadata only |
| presentation-builder | 283 | Same as pitch-deck-writer |

### Model anomalies
| Worker | DB model_used | Expected | Flag |
|---|---|---|---|
| thumbnail-designer | flux-pro/kontext + sharp.js | dall-e-3 | ⚠️ DB reflects a different code path than current config |
| meeting-notes-writer | claude-sonnet | claude-sonnet-4-6 | ⚠️ Legacy model string — tasks predate model upgrade |
| course-outline-builder | n/a | claude-sonnet-4-6 | ⚠️ model_used not being written for this worker |
| pitch-deck-writer | n/a | claude-sonnet-4-6 | ⚠️ Same — PPTX pipeline skips model_used write |
| presentation-builder | n/a | claude-sonnet-4-6 | ⚠️ Same |
| website-builder | n/a | claude-sonnet-4-6 | ⚠️ Same — HTML pipeline skips model_used write |

### Credits discrepancies (config vs observed)
| Worker | Config credits | Observed credits | Likely cause |
|---|---|---|---|
| data-analyst | 2 | 0 | Tasks from before credit billing was implemented |
| data-cleaner | 2 | 0 | Same |
| spreadsheet-builder | 2 | 0 | Same |
| sales-outreach-writer | 1 | 0 | Same |
| ad-campaign-strategist | 0–1 (by mode) | 1 | Only paid mode represented in sample |
| automation-blueprint-writer | 0–1 (by mode) | 1 | Only paid mode represented in sample |

---

## Per-Mode Credit Detail (variable-credit workers)

| slug | mode | credits |
|---|---|---|
| course-outline-builder | mini_course | 0 |
| course-outline-builder | workshop | 0 |
| course-outline-builder | signature | 2 |
| course-outline-builder | premium | 4 |
| course-outline-builder | certification | 2 |
| social-media-graphics-designer (Gus) | single_graphic | 1 |
| social-media-graphics-designer (Gus) | multi_platform_set | 3 |
| social-media-graphics-designer (Gus) | carousel | 3 |
| social-media-graphics-designer (Gus) | premium_hero | 4 |
| ad-campaign-strategist (Trey) | quick-angle | 0 |
| ad-campaign-strategist (Trey) | full-blueprint | 1 |
| automation-blueprint-writer (Wes) | quick-sketch | 0 |
| automation-blueprint-writer (Wes) | full-blueprint | 1 |
| audience-persona-builder (Nora) | quick-sketch | 0 |
| audience-persona-builder (Nora) | full-set | 1 |
| content-strategist (Lane) | pillar_framework | 1 |
| content-strategist (Lane) | channel_strategy | 1 |
| content-strategist (Lane) | full_strategy | 2 |
| content-strategist (Lane) | editorial_calendar | 2 |
| content-strategist (Lane) | content_audit | 2 |
| trend-analyst (Jett) | quick_scan | 0 |
| trend-analyst (Jett) | horizon | 0 |
| trend-analyst (Jett) | category | 0 |
| trend-analyst (Jett) | trend_dive | 0 |
| trend-analyst (Jett) | strategic_foresight | 1 |
| site-auditor (Nash) | performance | 1 |
| site-auditor (Nash) | seo | 1 |
| site-auditor (Nash) | mobile | 1 |
| site-auditor (Nash) | competitor | 2 |
| site-auditor (Nash) | full | 2 |
| b-roll-generator (Joss) | quick_broll | 3 |
| b-roll-generator (Joss) | cinematic_scene | 3 |
| b-roll-generator (Joss) | product_brand | 3 |
| b-roll-generator (Joss) | 10s clip (any mode) | +1 surcharge |
| training-material-writer (Ivy) | quick_reference | 0 |
| training-material-writer (Ivy) | microlesson | 0 |
| training-material-writer (Ivy) | step_by_step | 0 |
| training-material-writer (Ivy) | workshop_guide | 0 |
| training-material-writer (Ivy) | full_program | 1 |
| content-translator (Tala) | ≤2 min audio | 3 |
| content-translator (Tala) | 2–5 min audio | 6 |
| meeting-notes-writer (Dina) | transcript input | 1 |
| meeting-notes-writer (Dina) | audio upload | 2 |
| lead-generator (Lenny) | lead_list | 5 |
| lead-generator (Lenny) | abm_lead_list | 5 |
| lead-generator (Lenny) | list_enrichment | 2 |

---

## Deprecated Workers (excluded from 78 count)

Found in DB completed tasks (have historical data):

| slug | persona | observed_samples | redirectTo | notes |
|---|---|---|---|---|
| brand-voice-guide-writer | Ember (old) | 7 | image-cleanup | Avg 6,109 output tokens; deprecated |
| cover-letter-writer | Cleo | 18 | resume-writer | Avg 440 tokens |
| faq-writer | Ty | 3 | customer-support-writer | Avg 754 tokens |
| linkedin-profile-optimizer | Lea | 4 | linkedin-ghostwriter | Avg 2,598 tokens; now baked into Elliot |
| long-form-article-writer | Sam (old) | 12 | hook-specialist (now content-writer) | Avg 3,042 tokens |
| press-release-writer | Finch | 3 | whitepaper-writer | Avg 385 tokens |
| tagline-writer | Kit | 5 | brand-strategist | Avg 386 tokens |

---

## Notes for Audit

1. **Input tokens not in DB** — `tasks` table has no input token column. All input estimates remain estimates. A future enhancement would be to log `input_tokens` + `output_tokens` from the Anthropic API response into a `task_metrics` column.
2. **4 PPTX/pipeline workers** (course-outline-builder, pitch-deck-writer, presentation-builder, website-builder) do not write `model_used` to the DB. The actual model is `claude-sonnet-4-6` in all cases; the pipeline path just doesn't record it.
3. **thumbnail-designer** DB shows `flux-pro/kontext + sharp.js` — this is a different code path than the current Reed config (dall-e-3). Audit should confirm which path is live.
4. **meeting-notes-writer** shows legacy `claude-sonnet` model string. Older tasks. Current model is `claude-sonnet-4-6`.
5. **Video/audio workers** (Joss, Paul, Rio, Darcy, Clay, Opal, Koa, Tala) have zero or near-zero observed tasks in the sample window — these are newer or lower-volume workers.
6. **Lenny (lead-generator)** has only 1 observed sample and shows 5 credits, confirming `lead_list` mode is the one exercised. The 56-token "output" is just a structured JSON result stub — the actual deliverable is a CSV attachment.
7. **course-outline-builder** avg 14,566 output tokens is the highest in the catalog by raw output volume. At Sonnet 4.6 rates ($15/MTok output), that's ~$0.22 per task in AI cost alone for paid modes.
8. **website-builder** 14,616 avg output tokens at $15/MTok = ~$0.22/task AI output cost. Charged 2 credits ($0.58 credit value at $29 Starter = $0.029/credit; 2cr = $0.058). Margin analysis needed.

---

*Generated: 2026-05-01 | Data: last 500 completed tasks from `tasks` table | Cross-reference: docs/cost-reference-2026-05-01.md*
