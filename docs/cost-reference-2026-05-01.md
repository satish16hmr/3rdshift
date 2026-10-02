# 3rdShift API Cost Reference — 2026-05-01

> **Purpose:** Authoritative reference for pricing of every external provider called by 3rdShift workers.
> Used as input to cost/margin audits. All prices are USD. Rates sourced from official pricing pages and
> verified cross-references on or before 2026-05-01. Mark individual entries as stale if provider updates.

---

## 1. Anthropic (Claude) — Text AI

**Used by:** All text-output workers (see Doc 2 for per-worker mapping)
**Primary model (workers):** `claude-sonnet-4-6`
**Light model (JARVIS/orchestration):** `claude-haiku-4-5-20251001`
**Fallback:** OpenAI `gpt-4o` / `gpt-4o-mini` (if Anthropic fails)

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Notes |
|---|---|---|---|
| claude-haiku-4-5 | $1.00 | $5.00 | JARVIS, light orchestration |
| claude-sonnet-4-6 | $3.00 | $15.00 | All workers (primary) |
| claude-opus-4-6 | $5.00 | $25.00 | Not used in production (reference only) |

**Additional:**
- Prompt caching writes: ~$3.75–$6.00/MTok (Sonnet)
- Cache hits: ~$0.30/MTok
- Batch API: ~50% discount on standard rates
- No long-context surcharge on Sonnet 4.6 / Opus 4.6 at full 1M context

**Sources:** Anthropic official pricing page, MetaCTO, CheckThat.ai (verified 2026-05)

---

## 2. OpenAI — Image Generation (DALL-E 3)

**Used by:** Reed (thumbnail-designer)

| Quality / Resolution | Price per Image |
|---|---|
| Standard 1024×1024 | $0.04 |
| HD 1024×1024 | $0.08 |
| HD 1024×1536 or 1536×1024 | $0.12 |

**Implementation:** Reed generates 4 variations per task. Typical cost = 4 × $0.04 = **$0.16/task** (standard) or 4 × $0.08 = **$0.32/task** (HD).

**Sources:** OpenAI official pricing, finout.io (verified 2026-05)

---

## 3. OpenAI — Text Fallback

**Used by:** All workers (fallback if Anthropic unavailable)
**Note:** Anthropic is primary; OpenAI is fallback only.

| Model | Input ($/1M tokens) | Output ($/1M tokens) |
|---|---|---|
| gpt-4o | ~$2.50 | ~$10.00 |
| gpt-4o-mini | ~$0.15 | ~$0.60 |

---

## 4. ElevenLabs — Audio/Voice

**Used by:** Clay (voiceover-artist), Opal (transcription-specialist), Heath (podcast), Koa (sound-effects-designer), Tala (content-translator)

### 4a. Text-to-Speech (TTS) — Clay (voiceover-artist)
**Model:** `eleven_multilingual_v2`
**Billing:** Per character (plan credits). Pro plan ($99/mo) includes 500k–600k credits (~500–1,000 min TTS).
**Overage rate:** ~$0.10–$0.30/1K chars on lower tiers; ~$0.05–$0.10/1K chars at Scale/Business tier
**Approximate cost:** ~$0.002–$0.010/minute of generated audio (at Pro tier usage levels)

### 4b. Transcription (Scribe) — Opal (transcription-specialist), Dina (meeting-notes-writer)
**Model:** ElevenLabs Scribe (via `/v1/speech-to-text`)
**Billing:** Included in plan credits; per-minute pricing at overage
**Approximate overage:** ~$0.12–$0.33/minute of transcribed audio (plan-dependent)

### 4c. Sound Effects Generation — Koa (sound-effects-designer)
**Endpoint:** `/v1/sound-generation`
**Billing:** Per minute of generated audio
**Overage rate:** $0.12–$0.33/min across plans
**Included minutes:** 12 min (Starter), 44–67 min (Creator/Pro), up to 906 min (Business)
**Typical per-task cost:** Most sound effects are 5–30s → ~$0.01–$0.17/task at overage rates

### 4d. Dubbing — Tala (content-translator)
**Endpoint:** `/v1/dubbing`
**Billing:** Per source audio minute (not per character)
**Overage rate:** ~$0.24/min (Pro tier), ~$0.60/min (Creator tier)
**Tala tiers:** ≤2min = 3 credits ($0.48/task at Pro overage), 2–5min = 6 credits (~$1.20/task at Pro overage)
**Note:** Dubbing API requires Pro plan ($99/mo) minimum

