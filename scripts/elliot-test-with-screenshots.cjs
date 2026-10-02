'use strict';
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs'), path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.PROD_SUPABASE_URL || 'https://auth.3rdshift.ai';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY;
if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY env');
const BASE_URL = 'https://3rdshift.ai';
const TODAY = new Date().toISOString().split('T')[0];
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'specialist-rebuild-evidence', 'elliot-2026-04-22', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const TESTS = [
  { name: 'T1-personal-story', input: { post_type: 'Personal Story', topic: 'I almost killed 3rdShift by scaling too early before a single paying customer', pov: 'I spent 3 months building integrations nobody asked for. When I finally talked to customers, they wanted something completely different. Stopping all new features for 30 days and just listening saved us.', audience: 'Founders / entrepreneurs', voice: 'Founder storytelling' } },
  { name: 'T2-contrarian-take', input: { post_type: 'Contrarian Take', topic: 'Most founders obsess over CAC when they should obsess over time-to-value', pov: 'The real predictor of retention is how fast users get to their first win. Cut CAC in half and double time-to-value and the business gets worse. Flip it and it gets dramatically better.', audience: 'Founders / entrepreneurs', voice: 'Bold contrarian' } },
  { name: 'T3-framework', input: { post_type: 'Framework / Breakdown', topic: '5 questions I ask before hiring an operator', pov: 'I hired 3 bad operators and 2 great ones. The difference was always these 5 questions. Most people ask about experience. These reveal judgment.', audience: 'Founders / entrepreneurs', voice: 'Thoughtful operator' } },
  { name: 'T4-case-study', input: { post_type: 'Case Study', topic: '3rdShift: 0 to 12 paying customers in 45 days', pov: 'Launched with 85 AI workers. Got 1 customer in week 1 via LinkedIn DM. All early customers came from LinkedIn organic posts, not ads. By day 45 had 12 paying customers.', audience: 'Founders / entrepreneurs', voice: 'Founder storytelling' } },
  { name: 'T5-industry-insight', input: { post_type: 'Industry Insight', topic: 'AI agents will make most SaaS integrations worthless', pov: 'When AI agents navigate any software UI themselves, pre-built integrations lose their value. Zapier solved automation for the API era. That era is ending faster than most think.', audience: 'Founders / entrepreneurs', voice: 'Sharp analyst' } },
  { name: 'T6-question-post', input: { post_type: 'Question / Poll', topic: 'If you had to cut your SaaS stack to 5 tools, what stays?', pov: 'I asked myself this when bootstrapping hard. My answer surprised me. I kept communication tools and cut analytics first.', audience: 'Founders / entrepreneurs', voice: 'Thoughtful operator' } },
  { name: 'T7-announcement', input: { post_type: 'Announcement', topic: 'Shobrun joined 3rdShift as Head of Design', pov: 'We built together 4 months before he officially joined. He redesigned the full dashboard in a week. What he brings is rare: taste and speed.', audience: 'Founders / entrepreneurs', voice: 'Thoughtful operator', include_cta: 'No CTA' } },
  { name: 'T8-carousel-outline', input: { post_type: 'Carousel Outline', topic: 'How to validate a SaaS idea in 30 days', pov: 'I validated 3 ideas last year using this framework. Two led to products. One killed a bad idea before I wasted 6 months.', audience: 'Founders / entrepreneurs', voice: 'Warm mentor' } },
];

const BANNED = ['In today\'s digital landscape', 'Game-changing', 'Thought leader', 'Synergy', 'Leveraging', 'Move the needle', 'Circle back', 'Low-hanging fruit', 'Crushing it', 'Excited to announce', 'Thrilled to share'];

