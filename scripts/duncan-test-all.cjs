'use strict';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs'), path = require('path');
const SUPABASE_URL = 'https://auth.3rdshift.ai';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY;
if (!SUPABASE_KEY) throw new Error('Missing Supabase key env for SUPABASE_KEY');
const BASE_URL = 'https://3rdshift.ai';
const TODAY = new Date().toISOString().split('T')[0];
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const TESTS = [
  {
    name: 'Test 1 — Investor Pitch',
    input: {
      purpose: 'Investor pitch research',
      market: 'AI workforce SaaS for solo founders',
      product_angle: '3rdShift — 85 specialized AI workers for solo founders and SMBs. Replaces freelancers, VAs, agencies. $29-199/mo subscription.',
      geography: 'United States',
      depth: 'Standard (~1,500-2,500 words)',
      competitors: 'Sintra AI, Marblism, Blaze AI, Copy.ai',
    },
    checks: { shouldContain: ['TAM', 'SAM', 'SOM'], shouldNotContain: ['Robust growth', 'Paradigm shift', 'In today\'s dynamic'], minWords: 800 },
  },
  {
    name: 'Test 2 — Market Entry Strategy',
    input: {
      purpose: 'Internal strategy / market entry',
      market: 'D2C men\'s skincare for 35-55 year olds',
      product_angle: 'Minimalist skincare line for men who don\'t want to think about it. 3-step routine, subscription model, $45/mo.',
      geography: 'United States',
      depth: 'Standard (~1,500-2,500 words)',
    },
    checks: { shouldContain: ['Porter', 'Force', 'segment'], shouldNotContain: ['Paradigm', 'Synerg'], minWords: 800 },
  },
  {
    name: 'Test 3 — Product Validation',
    input: {
      purpose: 'Product validation',
      market: 'Async-first project management for distributed engineering teams',
      product_angle: 'Linear-meets-Notion for async-first engineering teams. Focus on clarity over meetings.',
      geography: 'Global',
      depth: 'Standard (~1,500-2,500 words)',
    },
    checks: { shouldContain: ['wedge', 'Wedge', 'willingness', 'Willingness'], shouldNotContain: ['Paradigm'], minWords: 600 },
  },
  {
    name: 'Test 4 — Competitive Intelligence',
    input: {
      purpose: 'Competitive intelligence',
      market: 'AI content writing tools',
      product_angle: '3rdShift positioning against AI writing tools — focused on specialists not generalists.',
      geography: 'Global',
      depth: 'Standard (~1,500-2,500 words)',
      competitors: 'Jasper, Copy.ai, Writesonic',
    },
    checks: { shouldContain: ['Jasper', 'Attack', 'attack', 'positioning', 'Positioning'], shouldNotContain: ['Paradigm'], minWords: 800 },
  },
  {
    name: 'Test 5 — Industry Trend Analysis',
    input: {
      purpose: 'Industry trend analysis',
      market: 'AI voice agents for customer service',
      product_angle: 'Understanding macro trends to inform 3rdShift product roadmap.',
      geography: 'Global',
      depth: 'Standard (~1,500-2,500 words)',
    },
    checks: { shouldContain: ['PESTLE', 'trend', 'Trend'], shouldNotContain: ['Paradigm', 'Robust growth'], minWords: 800 },
  },
  {
    name: 'Test 6 — M&A Screening',
    input: {
      purpose: 'M&A / acquisition screening',
      market: 'Newsletter tools and creator economy infrastructure',
      product_angle: 'Media company evaluating acquisition targets for newsletter distribution capabilities.',
      geography: 'United States',
      depth: 'Standard (~1,500-2,500 words)',
    },
    checks: { shouldContain: ['target', 'Target', 'acquisition', 'shortlist', 'Shortlist'], shouldNotContain: ['Paradigm'], minWords: 600 },
  },
];

const BANNED = ['In today\'s dynamic market', 'Rapidly evolving landscape', 'Paradigm shift', 'Unprecedented opportunity', 'Robust growth', 'Leveraging synergies', 'Strategic imperative'];

async function runTest(t, token, userId, workspaceId) {
  const { data: task, error } = await sb.from('tasks').insert({
    user_id: userId, workspace_id: workspaceId,
    worker_slug: 'market-research-analyst', category: 'research-strategy',
    task_type: 'heavy', status: 'pending', input: t.input,
  }).select('id').single();
  if (error || !task) return { name: t.name, status: 'FAIL', error: error?.message };

  const res = await fetch(`${BASE_URL}/api/execute-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-workspace-id': workspaceId },
    body: JSON.stringify({ taskId: task.id }),
  });
  if (!res.ok) return { name: t.name, status: 'FAIL', error: `Execute ${res.status}` };

  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await sb.from('tasks').select('status, output').eq('id', task.id).single();
    if (data?.status === 'completed' || data?.status === 'failed') {
      const text = data.output?.text || '';
      const wc = text.split(/\s+/).filter(Boolean).length;
      const failures = [];
      if (t.checks.minWords && wc < t.checks.minWords) failures.push(`Too short: ${wc} words`);
      BANNED.forEach(b => { if (text.includes(b)) failures.push(`Banned: "${b}"`); });
      t.checks.shouldContain?.forEach(s => { if (!text.includes(s)) failures.push(`Missing: "${s}"`); });
      t.checks.shouldNotContain?.forEach(s => { if (text.includes(s)) failures.push(`Should not contain: "${s}"`); });
      return { name: t.name, taskId: task.id, status: data.status === 'completed' && failures.length === 0 ? 'PASS' : 'FAIL', wordCount: wc, failures, preview: text.substring(0, 120).replace(/\n/g, ' ') };
    }
  }
  return { name: t.name, status: 'TIMEOUT', taskId: task.id };
}

(async () => {
  const { data: signIn } = await sb.auth.signInWithPassword({ email: 'test-roger@3rdshift.ai', password: '<SCREENSHOT_TEST_PASSWORD>' });
  const token = signIn?.session?.access_token, userId = signIn?.user?.id;
  const { data: member } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId).single();
  const workspaceId = member?.workspace_id;
  console.log('Auth OK\n');

  const results = [];
  // Run 2 at a time (Serper-heavy, don't want to hammer API)
  for (let i = 0; i < TESTS.length; i += 2) {
    const batch = TESTS.slice(i, i + 2);
    process.stdout.write(`Running: ${batch.map(t => t.name).join(', ')}...\n`);
    const batchResults = await Promise.all(batch.map(t => runTest(t, token, userId, workspaceId)));
    batchResults.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.wordCount || '?'} words`);
      if (r.failures?.length) r.failures.forEach(f => console.log(`    ⚠️  ${f}`));
      if (r.preview) console.log(`    Preview: ${r.preview.substring(0, 80)}...`);
    });
    results.push(...batchResults);
    if (i + 2 < TESTS.length) await new Promise(r => setTimeout(r, 3000));
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`\n${'='.repeat(50)}\nDuncan Tests: ${passed}/${results.length} passed`);
  console.log(results.map(r => `  ${r.status === 'PASS' ? '✅' : '❌'} ${r.name}`).join('\n'));
  fs.writeFileSync(path.join(__dirname, `duncan-test-results-${TODAY}.json`), JSON.stringify({ date: TODAY, results, passed, total: results.length }, null, 2));
  console.log('Results saved.');
})();