**Plan summary:**
| Plan | Monthly | Credits | TTS included | Dubbing |
|---|---|---|---|---|
| Starter | $5–6 | 30k | ~30–60 min | Limited |
| Creator | $22 | 100k | ~100–200 min | ~50–100 min |
| Pro | $99 | 500k–600k | ~500–1,000 min | ~250–500 min |
| Scale | $330 | 2M | ~1,000–2,000 min | ~1,000 min |
| Business | $1,320 | 11M | ~5,500–11,000 min | ~5,500 min |

**Sources:** ElevenLabs official pricing, blog.geckodub.com, cekura.ai (verified 2026-05)

---

## 5. fal.ai — Image Generation

**Used by:** Shay (logo-concept-generator), Gus (social-media-graphics-designer), Ember (image-cleanup), Reed (thumbnail-designer — refinement pass)

### 5a. fal-ai/nano-banana-pro — Shay (logo-concept-generator), Gus premium_hero mode, Reed refinement
**Per-image pricing:**
| Resolution | Price |
|---|---|
| Standard | $0.15/image |
| 4K | $0.30/image |

**Per-task cost (Shay):** 4 images × $0.15 = **$0.60/task**
**Per-task cost (Gus premium_hero):** 4 images × $0.15 = **$0.60/task**

### 5b. fal-ai/nano-banana-2 — Gus (single_graphic, multi_platform_set, carousel)
| Resolution | Price |
|---|---|
| 512×512 | $0.06/image |
| 1K (1024×1024) | $0.08/image |
| 2K | $0.12/image |
| 4K | $0.16/image |

**Per-task cost estimates (at 1K res):**
- single_graphic: 2 images × $0.08 = **$0.16/task**
- multi_platform_set: 4 images × $0.08 = **$0.32/task**
- carousel (5 slides): 5 × $0.08 = **$0.40/task** (10-slide: $0.80)

### 5c. fal-ai image cleanup models — Ember (image-cleanup)
| Model | Use case |
|---|---|
| fal-ai/birefnet | Background removal (primary) |
| fal-ai/rembg | Background removal (fallback) |
| fal-ai/inpaint | Object/watermark removal (primary) |
| fal-ai/flux-pro/v1/fill | Object/watermark removal (fallback) |
| fal-ai/flux-pro/kontext | Watermark removal (no mask) |
| fal-ai/clarity-upscaler | Upscaling (primary) |
| fal-ai/creative-upscaler | Upscaling (fallback) |
| fal-ai/flux-kontext-pro | Color correction |

**Note:** Individual pricing per model varies; fal.ai general image processing ~$0.05–$0.20/image. Exact per-model pricing not publicly listed — check fal.ai dashboard for actuals.

### 5d. fal-ai/flux-pro — Reed (thumbnail-designer, Claude prompt pass)
**Used for:** Claude-generated prompt → Flux for thumbnail variations
**Price:** ~$0.05–$0.15/image (Flux Pro standard)

**Sources:** fal.ai/pricing, blog.laozhang.ai, fal.ai/learn/tools/ai-image-generators (verified 2026-05)

---

## 6. fal.ai — Video Generation (via Atlas Cloud / fal.ai pipeline)

**Used by:** Paul (product-video-creator), Joss (b-roll-generator), Rio (scene-director), Darcy (ad-creative-generator)

**Primary model:** `bytedance/seedance-2.0-fast` (text-to-video, image-to-video, reference-to-video)
**Fallback model:** `alibaba/wan-2.7` (text-to-video, image-to-video, reference-to-video)

| Provider / Tier | Cost per Second of Video | Notes |
|---|---|---|
| Atlas Cloud Fast (Seedance 2.0) | $0.022/sec | High quality, optimized inference |
| Atlas Cloud Pro (Seedance 2.0) | $0.247/sec | Max quality |
| fal.ai Wan 2.7 | $0.10/sec | 1080p, fallback |
| fal.ai Seedance 2.0 Fast | ~$0.05–$0.10/sec | Estimated; matches Wan 2.7 structure |

**Per-task cost estimates:**
- 5s clip: $0.11–$0.50/clip (Seedance Fast at $0.022–$0.10/sec)
- 10s clip: $0.22–$1.00/clip
- Joss 10s (+1cr surcharge): $0.22–$1.00
- Darcy 5cr task (5s): ~$0.11–$0.50/generation

**Sources:** atlascloud.ai/blog, fal.ai/wan-2.7, wavespeed.ai (verified 2026-05)

---

## 7. RocketReach — Lead Generation

**Used by:** Lenny (lead-generator)

| Plan | Annual Cost/User | Lookups/Year | API Access |
|---|---|---|---|
| Essentials | $396–$960 | 1,200 (email only) | No |
| Pro | $996–$1,800 | 3,600 (email + phone) | No |
| **Ultimate** | **$2,099–$2,484** | **10,000** | **Yes** |

**Current 3rdShift plan:** Pro Annual ($119/mo reference; ~$1,428/yr) — **Pro does NOT include API access per sources. Verify current contract.**

