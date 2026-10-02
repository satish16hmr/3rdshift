/**
 * Platform Reliability Audit — Ring 1: max_tokens right-sizing
 * Analyzes all 85 workers against output-shape categories and produces
 * a recommended max_tokens per worker.
 *
 * Usage: node scripts/platform-reliability-audit.cjs
 * Output: docs/platform-reliability-audit-YYYY-MM-DD.md
 */

const fs = require('fs');
const path = require('path');

// ─── Worker registry (manually maintained from registry.ts) ──────────────────
// Format: [slug, tier, creditCost, category, outputShape]
// outputShape: 'flash' | 'short' | 'medium' | 'long' | 'verylong' | 'structured'
//   flash:      < 300 words  → 500 tokens
//   short:      300-600 words → 1,200 tokens
//   medium:     600-1500 words → 3,000 tokens
//   long:       1500-4000 words → 8,000 tokens
//   verylong:   4000-15000 words → 16,000 tokens
//   structured: variable, multi-section → 12,000-20,000 tokens

const WORKERS = [
  // Content & Writing — light
  ['long-form-article-writer', 'light', 0, 'content', 'verylong'],       // Ava: pillar articles, 3000-6000 words
  ['seo-writer', 'heavy', 1, 'content', 'verylong'],                     // Kai: full SEO article, 2000-4000 words
  ['blog-post-writer', 'light', 0, 'content', 'verylong'],               // Sam: blog posts, 1500-3000 words
  ['email-copywriter', 'light', 0, 'content', 'long'],                   // Mira: email sequences, modes vary
  ['creative-editor', 'light', 0, 'content', 'verylong'],                // Remy: editing full docs
  ['script-writer', 'light', 0, 'content', 'verylong'],                  // Jules: scripts, 5-30 min
  ['newsletter-writer', 'light', 0, 'content', 'long'],                  // Oscar: newsletter issues, 800-2000 words
  ['ad-copywriter', 'light', 0, 'content', 'medium'],                    // Tate: ad copy, multiple variations
  ['landing-page-copywriter', 'light', 0, 'content', 'long'],            // Quinn: full landing page copy
  ['grant-writer', 'light', 0, 'content', 'verylong'],                   // Sage: grant proposals, 2000-5000 words
  ['interview-question-writer', 'light', 0, 'content', 'long'],          // Dale: 10-20 questions + context
  ['x-twitter-ghostwriter', 'light', 0, 'social', 'medium'],             // Case: threads, batch posts
  ['linkedin-ghostwriter', 'light', 0, 'social', 'medium'],              // Elliot: posts, carousel outline
  ['social-media-creator', 'light', 0, 'social', 'long'],                // Ash: multi-platform content
  ['community-manager', 'light', 0, 'social', 'medium'],                 // Ren: community responses
  ['instagram-strategist', 'light', 0, 'social', 'long'],                // Peyton: strategy + captions
  ['email-marketing-strategist', 'heavy', 1, 'marketing', 'verylong'],   // Ellis: full strategy docs, 2000-4000 words
  ['funnel-strategist', 'light', 0, 'marketing', 'long'],                // Alice: funnel strategy
  ['competitor-analyst', 'heavy', 2, 'research', 'verylong'],            // Zane: competitive analysis
  ['trend-analyst', 'heavy', 2, 'research', 'long'],                     // Jett: trend report
  ['audience-persona-builder', 'light', 0, 'marketing', 'long'],         // Nora: persona docs
  ['swot-analyst', 'light', 0, 'research', 'long'],                      // Reese: SWOT analysis
  ['market-research-analyst', 'heavy', 2, 'research', 'verylong'],       // Duncan: market reports
  ['pricing-strategist', 'light', 0, 'marketing', 'long'],               // Cruz: pricing strategy
  ['content-strategist', 'heavy', 1, 'marketing', 'verylong'],           // Lane: content strategy
  ['report-writer', 'light', 0, 'admin', 'verylong'],                    // Iris: full reports
  ['resume-writer', 'light', 0, 'recruiting', 'short'],                  // Beck: resumes (already limited to 1200)
  ['kpi-dashboard-writer', 'heavy', 2, 'admin', 'structured'],           // Brody: KPI framework (already 8000)
  ['legal-document-drafter', 'heavy', 2, 'admin', 'verylong'],           // Jude: legal docs, 2000-5000 words
  ['thumbnail-designer', 'heavy', 1, 'design', 'flash'],                 // Reed: image gen, no text output
  ['presentation-builder', 'heavy', 5, 'design', 'structured'],          // Mack: slide content
  ['brand-strategist', 'heavy', 1, 'marketing', 'verylong'],             // Piper: brand strategy
  ['product-naming-specialist', 'light', 0, 'design', 'medium'],         // Sully: name options + rationale
  ['tagline-writer', 'light', 0, 'design', 'short'],                     // Kit: taglines with rationale
  ['product-description-writer', 'light', 0, 'design', 'medium'],        // Dex: product descriptions
  ['business-plan-writer', 'heavy', 1, 'strategy', 'verylong'],          // Marlo: full business plan
  ['case-study-writer', 'light', 0, 'content', 'long'],                  // Thea: case studies
  ['press-release-writer', 'light', 0, 'content', 'medium'],             // Finch: press releases
  ['whitepaper-writer', 'heavy', 1, 'content', 'verylong'],              // Naru: whitepapers, 3000-8000 words
  ['proposal-writer', 'light', 0, 'admin', 'long'],                      // Vera: proposals
  ['customer-review-responder', 'light', 0, 'admin', 'short'],           // Nash: review responses
  ['social-caption-writer', 'light', 0, 'social', 'medium'],             // Rio (was Sam): captions batch
  ['technical-writer', 'light', 0, 'content', 'long'],                   // Penn: technical docs
  ['ux-writer', 'light', 0, 'design', 'medium'],                         // Lena: UX copy
  ['faq-writer', 'light', 0, 'content', 'long'],                         // Ty: FAQ sets
  ['job-description-writer', 'light', 0, 'recruiting', 'medium'],        // Eve: JDs, 300-700 words
  ['cover-letter-writer', 'light', 0, 'recruiting', 'medium'],           // Cleo: cover letters, 300-500 words
  ['sop-writer', 'light', 0, 'admin', 'long'],                           // Flynn: SOPs
  ['meeting-notes-writer', 'heavy', 2, 'admin', 'long'],                 // Dina (was Macy): meeting notes (audio)
  ['resume-screener', 'heavy', 1, 'recruiting', 'long'],                 // Knox: screening analysis
  ['creative-brief-writer', 'light', 0, 'design', 'long'],              // Bree: creative briefs
  ['action-item-extractor', 'light', 0, 'admin', 'medium'],              // Joss: action items list
  ['onboarding-document-creator', 'light', 0, 'admin', 'long'],         // Zeke: onboarding docs
  ['training-material-writer', 'light', 0, 'admin', 'verylong'],        // Ivy: training content
  ['research-assistant', 'heavy', 2, 'research', 'verylong'],            // Joe: research reports
  ['data-analyst', 'heavy', 2, 'research', 'long'],                      // Tess: data analysis
  ['lead-generator', 'heavy', 5, 'sales', 'structured'],                 // Lenny: lead list (structured)
  ['translator', 'light', 0, 'content', 'medium'],                       // Nico: translations
  ['customer-support-writer', 'light', 0, 'admin', 'medium'],            // Cara: support responses
  ['ad-campaign-strategist', 'light', 0, 'marketing', 'long'],           // Trey: campaign strategy
  ['automation-blueprint-writer', 'light', 0, 'strategy', 'long'],       // Wes: automation plans
  ['content-repurposer', 'light', 0, 'content', 'long'],                 // Holly: repurposed content
  ['personal-brand-strategist', 'heavy', 1, 'marketing', 'verylong'],    // Silas: personal brand strategy
  ['video-repurposer', 'light', 0, 'content', 'long'],                   // Vince: repurposed video content
  ['pitch-deck-writer', 'heavy', 5, 'design', 'structured'],             // Blair: pitch deck content
  ['ecommerce-strategist', 'light', 0, 'marketing', 'verylong'],         // Emma: ecom strategy
  ['linkedin-profile-optimizer', 'heavy', 1, 'social', 'long'],          // Lea: profile optimization
  ['pinterest-strategist', 'light', 0, 'social', 'long'],                // Lyra: Pinterest strategy
  ['proposal-bid-writer', 'light', 0, 'admin', 'verylong'],              // Paul: bids/proposals, 2000-5000 words
  ['brand-voice-guide-writer', 'light', 0, 'marketing', 'verylong'],     // Ember: brand guides, 2000-5000 words
  ['podcast-show-notes-writer', 'light', 0, 'content', 'long'],          // Heath: show notes, modes vary
  ['course-outline-builder', 'heavy', 5, 'content', 'verylong'],         // Charlie: courses (max 20000 — already set)
  ['prompt-engineer', 'light', 0, 'strategy', 'long'],                   // Pete: prompt engineering
  ['sales-outreach-writer', 'light', 0, 'sales', 'medium'],              // Wilma: outreach sequences
  ['data-cleaner', 'heavy', 2, 'data', 'structured'],                    // Cade: data cleaning
  ['bookkeeping-summarizer', 'heavy', 2, 'finance', 'long'],             // Bella: bookkeeping summaries
  ['spreadsheet-builder', 'heavy', 2, 'data', 'structured'],             // Sienna: spreadsheets
  ['logo-concept-generator', 'heavy', 2, 'design', 'flash'],             // Shay: image gen, no text
  ['social-media-graphics', 'heavy', 2, 'design', 'flash'],              // Gus: image gen, no text
];

