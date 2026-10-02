/**
 * purity-retry.cjs
 * Re-runs the tasks that timed out in purity-verify.cjs:
 * - Cruz (Test 1 real path + Test 4 required-only)
 * - Dale candidate_prep, investor_prep
 * - Naru (Test 4)
 * - Ash (Test 5)
 * Also re-runs the Serper workers (Kai, Zane, Duncan) after the ## Sources fix.
 */

'use strict';
const { runTest, ensureAuth } = require('./purity-harness.cjs');
const fs = require('fs');
const path = require('path');

const WORKERS = {
  'pricing-strategist':       { category: 'Research & Strategy',    taskType: 'heavy' },
  'interview-question-writer':{ category: 'Recruiting & HR',        taskType: 'light' },
  'whitepaper-writer':        { category: 'Documents & Reports',    taskType: 'heavy' },
  'social-media-creator':     { category: 'Social Media',           taskType: 'light' },
  'seo-strategist':           { category: 'Marketing',              taskType: 'heavy' },
  'competitor-analyst':       { category: 'Research & Strategy',    taskType: 'heavy' },
  'market-research-analyst':  { category: 'Research & Strategy',    taskType: 'heavy' },
  'business-plan-writer':     { category: 'Documents & Reports',    taskType: 'heavy' },
  'proposal-writer':          { category: 'Documents & Reports',    taskType: 'light' },
  'legal-document-drafter':   { category: 'Documents & Reports',    taskType: 'heavy' },
};

