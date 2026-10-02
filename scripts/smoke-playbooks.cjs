#!/usr/bin/env node
/**
 * Phase 15 Batch E Smoke Test — all 21 Playbooks end-to-end
 * Uses test-operator-c (temporarily upgraded to Operator) + workspace WC
 */

const BASE_URL = process.env.BASE_URL || 'https://3rdshift.ai';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auth.3rdshift.ai';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.PROD_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!ANON_KEY) throw new Error('Missing Supabase key env for ANON_KEY');
const WC = 'cccccccc-c0c0-c0c0-c0c0-c0c0c0c0c001';

// Realistic test inputs for [User fills in] fields
const TEST_INPUTS = {
  brand_name: '3rdShift',
  what_you_do: 'AI-powered worker platform that replaces freelancers and agencies',
  industry_or_category: 'B2B SaaS / AI tools',
  target_customer: 'Solo founders and small business owners',
  brand_stage: 'New launch (0-12mo)',
  product_or_service: 'AI worker platform for businesses',
  audience_description: 'Solo founders aged 25-45 building bootstrapped businesses',
  industry_or_niche: 'SaaS / AI tools',
  persona_purpose: 'Marketing campaigns',
  business: '3rdShift AI platform',
  goal: 'Drive organic traffic',
  timeframe: '30 days',
  topic: 'How AI workers replace expensive freelancers',
  target_audience: 'Solo founders and small business owners',
  primary_keyword: 'AI workers for business',
  focus: 'AI adoption trends in SMB market',
  industry: 'AI / SaaS',
  newsletter_topic: 'How to replace your freelancer stack with AI',
  newsletter_length: 'standard',
  core_takeaway: 'AI workers cost 10x less than freelancers and deliver in seconds',
  role_title: 'Senior Software Engineer',
  required_skills: 'React, TypeScript, Node.js, PostgreSQL',
  responsibilities: 'Build and maintain our AI worker pipeline and API',
  company_name_stage: '3rdShift (Series A, 20 employees)',
  work_location: 'Remote',
  hiring_approach: 'skills-first',
  compensation: '$150,000 - $180,000',
  job_titles: 'VP of Marketing, Head of Growth, CMO',
  company_size: 'SMB (11-200)',
  target_industry: 'B2B SaaS',
  your_name_company: 'Roger / 3rdShift',
  what_selling: 'AI worker platform that replaces freelancers',
  prospect_role: 'Founder',
  value_prop: 'Replace your entire freelancer stack for $29/month',
  offer_or_context: 'AI platform that replaces freelancers at 10x lower cost',
  your_business: '3rdShift — AI worker platform for solo founders',
  competitors_to_analyze: 'Fiverr, Upwork, traditional freelancer platforms',
  focus_areas: 'Pricing, positioning, features',
  your_target_market: 'Solo founders and SMB owners',
  analysis_goal: 'Competitive positioning',
  business_name: '3rdShift',
  description: 'AI-powered worker platform replacing freelancers and agencies',
  target_market: 'Solo founders and SMB owners globally',
  company_name: '3rdShift',
  one_liner: 'Replace your entire freelancer stack with AI for $29/month',
  problem: 'Hiring freelancers is expensive, slow, and unpredictable',
  solution: 'Pre-built AI workers across 82 specialties, instant delivery, $29/month',
  market: '$455B global freelancer market',
  business_model: 'SaaS subscription',
  traction: '$50K MRR, 500 customers, 40% MoM growth',
  team: 'Josh Rager (CEO, 2 exits) + engineering team',
  funding_ask: '$2M Seed to scale marketing and expand worker catalog',
  competitive_advantage: 'First-mover in pre-built AI workers, 82 specialists vs DIY prompting',
  site_url: 'https://3rdshift.ai',
  report_title: 'Q1 2026 Performance Review',
  key_findings: 'Revenue up 40%, customer acquisition cost down 20%, churn at 3%',
  product_name: '3rdShift AI Platform',
  product_description: 'AI-powered worker platform for solo founders',
  common_issues: 'Users love the speed but want more customization',
  brand_tone: 'Professional and approachable',
  market: 'AI worker / automation platforms for SMBs',
  questions: 'What is the realistic TAM? Who are the top 5 competitors?',
  client_name: 'Acme Corp',
  project_or_engagement: 'AI worker implementation for marketing team',
  role: 'Marketing Manager',
  company: '3rdShift',
  department: 'Marketing',
  priorities: 'Learn the AI platform, ship first campaign, meet the team',
  process_name: 'Content publishing workflow',
  purpose: 'Standardize how the team publishes blog posts',
  scope: 'Marketing team content operations',
  key_steps: '1. Write draft 2. Review 3. Format 4. Schedule 5. Publish 6. Distribute',
  training_topic: 'Using 3rdShift AI workers for content creation',
  learner_role: 'Marketing coordinator',
  learning_objectives: 'Create and publish content using AI workers without manual editing',
  pricing_goal: 'Launching new pricing',
  product: '3rdShift AI worker platform',
  target_customers: 'Solo founders doing $0-500K ARR',
  offer_or_context: 'AI platform replacing freelancers for $29/month',
  niche: 'AI tools for founders',
};

