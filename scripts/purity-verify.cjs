/**
 * purity-verify.cjs
 * Full output purity verification — real form path, real execute-task route.
 * Tests 1–6. Tests 7–8 (HandoffCards UI + downloads) run via Playwright separately.
 */

'use strict';
const { runTest, getFormSchema, ensureAuth, adminClient } = require('./purity-harness.cjs');

// ── Worker registry lookup (minimal, only what we need for task insert) ──
const WORKERS = {
  'cover-letter-writer':     { category: 'Recruiting & HR',       taskType: 'light' },
  'pricing-strategist':      { category: 'Research & Strategy',    taskType: 'heavy' },
  'interview-question-writer':{ category: 'Recruiting & HR',      taskType: 'light' },
  'newsletter-writer':       { category: 'Content Writing',        taskType: 'light' },
  'email-copywriter':        { category: 'Copywriting',            taskType: 'light' },
  'landing-page-copywriter': { category: 'Copywriting',            taskType: 'light' },
  'podcast-show-notes-writer':{ category: 'Content Writing',       taskType: 'light' },
  'long-form-article-writer':{ category: 'Content Writing',        taskType: 'light' },
  'course-outline-builder':  { category: 'Content Writing',        taskType: 'heavy' },
  'content-writer':          { category: 'Content Writing',        taskType: 'light' },
  'social-media-creator':    { category: 'Social Media',           taskType: 'light' },
  'creative-editor':         { category: 'Content Writing',        taskType: 'light' },
  'ad-copywriter':           { category: 'Copywriting',            taskType: 'light' },
  'business-plan-writer':    { category: 'Documents & Reports',    taskType: 'heavy' },
  'whitepaper-writer':       { category: 'Documents & Reports',    taskType: 'heavy' },
  'seo-strategist':          { category: 'Marketing',              taskType: 'heavy' },
  'competitor-analyst':      { category: 'Research & Strategy',    taskType: 'heavy' },
  'market-research-analyst': { category: 'Research & Strategy',    taskType: 'heavy' },
  'proposal-writer':         { category: 'Documents & Reports',    taskType: 'light' },
  'legal-document-drafter':  { category: 'Documents & Reports',    taskType: 'heavy' },
};

const results = {};

