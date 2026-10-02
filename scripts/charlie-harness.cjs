/**
 * charlie-harness.cjs
 * Reusable test harness for Heavy workers with long generation times.
 *
 * ARCHITECTURE: Submit-and-poll (not wait-for-HTTP)
 * ─────────────────────────────────────────────────
 * execute-task is a Vercel Fluid Compute function with maxDuration=800s.
 * Waiting for the HTTP response body will drop (socket hang up) after ~300-340s
 * because Node's default socket timeout is shorter than the generation window.
 * Fix: fire the POST, immediately destroy the socket, poll the DB directly.
 * The Vercel function runs independently of the HTTP connection.
 *
 * OUTPUT FORMAT DETECTION: detectOutputSuccess()
 * ───────────────────────────────────────────────
 * 85 workers produce 8 distinct output shapes. The naive check (output.text.length > 0)
 * misreads non-text workers as failures:
 *
 *   Worker type          | Output shape          | Workers
 *   ---------------------|----------------------|------------------------------------------
 *   Text / markdown      | output.text (string) | 74 workers — everything defaults here
 *   PPTX slides          | output.downloadUrl + .pptx fileName | Mack, Blair
 *   Images               | output.images[] + format:'images' | Reed, Shay, Gus
 *   Audio                | output.downloadUrl + format:'audio' | Clay, Opal, Dina, Koa, Tala
 *   Video                | output.videoUrl or format:'video' | Rio, Joss, Paul, Darcy
 *   Leads                | output.leads[] + format:'leads' | Lenny
 *   XLSX / structured    | output.downloadUrl + .xlsx | Sienna, Cade, Brody, Bella
 *   Download (catch-all) | output.downloadUrl (any)  | fallback
 *
 * EXPECTED_FORMATS map catches cross-contamination:
 * a text worker returning videoUrl, or an image worker returning markdown text,
 * would be a bug. The map records the expected non-text format per worker slug.
 * Workers not in the map are expected to produce text output.
 *
 * CHARLIE RATE LIMIT: 5 tasks per rolling 24-hour window per user.
 * Use separate accounts (test-charlie / test-roger) to run more than 5 tasks.
 * Rate limit checks only count completed + processing tasks, not pending or failed.
 * Run tests SEQUENTIALLY — parallel submits race the rate limit check in execute-task.
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Test accounts
const ACCOUNTS = {
  'test-charlie': { email: 'test-charlie@3rdshift.ai', userId: '3d714838-b4d7-4052-9f65-c0d5620310d6', workspaceId: 'c1604e4b-3578-4415-a074-db48782c5e1b' },
  'test-roger':   { email: 'test-roger@3rdshift.ai',   userId: 'beb11849-c77e-4ba0-84a5-12c85e087162', workspaceId: '908596ba-f86a-4ca6-b8e6-a6e70101d081' },
};

let _token = null;
let _account = null;

async function ensureAuth(accountKey = 'test-charlie') {
  if (_token && _account === accountKey) return _token;
  const acc = ACCOUNTS[accountKey];
  if (!acc) throw new Error('Unknown account: ' + accountKey);
  const { data, error } = await anon.auth.signInWithPassword({ email: acc.email, password: '<SCREENSHOT_TEST_PASSWORD>' });
  if (error || !data.session) throw new Error('Auth failed: ' + (error?.message || 'no session'));
  _token = data.session.access_token;
  _account = accountKey;
  console.log('  Auth OK [' + accountKey + ']');
  return _token;
}

/**
 * Submit a task and immediately start polling — no waiting for HTTP response.
 * Returns when task completes or times out.
 */
async function submitAndPoll(workerSlug, input, opts = {}) {
  const {
    accountKey = 'test-charlie',
    label = workerSlug,
    pollIntervalMs = 10000,
    timeoutMs = 750000,  // 750s — safely under 800s maxDuration
    category = 'Content Writing',
    taskType = 'heavy',
  } = opts;

  const token = await ensureAuth(accountKey);
  const acc = ACCOUNTS[accountKey];

  // Step 1: Insert task
  const { data: taskData, error: insertErr } = await admin.from('tasks').insert({
    user_id: acc.userId,
    workspace_id: acc.workspaceId,
    worker_slug: workerSlug,
    category,
    input,
    status: 'pending',
    task_type: taskType,
  }).select('id').single();

  if (insertErr || !taskData) throw new Error('Task insert failed: ' + (insertErr?.message || 'no data'));
  const taskId = taskData.id;
  console.log('  [' + label + '] taskId: ' + taskId.slice(0, 8));

  // Step 2: Fire execute-task — fire and forget (don't block on HTTP response)
  const body = JSON.stringify({ taskId });
  const req = https.request({
    hostname: '3rdshift.ai',
    path: '/api/execute-task',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 30000, // only need the server to ACK the request start
  });
  req.on('error', () => {}); // intentionally ignore HTTP errors — task runs independently
  req.on('timeout', () => req.destroy()); // disconnect after initial timeout
  req.write(body);
  req.end();

  // Step 3: Poll DB until done
  const start = Date.now();
  let lastStatus = 'pending';
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    const elapsed = Math.round((Date.now() - start) / 1000);
    const { data } = await admin.from('tasks').select('status, output, credits_charged').eq('id', taskId).single();
    if (!data) { process.stdout.write('?'); continue; }
    lastStatus = data.status;
    if (data.status === 'completed' || data.status === 'failed') {
      const text = data.output?.text || '';
      const err = data.output?.error || '';
      process.stdout.write('\n');
      console.log('  [' + label + '] ' + data.status + ' | ' + text.length + ' chars | ' + elapsed + 's | credits: ' + data.credits_charged);
      if (err) console.log('  error: ' + err.slice(0, 200));
      return { pass: data.status === 'completed' && text.length > 1000, status: data.status, chars: text.length, elapsed, taskId, text, credits: data.credits_charged };
    }
    process.stdout.write('.' + elapsed + 's ');
  }
  process.stdout.write('\n');
  console.log('  [' + label + '] TIMEOUT after ' + Math.round(timeoutMs/1000) + 's | last status: ' + lastStatus);
  return { pass: false, status: 'timeout', chars: 0, elapsed: Math.round(timeoutMs/1000), taskId };
}

