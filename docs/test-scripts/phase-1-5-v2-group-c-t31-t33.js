// Phase 1.5 v2 Group C adversarial tests (T31 + T33a-i)
// Parameterized: TARGET=branch (default) or TARGET=prod
const TARGET = process.env.TARGET || 'branch';

const CONFIGS = {
  branch: {
    url: process.env.BRANCH_SUPABASE_URL || 'https://nwouqhjndtouyizixvtn.supabase.co',
    anonKey: process.env.BRANCH_SUPABASE_ANON_KEY,
    svcKey: process.env.BRANCH_SUPABASE_SERVICE_ROLE_KEY || process.env.BRANCH_SUPABASE_SECRET_KEY,
    users: {
      A: { email: 'user-a@3rdshift-test.dev', pass: 'TestPass123!' },
      B: { email: 'user-b@3rdshift-test.dev', pass: 'TestPass123!' },
      C: { email: 'user-c@3rdshift-test.dev', pass: 'TestPass123!' },
    },
    WA: 'aaaaaaaa-0000-0000-0000-000000000001',
  },
  prod: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.PROD_SUPABASE_URL || 'https://ytqflszzzkkriqhyrroy.supabase.co',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.PROD_ANON_KEY,
    svcKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY,
    users: {
      A: { email: 'test-roger@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },      // owner of WA
      B: { email: 'test-member@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },     // member of WA
      C: { email: 'test-operator-c@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' }, // owner of WC
    },
    WA: '908596ba-f86a-4ca6-b8e6-a6e70101d081', // test-roger workspace
  }
};

const cfg = CONFIGS[TARGET];
const BASE_URL = cfg.url;
const ANON_KEY = cfg.anonKey;
const SVC_KEY = cfg.svcKey;
let WA = cfg.WA;

const results = [];
let passed = 0;
let failed = 0;

function assert(name, ok, detail) {
  if (ok) { results.push('  PASS: ' + name); passed++; }
  else { results.push('  FAIL: ' + name + (detail ? ' -- ' + detail : '')); failed++; }
}

// Blocked = 403/401 OR 0 rows OR pg error 42501
function isBlocked(res) {
  if (res.status === 403 || res.status === 401) return true;
  if (Array.isArray(res.data) && res.data.length === 0) return true;
  if (res.data && res.data.code === '42501') return true;
  return false;
}

async function signIn(email, pass) {
  const r = await fetch(BASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password: pass })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Auth failed: ' + email);
  return d.access_token;
}

async function getUserId(token) {
  const r = await fetch(BASE_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token } });
  const d = await r.json();
  return d.id;
}

async function rest(token, method, table, params, body, isService) {
  params = params || '';
  const key = isService ? SVC_KEY : ANON_KEY;
  const auth = isService ? ('Bearer ' + SVC_KEY) : ('Bearer ' + token);
  const headers = { apikey: key, Authorization: auth, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE_URL + '/rest/v1/' + table + params, opts);
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, data };
}

