/**
 * purity-harness.cjs
 * Real-path verification harness for output purity tests.
 * Mirrors the exact flow the browser uses:
 *   1. Sign in as test-roger (get JWT)
 *   2. Fetch form schema from /api/test-harness/form-schema
 *   3. Insert task into Supabase tasks table (same as page.jsx step 1)
 *   4. POST to /api/execute-task with taskId (same as page.jsx step 2)
 *   5. Poll tasks table until completed
 *   6. Inspect output for pollution patterns
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE = 'https://3rdshift.ai';

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

// ── Pollution patterns ───────────────────────────────────────────────────
const POLLUTION = [
  // "word count: N" as a standalone output line (e.g. appended to cover letter)
  // Does NOT match "RECOMMENDED WORD COUNT: N" (Kai SEO brief - legitimate deliverable content)
  ['word count line',       /^\*{0,2}word count:\s*\d+/im],
  ['keep going with team',  /keep going with (the )?team/i],
  ['click a name above',    /click a name above/i],
  ['turn this into action', /turn this.*into action/i],
  ['⚡ handoff header',     /### ⚡/],
  ['next steps for hire',   /next steps for this hire/i],
  ['## Sources header',     /\n## sources\n/i],
  ['Serper meta-comment',   /web research results provided.*weren.t used|not cited in the body|pertain to pricing analyst/i],
  ['bracket placeholder',   /\[(Your )?(Company Name|Product Name|Topic|Insert [A-Z]|Company\/Product)\]/i],
];

function checkPollution(text) {
  const hits = [];
  for (const [name, pattern] of POLLUTION) {
    if (pattern.test(text)) hits.push(name);
  }
  return hits;
}

// ── Auth ─────────────────────────────────────────────────────────────────
let _token = null;
let _userId = null;
let _workspaceId = null;

async function ensureAuth() {
  if (_token) return;
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: 'test-roger@3rdshift.ai',
    password: '<SCREENSHOT_TEST_PASSWORD>',
  });
  if (error || !data.session) throw new Error('Auth failed: ' + (error?.message || 'no session'));
  _token = data.session.access_token;
  _userId = data.session.user.id;

  // Get workspace
  const { data: ws } = await adminClient
    .from('workspaces')
    .select('id')
    .eq('owner_id', _userId)
    .limit(1)
    .single();
  _workspaceId = ws?.id || null;
  console.log('  Auth OK | user:', _userId.slice(0,8), '| workspace:', _workspaceId?.slice(0,8) || 'none');
}

// ── Form schema fetch ────────────────────────────────────────────────────
async function getFormSchema(workerSlug) {
  const url = `${BASE}/api/test-harness/form-schema?worker=${workerSlug}&token=${CRON_SECRET}`;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

// ── Submit task (real path) ──────────────────────────────────────────────
async function submitTask(workerSlug, input, workerRegistry) {
  await ensureAuth();

  // Get worker config
  const worker = workerRegistry[workerSlug] || { category: workerSlug, taskType: 'light' };

  // Step 1: Insert task (mirrors page.jsx)
  const { data: taskData, error: insertError } = await adminClient
    .from('tasks')
    .insert({
      user_id: _userId,
      workspace_id: _workspaceId,
      worker_slug: workerSlug,
      category: worker.category,
      input,
      status: 'pending',
      task_type: worker.taskType || 'light',
    })
    .select('id')
    .single();

  if (insertError || !taskData) throw new Error('Insert failed: ' + (insertError?.message || 'no data'));

  const taskId = taskData.id;

  // Step 2: Call execute-task (mirrors page.jsx)
  await new Promise((resolve, reject) => {
    const body = JSON.stringify({ taskId });
    const req = https.request({
      hostname: new URL(BASE).hostname,
      path: '/api/execute-task',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _token,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });

  return taskId;
}

// ── Poll for completion ──────────────────────────────────────────────────
async function pollTask(taskId, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 4000));
    const { data } = await adminClient
      .from('tasks')
      .select('status,output,input,worker_slug')
      .eq('id', taskId)
      .single();
    if (data?.status === 'completed' || data?.status === 'failed') return data;
    process.stdout.write('.');
  }
  throw new Error('Timeout polling task ' + taskId);
}

// ── Run a single test ────────────────────────────────────────────────────
async function runTest(workerSlug, input, workerRegistry, label) {
  console.log(`\n[${label}] ${workerSlug}`);
  try {
    const taskId = await submitTask(workerSlug, input, workerRegistry);
    console.log('  taskId:', taskId);
    const result = await pollTask(taskId);
    console.log('');

    if (result.status === 'failed') {
      console.log('  ❌ TASK FAILED:', result.output?.error || 'unknown error');
      return { pass: false, taskId, error: result.output?.error, text: '' };
    }

    const text = result.output?.text || '';
    const hits = checkPollution(text);

    if (hits.length === 0) {
      console.log('  ✅ CLEAN');
    } else {
      console.log('  ❌ POLLUTION:', hits.join(', '));
    }

    console.log('  Length:', text.length, 'chars');
    const lastLine = text.trim().split('\n').filter(Boolean).pop() || '';
    console.log('  Last line:', lastLine.slice(0, 120));
    const tail = text.slice(-300).replace(/\n/g, ' ');
    console.log('  Last 300:', tail);

    return { pass: hits.length === 0, taskId, hits, text, lastLine };
  } catch(e) {
    console.log('  ❌ ERROR:', e.message);
    return { pass: false, error: e.message };
  }
}

module.exports = { ensureAuth, getFormSchema, submitTask, pollTask, runTest, checkPollution, adminClient, anonClient };