const results = {};
const IDS_FILE = path.join(__dirname, '../screenshots/output-purity/task-ids.json');
let existingIds = {};
try { existingIds = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')); } catch {}

async function main() {
  console.log('=== Output Purity Verification — Retry Pass ===\n');
  await ensureAuth();

  // ── Cruz Test 2 (real path with full competitor data) ──────────────────
  console.log('\n══ TEST 2 RETRY: Cruz ══');
  results.t2_cruz = await runTest('pricing-strategist', {
    pricing_goal: 'Launching new pricing',
    product: 'Productized B2B SaaS content retainer',
    target_customers: 'Series A–C SaaS companies (50–500 employees)',
    business_model: 'Service/retainer',
    current_pricing: 'None — pre-launch',
    competitor_pricing: 'ContentFly: $1,500–$5,000/mo. Verblio: $0.06/word or $500/mo. ClearVoice: $1,200–$8,000/mo. Contently: $3,000–$10,000/mo enterprise. Content at Scale: $500–$1,500/mo AI-assisted.',
  }, WORKERS, '2-Cruz-retry');

  // ── Dale candidate_prep ────────────────────────────────────────────────
  console.log('\n══ TEST 3b RETRY: Dale/candidate_prep ══');
  results.t3_candidate = await runTest('interview-question-writer', {
    mode: 'candidate_prep',
    role: 'Senior Product Manager',
    company: 'Stripe',
    experience_level: 'Senior (7+ years)',
    focus_areas: 'Product strategy, working with engineers, data-driven decisions',
  }, WORKERS, '3b-Dale/candidate_prep-retry');

  // ── Dale investor_prep ─────────────────────────────────────────────────
  console.log('\n══ TEST 3e RETRY: Dale/investor_prep ══');
  results.t3_investor = await runTest('interview-question-writer', {
    mode: 'investor_prep',
    company: 'Fieldwork AI',
    stage: 'Seed',
    pitch_focus: 'AI-powered CRM for field sales. $180K ARR, 24 customers, 15% MoM growth.',
    concerns: 'Enterprise sales cycle, CAC, competition from Salesforce',
  }, WORKERS, '3e-Dale/investor_prep-retry');

  // ── Cruz Test 4 required-only ──────────────────────────────────────────
  console.log('\n══ TEST 4a RETRY: Cruz/required-only ══');
  results.t4_cruz = await runTest('pricing-strategist', {
    pricing_goal: 'Launching new pricing',
    product: 'B2B analytics dashboard',
    target_customers: 'Mid-market SaaS companies',
    business_model: 'SaaS Subscription',
  }, WORKERS, '4a-Cruz/required-only-retry');

  // ── Marlo Test 4 required-only ────────────────────────────────────────
  console.log('\n══ TEST 4c RETRY: Marlo/required-only ══');
  results.t4_marlo = await runTest('business-plan-writer', {
    business_name: 'GreenRoute',
    description: 'SaaS platform that optimizes delivery routes for sustainability and cost.',
    target_market: 'Last-mile delivery companies in North America',
  }, WORKERS, '4c-Marlo/required-only-retry');

  // ── Naru Test 4 required-only ─────────────────────────────────────────
  console.log('\n══ TEST 4e RETRY: Naru/required-only ══');
  results.t4_naru = await runTest('whitepaper-writer', {
    topic: 'The State of AI Adoption in Mid-Market B2B SaaS',
    target_audience: 'CTO and VP Engineering at 100–500 person companies',
    company_name: 'TechEdge Research',
    industry: 'B2B SaaS',
  }, WORKERS, '4e-Naru/required-only-retry');

  // ── Ash Test 5 ────────────────────────────────────────────────────────
  console.log('\n══ TEST 5h RETRY: Ash ══');
  results.t5_ash = await runTest('social-media-creator', {
    platform: 'LinkedIn',
    content_theme: 'Sharing a founder lesson: the hiring mistake that cost us 6 months',
    content_type: 'Full Post',
  }, WORKERS, '5h-Ash-retry');

  // ── Serper workers — re-run after ## Sources fix ─────────────────────
  console.log('\n══ TEST 6 RERUN after Sources fix ══');

  const batch6 = await Promise.all([
    runTest('seo-strategist', {
      topic: 'best project management software for remote teams 2026',
    }, WORKERS, '6a-Kai-rerun'),
    runTest('competitor-analyst', {
      your_product: 'AI writing assistant for B2B content teams',
      competitors: 'Jasper, Copy.ai, Writer',
      analysis_focus: 'Pricing, features, positioning',
    }, WORKERS, '6b-Zane-rerun'),
    runTest('market-research-analyst', {
      market: 'AI-powered HR software',
      focus: 'Market size, key players, growth trends 2025-2026',
    }, WORKERS, '6c-Duncan-rerun'),
  ]);
  results.t6_kai   = batch6[0];
  results.t6_zane  = batch6[1];
  results.t6_duncan = batch6[2];

  // Also run Vera and Jude for Test 8 downloads (need their task IDs)
  console.log('\n══ TEST 8 PREP: Vera + Jude ══');
  const batch8extra = await Promise.all([
    runTest('proposal-writer', {
      client_name: 'Acme Corp',
      project_description: 'Website redesign and SEO optimization project for B2B SaaS company',
      services_offered: 'UX design, development, SEO audit, content refresh',
      timeline: '12 weeks',
      budget_range: '$45,000–$60,000',
    }, WORKERS, '8-Vera'),
    runTest('legal-document-drafter', {
      document_type: 'NDA (Non-Disclosure Agreement)',
      party_one: 'Acme Corp',
      party_two: 'Freelancer Jane Smith',
      jurisdiction: 'California',
      key_terms: 'Mutual NDA, 2-year term, covers product roadmap and customer data',
    }, WORKERS, '8-Jude'),
  ]);
  results.t8_vera = batch8extra[0];
  results.t8_jude = batch8extra[1];

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════');
  console.log('RETRY SUMMARY');
  console.log('══════════════════════════════════════════');

  let passed = 0, failed = 0;
  for (const [key, r] of Object.entries(results)) {
    const icon = r.pass ? '✅' : '❌';
    const extra = r.hits?.length ? ' | ' + r.hits.join(', ') : (r.error ? ' | ERROR: ' + r.error.slice(0,60) : '');
    console.log(`${icon} ${key}${extra}`);
    if (r.pass) passed++; else failed++;
  }
  console.log(`\n${passed}/${passed+failed} passed`);

  // Merge task IDs
  const newIds = {};
  for (const [key, r] of Object.entries(results)) {
    if (r.taskId) newIds[key] = r.taskId;
  }
  const merged = { ...existingIds, ...newIds };
  fs.writeFileSync(IDS_FILE, JSON.stringify(merged, null, 2));
  console.log('\nTask IDs updated at screenshots/output-purity/task-ids.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