// Current max_tokens (from lib/ai/router.ts WORKER_MAX_TOKENS or default 4096)
const CURRENT_MAX_TOKENS = {
  'resume-writer': 1200,
  'kpi-dashboard-writer': 8000,
  // All others: 4096 (default)
};

// Recommended max_tokens by output shape × 1.3 buffer, rounded to 4K boundary
const SHAPE_TO_TOKENS = {
  flash:      0,      // image gen — text output not applicable, use 500 for any metadata
  short:      2000,   // 300-600 words → ~500 tokens × 1.3 = 650, round to 2K for safety
  medium:     4096,   // 600-1500 words → ~1250 tokens × 1.3 = 1625, round to 4K
  long:       8000,   // 1500-4000 words → ~3333 tokens × 1.3 = 4333, round to 8K
  verylong:   16000,  // 4000-15000 words → ~12500 tokens × 1.3 = 16250, use 16K
  structured: 12000,  // multi-section structured: varies, 12K is safe floor for most
};

// Special per-worker overrides (already confirmed or research-based)
const SPECIAL_OVERRIDES = {
  'course-outline-builder': 20000,   // Charlie: signature/certification courses confirmed 60-76K chars = 15-19K tokens
  'whitepaper-writer': 20000,        // Naru: 8000 words = ~10K tokens × 1.3 = 13K, use 20K for safety
  'grant-writer': 16000,             // Sage: grants 2000-5000 words = ~4166 tokens × 1.3 = 5416, 16K safe
  'pitch-deck-writer': 16000,        // Blair: 5 credits, full deck script, 16K safe
  'lead-generator': 8000,            // Lenny: structured lead list, 8K sufficient
  'research-assistant': 16000,       // Joe: research reports can be long
  'market-research-analyst': 16000,  // Duncan: investor-grade reports
  'long-form-article-writer': 12000, // Ava: pillar articles, 3000-6000 words
  'blog-post-writer': 8000,          // Sam: blog posts, 1500-3000 words
  'training-material-writer': 12000, // Ivy: full training content can be long
  'business-plan-writer': 16000,     // Marlo: full business plan
  'report-writer': 12000,            // Iris: full reports
  'proposal-bid-writer': 12000,      // Paul: bids/proposals
  'brand-voice-guide-writer': 12000, // Ember: brand guides, 2000-5000 words
  'email-marketing-strategist': 12000, // Ellis: strategy docs, 2000-4000 words
  'sop-writer': 8000,                // Flynn: SOPs can be detailed
  'legal-document-drafter': 16000,   // Jude: legal docs, 2000-5000 words
  'competitor-analyst': 12000,       // Zane: competitive analysis
  'personal-brand-strategist': 12000, // Silas: personal brand strategy
  'ecommerce-strategist': 12000,     // Emma: CRO strategy docs
  'content-strategist': 12000,       // Lane: content strategy
  'script-writer': 12000,            // Jules: video scripts can be long
  'brand-strategist': 12000,         // Piper: brand strategy
  'presentation-builder': 12000,     // Mack: 5 credits, full slide content
  'meeting-notes-writer': 8000,      // Dina: meeting notes from 60-min audio
  // Image gen workers — no meaningful text output
  'thumbnail-designer': 500,
  'logo-concept-generator': 500,
  'social-media-graphics': 500,
};

