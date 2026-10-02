'use strict';
/**
 * gen-samples-v2.cjs — Deliverable 2, simplified approach
 * Generates samples directly via Anthropic API using worker system prompts
 * No HTTP calls to the app — reads configs directly
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = '/Users/3rdshift/.openclaw/workspace/3rdshift-frontend';
const OUT_DIR = '/Users/3rdshift/.openclaw/workspace/outputs/worker-samples';
const STATE_FILE = '/Users/3rdshift/.openclaw/workspace/outputs/samples-state.json';

// Load env
const envSrc = fs.readFileSync(path.join(FRONTEND, '.env.local'), 'utf8');
const env = {};
for (const line of envSrc.split('\n')) {
  const m = line.match(/^([^=]+)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const Anthropic = require(path.join(FRONTEND, 'node_modules/@anthropic-ai/sdk'));
const client = new Anthropic.default({ apiKey: env.ANTHROPIC_API_KEY });

fs.mkdirSync(OUT_DIR, { recursive: true });

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { completed: [], failed: [] }; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Get all workers sorted alphabetically ────────────────────────────────────
function getAllSlugs() {
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/registry.ts'), 'utf8');
  const seen = new Set();
  const slugs = [];
  for (const m of src.matchAll(/\{\s*\n?\s*slug:\s*'([^']+)'/g)) {
    if (!seen.has(m[1]) && m[1].length > 2) { seen.add(m[1]); slugs.push(m[1]); }
  }
  return slugs.sort();
}

function getWorkerName(slug) {
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/registry.ts'), 'utf8');
  const idx = src.indexOf(`slug: '${slug}'`);
  if (idx === -1) return slug;
  const block = src.slice(idx, idx + 500);
  const m = block.match(/personaName:\s*'([^']+)'/);
  const n = block.match(/name:\s*'([^']+)'/);
  return m && n ? `${m[1]} · ${n[1]}` : (n ? n[1] : slug);
}

function getSystemPrompt(slug) {
  // Check worker-specific file
  const workerDir = path.join(FRONTEND, 'lib/workers', slug);
  const promptFile = path.join(workerDir, 'prompt.ts');
  if (fs.existsSync(promptFile)) {
    const src = fs.readFileSync(promptFile, 'utf8');
    // Match template literal — handle nested backticks via ANTI_AI etc
    const m = src.match(/systemPrompt:\s*`([\s\S]+?)`\s*[,\n]/);
    if (m) return m[1];
    // Try longer match
    const start = src.indexOf('systemPrompt: `');
    if (start !== -1) {
      // Find the closing backtick that's not inside ${...}
      let depth = 0;
      let inExpr = false;
      for (let i = start + 15; i < src.length; i++) {
        if (src[i] === '$' && src[i+1] === '{') { inExpr = true; depth++; i++; continue; }
        if (inExpr && src[i] === '{') depth++;
        if (inExpr && src[i] === '}') { depth--; if (depth === 0) inExpr = false; continue; }
        if (!inExpr && src[i] === '`') return src.slice(start + 15, i);
      }
    }
  }
  
  // Fall back to configs.ts
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/configs.ts'), 'utf8');
  const idx = src.indexOf(`'${slug}':`);
  if (idx === -1) return null;
  const block = src.slice(idx, idx + 50000);
  const start = block.indexOf('systemPrompt: `');
  if (start === -1) return null;
  let depth = 0, inExpr = false;
  for (let i = start + 15; i < block.length; i++) {
    if (block[i] === '$' && block[i+1] === '{') { inExpr = true; depth++; i++; continue; }
    if (inExpr && block[i] === '{') depth++;
    if (inExpr && block[i] === '}') { depth--; if (depth === 0) inExpr = false; continue; }
    if (!inExpr && block[i] === '`') return block.slice(start + 15, i);
  }
  return null;
}

function cleanPrompt(p) {
  if (!p) return '';
  return p
    .replace(/\$\{ANTI_AI\}/g, 'Write naturally and directly. Avoid jargon. Vary sentence length.')
    .replace(/\$\{NO_HALLUCINATION\}/g, 'Only include accurate, factual information.')
    .replace(/\$\{DELIVERABLE_RULE\}/g, 'Output finished, usable deliverables only — not advice or meta-commentary.')
    .replace(/\$\{[A-Z_]+\}/g, '') // strip other constants
    .trim();
}

// ── Test inputs ───────────────────────────────────────────────────────────────
const INPUTS = {
  // Content writing
  'content-writer': 'Write a 600-word blog post about customer retention strategies for SaaS companies. Audience: SaaS founders. Tone: authoritative but accessible.',
  'newsletter-writer': 'Write a newsletter issue about customer retention strategies for SaaS companies. Audience: small business owners. Include 3 actionable tips.',
  'email-copywriter': 'Email type: Welcome Email. Product: Acme Analytics (B2B SaaS analytics). Audience: new trial users. Tone: warm, professional.',
  'ad-copywriter': 'Platform: Facebook/Instagram. Product: B2B analytics software. Goal: free trial signups. Audience: SaaS founders. Write 3 ad variations.',
  'landing-page-copywriter': 'Product: Acme Analytics. Audience: SaaS founders. Goal: free trial signups. Key benefit: predict and prevent churn.',
  'script-writer': 'Platform: YouTube. Topic: How to reduce SaaS churn by 40%. Duration: 5-7 min. Tone: educational, direct.',
  'grant-writer': 'Organization: TechNonprofit Inc. Grant: Community Innovation Grant ($25,000). Purpose: build free coding education platform for underserved youth.',
  'long-form-article-writer': 'Write a 1000-word article about customer retention strategies for SaaS companies. Audience: SaaS founders and operators.',
  'press-release-writer': 'Company: Acme Analytics. News: Launch of AI-powered churn prediction feature. Contact: press@acmeanalytics.com.',
  'whitepaper-writer': 'Topic: Data-driven customer retention in SaaS. Audience: SaaS executives. Length: executive summary + 5 sections.',
  'case-study-writer': 'Company: Acme Analytics. Client: Retail SaaS Co. Problem: 8% monthly churn. Solution: Predictive analytics. Result: Reduced churn to 3.2% in 90 days.',
  'proposal-writer': 'Client: Growth Corp. Service: Marketing strategy and analytics setup. Value: $15,000. Timeline: 3 months.',
  'technical-writer': 'Topic: Getting started with the Acme Analytics REST API. Audience: Software developers.',
  'ux-writer': 'Product: B2B analytics dashboard. Context: First-time user onboarding flow (steps 1-5). Tone: friendly and clear.',
  'faq-writer': 'Product: Acme Analytics (B2B SaaS). Audience: potential customers. Generate 8 FAQs covering pricing, setup, integrations, and data security.',
  'standard-operating-procedure-writer': 'Process: Customer support ticket handling. Department: Customer Success. Create a step-by-step SOP.',
  'onboarding-document-creator': 'Role: Customer Success Manager. Company: Acme Analytics. Tools: Salesforce, Slack, Jira, Acme Analytics dashboard.',
  'training-material-writer': 'Topic: How to use analytics dashboards for business decision-making. Audience: non-technical business users. Format: workshop guide.',
  'interview-question-writer': 'Role: Senior Customer Success Manager. Company: Acme Analytics. Type: Behavioral + situational. Generate 10 questions.',
  'cover-letter-writer': 'Role: Senior Customer Success Manager. Company: Acme Analytics. Applicant: 4 years CSM experience at B2B SaaS, reduced churn 30%.',

  // Social
  'x-twitter-ghostwriter': 'Content type: Thread. Topic: How we reduced churn 40% in 90 days. Niche: SaaS growth. Tone: Direct. Goal: Build audience.',
  'linkedin-ghostwriter': 'Write a LinkedIn post about how data analytics reduced customer churn by 40%. Tone: professional but human. Goal: thought leadership.',
  'social-media-creator': 'Platform: All Platforms. Topic: Announcing new AI churn prediction feature. Goal: drive free trial signups.',
  'community-manager': 'Platform: Slack Community. Community type: SaaS founders and operators. Community goal: Build engagement. Create a 30-day engagement calendar.',
  'instagram-strategist': 'Business: B2B analytics software. Goal: grow followers. Target: SaaS founders. Posting frequency: 3x/week.',
  'email-marketing-strategist': 'Campaign goal: Welcome series for new trial users. Product: Acme Analytics. Audience: SaaS founders trying to reduce churn.',
  'pinterest-strategist': 'Business: Online business education platform. Goal: drive traffic. Niche: entrepreneurship and business growth.',
  'content-repurposer': 'Original: "We helped 50 SaaS companies reduce churn by 40% using predictive analytics. Key insight: churn signals appear 30 days before cancellation." Source: Blog post. Repurpose into: Twitter thread, LinkedIn post, Email newsletter snippet.',
  'content-strategist': 'Business: Acme Analytics. Audience: SaaS founders. Goal: increase organic traffic and trial signups. Timeline: 6 months.',
  'personal-brand-strategist': 'Name: Alex Chen. Role: Founder & CEO, Acme Analytics. Audience: SaaS founders. Goal: thought leadership on data-driven growth.',
  'linkedin-profile-optimizer': 'Name: Alex Chen. Current headline: CEO at Acme Analytics. Background: 10 years in B2B SaaS. Goal: attract enterprise clients.',
  'video-repurposer': 'Source content: A 2000-word blog post about SaaS customer retention strategies. Target formats: Twitter thread, LinkedIn post, email newsletter snippet, YouTube description.',

  // Research & data
  'competitor-analyst': 'Our business: Acme Analytics (B2B SaaS). Competitors: Mixpanel, Amplitude, Heap. Focus: pricing, positioning, and product gaps.',
  'trend-analyst': 'Industry: B2B SaaS analytics. Region: North America. Timeframe: Next 12 months. Focus: AI adoption and churn prediction.',
  'audience-persona-builder': 'Product: B2B analytics software. Existing customers: SaaS founders, operations leads, growth managers at 10-500 person companies.',
  'swot-analyst': 'Business: Acme Analytics. Industry: B2B SaaS. Market position: Growing mid-market analytics player.',
  'market-research-analyst': 'Topic: SaaS customer retention market. Industry: B2B SaaS. Depth: Detailed report. Focus: tools, trends, and benchmarks.',
  'pricing-strategist': 'Product: B2B analytics SaaS. Current price: $49/month flat. Competitors: Mixpanel ($28+), Amplitude ($995+). Recommend pricing strategy.',
  'report-writer': 'Topic: Q1 2026 SaaS metrics summary. Audience: executive team. Data: ARR $2.1M, MRR growth 12%, Churn 3.2%, NPS 42, CAC $840, LTV $4,200.',
  'kpi-dashboard-writer': 'Business type: SaaS. Metrics: MRR, churn rate, DAU, NPS, CAC, LTV. Reporting period: Monthly. Audience: executive team.',
  'data-analyst': 'Analyze this data:\nMonth,MRR,Users,Churn\nJan,$50k,200,5%\nFeb,$58k,240,4%\nMar,$67k,290,3.5%\nIdentify trends and provide actionable insights.',
  'research-assistant': 'Research customer retention strategies for SaaS companies. Context: preparing content strategy for B2B SaaS blog. Depth: detailed report.',
  'swot-analyst': 'Business: Acme Analytics. Industry: B2B SaaS analytics. Current position: $2M ARR, growing 12% MoM. Main competitors: Mixpanel, Amplitude.',

  // Marketing & strategy
  'funnel-strategist': 'Business: Acme Analytics. Audience: SaaS founders. Goal: generate leads for free trial. Budget: $3,000/month.',
  'ad-campaign-strategist': 'Business: Acme Analytics. Promoting: Free analytics trial. Platforms: Google, Meta. Budget: $3,000/month. Goal: generate leads.',
  'brand-strategist': 'Brand: Acme Analytics. Industry: B2B SaaS. Audience: SaaS founders. Current positioning: "Analytics made simple". Improve the strategy.',
  'ecommerce-strategist': 'Context: B2B SaaS product. Goal: increase trial-to-paid conversion rate from 15% to 25%. Current MRR: $50k.',
  'brand-voice-guide-writer': 'Brand: Acme Analytics. Industry: B2B SaaS. Audience: SaaS founders and operators. Personality: smart, direct, approachable.',

  // HR
  'job-description-writer': 'Role: Senior Customer Success Manager. Company: Acme Analytics. Location: Remote. Requirements: 3+ years CSM in B2B SaaS.',
  'resume-screener': 'Job: Senior Customer Success Manager at Acme Analytics. Evaluate:\nCandidate 1: 4 years CSM at Salesforce, reduced churn 25%, BS CompSci.\nCandidate 2: 2 years CSM at startup, MBA, no metrics.\nCandidate 3: 5 years account management, no SaaS experience.',

  // Admin & ops
  'legal-document-drafter': 'Document type: Terms of Service for SaaS analytics platform. Business: Acme Analytics. Jurisdiction: United States. Industry: software.',
  'meeting-notes-summarizer': 'Transcript: Team met to review Q1. MRR hit $2.1M, up 12%. Churn improved to 3.2%. Discussion on enterprise pipeline concerns. Decision to launch new onboarding flow in April. Action items: Sarah to redesign pricing page, John to research enterprise deals. Next meeting May 1.',
  'data-cleaner': 'Data type: Customer contacts.\nname,email,phone\njohn smith,JOHN@ACME.COM,555-1234\nJane DOE,jane@example.com,(555) 567-8900\nBob Jones,,555.345.6789\nAlice,alice@test,1-800-NUMBERS',
  'spreadsheet-builder': 'Build a SaaS metrics tracking spreadsheet. Columns: Month, MRR, New Customers, Churned Customers, Expansion Revenue, Net MRR Change, MRR Growth %. Include sample data for 3 months.',
  'bookkeeping-summarizer': 'Transactions:\n2026-04-01, AWS, -$127\n2026-04-03, Stripe Payout, +$3240\n2026-04-05, Anthropic API, -$89\n2026-04-10, Vercel, -$20\n2026-04-15, Stripe Payout, +$2890\nPeriod: April 1-15 2026. Business: SaaS company.',
  'action-item-extractor': 'Meeting notes: Q1 review discussed. Sarah will redesign the pricing page by April 30. John needs to research 3 enterprise prospects and report back by April 25. Team agreed to launch new onboarding by May 15. Roger to update the API docs this week.',

  // Design
  'creative-brief-writer': 'Project: Product launch campaign for new churn prediction feature. Brand: Acme Analytics. Audience: SaaS founders. Objective: 500 free trial signups in 30 days.',
  'tagline-writer': 'Brand: Acme Analytics. Product: B2B analytics platform. Audience: SaaS founders. Benefit: predict and prevent customer churn. Generate 5 tagline options.',
  'product-naming-specialist': 'Product: AI-powered churn prediction tool for SaaS companies. Audience: SaaS founders. Style: modern, memorable, tech-forward. Generate 8 name options.',

  // Specialized
  'prompt-engineer': 'AI tool: ChatGPT. Goal: Write compelling cold email subject lines for B2B SaaS outreach. Use case: Writing. Generate 3 prompt variations.',
  'sales-outreach-writer': 'Your name/company: Alex at Acme Analytics. Selling: analytics platform for SaaS. Target: Head of Revenue at B2B SaaS companies. Channel: Cold email. Length: 3-email sequence.',
  'automation-blueprint-writer': 'Process: Lead nurturing after free trial signup. Tools: HubSpot, Slack, Stripe. Trigger: user signs up for free trial. Goal: convert to paid within 14 days.',
  'translator': 'Translate to Spanish: "Grow your SaaS business with predictive analytics. Reduce churn by 40%. Our AI identifies at-risk customers before they cancel. Start your free trial today."',
  'customer-support-writer': 'Support type: Feature request response. Product: analytics dashboard. Customer request: CSV data export feature. Current status: on roadmap for Q3.',
  'podcast-show-notes-writer': 'Episode: "How to Predict and Prevent SaaS Churn". Guest: Solo host. Key points: early warning signals, cohort analysis, intervention strategies, 40% churn reduction. Duration: 45 min.',
  'seo-strategist': 'Target keyword: "saas churn reduction strategies". Website: acmeanalytics.com. Audience: SaaS founders. Goal: rank for high-intent keywords and drive trial signups.',
  'pitch-deck-writer': 'Company: Acme Analytics. Industry: B2B SaaS. Stage: Series A. Ask: $5M. Use of funds: product and GTM. Traction: $2.1M ARR, 12% MoM growth, 95% retention.',
  'presentation-builder': 'Title: Q1 2026 Business Review. Audience: Board of Directors. Key points: ARR $2.1M, product milestones, team growth, Q2 roadmap. Slides: 12.',

  // Course
  'course-outline-builder': 'Mode: Mini-course. Topic: SaaS metrics mastery — understanding MRR, churn, and NPS. Audience: SaaS founders who track metrics but don\'t act on them. Transformation: They can identify which metrics to prioritize and take 3 specific actions to improve performance. Price: $47. Platform: Teachable.',

  // Creative Editor
  'creative-editor': 'Write a LinkedIn article in first person about: How we reduced customer churn by 40% in 90 days using predictive analytics. Tone: authentic, storytelling. Length: 600 words.',
};

const SKIP_WORKERS = new Set([
  'lead-generator',       // RocketReach API — expensive
  'thumbnail-designer',   // fal.ai images
  'logo-concept-generator', // fal.ai images
  'social-media-graphics-designer', // fal.ai images
  'voiceover-artist',     // ElevenLabs audio
  'transcription-specialist', // audio input required
  'meeting-notes-writer', // audio input required (meeting-notes-summarizer is the text one)
  'sound-effects-designer', // ElevenLabs audio
  'content-translator',   // audio/video input required
  'scene-director',       // video generation — expensive
  'b-roll-generator',     // video generation — expensive
  'ad-creative-generator', // video generation — expensive
  'product-video-creator', // video generation — expensive
]);

const SKIP_REASON = {
  'lead-generator': 'Requires live RocketReach API — expensive per-lead cost. Test manually.',
  'thumbnail-designer': 'Image generation worker (fal.ai). Test manually via dashboard.',
  'logo-concept-generator': 'Image generation worker (fal.ai). Test manually via dashboard.',
  'social-media-graphics-designer': 'Image generation worker (fal.ai). Test manually via dashboard.',
  'voiceover-artist': 'Audio generation worker (ElevenLabs). Requires audio output context. Test manually.',
  'transcription-specialist': 'Requires audio/video file upload input. Test manually.',
  'meeting-notes-writer': 'Requires audio/video file upload input. Test manually.',
  'sound-effects-designer': 'Audio generation worker (ElevenLabs). Test manually.',
  'content-translator': 'Requires audio/video file input for dubbing. Test manually.',
  'scene-director': 'Video generation worker (Atlas/Wan). Expensive per task. Test manually.',
  'b-roll-generator': 'Video generation worker (Atlas/Wan). Expensive per task. Test manually.',
  'ad-creative-generator': 'Video generation worker (Atlas/Wan). Expensive per task. Test manually.',
  'product-video-creator': 'Video generation worker (Atlas/Wan). Expensive per task. Test manually.',
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Deliverable 2: Sample Output Library ===\n');
  
  const allSlugs = getAllSlugs();
  const state = loadState();
  const completed = new Set(state.completed);
  const failed = new Set(state.failed);
  
  console.log(`Total workers: ${allSlugs.length}`);
  console.log(`Skipped (media): ${SKIP_WORKERS.size}`);
  console.log(`To generate: ${allSlugs.length - SKIP_WORKERS.size}`);
  console.log(`Already done: ${completed.size}`);
  
  let ok = 0, fail = 0, skip = 0;
  
  for (const slug of allSlugs) {
    const outFile = path.join(OUT_DIR, `${slug}.md`);
    const workerName = getWorkerName(slug);
    
    // Already done
    if (completed.has(slug) && fs.existsSync(outFile)) {
      console.log(`  [DONE] ${slug}`);
      ok++;
      continue;
    }
    
    // Media workers — write note file
    if (SKIP_WORKERS.has(slug)) {
      const content = `# Sample output: ${slug} — ${workerName}\n\n**Status:** Skipped — ${SKIP_REASON[slug] || 'Requires external media API'}\n\n**Test input that would be used:** Requires file upload or live API key unavailable in batch mode.\n`;
      fs.writeFileSync(outFile, content);
      completed.add(slug);
      saveState({ completed: [...completed], failed: [...failed] });
      console.log(`  [SKIP] ${slug}`);
      skip++;
      continue;
    }
    
    // Get test input
    const testInput = INPUTS[slug] || `Complete your core task for this worker. Context: B2B SaaS analytics company called Acme Analytics. Audience: SaaS founders. Topic: customer retention strategies.`;
    
    // Get system prompt
    let sysPrompt = getSystemPrompt(slug);
    if (!sysPrompt) {
      const errContent = `# Sample output: ${slug} — ${workerName}\n\n**Status:** FAILED — Could not extract system prompt\n`;
      fs.writeFileSync(outFile, errContent);
      failed.add(slug);
      saveState({ completed: [...completed], failed: [...failed] });
      console.log(`  [FAIL] ${slug} — no system prompt found`);
      fail++;
      continue;
    }
    
    sysPrompt = cleanPrompt(sysPrompt);
    
    // Generate
    process.stdout.write(`  [GEN ] ${slug}... `);
    const start = Date.now();
    
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: sysPrompt.slice(0, 12000),
        messages: [{ role: 'user', content: testInput }],
      }, { timeout: 90000 });
      
      const elapsed = Math.round((Date.now() - start) / 1000);
      const output = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const outTokens = response.usage?.output_tokens || Math.round(output.length / 4);
      
      const content = [
        `# Sample output: ${slug} — ${workerName}`,
        '',
        '**Test input used:**',
        '```',
        testInput,
        '```',
        '',
        `**Generation time:** ${elapsed}s`,
        `**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)`,
        `**Output tokens:** ${outTokens}`,
        `**Output char count:** ${output.length}`,
        '',
        '**Full output below:**',
        '',
        '---',
        '',
        output,
      ].join('\n');
      
      fs.writeFileSync(outFile, content);
      completed.add(slug);
      saveState({ completed: [...completed], failed: [...failed] });
      console.log(`✅ ${elapsed}s, ${output.length} chars`);
      ok++;
      
      // Small delay to avoid hammering the API
      await sleep(1500);
      
    } catch (err) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`❌ ${err.message.slice(0, 80)}`);
      
      const errContent = [
        `# Sample output: ${slug} — ${workerName}`,
        '',
        '**Status:** GENERATION FAILED',
        '',
        `**Error:** ${err.message}`,
        `**Time before failure:** ${elapsed}s`,
        '',
        '**Test input that was used:**',
        '```',
        testInput,
        '```',
      ].join('\n');
      
      fs.writeFileSync(outFile, errContent);
      failed.add(slug);
      saveState({ completed: [...completed], failed: [...failed] });
      fail++;
      await sleep(3000);
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`DONE — Success: ${ok}, Skipped: ${skip}, Failed: ${fail}`);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