async function runAndScreenshot(t, token, userId, workspaceId, page) {
  const { data: task, error } = await sb.from('tasks').insert({
    user_id: userId, workspace_id: workspaceId,
    worker_slug: 'linkedin-ghostwriter', category: 'social-media',
    task_type: 'light', status: 'pending', input: t.input,
  }).select('id').single();
  if (error || !task) return { name: t.name, status: 'FAIL', error: error?.message };

  const res = await fetch(`${BASE_URL}/api/execute-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-workspace-id': workspaceId },
    body: JSON.stringify({ taskId: task.id }),
  });
  if (!res.ok) return { name: t.name, status: 'FAIL', error: `Execute ${res.status}` };

  // Poll for completion
  let finalData;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const { data } = await sb.from('tasks').select('status, output').eq('id', task.id).single();
    if (data?.status === 'completed' || data?.status === 'failed') { finalData = data; break; }
  }
  if (!finalData) return { name: t.name, status: 'TIMEOUT', taskId: task.id };

  const text = finalData.output?.text || '';
  const charCount = text.length;

  // Screenshot the result page
  await page.goto(`${BASE_URL}/dashboard/tasks/result?taskId=${task.id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const screenshotPath = path.join(SCREENSHOT_DIR, `${t.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Strict hook check
  const lines = text.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const hookLine = lines[0] || '';
  const hookWords = hookLine.trim().split(/\s+/).filter(Boolean).length;
  const isCarousel = t.input.post_type === 'Carousel Outline';

  const failures = [];
  if (!isCarousel && hookWords > 10) failures.push(`HOOK EXCEEDS 10 WORDS: ${hookWords} words — "${hookLine.substring(0, 60)}"`);
  if (isCarousel && !(text.includes('Slide 1') || text.includes('## Slide'))) failures.push('Carousel: no slide structure found');
  if (!isCarousel && charCount > 1900) failures.push(`Too long: ${charCount} chars`);
  if (!isCarousel && charCount < 600) failures.push(`Too short: ${charCount} chars`);
  BANNED.forEach(b => { if (text.toLowerCase().includes(b.toLowerCase())) failures.push(`Banned phrase: "${b}"`); });

  // Wall of text check
  if (!isCarousel) {
    const textLines = text.split('\n');
    let consecutive = 0;
    for (const line of textLines) {
      if (line.trim()) consecutive++;
      else consecutive = 0;
      if (consecutive > 4) { failures.push('Wall of text (>4 consecutive non-blank lines)'); break; }
    }
  }

  return {
    name: t.name, taskId: task.id,
    status: finalData.status === 'completed' && failures.length === 0 ? 'PASS' : 'FAIL',
    charCount, hookWords, hookLine: hookLine.substring(0, 80),
    failures, screenshotPath,
    preview: text.substring(0, 200).replace(/\n/g, ' '),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Login as test-roger
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(8000);
  console.log('Login:', page.url().includes('dashboard') ? '✅' : '❌');

  const { data: signIn } = await sb.auth.signInWithPassword({ email: 'test-roger@3rdshift.ai', password: '<SCREENSHOT_TEST_PASSWORD>' });
  const token = signIn?.session?.access_token, userId = signIn?.user?.id;
  const { data: member } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId).single();
  const workspaceId = member?.workspace_id;
  console.log('Auth OK\n');

  // Screenshot Elliot form
  await page.goto(`${BASE_URL}/dashboard/workers/linkedin-ghostwriter`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'elliot-form-desktop.png'), fullPage: false });
  console.log('Form screenshot saved');

  const results = [];
  for (let i = 0; i < TESTS.length; i += 4) {
    const batch = TESTS.slice(i, i + 4);
    process.stdout.write(`Running: ${batch.map(t => t.name).join(', ')}...\n`);
    // Run tasks in parallel but screenshots sequential (shared browser page)
    const taskPromises = batch.map(t => {
      const { data: signIn2 } = { data: signIn }; // reuse token
      return new Promise(async (resolve) => {
        const r = await runAndScreenshot(t, token, userId, workspaceId, page);
        resolve(r);
      });
    });
    // Actually run sequentially to avoid page conflicts
    for (const t of batch) {
      const r = await runAndScreenshot(t, token, userId, workspaceId, page);
      results.push(r);
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.charCount}c | hook: ${r.hookWords}w "${r.hookLine?.substring(0, 50)}"`);
      if (r.failures?.length) r.failures.forEach(f => console.log(`    ⚠️  ${f}`));
    }
    if (i + 4 < TESTS.length) await new Promise(r => setTimeout(r, 2000));
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`\n${'='.repeat(50)}\nElliot Tests: ${passed}/${results.length} passed`);
  console.log(results.map(r => `  ${r.status === 'PASS' ? '✅' : '❌'} ${r.name}: hook ${r.hookWords}w`).join('\n'));

  fs.writeFileSync(path.join(__dirname, `elliot-test-results-v2-${TODAY}.json`), JSON.stringify({ date: TODAY, results, passed, total: results.length }, null, 2));
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('Results saved.');

  await browser.close();
})();