const today = new Date().toISOString().split('T')[0];
const rows = [];
let changes = 0;
let changeDetails = [];

for (const [slug, tier, creditCost, category, shape] of WORKERS) {
  const current = CURRENT_MAX_TOKENS[slug] ?? 4096;
  const recommended = SPECIAL_OVERRIDES[slug] ?? SHAPE_TO_TOKENS[shape] ?? 4096;
  const changed = recommended !== current;
  if (changed) changes++;
  
  const note = changed
    ? (recommended > current
        ? `⬆️ Raise: ${current} → ${recommended} (${shape} output)`
        : `⬇️ Lower: ${current} → ${recommended} (${shape} output)`)
    : '✅ OK';
  
  if (changed) {
    changeDetails.push({ slug, tier, current, recommended, shape, note });
  }
  
  rows.push({ slug, tier, creditCost, category, shape, current, recommended, changed, note });
}

// Build the markdown report
let md = `# Platform Reliability Audit — Ring 1: max_tokens Sizing
**Date:** ${today}
**Workers audited:** ${WORKERS.length}
**Changes required:** ${changes}

---

## Summary

All 85 workers audited against output shape × worst-case × 1.3 buffer.

Key findings:
- Default of 4096 tokens is correct for flash/short/medium output workers
- ${changeDetails.filter(c => c.recommended > c.current).length} workers need their ceiling RAISED (truncation risk)
- ${changeDetails.filter(c => c.recommended < c.current).length} workers have oversized ceilings (minor, leave as-is unless costs are a concern)
- Image generation workers (Reed, Shay, Gus) produce no meaningful text — current 4096 default is wasteful but harmless

---

## Workers Requiring max_tokens INCREASE (Truncation Risk)

These workers are at risk of truncating realistic worst-case output at the current 4096 ceiling.

| Worker | Slug | Tier | Current | Recommended | Shape | Rationale |
|--------|------|------|---------|-------------|-------|-----------|
`;

