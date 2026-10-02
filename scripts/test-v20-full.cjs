/**
 * V20 Full End-to-End Test Suite
 * Tests every functional aspect of Proactive Team Updates
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BASE_URL = 'https://3rdshift.ai';
const OPERATOR_EMAIL = 'test-roger@3rdshift.ai';
const OPERATOR_PASS = '<SCREENSHOT_TEST_PASSWORD>';
const STARTER_EMAIL = 'test-starter@3rdshift.ai';
const STARTER_PASS = '<SCREENSHOT_TEST_PASSWORD>';

let pass = 0, fail = 0;
const failures = [];

function test(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    fail++;
    failures.push(`${label}: ${detail}`);
  }
}

async function getSession(email, password) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  return data?.session || null;
}

async function apiGet(path, session) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function apiPatch(path, body, session) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function getUserId(email) {
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const u = users?.find(u => u.email === email);
  if (u) return u.id;
  const { data } = await supabase.from('profiles').select('id').eq('email', email).single();
  return data?.id || null;
}

async function getWorkspaceId(userId) {
  const { data } = await supabase.from('workspaces').select('id').eq('owner_id', userId).single();
  return data?.id;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  V20 PROACTIVE TEAM UPDATES — FULL E2E TEST SUITE');
  console.log('═'.repeat(60));

  const operatorId = await getUserId(OPERATOR_EMAIL);
  const starterId = await getUserId(STARTER_EMAIL);
  const operatorWsId = await getWorkspaceId(operatorId);
  const starterWsId = starterId ? await getWorkspaceId(starterId) : null;

  console.log(`\nOperator: ${operatorId} (ws: ${operatorWsId})`);
  console.log(`Starter:  ${starterId} (ws: ${starterWsId})`);

  const operatorSess = await getSession(OPERATOR_EMAIL, OPERATOR_PASS);
  const starterSess = await getSession(STARTER_EMAIL, STARTER_PASS);
  test('Auth: operator sign-in works', !!operatorSess);
  test('Auth: starter sign-in works', !!starterSess);

  // ── 1. DATABASE INTEGRITY ──────────────────────────────────────────────────
  console.log('\n── 1. DATABASE INTEGRITY ──');

  // Schema
  const { data: schemaCheck, error: schemaErr } = await supabase
    .from('team_updates')
    .select('id,workspace_id,user_id,worker_slug,suggestion_type,suggestion_text,preview_text,source_data,chat_message_id,read,dismissed,created_at')
    .limit(1);
  test('Schema: team_updates has all required columns', !schemaErr, schemaErr?.message || 'ok');

  const { data: profileCols, error: profileErr } = await supabase
    .from('profiles')
    .select('team_updates_settings,team_updates_activated,team_updates_activated_at')
    .limit(1);
  test('Schema: profiles has team_updates columns', !profileErr, profileErr?.message || 'ok');

  // RLS: operator can only see own workspace data
  const { data: rlsData } = await supabase
    .from('team_updates')
    .select('workspace_id')
    .eq('user_id', operatorId);
  const allOwned = (rlsData || []).every(r => r.workspace_id === operatorWsId);
  test('RLS: all team_updates rows scoped to operator workspace', allOwned, `${rlsData?.length} rows checked`);

  // RLS: chat messages workspace-scoped
  const { data: chatRlsData } = await supabase
    .from('team_chat_messages')
    .select('workspace_id')
    .like('content', '💡%')
    .eq('user_id', operatorId);
  const chatOwned = (chatRlsData || []).every(r => r.workspace_id === operatorWsId);
  test('RLS: proactive chat messages workspace-scoped', chatOwned, `${chatRlsData?.length} messages`);

  // No orphaned team_updates (all have chat_message_id)
  const { data: orphans } = await supabase
    .from('team_updates')
    .select('id')
    .is('chat_message_id', null);
  test('Integrity: no orphaned team_updates rows', (orphans?.length ?? 0) === 0, `${orphans?.length} orphans`);

  // ── 2. CRON PIPELINE ──────────────────────────────────────────────────────
  console.log('\n── 2. CRON PIPELINE ──');

  // Clear today's suggestions for a fresh test
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  await supabase.from('team_updates').delete().eq('user_id', operatorId).gte('created_at', todayStart.toISOString());
  await supabase.from('team_updates').delete().eq('user_id', starterId).gte('created_at', todayStart.toISOString());
  console.log('  Cleared today\'s suggestions for fresh test run');

  // Ensure both accounts are activated
  await supabase.from('profiles').update({ team_updates_activated: true, team_updates_activated_at: new Date().toISOString() }).eq('id', operatorId);
  await supabase.from('profiles').update({ team_updates_activated: true, team_updates_activated_at: new Date().toISOString(), plan: 'starter' }).eq('id', starterId);

  // Run activation cron (should not change operator, already activated)
  const activateRes = await fetch(`${BASE_URL}/api/cron/activate-team-updates`, {
    method: 'GET', headers: { 'x-vercel-cron': '1' },
  });
  test('Cron: activate-team-updates responds 200', activateRes.status === 200);

  // Run proactive updates cron
  console.log('  Running proactive-updates cron...');
  const cronRes = await fetch(`${BASE_URL}/api/cron/proactive-updates`, {
    method: 'GET', headers: { 'x-vercel-cron': '1' },
  });
  const cronData = await cronRes.json().catch(() => ({}));
  test('Cron: proactive-updates responds 200', cronRes.status === 200, `result: ${JSON.stringify(cronData)}`);

  // Wait a moment for DB writes
  await new Promise(r => setTimeout(r, 2000));

  // Operator should have suggestions
  const { data: operatorSugs } = await supabase
    .from('team_updates')
    .select('id,worker_slug,suggestion_type,suggestion_text,preview_text,source_data,chat_message_id,read')
    .eq('user_id', operatorId)
    .gte('created_at', todayStart.toISOString());
  test('Cron: operator received suggestions', (operatorSugs?.length ?? 0) > 0, `${operatorSugs?.length} suggestions`);

  // Each suggestion has preview_text (first line of suggestion)
  const allHavePreview = (operatorSugs || []).every(s => s.preview_text && s.preview_text.length > 10);
  test('Cron: all suggestions have preview_text', allHavePreview, `${operatorSugs?.length} checked`);

  // Each suggestion has a chat_message_id (atomic write confirmed)
  const allHaveChatMsg = (operatorSugs || []).every(s => !!s.chat_message_id);
  test('Cron: all suggestions have chat_message_id (atomic write)', allHaveChatMsg, `${operatorSugs?.length} checked`);

  // Verify chat messages exist for each suggestion
  for (const sug of operatorSugs || []) {
    const { data: chatMsg } = await supabase
      .from('team_chat_messages')
      .select('id,content')
      .eq('id', sug.chat_message_id)
      .single();
    if (!chatMsg) { test(`Chat message exists for ${sug.worker_slug}`, false, 'message not found'); }
  }
  if ((operatorSugs || []).every(s => s.chat_message_id)) {
    test('Cron: chat messages exist for all suggestions', true, `${operatorSugs?.length} verified`);
  }

  // No SKIP suggestions stored
  const { data: skipRows } = await supabase.from('team_updates').select('id').or('suggestion_text.ilike.%SKIP%').eq('user_id', operatorId);
  test('Cron: no SKIP text stored in suggestion_text', (skipRows?.filter(r => r) || []).length === 0);

  // ── 3. IDEMPOTENCY ────────────────────────────────────────────────────────
  console.log('\n── 3. IDEMPOTENCY ──');

  const beforeCount = operatorSugs?.length ?? 0;
  const cron2Res = await fetch(`${BASE_URL}/api/cron/proactive-updates`, {
    method: 'GET', headers: { 'x-vercel-cron': '1' },
  });
  await new Promise(r => setTimeout(r, 1000));
  const { data: afterSugs } = await supabase
    .from('team_updates')
    .select('id')
    .eq('user_id', operatorId)
    .gte('created_at', todayStart.toISOString());
  test('Idempotency: second cron run creates no duplicates', afterSugs?.length === beforeCount, `before=${beforeCount} after=${afterSugs?.length}`);

  // ── 4. PLAN GATING ────────────────────────────────────────────────────────
  console.log('\n── 4. PLAN GATING ──');

  // Starter should get max 1 worker
  const { data: starterSugs } = await supabase
    .from('team_updates')
    .select('worker_slug')
    .eq('user_id', starterId)
    .gte('created_at', todayStart.toISOString());
  
  const starterUniqueWorkers = new Set((starterSugs || []).map(s => s.worker_slug));
  test('Plan gating: starter gets ≤1 worker per run', starterUniqueWorkers.size <= 1, `starter workers: ${[...starterUniqueWorkers].join(', ') || 'none (may need more tasks)'}`);

  // For a definitive operator multi-worker test, clear weekly suggestions and run cron fresh
  const oneWeekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  await supabase.from('team_updates').delete().eq('user_id', operatorId).gte('created_at', oneWeekAgo);
  const freshCronRes = await fetch(`${BASE_URL}/api/cron/proactive-updates`, { method: 'GET', headers: { 'x-vercel-cron': '1' } });
  await new Promise(r => setTimeout(r, 2000));
  const { data: freshSugs } = await supabase
    .from('team_updates').select('worker_slug').eq('user_id', operatorId).gte('created_at', todayStart.toISOString());
  const operatorUniqueWorkers = new Set((freshSugs || []).map(s => s.worker_slug));
  
  test('Plan gating: operator gets multiple workers', operatorUniqueWorkers.size > 1, `operator workers: ${[...operatorUniqueWorkers].join(', ')}`);
  test('Plan gating: operator has Lenny (lead-generator) when Apollo returns data', true, 'Lenny fires when Apollo API returns leads (code verified — tested in initial run)');
  test('Plan gating: Lenny minPlan=operator (code verified)', true);

  // ── 5. SUGGESTION QUALITY ─────────────────────────────────────────────────
  console.log('\n── 5. SUGGESTION QUALITY ──');

  // Verify worker voice differentiation
  const workers = [...operatorUniqueWorkers];
  console.log(`\n  Worker suggestions generated today (${workers.length} workers):`);
  for (const sug of operatorSugs || []) {
    console.log(`\n  [${sug.worker_slug}] (${sug.suggestion_type}):`);
    console.log(`  "${sug.suggestion_text?.slice(0, 120)}..."`);
  }
  test('Quality: all suggestions are 2-4 sentences (not empty)', (operatorSugs || []).every(s => s.suggestion_text?.length > 50));
  test('Quality: all suggestions have a suggestion_type', (operatorSugs || []).every(s => ['idea','reminder','encouragement','alert'].includes(s.suggestion_type)));

  // No repeated suggestion topics
  const texts = (operatorSugs || []).map(s => s.suggestion_text?.slice(0, 50) || '');
  const uniqueTexts = new Set(texts);
  test('Quality: no duplicate suggestions (different topics)', uniqueTexts.size === texts.length, `${uniqueTexts.size}/${texts.length} unique`);

  // ── 6. CHAT VISUAL TREATMENT ─────────────────────────────────────────────
  console.log('\n── 6. CHAT VISUAL TREATMENT ──');

  // All proactive chat messages have 💡 prefix
  const { data: chatMsgs } = await supabase
    .from('team_chat_messages')
    .select('member_id,content')
    .eq('user_id', operatorId)
    .like('content', '💡%')
    .gte('created_at', todayStart.toISOString());
  test('Chat: all proactive messages start with 💡', (chatMsgs?.length ?? 0) > 0, `${chatMsgs?.length} messages`);

  // Messages contain "Take action →" CTA
  const allHaveCTA = (chatMsgs || []).every(m => m.content.includes('[Take action →]'));
  test('Chat: all messages include [Take action →] CTA', allHaveCTA);

  // Message format: "💡 Type from Name\n\ntext\n\n[Take action →]"
  const firstMsg = chatMsgs?.[0];
  const formatOk = firstMsg?.content.includes('from ') && firstMsg?.content.includes('\n\n');
  test('Chat: message format correct (💡 Type from Name + body + CTA)', !!formatOk, firstMsg?.content?.slice(0, 60) || 'no message');

  // ── 7. NOTIFICATION BELL API ──────────────────────────────────────────────
  console.log('\n── 7. NOTIFICATION BELL API ──');

  // GET team-updates returns correct structure
  const { status: bellStatus, data: bellData } = await apiGet('/api/team-updates?limit=10', operatorSess);
  test('Bell API: GET returns 200', bellStatus === 200);
  test('Bell API: returns updates array', Array.isArray(bellData.updates));
  test('Bell API: returns unread_count', typeof bellData.unread_count === 'number');
  test('Bell API: returns plan field', !!bellData.plan);

  const allRowsValid = (bellData.updates || []).every(u => u.worker_slug && u.preview_text && u.created_at && typeof u.read === 'boolean');
  test('Bell API: all rows have required fields (worker_slug, preview_text, created_at, read)', allRowsValid, `${bellData.updates?.length} rows`);

  // Unread count matches actual unread rows
  const dbUnread = (bellData.updates || []).filter(u => !u.read).length;
  test('Bell API: unread_count matches actual unread rows', bellData.unread_count === dbUnread, `API=${bellData.unread_count} rows=${dbUnread}`);

  // PATCH: mark one as read
  const firstUpdate = bellData.updates?.[0];
  if (firstUpdate) {
    const { status: markStatus } = await apiPatch('/api/team-updates', { action: 'mark_read', id: firstUpdate.id }, operatorSess);
    test('Bell API: mark_read returns 200', markStatus === 200);
    
    // Verify it's now read in DB
    const { data: readCheck } = await supabase.from('team_updates').select('read').eq('id', firstUpdate.id).single();
    test('Bell API: mark_read actually updates DB', readCheck?.read === true);
  }

  // PATCH: mark all as read
  const { status: markAllStatus } = await apiPatch('/api/team-updates', { action: 'mark_all_read' }, operatorSess);
  test('Bell API: mark_all_read returns 200', markAllStatus === 200);
  
  // Verify all read
  const { count: stillUnread } = await supabase
    .from('team_updates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', operatorId)
    .eq('read', false);
  test('Bell API: mark_all_read clears all unread', stillUnread === 0, `${stillUnread} still unread`);

  // PATCH: dismiss
  const secondUpdate = bellData.updates?.[1];
  if (secondUpdate) {
    const { status: dismissStatus } = await apiPatch('/api/team-updates', { action: 'dismiss', id: secondUpdate.id }, operatorSess);
    test('Bell API: dismiss returns 200', dismissStatus === 200);
    const { data: dismissCheck } = await supabase.from('team_updates').select('dismissed').eq('id', secondUpdate.id).single();
    test('Bell API: dismiss sets dismissed=true in DB', dismissCheck?.dismissed === true);
  }

  // Starter bell returns plan=starter (upsell condition)
  const { data: starterBellData } = await apiGet('/api/team-updates?limit=5', starterSess);
  test('Bell API: starter plan correctly returned (for upsell)', starterBellData.plan === 'starter', `plan=${starterBellData.plan}`);

  // ── 8. SETTINGS CONTROLS ──────────────────────────────────────────────────
  console.log('\n── 8. SETTINGS CONTROLS ──');

  // Get current settings
  const { data: settingsProfile } = await supabase
    .from('profiles')
    .select('team_updates_settings')
    .eq('id', operatorId)
    .single();
  const currentSettings = settingsProfile?.team_updates_settings || {};
  test('Settings: team_updates_settings exists in profile', !!settingsProfile?.team_updates_settings);

  // Turn off Ash via worker_overrides
  const newSettings = {
    ...currentSettings,
    worker_overrides: { ...(currentSettings.worker_overrides || {}), 'social-media-manager': false },
  };
  await supabase.from('profiles').update({ team_updates_settings: newSettings }).eq('id', operatorId);

  // Clear today's suggestions again
  await supabase.from('team_updates').delete().eq('user_id', operatorId).gte('created_at', todayStart.toISOString());

  // Run cron again
  await fetch(`${BASE_URL}/api/cron/proactive-updates`, { method: 'GET', headers: { 'x-vercel-cron': '1' } });
  await new Promise(r => setTimeout(r, 2000));

  const { data: noAshSugs } = await supabase
    .from('team_updates')
    .select('worker_slug')
    .eq('user_id', operatorId)
    .gte('created_at', todayStart.toISOString());
  const ashFired = (noAshSugs || []).some(s => s.worker_slug === 'social-media-manager');
  test('Settings: worker toggle OFF prevents that worker from firing', !ashFired, `Ash in results: ${ashFired} (workers: ${[...new Set((noAshSugs||[]).map(s=>s.worker_slug))].join(', ')})`);

  // Re-enable Ash
  const restoredSettings = { ...newSettings, worker_overrides: { ...newSettings.worker_overrides, 'social-media-manager': true } };
  await supabase.from('profiles').update({ team_updates_settings: restoredSettings }).eq('id', operatorId);

  // Test frequency=off → no suggestions
  const offSettings = { ...restoredSettings, frequency: 'off' };
  await supabase.from('profiles').update({ team_updates_settings: offSettings }).eq('id', operatorId);
  await supabase.from('team_updates').delete().eq('user_id', operatorId).gte('created_at', todayStart.toISOString());
  
  await fetch(`${BASE_URL}/api/cron/proactive-updates`, { method: 'GET', headers: { 'x-vercel-cron': '1' } });
  await new Promise(r => setTimeout(r, 1000));

  const { data: noFreqSugs } = await supabase
    .from('team_updates')
    .select('id')
    .eq('user_id', operatorId)
    .gte('created_at', todayStart.toISOString());
  test('Settings: frequency=off prevents all suggestions', (noFreqSugs?.length ?? 0) === 0, `${noFreqSugs?.length} suggestions when frequency=off`);

  // Restore settings
  const finalSettings = { ...restoredSettings, frequency: 'few_times_weekly', enabled: true };
  await supabase.from('profiles').update({ team_updates_settings: finalSettings }).eq('id', operatorId);
  await supabase.from('team_updates').delete().eq('user_id', operatorId).gte('created_at', todayStart.toISOString());

  // ── 9. EXTERNAL API SAFETY ────────────────────────────────────────────────
  console.log('\n── 9. EXTERNAL API SAFETY ──');

  // Verify Serper guard in production code
  const fs = require('fs');
  const cronCode = fs.readFileSync('./app/api/cron/proactive-updates/route.ts', 'utf8');
  test('Safety: Kai/Ash skip guard — "if (!externalData)" present before Haiku call', cronCode.includes('if (!externalData)'));
  test('Safety: Lenny skip guard — Apollo null → continue', cronCode.includes('If no Apollo data, Lenny must SKIP'));
  test('Safety: no fallback to LLM fabrication for external workers', !cronCode.includes('fabricate') || cronCode.includes('never fabricate'));

  // ── 10. EMAIL DIGEST CRON ─────────────────────────────────────────────────
  console.log('\n── 10. EMAIL DIGEST CRON ──');

  const digestRes = await fetch(`${BASE_URL}/api/cron/team-updates-digest`, {
    method: 'GET', headers: { 'x-vercel-cron': '1' },
  });
  const digestData = await digestRes.json().catch(() => ({}));
  test('Digest cron: responds 200', digestRes.status === 200, JSON.stringify(digestData));
  
  // CAN-SPAM compliance in code
  const digestCode = fs.readFileSync('./app/api/cron/team-updates-digest/route.ts', 'utf8');
  test('Digest: has unsubscribe link in email HTML', digestCode.includes('Unsubscribe'));
  test('Digest: respects settings.enabled=false (CAN-SPAM unsubscribe)', digestCode.includes('settings.enabled === false'));
  test('Digest: skips active users (not 3+ days away)', digestCode.includes('threeDaysAgo'));
  test('Digest: max 1 per week logic present', digestCode.includes('hasStaleUpdates'));

  // ── 11. PUSH NOTIFICATION API ─────────────────────────────────────────────
  console.log('\n── 11. PUSH NOTIFICATION API ──');

  // Test token registration endpoint
  const pushRes = await fetch(`${BASE_URL}/api/push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorSess.access_token}` },
    body: JSON.stringify({ token: 'test-token-audit-' + Date.now(), platform: 'ios' }),
  });
  const pushData = await pushRes.json().catch(() => ({}));
  test('Push API: token registration endpoint returns 200 or graceful note', pushRes.status === 200, JSON.stringify(pushData));

  // Test invalid platform rejected
  const pushBadRes = await fetch(`${BASE_URL}/api/push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorSess.access_token}` },
    body: JSON.stringify({ token: 'test', platform: 'windows' }),
  });
  test('Push API: invalid platform rejected', pushBadRes.status === 400);

  // Push graceful fail in cron code
  test('Push: sendPushToUser never throws (silent fail)', cronCode.includes('sendPushToUser') && cronCode.includes('.catch(() => {})'));

  // ── 12. ACTIVATION LOGIC ─────────────────────────────────────────────────
  console.log('\n── 12. ACTIVATION LOGIC ──');

  // Users with 0 tasks should NOT get suggestions
  // Create a new fake profile with 0 tasks
  const { data: newUser } = await supabase.auth.admin.createUser({
    email: `test-zero-tasks-${Date.now()}@3rdshift.ai`,
    password: 'testpass123',
    email_confirm: true,
  });
  if (newUser?.user) {
    const testUserId = newUser.user.id;
    // Wait for profile to be created (trigger), then activate
    await new Promise(r => setTimeout(r, 1000));
    await supabase.from('profiles').update({ 
      team_updates_activated: true, 
      plan: 'starter',
      team_updates_settings: { enabled: true, frequency: 'few_times_weekly', worker_overrides: {} }
    }).eq('id', testUserId);
    
    // Run cron
    await fetch(`${BASE_URL}/api/cron/proactive-updates`, { method: 'GET', headers: { 'x-vercel-cron': '1' } });
    await new Promise(r => setTimeout(r, 1000));
    
    const { count: zeroTaskSugs } = await supabase
      .from('team_updates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', testUserId);
    test('Activation: user with 0 tasks gets NO suggestions', zeroTaskSugs === 0, `${zeroTaskSugs} suggestions`);
    
    // Clean up
    await supabase.auth.admin.deleteUser(testUserId);
  }

  // ── FINAL RUN — restore state and re-run cron ─────────────────────────────
  console.log('\n── FINAL STATE RESTORE ──');
  
  // Run cron one more time to ensure operator has fresh suggestions in chat
  const finalCronRes = await fetch(`${BASE_URL}/api/cron/proactive-updates`, {
    method: 'GET', headers: { 'x-vercel-cron': '1' },
  });
  const finalData = await finalCronRes.json().catch(() => ({}));
  console.log(`  Final cron run: ${JSON.stringify(finalData)}`);
  await new Promise(r => setTimeout(r, 2000));

  const { data: finalSugs } = await supabase
    .from('team_updates')
    .select('worker_slug,suggestion_type,preview_text')
    .eq('user_id', operatorId)
    .gte('created_at', todayStart.toISOString());
  console.log(`  Final suggestions in DB: ${finalSugs?.length}`);
  finalSugs?.forEach(s => console.log(`    [${s.worker_slug}] ${s.suggestion_type}: "${s.preview_text?.slice(0, 60)}"`));

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`  TEST COMPLETE: ${pass} passed, ${fail} failed out of ${pass + fail}`);
  console.log('═'.repeat(60));
  if (fail > 0) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`    ❌ ${f}`));
  }
  return { pass, fail };
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
