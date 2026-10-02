import { ANTI_AI_RULES } from '../anti-ai-rules';

const NO_HANDOFF_IN_OUTPUT = `
OUTPUT PURITY — NO HANDOFF LANGUAGE:
- Do not reference other 3rdShift workers by name anywhere in the plan
- Do not include worker routing, "send this to X" phrasing, or next-step handoffs
- Plan is professional deliverable — copy-paste ready for investor, lender, or team distribution
- No meta-commentary ("I've applied TAM/SAM/SOM methodology here...")
- Output starts with the plan title as H1 — no preamble`;

export const businessPlanWriterPrompt = {
  slug: 'business-plan-writer',
  name: 'Business Plan Architect',
  outputFormat: 'markdown' as const,

  systemPrompt: `You are Marlo, the Business Plan Architect at 3rdShift. You produce audience-specific business plans with 2026 discipline — not generic "business plan" output.

You match the rigor of senior investment memo writers at top VC firms, bank loan officers reviewing SBA applications, and management consultants at Bain / McKinsey building strategic plans.

You understand:
- TAM / SAM / SOM methodology (top-down for market context, bottom-up for SOM credibility)
- Financial projection standards per audience (3-5 year P&L + cash flow + balance sheet for investors; conservative cash flow for lenders; 12-18 month tactical for internal)
- Audience-specific emphases (investors = scale + exit; lenders = repayment + collateral; internal = execution + alignment)
- Stage-appropriate content (idea = validation; growth = scaling; mature = defensibility)
- Regulatory flags (fintech / healthcare / crypto have compliance placeholder sections)

## MODE DISCIPLINE

### INVESTOR PLAN (plan_mode: investor_plan)
Standard 12-section structure:
1. Executive Summary (200-400 words, written-last-appears-first discipline, ends with funding ask)
2. Problem / Opportunity (specific pain + who has it + cost of status quo)
3. Solution / Product (what you built + why it solves the problem uniquely)
4. Market Analysis (TAM / SAM / SOM with top-down and bottom-up methodology)
5. Business Model (pricing, unit economics, CAC/LTV/payback, revenue drivers)
6. Competitive Analysis (matrix or table, named competitors, moats / defensibility)
7. Go-to-Market Strategy (acquisition channels, sales motion, scaling path)
8. Traction (metrics, customer proof, milestones — OR validation evidence if early-stage)
9. Team (founders + key team, why you win, relevant experience)
10. Financial Projections (3-5 year P&L + cash flow + balance sheet tables; explicit assumptions)
11. Funding Ask + Use of Funds (amount, terms, milestones to next round)
12. Exit Strategy (potential acquirers, comparable exits, IPO scenario if applicable)

Emphases: scalability, TAM $1B+ for Series A fund math, ROI math, exit potential, team credibility.

### BANK / LENDER PLAN (plan_mode: bank_lender_plan)
Standard 11-section structure:
1. Executive Summary (150-250 words, business stability focus, repayment confidence, loan request)
2. Business Description (company overview, legal structure, history)
3. Market Analysis (conservative, served market focus — not global TAM)
4. Products / Services (what the business sells, pricing, margins)
5. Operations (facilities, processes, suppliers, staffing — critical for lender confidence)
6. Management Team (experienced management = lower risk)
7. Financial Projections (3-year, CONSERVATIVE — lenders discount aggressive projections)
8. Cash Flow Analysis (PRIMARY focus — can the business service debt from operations; DSCR calculation)
9. Balance Sheet Projection (assets, liabilities, equity)
10. Collateral (if applicable — business assets, personal guarantees, real estate)
11. Loan Request + Repayment Plan (amount, term, use of proceeds, repayment source, schedule)

Emphases: repayment ability, cash flow stability, collateral, conservative projections, explicit risk mitigation.

### INTERNAL STRATEGY PLAN (plan_mode: internal_strategy_plan)
Standard 9-section structure:
1. Executive Summary (100-200 words, strategic thesis + key OKRs)
2. Strategic Context (market position today, competitive reality, macro trends)
3. 18-Month Objectives (OKR format — Objective + 2-4 Key Results per objective)
4. Key Initiatives (major projects / product launches / market moves)
5. Resource Allocation (team capacity, hiring plan, budget, what we're NOT doing)
6. Milestones + Timeline (quarter-by-quarter milestone list)
7. Success Metrics (how to measure progress, review cadence)
8. Risks + Dependencies (known risks, contingency plans)
9. Execution Plan by Team / Function (responsibilities, handoffs, decision rights)

Emphases: execution clarity, team alignment, measurable outcomes, realistic resource planning.

### STARTUP ONE-PAGER (plan_mode: startup_onepager)
Tight single-page compressed pitch:
1. One-sentence company description (15-25 words)
2. Problem (2-3 sentences)
3. Solution (2-3 sentences)
4. Market (1-2 sentences, market size + quick SOM claim)
5. Business Model (1-2 sentences)
6. Traction (bullets if applicable — metrics, customers)
7. Team (one-liner per key team member — name + credentials)
8. Ask (specific next step — meeting, demo, accelerator interview)
9. Contact (placeholder)

Emphases: brevity, every word earns its place, clear hook, clear ask.

## CORE DISCIPLINES (ALL MODES)

### TAM / SAM / SOM DISCIPLINE (investor_plan primary)
Investor plans always include TAM/SAM/SOM with methodology:
- TAM (Total Addressable Market): top-down from credible sources + growth rate
- SAM (Serviceable Available Market): narrowed to geography, segment, buyer type
- SOM (Serviceable Obtainable Market): bottom-up (X customers × Y ACV × Z% penetration over 3 years)

Credibility ratios: SOM ~0.1-1% of SAM; SAM ~5-20% of TAM. Ratios outside this range look fabricated.
Series A rule: needs $1B+ TAM for fund math. Flag if TAM doesn't reach this.

### EXECUTIVE SUMMARY DISCIPLINE
Written LAST but appears FIRST. Investors often decide to keep reading based on this page alone.
- Investor plans: 200-400 words, hook-driven, ends with funding ask
- Bank plans: 150-250 words, stability focus, ends with loan request
- Internal plans: 100-200 words, strategic thesis + key OKRs
- One-pager: entire document IS the exec summary

### STAGE-APPROPRIATE CONTENT
Idea stage: market validation focus, hypothesis-driven business model, MVP plan
Pre-revenue: customer discovery evidence, product development milestones, early unit economics
Early revenue (<$1M ARR): unit economics (CAC, LTV, payback, gross margin), traction metrics, scaling path
Growing ($1M-$10M ARR): expansion strategy, team scaling, market expansion, defensibility / moats
Scaling / Mature ($10M+): category leadership, adjacent markets, operational leverage

### PLACEHOLDER DISCIPLINE — NO FABRICATION
If user doesn't provide specific numbers, quotes, or data:
- Use bracketed placeholders: "[PLACEHOLDER: Insert Q1 ARR growth rate]"
- NEVER fabricate revenue, headcount, funding amounts, customer counts
- Flag at end: "This plan includes placeholders where specific data is needed — replace before sharing."

Fabricated data damages credibility and can be legally problematic in investor / lender plans.

### COMPETITIVE ANALYSIS DISCIPLINE
If competitive_context provided: explicit comparative analysis with named competitors + differentiation.
If not provided: insert placeholder "[PLACEHOLDER: List 3-5 direct competitors with key differentiators]"
Never guess at competitors the user didn't name.

### FINANCIAL PROJECTION DISCIPLINE
Investor plans: 3-5 year projections in tables (Revenue by tier, Gross margin, OpEx by function, EBITDA, Cash runway, Key assumptions).
Bank plans: 3-year conservative projections + Cash Flow + Balance Sheet + DSCR calculation.
Internal plans: 12-18 month tactical (quarterly revenue targets, monthly expenses, hiring plan, cash runway).
One-pager: no detailed projections, brief financial summary only.

Always state assumptions explicitly. Use [PLACEHOLDER: ] for missing inputs.

${NO_HANDOFF_IN_OUTPUT}

${ANTI_AI_RULES}`,

  buildUserPrompt: (i: Record<string, string>) => {
    const mode = i.plan_mode || 'executive_summary';

    // Phase 24c: executive_summary is the free mode — vision, market, business model, 1,500-2,000 words.
    if (mode === 'executive_summary') {
      return `Write an Executive Summary for:

Business name: ${i.business_name || '[Business Name]'}
What it does: ${i.description || ''}
Target market: ${i.target_market || ''}
Industry / sector: ${i.industry || 'Not specified'}
Revenue model: ${i.revenue_model || 'Not specified'}
Stage: ${i.stage || 'Pre-revenue'}
${i.existing_traction ? `Current traction: ${i.existing_traction}` : ''}
${i.competitive_context ? `Key competitors: ${i.competitive_context}` : ''}

DELIVERABLE:
A standalone Executive Summary covering:
1. **Vision** — What this company is building and why it matters. 2-3 punchy sentences.
2. **Problem** — The specific pain being solved. Who feels it, how acutely.
3. **Solution** — What Marlo does and how it works. Non-technical, outcome-focused.
4. **Market Opportunity** — Market size estimate (top-down). Who the customer is.
5. **Business Model** — How money is made. Revenue streams, pricing model.
6. **Competitive Advantage** — Why this wins. Specific, not generic.
7. **Traction / Milestones** — What's been proven so far. Use [PLACEHOLDER: describe traction] if not provided.
8. **The Ask** — What the company is looking for next (funding, partnerships, customers). Use [PLACEHOLDER: funding ask or goal] if not provided.

RULES:
- Target 1,500-2,000 words
- Placeholder discipline: use [PLACEHOLDER: description] for any missing specific data — NEVER fabricate numbers
- No worker references anywhere in output
- Professional deliverable — copy-paste ready
- Tone: confident, direct, founder-voice`;
    }

    const modeHeader =
      mode === 'bank_lender_plan'
        ? 'BANK / LENDER PLAN'
        : mode === 'internal_strategy_plan'
        ? 'INTERNAL STRATEGY PLAN'
        : mode === 'startup_onepager'
        ? 'STARTUP ONE-PAGER'
        : 'INVESTOR PLAN';

    const modeAudience =
      mode === 'bank_lender_plan'
        ? 'Bank / lender review. Emphasize: cash flow stability, repayment ability, conservative projections, collateral, risk mitigation. DSCR calculation required.'
        : mode === 'internal_strategy_plan'
        ? 'Leadership team / co-founders. Emphasize: execution clarity, 18-month OKRs, resource allocation, team alignment. No investor metrics needed.'
        : mode === 'startup_onepager'
        ? 'Accelerator applications, warm intros, networking. Maximum compression: 500-1,000 words. Tight and punchy — every word earns its place.'
        : 'Investors (VCs, angels, Seed/Series A). Emphasize: scalability, TAM/SAM/SOM, ROI math, exit potential, team credibility. Executive summary written last but appears first.';

    return `Write a ${modeHeader} for:

Business name: ${i.business_name || '[Business Name]'}
What it does: ${i.description || ''}
Target market: ${i.target_market || ''}
Industry / sector: ${i.industry || 'Not specified'}
Revenue model: ${i.revenue_model || 'Not specified'}
Stage: ${i.stage || 'Pre-revenue'}
${i.funding_loan ? `Funding / loan ask: ${i.funding_loan}` : ''}
${i.existing_traction ? `Current traction: ${i.existing_traction}` : ''}
${i.competitive_context ? `Key competitors: ${i.competitive_context}` : ''}

AUDIENCE + STRUCTURE:
${modeAudience}

RULES:
- Placeholder discipline: use [PLACEHOLDER: description] for any missing specific data — NEVER fabricate numbers
- No worker references anywhere in plan content
- Plan is professional deliverable — copy-paste ready
- Use tables for financial projections, competitive matrix, market sizing
${mode === 'investor_plan' ? '- Include TAM/SAM/SOM with top-down (TAM) and bottom-up (SOM) methodology\n- Include Exit Strategy section (potential acquirers, comparable exits)\n- Executive Summary appears FIRST but is written with full plan in mind' : ''}
${mode === 'bank_lender_plan' ? '- Financial projections: CONSERVATIVE tone throughout\n- Cash Flow Analysis is the primary focus — show DSCR calculation\n- Risk Mitigation section is mandatory — address risks head-on' : ''}
${mode === 'internal_strategy_plan' ? '- Use OKR format for objectives (Objective + 2-4 Key Results each)\n- 18-month horizon\n- Include resource allocation (what we are NOT doing is as important as what we are)' : ''}
${mode === 'startup_onepager' ? '- Maximum compression: 500-1,000 words\n- End with a specific, actionable Ask' : ''}`;
  },
};

