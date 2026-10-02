// Nash — Site Auditor
// V28 Phase 2 Worker 2 — reshaped from Customer Review Responder (Apr 25, 2026)
// APIs: Google PageSpeed Insights + Serper + Claude Sonnet (orchestration)

export const CROSS_REFERENCE_ALLOWLIST = [
  { name: 'Kai', role: 'SEO Strategist', use: 'building a full SEO content strategy after the audit identifies gaps' },
  { name: 'Zane', role: 'Competitor Analyst', use: 'deeper competitor analysis beyond site performance metrics' },
  { name: 'Jett', role: 'Trend Analyst', use: 'understanding market trends that might explain traffic or ranking shifts' },
  { name: 'Silas', role: 'Website Builder', use: 'building a new site if audit recommendations require a full rebuild' },
];

const CROSS_REFERENCE_TEXT = CROSS_REFERENCE_ALLOWLIST
  .map(w => `- ${w.name} (${w.role}): ${w.use}`)
  .join('\n');

const FABRICATION_GUARDRAIL = `
FABRICATION GUARDRAIL — MANDATORY:
- Do NOT invent PageSpeed scores. If the API data is not in your input, state it is unavailable.
- Do NOT fabricate SEO rankings, SERP positions, or keyword data without Serper data.
- Do NOT invent competitor metrics.
- If an API fails or data is missing, surface the error clearly with a specific note like "PageSpeed data unavailable for this URL — check that the URL is publicly accessible."
- Do NOT fill data gaps with generic advice presented as live data.
- Placeholders and estimates are permitted only when clearly labeled as estimated.

CROSS-REFERENCE ALLOWLIST — only name these workers in your output, no others:
${CROSS_REFERENCE_TEXT}

NO HANDOFF LANGUAGE in the audit body. Cross-references belong in the "Recommended Next Steps" section only, and only when genuinely relevant.
`;

export const siteAuditorSystemPrompt = `You are Nash, the Site Auditor at 3rdShift. You audit websites using Google PageSpeed Insights data and live SERP research. You synthesize raw API data into clear, prioritized audit reports that a founder or developer can act on immediately.

Your job is to take the API data provided in the user message (PageSpeed scores, Core Web Vitals, audit opportunities, Serper SERP results) and produce a structured, human-readable audit report. You do NOT call external APIs yourself — the system has already done that and injected the data into your context.

${FABRICATION_GUARDRAIL}

OUTPUT STANDARDS:
- Lead with scores and verdicts. Busy founders scan first.
- Every issue you list must include: what it is, why it matters, and how to fix it.
- Prioritize by impact. Put the biggest wins first.
- Use markdown tables for comparison data (competitor benchmarks).
- Use numbered lists for prioritized actions.
- Be specific. "Your LCP is 4.2 seconds — the target is under 2.5s" beats "your LCP is slow."
- Tone: direct, expert, no fluff. You are a senior technical SEO and performance consultant.
- Never start your output with "I" or "Nash" — dive straight into the audit.`;

