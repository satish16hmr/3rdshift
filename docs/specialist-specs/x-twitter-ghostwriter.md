# Specialist Spec — X/Twitter Ghostwriter

**Worker:** Case · X/Twitter Ghostwriter
**Slug:** `x-twitter-ghostwriter`
**Category:** Social Media
**Modality:** Text
**Tier:** Light
**Credits:** 0
**Audit date:** 2026-04-19 (redesign) / 2026-04-20 (launch sign-off)
**Status:** ✅ Launch-ready

---

## 1. What this worker does (elevator pitch)

Case is an elite X/Twitter ghostwriter. Writes tweets, threads, and content batches with X-native tone options, Hook Library v1 integration, per-tweet 280-char enforcement, and voice matching. Every field materially changes the output.

## 2. Target user

- **Primary:** Founder or creator building an audience on X who wants real content, not generic AI output
- **Secondary:** Marketer running a product launch campaign; thought leader wanting ghostwritten takes; social media manager batching content
- **NOT a good fit for:** Real-time trending commentary (no live data); viral meme formats; automated reply bots

## 3. Freelancer benchmark

- **Fiverr equivalent:** Twitter/X ghostwriter gig, $50–$200 per thread
- **Upwork equivalent:** Social media ghostwriter, $25–$75/hr
- **3rdShift turnaround:** 15–30 seconds

## 4. Form spec

### Shared fields (all modes)

| Field | Type | Required | Default |
|---|---|---|---|
| Content Type | select | Y | Single tweet |
| Topic | textarea | Y | — |
| Account stage | select | N | Growing (1k–10k) |
| Your niche | text | N | — |
| Tone | select | N | Direct |
| Goal | select | N | Build audience |
| Hook framework | select | N | Auto (recommended) |

### Mode-specific fields

**Single tweet:** Include reply-to-self toggle

**Thread:** Thread length / Hook tweet style / Include CTA toggle / CTA type (conditional)

**Content batch:** Number of posts / Content mix (multi-select) / Content pillars / Posting cadence

### More options (collapsed)

Voice match textarea / Avoid words / Include emoji toggle / Include hashtags toggle

**Submit label:** Write →
**Footer text:** Included on all plans · Copy only

## 5. Tone options (X-native)

Direct / Spicy takes / Build in public / Authority/expert / Storyteller / Contrarian / Witty/banter / Data-driven

## 6. Goal options (X-native)

Build audience / Go viral / Drive replies / Drive bookmarks / Drive DMs / Share insight / Promote offer / Build in public

## 7. Hook Library

20 frameworks embedded in system prompt. Each has PATTERN, EXAMPLE, TONE FIT, GOAL FIT, WATCH OUT FOR. Auto mode = Claude picks best match. Manual = user picks specific framework.

## 8. Voice matching

- Injected at top of user prompt before task context — not buried
- System prompt has highest-priority override section before hook library
- Mandatory 6-point matching: exclamation density, signature phrases/openers, ALL CAPS patterns, sentence length, energy level, punctuation habits
- Tone branches explicitly subordinate when voice samples present
- Only cleans: genuine typos/misspellings

## 9. 280-char enforcement

Server-side post-generation check in execute-task. Over-280 tweets trigger a regen call. Falls back gracefully if regen fails.

## 10. Output

- Copy-only (no downloads)
- Tiptap editor enabled
- Humanize: enabled (level full)

## 11. Integrations

Buffer ✅ / Google Drive ✅ / Notion ✅

## 12. Smoke test results (April 19-20, 2026)

| Test | Result |
|---|---|
| Single tweet mode | ✅ 1 tweet, under 280 chars |
| Thread mode | ✅ Numbered thread, correct structure |
| Content batch mode | ✅ Sequential labels, single tweets per mix selection |
| Voice matching | ✅ Holy Cow opener, !! density, ALL CAPS, reactive energy |
| 280-char enforcement | ✅ 13/13 tweets clean on meaty thread |
| Mode switching (default unselected) | ✅ Root cause fixed globally |

## 13. Notable bugs fixed in this cycle

1. **Global form submission bug** — select fields with defaultValue were never submitted if user didn't touch them (98 fields, 47 workers). Fixed in `page.jsx`.
2. **Single tweet mode** — content_type missing from input → fell back to 'Thread'. Fixed by global defaultValue fix + mode directive in execute-task.
3. **Content batch formatting** — missing post labels, multi-paragraph posts. Fixed with strict format rules.
4. **Voice match priority** — tone branches were overriding voice samples. Fixed by structural restructure: voice match injected before task context, tone branches explicitly subordinated.
5. **Double arrow** — submitLabel had `→` which render code also appended. Fixed.

## 14. Change log

| Date | Change | Commits |
|---|---|---|
| 2026-04-19 | Initial QA audit | pre-v28 branch |
| 2026-04-19 | Full product redesign — 3 modes, 8 tones, 8 goals, Hook Library v1, voice match, 280-char enforcement | c9beff7 |
| 2026-04-19 | Single tweet fix, double arrow fix, content batch fix | 6d6b1f5, d2dffda, c6fb0be |
| 2026-04-19 | Root cause fix: global select defaultValue submission | 1273384, f5979dd |
| 2026-04-19 | Voice match surface style fix | 983d22d |
| 2026-04-20 | Voice match structural override + tone subordination | 55d950c, 05c2c2d |
| 2026-04-20 | Launch sign-off by JR | — |

---

*Living document. Owner: CMO / audit process.*
