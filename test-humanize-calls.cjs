const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const SB_URL = 'https://auth.3rdshift.ai';
const SB_SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
const sb = createClient(SB_URL, SB_SERVICE);
const BASE = 'https://3rdshift.ai';

async function getJWT() {
  const { data, error } = await sb.auth.signInWithPassword({
    email: 'test-roger@3rdshift.ai',
    password: '<SCREENSHOT_TEST_PASSWORD>',
  });
  if (error) throw new Error('Auth: ' + error.message);
  return data.session.access_token;
}

async function apiPost(path, body, jwt) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + jwt },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('Non-JSON from ' + path + ': ' + text.slice(0,200)); }
}

async function pollTask(taskId, maxWait = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 3000));
    const { data } = await sb.from('tasks').select('id, status, output').eq('id', taskId).single();
    if (data?.status === 'completed' || data?.status === 'failed') return data;
  }
  throw new Error('Task timed out: ' + taskId);
}

(async () => {
  console.log('Getting JWT...');
  const jwt = await getJWT();

  // Get workspace_id for test account
  const { data: { user } } = await sb.auth.getUser(jwt);
  const { data: ws } = await sb.from('workspaces').select('id').eq('owner_id', user.id).single();
  const workspaceId = ws?.id;
  console.log('workspace_id:', workspaceId);

  // --- AVA (content-writer — light) ---
  console.log('\nCreating Ava task...');
  const { data: avaRow } = await sb.from('tasks').insert({
    user_id: user.id,
    workspace_id: workspaceId,
    worker_slug: 'content-writer',
    category: 'Content',
    task_type: 'light',
    status: 'pending',
    input: { topic: 'How to write a great email subject line', content_type: 'Blog post', audience: 'Email marketers', tone: 'Friendly', word_count: 'Short (~500 words)' },
    output_format: 'markdown',
  }).select().single();
  console.log('Ava task ID:', avaRow.id);

  // Trigger execution
  await apiPost('/api/execute-task', { taskId: avaRow.id }, jwt);
  const avaResult = await pollTask(avaRow.id);
  console.log('Ava status:', avaResult.status);

  // Humanize Ava
  console.log('Humanizing Ava (expect: humanize-light)...');
  const avaH = await apiPost('/api/humanize', { task_id: avaRow.id }, jwt);
  console.log('Ava humanize:', avaH.humanized ? 'got ' + avaH.humanized.length + ' chars' : 'ERROR: ' + JSON.stringify(avaH));

  // --- ZANE (competitor-analyst — full) ---
  console.log('\nCreating Zane task...');
  const { data: zaneRow } = await sb.from('tasks').insert({
    user_id: user.id,
    workspace_id: workspaceId,
    worker_slug: 'competitor-analyst',
    category: 'Research & Data',
    task_type: 'heavy',
    status: 'pending',
    input: { topic: 'Notion vs Coda productivity tools', competitors: 'Notion\nCoda', target_market: 'SaaS teams' },
    output_format: 'markdown',
  }).select().single();
  console.log('Zane task ID:', zaneRow.id);

  await apiPost('/api/execute-task', { taskId: zaneRow.id }, jwt);
  const zaneResult = await pollTask(zaneRow.id, 60000);
  console.log('Zane status:', zaneResult.status);

  // Humanize Zane
  console.log('Humanizing Zane (expect: humanize-full)...');
  const zaneH = await apiPost('/api/humanize', { task_id: zaneRow.id }, jwt);
  console.log('Zane humanize:', zaneH.humanized ? 'got ' + zaneH.humanized.length + ' chars' : 'ERROR: ' + JSON.stringify(zaneH));

  // Pull ai_call_log
  await new Promise(r => setTimeout(r, 2000));
  const { data: logs } = await sb
    .from('ai_call_log')
    .select('id, worker_id, call_type, created_at')
    .in('call_type', ['humanize-light', 'humanize-full'])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n── AI_CALL_LOG (humanize entries) ──────────────────────');
  (logs || []).forEach(l => {
    console.log(`  ${l.call_type.padEnd(18)} | worker: ${l.worker_id.padEnd(25)} | ${l.created_at}`);
  });
  console.log('────────────────────────────────────────────────────────');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
