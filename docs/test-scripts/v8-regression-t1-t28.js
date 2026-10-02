// v8 Full Regression Suite T1-T28
// Parameterized: set BASE_URL, ANON_KEY, SVC_KEY for branch or prod
// Branch: https://nwouqhjndtouyizixvtn.supabase.co
// Prod:   https://ytqflszzzkkriqhyrroy.supabase.co

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
      D: { email: 'user-d@3rdshift-test.dev', pass: 'TestPass123!' },
    },
    WA: 'aaaaaaaa-0000-0000-0000-000000000001',
    WB: 'bbbbbbbb-0000-0000-0000-000000000001',
  },
  prod: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.PROD_SUPABASE_URL || 'https://ytqflszzzkkriqhyrroy.supabase.co',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.PROD_ANON_KEY,
    svcKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY,
    users: {
      A: { email: 'test-roger@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
      B: { email: 'test-member@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },          // member of WA
      C: { email: 'test-operator-c@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },      // owner of WC only
      D: { email: 'test-starter@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
    },
    WA: '908596ba-f86a-4ca6-b8e6-a6e70101d081',
    WB: 'cccccccc-c0c0-c0c0-c0c0-c0c0c0c0c001',
  }
};

const cfg = CONFIGS[TARGET];
const BASE_URL = cfg.url;
const ANON_KEY = cfg.anonKey;
const SVC_KEY = cfg.svcKey;
let WA = cfg.WA;
let WB = cfg.WB;

const results = [];
let passed = 0;
let failed = 0;

function assert(name, ok, detail) {
  if (ok) { results.push('  PASS: ' + name); passed++; }
  else { results.push('  FAIL: ' + name + (detail ? ' -- ' + detail : '')); failed++; }
}

async function signIn(email, pass) {
  const r = await fetch(BASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password: pass })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Auth failed: ' + email + ' -- ' + JSON.stringify(d));
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

// RLS-block check: 403/401 OR 0 rows OR pg error code 42501
function isBlocked(res) {
  if (res.status === 403 || res.status === 401) return true;
  if (Array.isArray(res.data) && res.data.length === 0) return true;
  if (res.data && res.data.code === '42501') return true;
  return false;
}

async function run() {
  console.log('=== v8 Regression Suite T1-T28 [' + TARGET + '] ===\n');

  const tokenA = await signIn(cfg.users.A.email, cfg.users.A.pass);
  const tokenB = await signIn(cfg.users.B.email, cfg.users.B.pass);
  const tokenC = await signIn(cfg.users.C.email, cfg.users.C.pass);
  const tokenD = await signIn(cfg.users.D.email, cfg.users.D.pass);
  const uidA = await getUserId(tokenA);
  const uidB = await getUserId(tokenB);
  const uidC = await getUserId(tokenC);
  const uidD = await getUserId(tokenD);
  console.log('Auth OK: A=' + uidA.slice(0,8) + ' B=' + uidB.slice(0,8) + ' C=' + uidC.slice(0,8) + ' D=' + uidD.slice(0,8) + '\n');








  // ── T1-T5: tasks (C2) ──
  console.log('T1-T5: tasks');
  const taskIns = await rest(null, 'POST', 'tasks', '', {
    user_id: uidA, workspace_id: WA, worker_slug: 'hook-specialist',
    task_type: 'light', category: 'Content Writing', status: 'completed', input: {}, output: 'regression test'
  }, true);
  const taskAId = Array.isArray(taskIns.data) && taskIns.data[0] ? taskIns.data[0].id : null;

  const t1 = await rest(tokenA, 'GET', 'tasks', '?id=eq.' + taskAId + '&select=id');
  assert('T1: User A reads own task', Array.isArray(t1.data) && t1.data.length > 0);
  const t2 = await rest(tokenC, 'GET', 'tasks', '?id=eq.' + taskAId + '&select=id');
  assert('T2: User C cannot read User A task', Array.isArray(t2.data) && t2.data.length === 0);
  const t3 = await rest(tokenC, 'POST', 'tasks', '', { user_id: uidA, workspace_id: WA, worker_slug: 'test', task_type: 'light', status: 'completed' });
  assert('T3: Anon INSERT tasks blocked', isBlocked(t3));
  const t4 = await rest(tokenC, 'PATCH', 'tasks', '?id=eq.' + taskAId, { status: 'pending' });
  assert('T4: Anon UPDATE tasks blocked', isBlocked(t4));
  const t5 = await rest(tokenC, 'DELETE', 'tasks', '?id=eq.' + taskAId);
  assert('T5: Anon DELETE tasks blocked', isBlocked(t5));
  console.log('');

  // ── T6-T9: workspaces + workspace_members (C3/C4) ──
  console.log('T6-T9: workspaces + workspace_members');
  const t6 = await rest(tokenA, 'GET', 'workspaces', '?id=eq.' + WA + '&select=id');
  assert('T6: User A reads own workspace', Array.isArray(t6.data) && t6.data.length > 0);
  const t7 = await rest(tokenC, 'GET', 'workspaces', '?id=eq.' + WA + '&select=id');
  assert('T7: User C cannot read WA', Array.isArray(t7.data) && t7.data.length === 0);
  const t8 = await rest(tokenD, 'POST', 'workspaces', '', { name: 'Hack', plan: 'operator' });
  assert('T8: Anon INSERT workspaces blocked', isBlocked(t8));
  const t9 = await rest(tokenB, 'GET', 'workspace_members', '?workspace_id=eq.' + WA + '&select=user_id');
  assert('T9: User B (member WA) reads workspace_members', Array.isArray(t9.data) && t9.data.length > 0);
  console.log('');

  // ── T10: profiles (C10) ──
  console.log('T10-T15: profiles + support_requests');
  const t10a = await rest(tokenD, 'PATCH', 'profiles', '?id=eq.' + uidA, { plan: 'operator', heavy_credits_remaining: 9999 });
  assert('T10a: Anon cannot escalate plan', isBlocked(t10a));
  const t10b = await rest(tokenD, 'GET', 'profiles', '?id=eq.' + uidA + '&select=plan,stripe_customer_id');
  assert('T10b: Anon cannot read other user billing', Array.isArray(t10b.data) && t10b.data.length === 0);
  const t10c = await rest(null, 'PATCH', 'profiles', '?id=eq.' + uidA, { plan: 'pro' }, true);
  assert('T10c: Service role can write profiles', t10c.status === 200 || t10c.status === 204 || Array.isArray(t10c.data));
  const t10d = await rest(tokenD, 'PATCH', 'profiles', '?id=eq.' + uidD, { plan: 'operator' });
  assert('T10d: User cannot self-escalate plan', isBlocked(t10d));
  const t10e = await rest(tokenD, 'PATCH', 'profiles', '?id=eq.' + uidD, { heavy_credits_remaining: 10000 });
  assert('T10e: User cannot self-grant credits', isBlocked(t10e));
  const t10f = await rest(tokenD, 'PATCH', 'profiles', '?id=eq.' + uidD, { stripe_customer_id: 'cus_hacked' });
  assert('T10f: User cannot set stripe_customer_id', isBlocked(t10f));
  const t10g = await rest(tokenD, 'PATCH', 'profiles', '?id=eq.' + uidA, { plan: 'operator' });
  assert('T10g: Cross-user profile UPDATE blocked', isBlocked(t10g));
  console.log('');

  // ── T11-T15: workspace_invites (C5) + support_requests (C6) ──
  console.log('T11-T15: workspace_invites + support_requests');
  // Seed invite via service role with correct columns (no 'role' column in schema)
  await rest(null, 'POST', 'workspace_invites', '', {
    workspace_id: WA, invited_by: uidA,
    email: 'regtest-' + Date.now() + '@example.com',
    token: '00000000-0000-0000-0000-' + Date.now().toString().slice(-12).padStart(12, '0'),
    accepted: false
  }, true);

  const t11 = await rest(tokenA, 'GET', 'workspace_invites', '?workspace_id=eq.' + WA + '&select=id');
  assert('T11: WA owner reads workspace_invites', Array.isArray(t11.data) && t11.data.length > 0);
  const t12 = await rest(tokenC, 'GET', 'workspace_invites', '?workspace_id=eq.' + WA + '&select=id');
  assert('T12: User C cannot read WA invites', Array.isArray(t12.data) && t12.data.length === 0);
  // T13: INSERT with correct schema — RLS blocks with 42501
  const t13 = await rest(tokenC, 'POST', 'workspace_invites', '', {
    workspace_id: WA, invited_by: uidC,
    email: 'hack@example.com',
    token: '00000000-0000-0000-0000-aabbccddeeff',
    accepted: false
  });
  assert('T13: Anon INSERT workspace_invites blocked', isBlocked(t13));
  const t14 = await rest(tokenD, 'POST', 'support_requests', '', { user_id: uidA, subject: 'Hack', message: 'Test' });
  assert('T14: Anon INSERT support_requests blocked', isBlocked(t14));
  const t15 = await rest(null, 'GET', 'support_requests', '?select=id&limit=1', null, true);
  assert('T15: Service role reads support_requests', t15.status === 200 || Array.isArray(t15.data));
  console.log('');

  // ── T16-T20: agent_mode_presets (C7) + agent_mode_settings (C11) ──
  console.log('T16-T20: agent_mode_presets + agent_mode_settings');
  const t16 = await rest(tokenD, 'GET', 'agent_mode_presets', '?select=id&limit=1');
  assert('T16: Anon cannot read agent_mode_presets', isBlocked(t16));
  // T17: INSERT with correct schema (no user_id column)
  const t17 = await rest(tokenD, 'POST', 'agent_mode_presets', '', { name: 'Hack', description: 'injected', category: 'test' });
  assert('T17: Anon INSERT agent_mode_presets blocked', isBlocked(t17));
  const t18 = await rest(tokenA, 'GET', 'agent_mode_settings', '?user_id=eq.' + uidA + '&select=user_id');
  assert('T18: User A reads own agent_mode_settings', Array.isArray(t18.data) && t18.data.length > 0);
  const t19 = await rest(tokenC, 'GET', 'agent_mode_settings', '?user_id=eq.' + uidA + '&select=user_id');
  assert('T19: User C cannot read User A agent_mode_settings', Array.isArray(t19.data) && t19.data.length === 0);
  const t20 = await rest(tokenC, 'PATCH', 'agent_mode_settings', '?user_id=eq.' + uidA, { email_on_complete: false });
  assert('T20: Anon UPDATE agent_mode_settings blocked', isBlocked(t20));
  console.log('');

  // ── T21-T24: brand_profile (C12a) ──
  console.log('T21-T24: brand_profile (C12a)');
  // Upsert via service role — handle dupe key gracefully
  const bpIns = await rest(null, 'POST', 'brand_profile', '', { workspace_id: WA, user_id: uidA, company_name: 'Regression Corp' }, true);
  // Dupe key is OK — row exists from prior run
  const t21 = await rest(tokenA, 'GET', 'brand_profile', '?workspace_id=eq.' + WA + '&select=company_name');
  assert('T21: User A reads WA brand_profile', Array.isArray(t21.data) && t21.data.length > 0);
  const t22 = await rest(tokenB, 'GET', 'brand_profile', '?workspace_id=eq.' + WA + '&select=company_name');
  assert('T22: User B (member WA) reads brand_profile', Array.isArray(t22.data) && t22.data.length > 0);
  const t23 = await rest(tokenC, 'GET', 'brand_profile', '?workspace_id=eq.' + WA + '&select=company_name');
  assert('T23: User C cannot read WA brand_profile', Array.isArray(t23.data) && t23.data.length === 0);
  const t24 = await rest(tokenC, 'PATCH', 'brand_profile', '?workspace_id=eq.' + WA, { company_name: 'Hacked' });
  // 200 with [] = 0 rows updated = RLS blocking writes (SELECT-only policy) = PASS
  assert('T24: Anon PATCH WA brand_profile blocked', t24.status === 403 || t24.status === 401 || (Array.isArray(t24.data) && t24.data.length === 0));
  console.log('');

  // ── T25-T28: ai_call_log (C8), system_config (C9) ──
  console.log('T25-T28: ai_call_log + system_config');
  const t25 = await rest(tokenD, 'GET', 'ai_call_log', '?select=id&limit=1');
  assert('T25: Anon cannot read ai_call_log', isBlocked(t25));
  // T26: INSERT with correct schema
  const t26 = await rest(tokenD, 'POST', 'ai_call_log', '', {
    user_id: uidD, call_type: 'llm', model_tier: 'standard', provider_used: 'anthropic', success: true
  });
  assert('T26: Anon cannot INSERT ai_call_log', isBlocked(t26));
  const t27 = await rest(tokenD, 'GET', 'system_config', '?select=key,value&limit=5');
  assert('T27: Anon cannot read system_config', isBlocked(t27));
  const t28 = await rest(tokenD, 'POST', 'system_config', '', { key: 'hacked', value: 'true' });
  assert('T28: Anon cannot INSERT system_config', isBlocked(t28));
  console.log('');

  // ── Summary ──
  console.log('=== Results [' + TARGET + '] ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed out of ' + (passed + failed));
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