async function run() {
  console.log('=== Phase 1.5 v2 Group C Tests (T31 + T33a-i) [' + TARGET + '] ===\n');

  const tokenA = await signIn(cfg.users.A.email, cfg.users.A.pass);
  const tokenB = await signIn(cfg.users.B.email, cfg.users.B.pass);
  const tokenC = await signIn(cfg.users.C.email, cfg.users.C.pass);
  const uidA = await getUserId(tokenA);
  const uidB = await getUserId(tokenB);
  const uidC = await getUserId(tokenC);
  console.log('Auth OK: A=' + uidA.slice(0,8) + ' B=' + uidB.slice(0,8));


  // ── Seed data ──
  // agent_mode_notifications for User A (correct schema: type, title, message, read)
  await rest(null, 'POST', 'agent_mode_notifications', '', {
    user_id: uidA, type: 'info', title: 'Test Notification', message: 'Seeded for test', read: false
  }, true);
  // team_updates for WA (workspace-scoped)
  await rest(null, 'POST', 'team_updates', '', {
    workspace_id: WA, user_id: uidA, worker_slug: 'hook-specialist',
    suggestion_type: 'idea', suggestion_text: 'Test suggestion', preview_text: 'Test', read: false, dismissed: false
  }, true);
  // worker_memory for User A
  await rest(null, 'POST', 'worker_memory', '', {
    user_id: uidA, worker_slug: 'hook-specialist', memory_type: 'preferences', content: 'User A prefers concise output'
  }, true);
  console.log('Seed data inserted\n');

  // ── T31: SELECT policy verification ──
  console.log('T31: SELECT policy reads');
  const t31a = await rest(tokenA, 'GET', 'agent_mode_notifications', '?user_id=eq.' + uidA + '&select=message');
  assert('T31a: User A reads own agent_mode_notifications', Array.isArray(t31a.data) && t31a.data.length > 0);
  const t31b = await rest(tokenC, 'GET', 'agent_mode_notifications', '?user_id=eq.' + uidA + '&select=message');
  assert('T31b: User C cannot read User A notifications', Array.isArray(t31b.data) && t31b.data.length === 0);
  const t31c = await rest(tokenA, 'GET', 'team_updates', '?workspace_id=eq.' + WA + '&select=suggestion_text');
  assert('T31c: User A reads WA team_updates', Array.isArray(t31c.data) && t31c.data.length > 0);
  const t31d = await rest(tokenB, 'GET', 'team_updates', '?workspace_id=eq.' + WA + '&select=suggestion_text');
  assert('T31d: User B (member WA) reads WA team_updates', Array.isArray(t31d.data) && t31d.data.length > 0);
  const t31e = await rest(tokenC, 'GET', 'team_updates', '?workspace_id=eq.' + WA + '&select=suggestion_text');
  assert('T31e: User C cannot read WA team_updates', Array.isArray(t31e.data) && t31e.data.length === 0);
  const t31f = await rest(tokenA, 'GET', 'worker_memory', '?user_id=eq.' + uidA + '&select=content');
  assert('T31f: User A reads own worker_memory', Array.isArray(t31f.data) && t31f.data.length > 0);
  const t31g = await rest(tokenC, 'GET', 'worker_memory', '?user_id=eq.' + uidA + '&select=content');
  assert('T31g: User C cannot read User A worker_memory', Array.isArray(t31g.data) && t31g.data.length === 0);
  const t31h = await rest(tokenA, 'GET', 'chat_conversation_summaries', '?select=id&limit=1');
  assert('T31h: chat_conversation_summaries inaccessible', isBlocked(t31h));
  console.log('');

  // ── T33: Write-restriction tests ──
  console.log('T33: Write-restriction tests (correct schema)');

  // T33a: UPDATE chat_rate_limits — correct column is msg_count
  const t33a = await rest(tokenA, 'PATCH', 'chat_rate_limits', '?user_id=eq.' + uidA, { msg_count: 0 });
  assert('T33a: chat_rate_limits UPDATE blocked (0 rows = RLS)', Array.isArray(t33a.data) && t33a.data.length === 0 || isBlocked(t33a));

  // T33b: INSERT chat_rate_limits — correct schema: user_id, member_id, window_type, msg_count
  const t33b = await rest(tokenA, 'POST', 'chat_rate_limits', '', {
    user_id: uidA, member_id: 'hook-specialist', window_type: 'hourly', msg_count: 0
  });
  assert('T33b: chat_rate_limits INSERT blocked', isBlocked(t33b));

  // T33c: UPDATE worker_memory
  const t33c = await rest(tokenA, 'PATCH', 'worker_memory', '?user_id=eq.' + uidA, { content: 'injected' });
  assert('T33c: worker_memory UPDATE blocked', isBlocked(t33c));

  // T33d: UPDATE credit_alert_state — correct column: credit_type
  const t33d = await rest(tokenA, 'PATCH', 'credit_alert_state', '?user_id=eq.' + uidA, { credit_type: 'light' });
  assert('T33d: credit_alert_state UPDATE blocked (0 rows = RLS)', Array.isArray(t33d.data) && t33d.data.length === 0 || isBlocked(t33d));

  // T33e: UPDATE scheduled_tasks
  const t33e = await rest(tokenA, 'PATCH', 'scheduled_tasks', '?user_id=eq.' + uidA, { next_run_at: new Date(0).toISOString() });
  assert('T33e: scheduled_tasks UPDATE blocked', isBlocked(t33e));

  // T33f: UPDATE google_workspace_settings
  const t33f = await rest(tokenA, 'PATCH', 'google_workspace_settings', '?user_id=eq.' + uidA, { user_id: uidA });
  assert('T33f: google_workspace_settings UPDATE blocked', isBlocked(t33f));

  // T33g: UPDATE custom_playbooks
  const t33g = await rest(tokenA, 'PATCH', 'custom_playbooks', '?user_id=eq.' + uidA, { user_id: uidA });
  assert('T33g: custom_playbooks UPDATE blocked', isBlocked(t33g));

  // T33h: UPDATE agent_mode_notifications — Option A: no UPDATE policy
  const t33h = await rest(tokenA, 'PATCH', 'agent_mode_notifications', '?user_id=eq.' + uidA, { read: true });
  assert('T33h: agent_mode_notifications UPDATE blocked (Option A)', isBlocked(t33h));

  // T33i: UPDATE team_updates — Option A: no UPDATE policy
  const t33i = await rest(tokenA, 'PATCH', 'team_updates', '?user_id=eq.' + uidA, { read: true });
  assert('T33i: team_updates UPDATE blocked (Option A)', isBlocked(t33i));

  console.log('');
  console.log('=== Results [' + TARGET + '] ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