// Builds the user-facing prompt injected alongside API data
export function buildSiteAuditorPrompt(input: Record<string, string>, apiData: {
  performanceDesktop?: Record<string, unknown> | null;
  performanceMobile?: Record<string, unknown> | null;
  serperResults?: Array<{ title: string; snippet: string; link: string }>;
  competitorData?: Array<{ url: string; data: Record<string, unknown> | null; error?: string }>;
  errors?: string[];
}): string {
  const mode = input.audit_mode || 'performance_audit';
  const siteUrl = input.site_url || '';
  const businessContext = input.business_context || '';
  const targetKeywords = input.target_keywords || input.target_keywords_full || '';
  const targetLocation = input.target_location || 'United States';
  const competitorUrls = input.competitor_urls || input.competitor_urls_full || '';
  const benchmarkFocus = input.benchmark_focus || 'Overall';
  const primaryGoal = input.primary_goal || 'Conversion';

  const contextBlock = businessContext
    ? `\nBUSINESS CONTEXT: ${businessContext}`
    : '';

  const errorBlock = apiData.errors && apiData.errors.length > 0
    ? `\nAPI ERRORS (surface these clearly in your output — do not fabricate missing data):\n${apiData.errors.join('\n')}`
    : '';

  function formatPageSpeedData(data: Record<string, unknown> | null | undefined, strategy: string): string {
    if (!data) return `[${strategy} PageSpeed data unavailable]`;
    const lr = data.lighthouseResult as Record<string, unknown> | undefined;
    if (!lr) return `[${strategy} PageSpeed response missing lighthouseResult]`;
    const cats = lr.categories as Record<string, { score: number }> | undefined;
    const audits = lr.audits as Record<string, { displayValue?: string; title?: string; description?: string; score?: number; details?: { type?: string; overallSavingsMs?: number } }> | undefined;
    const perfScore = cats?.performance?.score != null ? Math.round(cats.performance.score * 100) : 'N/A';
    const seoScore = cats?.seo?.score != null ? Math.round(cats.seo.score * 100) : null;
    const a11yScore = cats?.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null;
    const bpScore = cats?.['best-practices']?.score != null ? Math.round(cats['best-practices'].score * 100) : null;

    const cwv = audits ? [
      `LCP: ${audits['largest-contentful-paint']?.displayValue || 'N/A'}`,
      `FID: ${audits['first-input-delay']?.displayValue || audits['max-potential-fid']?.displayValue || 'N/A'}`,
      `CLS: ${audits['cumulative-layout-shift']?.displayValue || 'N/A'}`,
      `FCP: ${audits['first-contentful-paint']?.displayValue || 'N/A'}`,
      `TBT: ${audits['total-blocking-time']?.displayValue || 'N/A'}`,
      `TTI: ${audits['interactive']?.displayValue || 'N/A'}`,
    ].join(' | ') : 'Core Web Vitals unavailable';

    // Top opportunities (type === 'opportunity' or numeric score < 1)
    const opportunities = audits ? Object.entries(audits)
      .filter(([, a]) => a.score != null && a.score < 1 && a.displayValue && a.title)
      .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
      .slice(0, 10)
      .map(([key, a], i) => `${i + 1}. ${a.title} — ${a.displayValue}${a.description ? ` (${a.description.slice(0, 120)})` : ''}`)
      .join('\n') : 'No opportunity data available';

    let scores = `Performance: ${perfScore}/100`;
    if (seoScore !== null) scores += ` | SEO: ${seoScore}/100`;
    if (a11yScore !== null) scores += ` | Accessibility: ${a11yScore}/100`;
    if (bpScore !== null) scores += ` | Best Practices: ${bpScore}/100`;

    return `[${strategy.toUpperCase()} PAGESPEED DATA]
Scores: ${scores}
Core Web Vitals: ${cwv}
Top Issues:
${opportunities}`;
  }

  function formatSerperData(results: Array<{ title: string; snippet: string; link: string }> | undefined): string {
    if (!results || results.length === 0) return '[No SERP data available]';
    return `[SERP DATA — ${results.length} results]\n` + results.slice(0, 8)
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.link}`)
      .join('\n\n');
  }

  function formatCompetitorData(competitors: Array<{ url: string; data: Record<string, unknown> | null; error?: string }> | undefined): string {
    if (!competitors || competitors.length === 0) return '[No competitor data]';
    return competitors.map(c => {
      if (c.error || !c.data) return `[${c.url}]: Data unavailable — ${c.error || 'unknown error'}`;
      return formatPageSpeedData(c.data, c.url);
    }).join('\n\n');
  }

  if (mode === 'single_page_scan') {
    // Phase 24c: free mode — PageSpeed only, top 5 issues, no Serper data.
    return `Produce a Single Page Scan report for: ${siteUrl}${contextBlock}${errorBlock}

${formatPageSpeedData(apiData.performanceDesktop, 'Desktop')}

REPORT STRUCTURE (use this exact structure, keep it focused and scannable):
## Single Page Scan: ${siteUrl}

### PageSpeed Score: [X]/100 (Desktop)
[Core Web Vitals: LCP, FID/INP, CLS values]

---

## Top 5 Issues to Fix
[Numbered list of top 5 speed/structure issues: Issue name — why it matters — how to fix it. Prioritize by impact. Be specific with actual values from the API data.]

---

## Quick Summary
[2-3 sentences: overall assessment and the single most important thing to fix first.]

---

## Recommended Next Steps
[2-3 actions. Cross-reference allowlist workers here only if genuinely relevant.]`;
  }

  if (mode === 'performance_audit') {
    return `Produce a Performance Audit report for: ${siteUrl}${contextBlock}${errorBlock}

${formatPageSpeedData(apiData.performanceDesktop, 'Desktop')}

${formatPageSpeedData(apiData.performanceMobile, 'Mobile')}

REPORT STRUCTURE (use this exact structure):
## Performance Audit: ${siteUrl}

### Desktop Performance Score: [X]/100
[Core Web Vitals table]

### Mobile Performance Score: [X]/100
[Core Web Vitals table]

---

## Top 10 Issues to Fix (prioritized by impact)
[Numbered list: Issue name — impact — what it is — how to fix it]

---

## Quick Wins (under 1 hour of work)
[3-5 items from the top 10 that a developer can fix fast]

---

## Recommended Next Steps
[3 prioritized actions. Cross-reference allowlist workers here only if genuinely relevant.]`;
  }

  if (mode === 'seo_audit') {
    return `Produce an SEO Audit report for: ${siteUrl}${contextBlock}
Target keywords: ${targetKeywords || 'Not specified'}
Target location: ${targetLocation}
${errorBlock}

${formatPageSpeedData(apiData.performanceDesktop, 'Desktop')}

${formatSerperData(apiData.serperResults)}

REPORT STRUCTURE:
## SEO Audit: ${siteUrl}

### On-Page SEO Assessment
[Synthesize from PageSpeed SEO category + meta tag data]

### Meta Tags Audit
[Title, meta description, H1, canonical, Open Graph — evaluate each]

### SERP Analysis
[For each target keyword if provided: position or "not ranking in top 10", top 3 competing pages]

### Keyword Opportunities
[5-10 keyword opportunities based on SERP data and competitive gaps]

### Technical SEO Flags
[sitemap.xml, robots.txt, schema markup, HTTPS, mobile, page speed impact on SEO]

### Recommended Actions
[Prioritized numbered list. Cross-references in this section only.]`;
  }

  if (mode === 'mobile_audit') {
    return `Produce a Mobile Experience Audit report for: ${siteUrl}${contextBlock}${errorBlock}

${formatPageSpeedData(apiData.performanceMobile, 'Mobile')}

REPORT STRUCTURE:
## Mobile Experience Audit: ${siteUrl}

### Mobile Performance Score: [X]/100
[Core Web Vitals — mobile specific]

### Mobile Usability
[Tap targets, text readability, viewport fit, plugin avoidance]

### Mobile-Specific Issues
[Top 10 mobile issues prioritized by impact]

### Mobile Quick Wins
[3-5 fast fixes a developer can ship today]

### Recommended Actions
[Prioritized numbered list. Cross-references in this section only.]`;
  }

  if (mode === 'competitor_benchmark') {
    return `Produce a Competitor Benchmark report for: ${siteUrl}
Competitors: ${competitorUrls}
Benchmark focus: ${benchmarkFocus}${contextBlock}${errorBlock}

YOUR SITE:
${formatPageSpeedData(apiData.performanceDesktop, 'Desktop')}

COMPETITORS:
${formatCompetitorData(apiData.competitorData)}

REPORT STRUCTURE:
## Competitor Benchmark: ${siteUrl}

### Performance Comparison Table
[Markdown table: Metric | Your Site | Comp 1 | Comp 2 | Comp 3 — include Performance Score, LCP, CLS, FCP, TBT]

### Where You're Winning
[Metrics and areas where your site outperforms]

### Where You're Losing
[Metrics and areas where competitors outperform — be specific with numbers]

### Specific Gaps to Close
[Numbered list: gap + recommendation for each]

### Recommended Focus Areas
[Priority list based on biggest gaps and competitive opportunity. Cross-references in this section only.]`;
  }

  if (mode === 'full_audit') {
    return `Produce a Full Site Audit report for: ${siteUrl}
Target keywords: ${targetKeywords || 'Not specified'}
Primary goal: ${primaryGoal}
Competitors (if provided): ${competitorUrls || 'None'}${contextBlock}${errorBlock}

YOUR SITE — DESKTOP:
${formatPageSpeedData(apiData.performanceDesktop, 'Desktop')}

YOUR SITE — MOBILE:
${formatPageSpeedData(apiData.performanceMobile, 'Mobile')}

SERP DATA:
${formatSerperData(apiData.serperResults)}

${apiData.competitorData && apiData.competitorData.length > 0 ? `COMPETITOR DATA:\n${formatCompetitorData(apiData.competitorData)}` : ''}

REPORT STRUCTURE:
## Full Site Audit: ${siteUrl}

### Executive Summary
[2-3 sentences. Overall health score (weighted avg). Top 3 priorities. Quick wins count.]

---

## Performance
[Full performance section — desktop + mobile scores, Core Web Vitals, top 10 issues]

## SEO
[Full SEO section — on-page, meta tags, SERP analysis if keywords provided, technical flags]

## Mobile
[Full mobile section — mobile score, usability, mobile-specific issues]

${apiData.competitorData && apiData.competitorData.length > 0 ? '## Competitor Snapshot\n[Abbreviated comparison table — key metrics only]' : ''}

---

## Prioritized 30-Day Action Plan

### Week 1 — Quick wins + critical fixes
### Week 2-3 — Medium priority
### Week 4 — Longer-term improvements

---

## Recommended Next Steps
[Cross-references in this section only if genuinely relevant.]`;
  }

  return `Produce a site audit for ${siteUrl}. Audit mode: ${mode}.${contextBlock}${errorBlock}

${formatPageSpeedData(apiData.performanceDesktop, 'Desktop')}
${formatSerperData(apiData.serperResults)}`;
}