**Per-reveal cost (Ultimate):** ~$0.20–$0.25/lookup ($2,484 / 10,000)
**Effective per-task cost:**
- lead_list (20 reveals): 20 × $0.20–$0.25 = **$4.00–$5.00/task**
- abm_lead_list (up to 20 reveals): same range
- list_enrichment (up to 30 leads): 30 × $0.20–$0.25 = **$6.00–$7.50/task**

**Note:** MEMORY.md says Josh has Pro Annual ($119/mo). Pro plan does not include API access per 2026 sources — may be grandfathered or Pro+Phone plan has different terms. Verify with RocketReach.

**Sources:** cleanlist.ai, salesintel.io, cognism.com (verified 2026-05)

---

## 8. Serper — Web Search

**Used by:** Ash (social-media-creator), Kai (seo-strategist), Zane (competitor-analyst), Nash (site-auditor), Jett (trend-analyst), Ellis (email-marketing-strategist), Piper (brand-strategist), Duncan (market-research-analyst), Joe (research-assistant), Peyton (instagram-strategist), Lyra (pinterest-strategist), Sully (product-naming-specialist)

| Plan | Monthly Cost | Cost per 1K Queries |
|---|---|---|
| Developer | $50/yr (~$4.17/mo) | $1.00/1K |
| Pro | $50/mo | $0.10/1K |
| Business | $250/mo | $0.083/1K |

**Free tier:** 2,500 queries/month

**Effective per-query cost (Pro):** $0.0001/query (Pro) — $0.001/query (Developer)
**Typical per-task cost:** Workers use 3–10 Serper queries/task
- At Pro: 3–10 queries × $0.0001 = **~$0.0003–$0.001/task** (negligible)
- At Developer: 3–10 × $0.001 = **~$0.003–$0.01/task**

**Sources:** serper.dev, buildmvpfast.com, awesomeagents.ai (verified 2026-05)

---

## 9. remove.bg — Background Removal (Pending provisioning)

**Used by:** Reed (thumbnail-designer) — provisioning pending, not yet live
**Note from MEMORY.md:** Account signed up, key not yet sent to Roger. Unsplash also pending.

| Plan | Monthly | Credits | Cost/Image |
|---|---|---|---|
| 40 Credits | $9 | 40 | $0.225 |
| 200 Credits | $39 | 200 | $0.195 |
| 500 Credits | $79–$80 | 500 | $0.158–$0.16 |
| Pay-as-you-go | — | Per use | $0.20 |

**Effective per-task cost (Reed face compositing):** 1 credit/image = **$0.16–$0.23/image** depending on plan

**Sources:** remove.bg/api, aimagicx.com (verified 2026-05)

---

## 10. Unsplash — Stock Images (Pending provisioning)

**Used by:** Silas (website-builder) — UNSPLASH_API_KEY not yet in Vercel
**Cost:** Free for API usage (commercial use covered under Unsplash license for API partners)
**Fallback (current):** Lorem Picsum (free, no key required)

**Note from MEMORY.md:** Josh action needed — unsplash.com/developers → New Application → copy Access Key → add UNSPLASH_API_KEY to Vercel.

---

## 11. Google PageSpeed Insights — Site Auditing

**Used by:** Nash (site-auditor)
**Cost:** Free (Google public API, no per-call charges)

---

## Summary: Cost per Provider

| Provider | Primary consumers | Est. variable cost/task |
|---|---|---|
| Anthropic (Sonnet 4.6) | All text workers | $0.01–$0.30 (token-volume dependent) |
| OpenAI DALL-E 3 | Reed (thumbnails) | $0.16–$0.32/task |
| ElevenLabs TTS | Clay (voiceover) | $0.002–$0.01/min |
| ElevenLabs Transcription | Opal, Dina | $0.12–$0.33/min |
| ElevenLabs SFX | Koa | $0.01–$0.17/task |
| ElevenLabs Dubbing | Tala | $0.48–$1.20/task |
| fal.ai image (nano-banana-2) | Gus | $0.08–$0.40/task |
| fal.ai image (nano-banana-pro) | Shay, Gus premium | $0.15–$0.60/task |
| fal.ai image (cleanup) | Ember | ~$0.05–$0.20/task |
| fal.ai video (Seedance 2.0) | Paul, Joss, Rio, Darcy | $0.11–$1.00/clip |
| RocketReach | Lenny | $4.00–$7.50/task |
| Serper | 12+ workers | ~$0.001–$0.01/task |
| remove.bg | Reed (pending) | $0.16–$0.23/image |
| Unsplash | Silas (pending) | Free |
| Google PageSpeed | Nash | Free |

---

*Generated: 2026-05-01 | Next review: before any pricing audit or margin analysis*