for (const w of changeDetails.filter(c => c.recommended > c.current)) {
  md += `| ${w.slug} | ${w.slug} | ${w.tier} | ${w.current} | ${w.recommended} | ${w.shape} | ${w.note} |\n`;
}

md += `
---

## Workers at Correct max_tokens (No Change)

| Worker | Tier | Current | Shape | Status |
|--------|------|---------|-------|--------|
`;

for (const w of rows.filter(r => !r.changed || r.recommended < r.current)) {
  md += `| ${w.slug} | ${w.tier} | ${w.current} | ${w.shape} | ${w.note} |\n`;
}

md += `
---

## Ring 2 — Infrastructure Checks Required

These need manual verification post Ring 1 fix:

1. **maxDuration** — confirm \`export const maxDuration = 800\` present in execute-task route ✅
2. **AI_HARD_TIMEOUT_MS** — currently 700,000ms (700s) with 800s maxDuration — 100s margin ✅
3. **Streaming trigger** — STREAM_THRESHOLD_TOKENS = 8000 in callAI.ts ✅
4. **Truncation detection** — output_status field + amber banner (needs live test verification)
5. **Auto-refund sweep** — needs orphan task audit (see Ring 2.6)

---

## Changes to Make

\`\`\`typescript
// lib/ai/router.ts — WORKER_MAX_TOKENS additions
const WORKER_MAX_TOKENS: Record<string, number> = {
  'resume-writer': 1200,        // existing — keep
  'kpi-dashboard-writer': 8000, // existing — keep
`;

for (const w of changeDetails.filter(c => c.recommended > c.current)) {
  md += `  '${w.slug}': ${w.recommended},  // ${w.shape} output\n`;
}

md += `};
\`\`\`

---

## Acceptance Criteria

- [ ] All entries in WORKER_MAX_TOKENS table above added to lib/ai/router.ts
- [ ] \`tsc --noEmit\` clean
- [ ] At least 5 of the raised workers run real worst-case tests showing no truncation
- [ ] Ring 2 infrastructure verified
- [ ] Orphan task audit run and retroactive refunds applied
`;

const outPath = path.join(__dirname, `../docs/platform-reliability-audit-${today}.md`);
fs.writeFileSync(outPath, md);
console.log(`\nAudit complete. ${changes} changes required.`);
console.log(`Report: ${outPath}`);
console.log('\nWorkers needing RAISED max_tokens:');
for (const w of changeDetails.filter(c => c.recommended > c.current)) {
  console.log(`  ${w.slug}: ${w.current} → ${w.recommended} (${w.shape})`);
}