/**
 * detectOutputSuccess — determines whether a completed task produced real output.
 * Handles all output formats: text, PPTX, images, audio, video, leads, CSV.
 * Without this, non-text workers (Mack, Blair, Clay, Reed, etc.) misread as 0-char failures.
 *
 * @param task  The task DB row with `status` and `output` fields
 * @param slug  The worker slug (used for format cross-contamination checks)
 * @returns     { success, format, chars, note }
 */
function detectOutputSuccess(task, slug) {
  if (task.status !== 'completed') return { success: false, format: 'unknown', chars: 0, note: 'status:' + task.status };
  const out = task.output || {};
  
  // 1. Text / markdown
  if (typeof out.text === 'string' && out.text.length > 100) {
    return { success: true, format: 'markdown', chars: out.text.length, note: out.text.length + 'ch' };
  }
  
  // 2. PPTX (presentation-builder / pitch-deck-writer)
  if (out.format === 'pptx' || out.downloadUrl?.includes('.pptx') || out.fileName?.endsWith('.pptx')) {
    return { success: true, format: 'pptx', chars: 0, note: (out.slideCount || '?') + ' slides | ' + (out.fileName || 'unknown.pptx') };
  }
  
  // 3. Images (thumbnail-designer, logo-concept-generator, social-media-graphics-designer)
  if (out.format === 'images' || (Array.isArray(out.images) && out.images.length > 0)) {
    const count = Array.isArray(out.images) ? out.images.length : 1;
    return { success: true, format: 'images', chars: 0, note: count + ' image(s)' };
  }
  
  // 4. Audio (voiceover-artist, sound-effects-designer, content-translator, meeting-notes-writer, transcription-specialist)
  if (out.format === 'audio' || out.audioUrl || out.downloadUrl?.includes('.mp3') || out.downloadUrl?.includes('.wav')) {
    return { success: true, format: 'audio', chars: 0, note: 'audio | ' + (out.duration || '') };
  }
  
  // 5. Video (product-video-creator, b-roll-generator, scene-director, ad-creative-generator)
  if (out.format === 'video' || out.format === 'video_pending' || out.videoUrl || out.video) {
    return { success: true, format: 'video', chars: 0, note: 'video | ' + (out.format || '') };
  }
  
  // 6. Leads CSV (lead-generator)
  if (out.format === 'leads' || (out.leads && out.leads.length > 0) || out.downloadUrl?.includes('.csv')) {
    const count = Array.isArray(out.leads) ? out.leads.length : '?';
    return { success: true, format: 'leads', chars: 0, note: count + ' leads' };
  }
  
  // 7. XLSX / structured data (spreadsheet-builder, data-cleaner, bookkeeping-summarizer, kpi-dashboard-writer)
  if (out.downloadUrl?.includes('.xlsx') || out.format === 'xlsx') {
    return { success: true, format: 'xlsx', chars: 0, note: 'xlsx | ' + (out.fileName || '') };
  }
  
  // 8. Any downloadUrl present (catch-all)
  if (out.downloadUrl) {
    return { success: true, format: 'download', chars: 0, note: 'download | ' + out.downloadUrl.split('/').pop().slice(0, 40) };
  }
  
  // No recognizable output
  return { success: false, format: 'empty', chars: 0, note: 'no output detected | keys: ' + Object.keys(out).join(',') };
}

/**
 * EXPECTED_OUTPUT_FORMAT per worker slug.
 * Used for cross-contamination checks: a markdown worker returning images = bug.
 * Only populated for non-standard output workers.
 */
const EXPECTED_FORMATS = {
  // PPTX
  'presentation-builder': 'pptx',
  'pitch-deck-writer': 'pptx',
  // Images
  'thumbnail-designer': 'images',
  'logo-concept-generator': 'images',
  'social-media-graphics-designer': 'images',
  // Audio
  'voiceover-artist': 'audio',
  'sound-effects-designer': 'audio',
  'content-translator': 'audio',
  'meeting-notes-writer': 'audio',
  'transcription-specialist': 'audio',
  // Video
  'product-video-creator': 'video',
  'b-roll-generator': 'video',
  'scene-director': 'video',
  'ad-creative-generator': 'video',
  // Leads
  'lead-generator': 'leads',
  // Default: text/markdown for everything else
};

module.exports = { submitAndPoll, ensureAuth, detectOutputSuccess, EXPECTED_FORMATS, admin, anon, ACCOUNTS };