function fillInputs(formSettings) {
  const filled = {};
  for (const [k, v] of Object.entries(formSettings)) {
    if (typeof v === 'string' && v.includes('[User fills in]')) {
      filled[k] = TEST_INPUTS[k] || `Test value for ${k}`;
    } else if (typeof v === 'string' && v.startsWith('[Output from')) {
      filled[k] = `[Output from previous step — will be populated at runtime]`;
    } else {
      filled[k] = v;
    }
  }
  return filled;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let token = null;

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email: 'test-operator-c@3rdshift.ai', password: '<SCREENSHOT_TEST_PASSWORD>' }),
  });
  const data = await res.json();
  token = data.access_token;
  if (!token) throw new Error('Login failed: ' + JSON.stringify(data));
}

function H() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-workspace-id': WC,
  };
}

async function triggerChain(presetId, presetName) {
  // Get the preset workers
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  const presetRes = await fetch(
    `https://ytqflszzzkkriqhyrroy.supabase.co/rest/v1/agent_mode_presets?select=workers&id=eq.${presetId}`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const presets = await presetRes.json();
  if (!presets?.[0]) return { error: 'Preset not found' };
  
  const workers = presets[0].workers.map((step, i) => ({
    position: step.step || (i + 1),
    worker_id: step.worker_id,
    form_settings: fillInputs(step.form_settings || {}),
  }));

  // Create a temporary chain
  const createRes = await fetch(`${BASE_URL}/api/agent-mode/chains`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({
      name: `SMOKE_${presetName.replace(/\s+/g, '_')}_${Date.now()}`,
      workspace_id: WC,
      workers,
      schedule: null,
    }),
  });
  const chainResp = await createRes.json();
  // API returns { chain: { id, ... } } or { error: '...' }
  if (chainResp.error) return { error: `Chain create failed: ${chainResp.error}` };
  const chain = chainResp.chain || chainResp;
  if (!chain.id) return { error: `Chain create failed (no id): ${JSON.stringify(chainResp).slice(0,200)}` };

  // Trigger run
  const runRes = await fetch(`${BASE_URL}/api/agent-mode/chains/${chain.id}/run`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ trigger_type: 'manual' }),
  });
  const runData = await runRes.json();
  const runId = runData.run_id || runData.runId;
  if (!runId) return { error: `Run trigger failed: ${JSON.stringify(runData)}`, chainId: chain.id };

  // Poll for completion (max 3 min per chain)
  let finalRun = null;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const pollRes = await fetch(`${BASE_URL}/api/agent-mode/runs/${runId}`, { headers: H() });
    const pollData = await pollRes.json();
    const status = pollData.status || pollData.run?.status;
    if (['completed', 'partial', 'failed'].includes(status)) {
      finalRun = pollData.run || pollData;
      break;
    }
  }

  // Cleanup chain
  await fetch(`${BASE_URL}/api/agent-mode/chains/${chain.id}`, { method: 'DELETE', headers: H() }).catch(() => {});

  return { runId, chain: finalRun };
}