async function main() {
  console.log('=== Output Purity Verification — Real Path ===\n');
  await ensureAuth();

  // ────────────────────────────────────────────────────────────────────────
  // TEST 1 — Cleo real path
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══ TEST 1: Cleo (real path) ══');
  results.t1_cleo = await runTest('cover-letter-writer', {
    full_name: 'Maria Hernandez',
    email: 'maria.hernandez@example.com',
    phone: '555-0144',
    location: 'San Francisco, CA',
    target_role: 'Senior Product Marketing Manager',
    company_name: 'Linear',
    job_posting: 'Linear is looking for a Senior PMM to own our enterprise go-to-market. You will define positioning, build the launch playbook, and partner with sales to close larger deals. Required: 5+ years B2B SaaS PMM, data-driven, can do both strategy and execution.',
    relevant_experience: 'At Notion I led PMM for the AI launch. Enterprise pipeline grew 40% in 6 months. I built the messaging architecture from scratch, ran GTM across product, sales, and content.',
    tone: 'Professional',
  }, WORKERS, '1-Cleo');

  // ────────────────────────────────────────────────────────────────────────
  // TEST 2 — Cruz real path (with full competitor data)
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══ TEST 2: Cruz (real path) ══');
  results.t2_cruz = await runTest('pricing-strategist', {
    pricing_goal: 'Launching new pricing',
    product: 'Productized B2B SaaS content retainer',
    target_customers: 'Series A–C SaaS companies (50–500 employees)',
    business_model: 'Service/retainer',
    current_pricing: 'None — pre-launch',
    competitor_pricing: 'ContentFly: $1,500–$5,000/mo retainer. Verblio: $0.06/word or $500/mo packages. ClearVoice: $1,200–$8,000/mo managed service. Contently: $3,000–$10,000/mo enterprise. Content at Scale: $500–$1,500/mo AI-assisted.',
  }, WORKERS, '2-Cruz');

  // ────────────────────────────────────────────────────────────────────────
  // TEST 3 — Dale: all 5 modes
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══ TEST 3: Dale — 5 modes ══');

  results.t3_hiring = await runTest('interview-question-writer', {
    mode: 'hiring',
    role: 'Head of Growth',
    hire_type: 'Experienced specialist',
    skills: 'Paid acquisition, SEO, growth loops, analytics',
    culture_fit: 'Bias to action, data-driven, comfortable with ambiguity',
    num_questions: '10',
  }, WORKERS, '3a-Dale/hiring');

  results.t3_candidate = await runTest('interview-question-writer', {
    mode: 'candidate_prep',
    role: 'Senior Product Manager',
    company: 'Stripe',
    experience_level: 'Senior (7+ years)',
    focus_areas: 'Product strategy, working with engineers, data-driven decisions',
  }, WORKERS, '3b-Dale/candidate_prep');

  results.t3_podcast = await runTest('interview-question-writer', {
    mode: 'podcast',
    guest_name: 'Rand Fishkin',
    guest_expertise: 'SEO, founder, SparkToro',
    interview_topic: 'Building a bootstrapped SaaS after VC',
    podcast_format: 'Long-form',
    listener_takeaway: 'Lessons on choosing bootstrapping vs VC',
  }, WORKERS, '3c-Dale/podcast');

  results.t3_discovery = await runTest('interview-question-writer', {
    mode: 'discovery',
    product: 'AI meeting notes tool that auto-creates action items and sends summaries',
    interviewee: 'Operations managers at 50–200 person companies',
    learning_goal: 'Understand current pain with meeting follow-up and whether they would pay to fix it',
    num_questions: '12',
  }, WORKERS, '3d-Dale/discovery');

  results.t3_investor = await runTest('interview-question-writer', {
    mode: 'investor_prep',
    company: 'Fieldwork AI',
    stage: 'Seed',
    pitch_focus: 'AI-powered CRM for field sales teams. $180K ARR, 24 customers, 15% MoM growth.',
    concerns: 'Enterprise sales cycle length, CAC, competition from Salesforce',
  }, WORKERS, '3e-Dale/investor_prep');

  // ────────────────────────────────────────────────────────────────────────
  // TEST 4 — Placeholder audit: required fields only
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══ TEST 4: Placeholder audit (required fields only) ══');

  // Cruz — required: pricing_goal, product, target_customers, business_model
  results.t4_cruz = await runTest('pricing-strategist', {
    pricing_goal: 'Launching new pricing',
    product: 'B2B analytics dashboard',
    target_customers: 'Mid-market SaaS companies',
    business_model: 'SaaS Subscription',
    // all optional fields intentionally blank: current_pricing, competitor_pricing
  }, WORKERS, '4a-Cruz/required-only');

  // Cleo — required: full_name, email, phone, location, target_role, company_name, job_posting, relevant_experience
  results.t4_cleo = await runTest('cover-letter-writer', {
    full_name: 'Alex Kim',
    email: 'alex@example.com',
    phone: '555-9999',
    location: 'Boston, MA',
    target_role: 'Software Engineer',
    company_name: 'Figma',
    job_posting: 'Figma is hiring a software engineer to work on our multiplayer collaboration engine.',
    relevant_experience: '3 years React/TypeScript, shipped real-time features at prior startup.',
    // tone, voice_match, why_this_company, achievements intentionally blank
  }, WORKERS, '4b-Cleo/required-only');

  // Marlo — required: business_name, description, target_market
  results.t4_marlo = await runTest('business-plan-writer', {
    business_name: 'GreenRoute',
    description: 'SaaS platform that optimizes delivery routes for sustainability and cost.',
    target_market: 'Last-mile delivery companies in North America',
    // all optional blank
  }, WORKERS, '4c-Marlo/required-only');

  // Charlie — required: course_topic, expertise, student_transformation (and course_mode via default)
  results.t4_charlie = await runTest('course-outline-builder', {
    course_topic: 'Email marketing for e-commerce brands',
    expertise: 'Email marketing strategist with 8 years experience',
    student_starting_point: 'Beginners who have never run email campaigns',
    student_transformation: 'Launch and run a complete email marketing system generating 20%+ of revenue',
    course_mode: 'mini_course',
    mini_course_type: 'Paid mini-course ($27-$47)',
    // all optional blank: title, price_point, platform, must_cover, etc.
  }, WORKERS, '4d-Charlie/required-only');

  // Naru (whitepaper-writer) — check required fields first
  const naruSchema = await getFormSchema('whitepaper-writer');
  const naruRequired = {};
  for (const f of (naruSchema.requiredFields || [])) {
    if (f.options) naruRequired[f.name] = f.options[0];
    else if (f.defaultValue) naruRequired[f.name] = f.defaultValue;
    else naruRequired[f.name] = `Test ${f.label}`;
  }
  console.log('\n  Naru required fields:', Object.keys(naruRequired));
  results.t4_naru = await runTest('whitepaper-writer', {
    ...naruRequired,
    topic: 'The State of AI Adoption in Mid-Market B2B SaaS',
    target_audience: 'CTO and VP Engineering at 100–500 person companies',
  }, WORKERS, '4e-Naru/required-only');

  // ────────────────────────────────────────────────────────────────────────
  // TEST 5 — Cross-worker handoff CTA audit (10 workers)
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══ TEST 5: Cross-worker handoff CTA audit ══');

  // Run these in parallel batches to save time
  const batch5a = await Promise.all([
    runTest('course-outline-builder', {
      course_topic: 'Freelance copywriting business',
      expertise: '10 years copywriting',
      student_starting_point: 'Has some writing skills, wants to go freelance',
      student_transformation: 'Land first 3 paying clients',
      course_mode: 'mini_course',
      mini_course_type: 'Paid mini-course ($27-$47)',
    }, WORKERS, '5a-Charlie'),

    runTest('newsletter-writer', {
      newsletter_topic: 'Why most SaaS onboarding fails — and a simple fix',
      target_audience: 'SaaS founders and PMs',
      newsletter_style: 'classic_founder',
      newsletter_length: 'standard',
      core_takeaway: 'Most onboarding fails because it teaches features, not outcomes',
    }, WORKERS, '5b-Oscar'),

    runTest('email-copywriter', {
      email_type: 'cold_outreach',
      target_audience: 'Head of Marketing at B2B SaaS companies with 50-200 employees',
      offer_or_context: 'AI writing tool that cuts content production time by 60%',
      primary_cta: '15-minute demo call',
      tone: 'Professional',
    }, WORKERS, '5c-Mira'),
  ]);

  const batch5b = await Promise.all([
    runTest('landing-page-copywriter', {
      page_type: 'product_launch',
      product_or_service: 'AI legal document generator for small businesses',
      target_audience: 'Small business owners who need contracts and NDAs',
      core_offer: '30-second legal documents without a lawyer',
      primary_goal: 'Free trial signup',
    }, WORKERS, '5d-Quinn'),

    runTest('podcast-show-notes-writer', {
      mode: 'show_notes',
      podcast_name: 'The Indie Founder',
      episode_topic: 'How I went from $0 to $50K MRR with no funding',
      episode_content: 'Interview with solo founder who bootstrapped a SaaS tool for freelancers. Covered: finding the idea, first 10 customers, pricing mistakes, SEO strategy, churn reduction.',
      include_timestamps: 'No',
    }, WORKERS, '5e-Heath'),

    runTest('long-form-article-writer', {
      article_topic: 'How to write cold emails that get replies in 2026',
      target_audience: 'B2B sales reps and founders',
      article_type: 'How-To Guide',
      target_word_count: '1,500-2,000 words',
      tone: 'Direct',
    }, WORKERS, '5f-Sam'),
  ]);

  const batch5c = await Promise.all([
    runTest('content-writer', {
      topic: '5 signs your pricing page is killing conversions',
      content_type: 'Blog post',
      audience: 'SaaS founders',
      tone: 'Friendly',
    }, WORKERS, '5g-Ava'),

    runTest('social-media-creator', {
      platform: 'LinkedIn',
      content_theme: 'Sharing a founder lesson: the hiring mistake that cost us 6 months',
      content_type: 'Full Post',
    }, WORKERS, '5h-Ash'),

    runTest('creative-editor', {
      task_input: 'I have this rough draft about how I almost ran out of runway but turned it around. Help me tighten it: "We were at 2 months of cash. I had to make hard calls. We cut costs and focused on one thing. It worked." Make it a compelling story for a LinkedIn post.',
    }, WORKERS, '5i-Remy'),

    runTest('ad-copywriter', {
      platform: 'Meta (Facebook/Instagram)',
      product_service: 'Project management tool for remote teams',
      target_audience: 'Remote team leads at tech companies',
      campaign_goal: 'Free trial signups',
      tone: 'Direct',
    }, WORKERS, '5j-Tate'),
  ]);

  results.t5_charlie  = batch5a[0];
  results.t5_oscar    = batch5a[1];
  results.t5_mira     = batch5a[2];
  results.t5_quinn    = batch5b[0];
  results.t5_heath    = batch5b[1];
  results.t5_sam      = batch5b[2];
  results.t5_ava      = batch5c[0];
  results.t5_ash      = batch5c[1];
  results.t5_remy     = batch5c[2];
  results.t5_tate     = batch5c[3];

  // ────────────────────────────────────────────────────────────────────────
  // TEST 6 — Serper Sources audit (5 workers)
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══ TEST 6: Serper Sources audit ══');

  const batch6 = await Promise.all([
    runTest('seo-strategist', {
      topic: 'best project management software for remote teams 2026',
    }, WORKERS, '6a-Kai'),

    runTest('competitor-analyst', {
      your_product: 'AI writing assistant for B2B content teams',
      competitors: 'Jasper, Copy.ai, Writer',
      analysis_focus: 'Pricing, features, positioning',
    }, WORKERS, '6b-Zane'),

    runTest('market-research-analyst', {
      market: 'AI-powered HR software',
      focus: 'Market size, key players, growth trends 2025-2026',
    }, WORKERS, '6c-Duncan'),

    runTest('business-plan-writer', {
      business_name: 'EcoTrack',
      description: 'SaaS platform for SMB carbon footprint tracking and reporting',
      target_market: 'SMBs in manufacturing and logistics needing ESG reporting',
    }, WORKERS, '6d-Marlo'),

    runTest('whitepaper-writer', {
      topic: 'The ROI of AI-Assisted Content Marketing for B2B SaaS',
      target_audience: 'CMOs and VPs of Marketing at B2B SaaS companies',
      company_name: 'ContentEdge',
      industry: 'B2B SaaS',
    }, WORKERS, '6e-Naru'),
  ]);

  results.t6_kai    = batch6[0];
  results.t6_zane   = batch6[1];
  results.t6_duncan = batch6[2];
  results.t6_marlo  = batch6[3];
  results.t6_naru   = batch6[4];

  // ────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════');
  console.log('SUMMARY — Output Purity Verification');
  console.log('══════════════════════════════════════════');

  const allResults = Object.entries(results);
  let passed = 0, failed = 0;
  for (const [key, r] of allResults) {
    const icon = r.pass ? '✅' : '❌';
    const extra = r.hits?.length ? ' | ' + r.hits.join(', ') : (r.error ? ' | ERROR: ' + r.error.slice(0,60) : '');
    console.log(`${icon} ${key}${extra}`);
    if (r.pass) passed++; else failed++;
  }

  console.log(`\n${passed}/${passed+failed} passed`);

  // Save task IDs for Playwright UI + download tests
  const taskIds = {};
  for (const [key, r] of allResults) {
    if (r.taskId) taskIds[key] = r.taskId;
  }
  require('fs').writeFileSync(
    require('path').join(__dirname, '../screenshots/output-purity/task-ids.json'),
    JSON.stringify(taskIds, null, 2)
  );
  console.log('\nTask IDs saved to screenshots/output-purity/task-ids.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
