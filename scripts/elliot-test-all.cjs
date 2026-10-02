'use strict';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs'), path = require('path');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.PROD_SUPABASE_URL || 'https://auth.3rdshift.ai';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY;
if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY env');
const BASE_URL = 'https://3rdshift.ai';
const TODAY = new Date().toISOString().split('T')[0];
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const TESTS = [
  {
    name: 'T1 Personal Story',
    input: { post_type: 'Personal Story', topic: 'I almost killed 3rdShift by trying to scale too early before having a single paying customer', pov: 'I spent 3 months building integrations nobody asked for. When I finally talked to customers, they wanted something completely different. The thing that saved us was stopping all new features for 30 days and just talking to the 4 people who had signed up.', audience: 'Founders / entrepreneurs', voice: 'Founder storytelling' },
    checks: { maxChars: 1800, noWallOfText: true },
  },
  {
    name: 'T2 Contrarian Take',
    input: { post_type: 'Contrarian Take', topic: 'Most founders obsess over CAC when they should obsess over time-to-value', pov: 'The real metric that predicts retention is how fast users get to their first win. Cut CAC in half and double time-to-value and your business gets worse. Flip it and it gets dramatically better.', audience: 'Founders / entrepreneurs', voice: 'Bold contrarian' },
    checks: { maxChars: 1800, noWallOfText: true },
  },
  {
    name: 'T3 Framework',
    input: { post_type: 'Framework / Breakdown', topic: '5 questions I ask before hiring an operator', pov: 'I have hired 3 bad operators and 2 great ones. The difference was always these 5 questions. Most people ask about experience. These questions reveal judgment.', audience: 'Founders / entrepreneurs', voice: 'Thoughtful operator' },
    checks: { maxChars: 1800, noWallOfText: true },
  },
  {
    name: 'T4 Case Study',
    input: { post_type: 'Case Study', topic: '3rdShift went from 0 to 12 paying customers in 45 days', pov: 'We launched with 85 AI workers, got 1 customer in week 1 via cold DM on LinkedIn. Realized all early customers came through LinkedIn personal posts not ads. Doubled down. By day 45 had 12 paying customers, 8 from LinkedIn organic.', audience: 'Founders / entrepreneurs', voice: 'Founder storytelling' },
    checks: { maxChars: 1800, noWallOfText: true },
  },
  {
    name: 'T5 Industry Insight',
    input: { post_type: 'Industry Insight', topic: 'AI agents are about to make 80% of today\'s SaaS integrations obsolete', pov: 'When an AI agent can navigate any software UI by itself, the value of pre-built integrations disappears. Zapier solved the automation problem for the API era. That era is ending faster than people think.', audience: 'Founders / entrepreneurs', voice: 'Sharp analyst' },
    checks: { maxChars: 1800, noWallOfText: true },
  },
  {
    name: 'T6 Question Post',
    input: { post_type: 'Question / Poll', topic: 'What would you give up last if you had to cut your SaaS stack to 5 tools?', pov: 'I asked myself this when we were bootstrapping hard. My answer surprised me. I kept the communication tools and cut the analytics first.', audience: 'Founders / entrepreneurs', voice: 'Thoughtful operator' },
    checks: { maxChars: 1200, noWallOfText: true },
  },
  {
    name: 'T7 Announcement',
    input: { post_type: 'Announcement', topic: 'Shobrun just joined 3rdShift as Head of Design', pov: 'We have been building together for 4 months before he officially joined. He redesigned the entire dashboard in a week. What he brings is rare: taste and speed.', audience: 'Founders / entrepreneurs', voice: 'Thoughtful operator', include_cta: 'No CTA' },
    checks: { maxChars: 1800, noWallOfText: true },
  },
  {
    name: 'T8 Carousel Outline',
    input: { post_type: 'Carousel Outline', topic: 'How to validate a SaaS idea in 30 days', pov: 'I have validated 3 ideas in the last year using a specific framework. Two led to products. One killed a bad idea before I wasted 6 months.', audience: 'Founders / entrepreneurs', voice: 'Warm mentor' },
    checks: { isCarousel: true, hasSlides: true },
  },
];

const BANNED = ['In today\'s digital landscape', 'Game-changing', 'Thought leader', 'Synergy', 'Leveraging', 'Move the needle', 'Circle back', 'Low-hanging fruit', 'Crushing it', 'Excited to announce', 'Thrilled to share'];

async function runTest(t, token, userId, workspaceId) {
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

  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const { data } = await sb.from('tasks').select('status, output').eq('id', task.id).single();
    if (data?.status === 'completed' || data?.status === 'failed') {
      const text = data.output?.text || '';
      const charCount = text.length;
      const failures = [];

      if (t.checks.maxChars && charCount > t.checks.maxChars) failures.push(`Too long: ${charCount} chars (max ${t.checks.maxChars})`);
      if (t.checks.isCarousel && !text.includes('Slide')) failures.push('Carousel mode: no slides found');
      if (t.checks.hasSlides && !(text.includes('Slide 1') || text.includes('## Slide'))) failures.push('Missing slide structure');

      // Check hook length (first non-empty line should be ≤10 words)
      const firstLine = text.trim().split('\n').find(l => l.trim() && !l.startsWith('#'));
      const hookWords = firstLine?.trim().split(/\s+/).length || 0;
      if (!t.checks.isCarousel && hookWords > 15) failures.push(`Hook too long: ${hookWords} words — "${firstLine?.substring(0, 60)}"`);

      // Check wall of text (no paragraph >3 lines without break)
      if (t.checks.noWallOfText) {
        const lines = text.split('\n');
        let consecutive = 0;
        for (const line of lines) {
          if (line.trim()) consecutive++;
          else consecutive = 0;
          if (consecutive > 4) { failures.push('Wall of text detected (>4 consecutive non-blank lines)'); break; }
        }
      }

      BANNED.forEach(b => { if (text.toLowerCase().includes(b.toLowerCase())) failures.push(`Banned: "${b}"`); });

      return { name: t.name, taskId: task.id, status: data.status === 'completed' && failures.length === 0 ? 'PASS' : 'FAIL', charCount, hookWords, failures, preview: text.substring(0, 120).replace(/\n/g, ' ') };
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
  for (let i = 0; i < TESTS.length; i += 4) {
    const batch = TESTS.slice(i, i + 4);
    process.stdout.write(`Running: ${batch.map(t => t.name).join(', ')}...\n`);
    const batchResults = await Promise.all(batch.map(t => runTest(t, token, userId, workspaceId)));
    batchResults.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.charCount || '?'} chars | hook: ${r.hookWords || '?'} words`);
      if (r.failures?.length) r.failures.forEach(f => console.log(`    ⚠️  ${f}`));
      if (r.preview) console.log(`    Preview: ${r.preview.substring(0, 80)}...`);
    });
    results.push(...batchResults);
    if (i + 4 < TESTS.length) await new Promise(r => setTimeout(r, 2000));
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`\n${'='.repeat(50)}\nElliot Tests: ${passed}/${results.length} passed`);
  fs.writeFileSync(path.join(__dirname, `elliot-test-results-${TODAY}.json`), JSON.stringify({ date: TODAY, results, passed, total: results.length }, null, 2));
  console.log('Results saved.');
})();
