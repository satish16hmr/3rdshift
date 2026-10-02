# Worker Pricing Framework

**Last updated:** 2026-04-22  
**Status:** Active — applies to all current and future workers

---

## 4 Pricing Buckets

### 1. Light (0 credits — included on all plans)

Short-to-medium outputs. Compute cost < $0.04 per task. No credit charge.

**Criteria:**
- Output < 1,500 tokens (~375 words)
- Compute cost < $0.04/task
- Available on all plans (Starter+)

**Examples:** Dex (product descriptions), Elliot (LinkedIn posts), Dex product description modes

---

### 2. Heavy (1–5 credits, Pro+)

Premium or uniformly long outputs. Compute cost $0.04–$0.25 per task.

**Credit scale by output size:**

| Output Size | Tokens | Credits | Compute Cost | Revenue @ $1.45/cr | Margin |
|-------------|--------|---------|-------------|-------------------|--------|
| 600-1,500 words | 1,500-3,000 | 1 credit | ~$0.04-$0.06 | $1.45 | ~96-97% |
| 1,500-3,000 words | 3,000-6,000 | 2 credits | $0.06-$0.12 | $2.90 | ~96-98% |
| 3,000-5,000 words | 6,000-10,000 | 3 credits | $0.12-$0.20 | $4.35 | ~95-97% |
| 5,000+ words / multi-part | 10,000+ | 5 credits | $0.20+ | $7.25 | ~97%+ |

**Note:** Variable-cost workers (audio STT, image generation, video generation) must account for third-party API costs in addition to Claude tokens.

---

### 3. Fully Heavy Workers

Workers where every mode is genuinely Heavy by nature. Don't force a fake Light mode.

**Rules:**
- Accept the worker is Fully Heavy
- If Light count drops below 50, build new Light backfill workers
- Never nerf a Heavy worker mode just to create a "Light entry point"

**Examples:** Charlie (course-outline-builder), any future whitepaper/business plan worker

---

### 4. Acquisition Free

Strategic decision — specific workers priced at 0 credits despite compute cost. Positions as "try the magic" conversion hooks.

**Rules:**
- Maximum 2–3 workers platform-wide at any time
- Requires explicit JR approval with business rationale
- Not a default — must be defended
- Monitor compute cost at scale; reassess if volume grows

**Current Acquisition Free workers:** To be designated by JR

---

## Decision Tree for Any New Worker

**Step 1: Natural output shape?**
- Short (< 1,500 tokens) → Light default
- Medium (1,500–3,000 tokens) → Light if common use, 1–2 credits if premium
- Long (3,000–6,000 tokens) → 2–3 credits
- Very long (6,000+ tokens) → 3–5 credits

**Step 2: Mode-priced or uniform?**
- Can modes meaningfully vary output size without nerfing quality? → Mixed pricing
- All modes produce similar output by nature? → Uniform pricing

**Step 3: Forbidden pattern check**
- Is the "Light" mode a real, usable deliverable (not a teaser)? If teaser → make Fully Heavy
- Is it 1 Light mode + everything else Heavy? → Either add more Light modes OR make Fully Heavy

**Step 4: Light count impact**
- Does the platform still have 50+ Light workers? → Ship
- Below 50? → Pause, flag to JR, decide: reclassify / build backfill / approve drop

---

## Hard Rules (No Exceptions)

1. **No "1 Light + all Heavy" pattern.** Either add more Light modes OR make the worker Fully Heavy.
2. **Every Light mode must be a real deliverable.** Not a teaser, not a sample, not a preview.
3. **Compute cost > 5% of expected revenue** → flag to FA for repricing.
4. **Acquisition Free requires explicit JR approval** with business rationale. Not a default.
5. **Mixed pricing (some modes Light, some Heavy) within one worker is OK** — this is the preferred pattern for depth-varying workers.

---

## Soft Guidance

- Most common use case should be Light when possible — the first task a user runs should succeed without upgrade
- Premium-by-nature workers (Ember-class) can stay Light if downstream handoff value offsets thin margin; document rationale
- When in doubt between "weak Light" and "Fully Heavy," choose Fully Heavy and build a backfill Light worker

---

## Output-Size-to-Credits Quick Reference

| Output | Credit |
|--------|--------|
| Social posts, short copy (< 500 tokens) | 0 (Light) |
| Standard documents (500–3,000 tokens) | 1 credit |
| Long strategy docs (3,000–6,000 tokens) | 2 credits |
| Very long multi-section (6,000–10,000 tokens) | 3 credits |
| Course-class deliverables (10,000+ tokens) | 5 credits |
| + Variable external API cost | +1 credit per ~$0.10 API cost |

---

## Light Count Protection

**Target: 50+ Light workers always**

Current (post-Tier-3 rebuilds): ~65+ Light workers (most of the 85 are light by output size)

Monitoring:
- Count Light workers after each specialist rebuild wave
- If count drops toward 50, build backfill Light workers before shipping more Heavy ones
- Never trade Light workers for Heavy without JR approval

---

## Examples from Current Workers

**Dina** — Mixed pricing model (1cr paste / 2cr audio). Gold standard for variable-cost mixed pricing. FA-validated.

**Duncan** — 2 credits flat across all depth settings. Under-charges on Deep Dive (3,633 output tokens at $0.12/task → 95.8% margin, still acceptable). Consider depth-based pricing in V2: Quick/Standard = 1cr, Deep = 2cr.

**Ellis** — 1 credit flat across all 7 modes. Under-charges on Campaign Calendar (6,387 tokens at $0.11/task → 92.6% margin). Recommendation: Campaign Calendar = 2 credits.

**Ember** — 0 credits (Light), avg 5,818 output tokens, $0.09/task compute. Justified only if downstream handoff volume is high. Otherwise should be 1–2 credits. Flag to JR.

**Emma** — 0 credits (Light), avg 3,046 tokens, $0.04–$0.07/task compute. Store Audit and Funnel Diagnosis are premium 3,000+ token outputs. Recommendation: mixed (see audit report).

**Silas (Website Builder)** — Mixed pricing model. 2 credits per initial generation (full page, up to 16K output tokens). 1 credit per section refinement (single section, ~2K tokens). +1 credit per AI-generated image (fal.ai flux-pro, optional, max 4 per page). Pattern established April 25, 2026 as the platform's first multi-tier mixed pricing worker with per-operation charges. Reference for future interactive/iterative workers.

---

## Forward Application

### Pre-Ship Pricing Checklist

For every new worker before shipping:
- [ ] Output-size-to-credit mapping applied per mode (see table above)
- [ ] Light count impact assessed (still 50+?)
- [ ] Forbidden patterns checked ("1 Light + all Heavy"?)
- [ ] FA validation if margin math is unclear
- [ ] Pricing documented in worker's evidence doc
- [ ] Credit display in form UI matches pricing
- [ ] Plan tier gating (Free/Pro+/Operator) set correctly

### Finch (Press Release Writer)
- Output: 400–600 words (~150–200 tokens) across all 7 modes
- **Pricing: Light 0 credits, all plans**
- Rationale: Short output, all modes similar length, framework says "< 1,500 words → Light default"

### Flynn (SOP Writer)
- Output varies by mode: Checklist ~500 words, Step-by-Step ~800, Flowchart ~600, Hierarchical ~2,000+
- **Pricing: Light 0 credits for Checklist/Step-by-Step/Flowchart; Heavy 1 credit for Hierarchical**
- Rationale: Mixed model. Hierarchical produces 3,000+ word multi-section docs (same tier as Ellis standard modes).