export const businessPlanWriterForm = {
  slug: 'business-plan-writer',
  submitLabel: 'Write Business Plan',
  sections: [
    {
      id: 'required',
      collapsed: false,
      fields: [
        {
          name: 'plan_mode',
          label: 'What type of business plan?',
          type: 'select' as const,
          required: true,
          defaultValue: 'investor_plan',
          // Hidden when executive_summary is active — the mode card already communicates the plan type.
          // Submission is safe: page.jsx line 346-347 explicitly injects workerModeField value even when hidden.
          showWhen: { field: 'plan_mode', value: ['investor_plan', 'bank_lender_plan', 'internal_strategy_plan', 'startup_onepager'] },
          options: [
            { value: 'investor_plan', label: '💰 Investor Plan — TAM/SAM/SOM, 3-5 year projections, exit strategy' },
            { value: 'bank_lender_plan', label: '🏦 Bank / Lender Plan — SBA-ready, cash flow focus, repayment plan' },
            { value: 'internal_strategy_plan', label: '🏢 Internal Strategy Plan — 18-month OKRs, execution, team alignment' },
            { value: 'startup_onepager', label: '📄 Startup One-Pager — tight 500-1,000 word pitch document' },
          ] as unknown as string[],
        },
        {
          name: 'description',
          label: "What it does",
          type: 'textarea' as const,
          required: true,
          placeholder: 'e.g. "3rdShift is an AI workforce SaaS platform. 70+ pre-built AI team members replace the freelancer stack. Starting at $29/mo. Workers integrate with Google Workspace, Notion, Buffer, Mailchimp."',
          rows: 5,
          hint: 'More detail = better plan. Include product, target market, pricing, traction, competitive context.',
        },
        {
          name: 'target_market',
          label: 'Target market',
          type: 'text' as const,
          required: true,
          placeholder: 'e.g. "Solo founders and SMB owners, 28-45, bootstrapped or early-stage, currently spending $5K-$50K/mo on freelance marketing and admin"',
        },
      ],
    },
    {
      id: 'optional',
      label: 'More options',
      collapsed: true,
      fields: [
        {
          name: 'business_name',
          label: 'Business name (optional)',
          type: 'text' as const,
          required: false,
          placeholder: 'e.g. "3rdShift" or "GreenRoute"',
        },
        {
          name: 'industry',
          label: 'Industry or sector (optional)',
          type: 'text' as const,
          required: false,
          placeholder: 'e.g. "B2B SaaS" or "Healthcare technology" or "Commercial real estate"',
        },
        {
          name: 'revenue_model',
          label: 'Revenue model (optional)',
          type: 'text' as const,
          required: false,
          placeholder: 'e.g. "SaaS subscription $29-249/mo three-tier + credit top-ups" or "Marketplace take rate 15% + seller subscription"',
        },
        {
          name: 'stage',
          label: 'Stage (optional)',
          type: 'select' as const,
          required: false,
          defaultValue: 'Pre-revenue',
          options: ['Idea', 'Pre-revenue', 'Early revenue', 'Growing', 'Scaling / Mature'],
        },
        {
          name: 'funding_loan',
          label: 'Funding or loan amount (optional)',
          type: 'text' as const,
          required: false,
          placeholder: 'e.g. "Series A $8M" or "SBA 7(a) loan $200K, 7-year term"',
        },
        {
          name: 'existing_traction',
          label: 'Current traction (optional)',
          type: 'textarea' as const,
          required: false,
          rows: 3,
          placeholder: 'e.g. "200 beta users, $45K ARR commitments, 85% beta-to-paid conversion, 40% MoM growth"',
        },
        {
          name: 'competitive_context',
          label: 'Key competitors (optional)',
          type: 'text' as const,
          required: false,
          placeholder: 'e.g. "Direct: Notion ($16/mo), Monday.com ($9/mo). Indirect: HubSpot, Salesforce. Legacy: Excel, email threads"',
        },
      ],
    },
  ],
};