const PLAYBOOKS = [
  { id: '61bfc04a-01ad-47d4-98f6-96ae5bbc94b4', name: 'Brand Voice + Content Foundation' },
  { id: 'b53f78ae-962a-4cec-a173-4f51fa35dc1a', name: 'Weekly Ad Refresh' },
  { id: 'bb4bc4b6-e4e0-4442-bf35-6ff0da6a1026', name: 'Local Authority Builder' },
  { id: 'e30bb7cc-bb94-49d9-9ead-a9c8c15a54ea', name: 'Weekly Content Engine' },
  { id: '802c783d-613e-495e-a548-58c7ed76e3f6', name: 'Hiring Pipeline' },
  { id: '0a055395-a200-49b2-91b8-9873d5055ddd', name: 'Lead Gen + Outreach Pipeline' },
  { id: 'e5c27327-1033-43b9-bd17-b3488caf87a1', name: 'Investor Readiness Pipeline' },
  { id: 'eaa2b2a2-9c70-47a2-8089-294dd0c5b649', name: 'Product Launch Pipeline' },
  { id: '54fe901c-eca9-4326-a6d7-9421ce015688', name: 'Weekly Content Marketing Engine' },
  { id: '86bba1b9-c47d-4ed1-a2f6-13e72a4e5005', name: 'Open House / Event Promo Chain' },
  { id: '71366da2-47c2-48dc-aa1d-b19b6ec4781f', name: 'SEO Content Machine' },
  { id: '843c642d-7c62-4a10-bcc7-e6593c6f6229', name: 'Proposal Factory' },
  { id: '9e5739d3-4c46-4995-9444-5797009d4b75', name: 'Onboarding Document Kit' },
  { id: 'bb6c8773-a082-43c6-9e35-3b0d2ea6a1fe', name: 'Site Audit → Content Loop' },
  { id: '3520b37b-7137-4402-b915-14d528b3746f', name: 'Client Reporting Chain' },
  { id: 'cc478b15-cc8a-485a-bea4-45b85ad29e39', name: 'Customer Review → Content Loop' },
  { id: '1eb61080-f0cf-4259-a7aa-992f32513025', name: 'Product Positioning Sprint' },
  { id: '9b9fb28a-6e11-4ba5-9744-38954e367fd3', name: 'Newsletter + Social Combo' },
  { id: '86e98a53-7333-457e-ab5c-6a9f23889590', name: 'Course Launch Content Sprint' },
  { id: 'fb7ba3a9-f5d7-41af-8260-6bd20c37a852', name: 'Competitive Intel + Pricing' },
  { id: '818aa017-98a3-4e45-987e-b18ba741af89', name: 'Thought Leadership Engine' },
];

async function main() {
  console.log('=== Phase 15 Batch E — Playbook Smoke Tests ===\n');
  await login();

  const results = [];

  for (let i = 0; i < PLAYBOOKS.length; i++) {
    const pb = PLAYBOOKS[i];
    console.log(`[${i+1}/21] Running: ${pb.name}...`);
    
    const result = await triggerChain(pb.id, pb.name);
    
    if (result.error) {
      results.push({ name: pb.name, overall: 'FAIL', error: result.error, steps: [] });
      console.log(`  ❌ FAIL: ${result.error}`);
      continue;
    }

    const run = result.chain;
    const workerResults = run?.worker_results || [];
    const steps = [];
    let overallStatus = 'PASS';

    for (const step of workerResults) {
      const hasOutput = step.output && step.output.length > 50;
      const status = step.status === 'completed' && hasOutput ? '✅' 
        : step.status === 'completed' && !hasOutput ? '⚠️'
        : step.status === 'skipped' ? '⚠️'
        : '❌';
      
      if (status === '❌') overallStatus = 'FAIL';
      else if (status === '⚠️' && overallStatus !== 'FAIL') overallStatus = 'WARN';

      const note = step.status === 'skipped' ? 'skipped (upstream failed)'
        : step.status === 'completed' && !hasOutput ? `output too short (${step.output?.length || 0} chars)`
        : step.status === 'failed' ? (step.error || 'failed')
        : `${step.output?.length || 0} chars`;

      steps.push({ worker: step.worker_id, status, note });
    }

    if (workerResults.length === 0) {
      overallStatus = 'FAIL';
    }

    results.push({ name: pb.name, overall: overallStatus, steps, runStatus: run?.status });
    const icon = overallStatus === 'PASS' ? '✅' : overallStatus === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${overallStatus} (run: ${run?.status})`);
  }

  console.log('\n\n=== FULL SMOKE TEST REPORT ===\n');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const icon = r.overall === 'PASS' ? '✅' : r.overall === 'WARN' ? '⚠️' : '❌';
    console.log(`Playbook ${i+1}: ${r.name}`);
    if (r.error) {
      console.log(`  ❌ ERROR: ${r.error}`);
    } else {
      for (const s of r.steps) {
        console.log(`  Step (${s.worker}): ${s.status} — ${s.note}`);
      }
    }
    console.log(`  Overall: ${icon} ${r.overall}\n`);
  }

  const passed = results.filter(r => r.overall === 'PASS').length;
  const warned = results.filter(r => r.overall === 'WARN').length;
  const failed = results.filter(r => r.overall === 'FAIL').length;
  console.log(`Summary: ${passed} PASS | ${warned} WARN | ${failed} FAIL`);
}

main().catch(err => { console.error(err); process.exit(1); });
