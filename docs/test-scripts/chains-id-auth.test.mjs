/**
 * Phase 2 Step 3i — R9: /api/agent-mode/chains/[id] (GET+PUT+DELETE) + pause + resume
 *
 * All 5 handlers owner-only. Role check fires before getOperatorChain / plan check.
 *
 * T1: Owner GET → past role gate (plan error or 404, not role error)
 * T2: Member GET → 403 "requires owner access"
 * T3: Owner PUT → past role gate
 * T4: Member PUT → 403 "requires owner access"
 * T5: Owner DELETE → past role gate
 * T6: Member DELETE → 403 "requires owner access"
 * T7: Owner POST pause → past role gate
 * T8: Member POST pause → 403 "requires owner access"
 * T9: Owner POST resume → past role gate
 * T10: Member POST resume → 403 "requires owner access"
 * T11: No auth GET → 401
 * T12: auth_denials row from T2 verified
 */

const TARGET = process.env.TARGET || 'prod';
const API_BASE = 'https://3rdshift.ai';

const SUPABASE_URLS = {
  branch: process.env.BRANCH_SUPABASE_URL || 'https://nwouqhjndtouyizixvtn.supabase.co',
  prod: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.PROD_SUPABASE_URL || 'https://ytqflszzzkkriqhyrroy.supabase.co',
};
const ANON_KEYS = {
  branch: process.env.BRANCH_SUPABASE_ANON_KEY,
  prod: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.PROD_ANON_KEY,
};
const SVC_KEYS = {
  branch: process.env.BRANCH_SUPABASE_SERVICE_ROLE_KEY || process.env.BRANCH_SUPABASE_SECRET_KEY,
  prod: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY,
};

const SUPABASE_URL = SUPABASE_URLS[TARGET];
const ANON_KEY = ANON_KEYS[TARGET];
const SVC_KEY = SVC_KEYS[TARGET];
if (!ANON_KEY) throw new Error(`Missing Supabase anon key env for ${TARGET}`);
if (!SVC_KEY) throw new Error(`Missing Supabase service-role key env for ${TARGET}`);

const ACCOUNTS = {
  prod: {
    owner:  { email: 'test-roger@3rdshift.ai',  pass: '<SCREENSHOT_TEST_PASSWORD>' },
    member: { email: 'test-member@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
  },
};
const accts = ACCOUNTS[TARGET] || ACCOUNTS.prod;

const FAKE_ID = '00000000-0000-0000-0000-000000000001';
const BASE = API_BASE + '/api/agent-mode/chains/' + FAKE_ID;

const results = [];
let passed = 0;
let failed = 0;

function assert(name, ok, detail) {
  if (ok) { results.push('  PASS: ' + name); passed++; }
  else { results.push('  FAIL: ' + name + (detail ? ' -- ' + detail : '')); failed++; }
}

async function signIn(email, pass) {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password: pass }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Auth failed: ' + email);
  return d.access_token;
}

async function call(method, token, url, body) {
  url = url || BASE;
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, body: data };
}

function isRoleError(res) {
  return res.status === 403 && res.body && res.body.error && res.body.error.includes('owner access');
}

function pastRoleGate(res) {
  // Passed role gate = not a role error and not 401
  return !isRoleError(res) && res.status !== 401;
}

async function run() {
  console.log('=== R9 /api/agent-mode/chains/[id] + pause + resume Auth Tests [' + TARGET + '] ===\n');

  const tokenOwner  = await signIn(accts.owner.email,  accts.owner.pass);
  const tokenMember = await signIn(accts.member.email, accts.member.pass);
  console.log('Auth: owner, member signed in OK\n');

  // GET
  const t1 = await call('GET', tokenOwner);
  assert('T1: Owner GET → past role gate', pastRoleGate(t1), 'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0,80));

  const t2 = await call('GET', tokenMember);
  assert('T2: Member GET → 403 role error', isRoleError(t2), 'status=' + t2.status + ' body=' + JSON.stringify(t2.body));

  // PUT
  const t3 = await call('PUT', tokenOwner, BASE, { name: 'Test' });
  assert('T3: Owner PUT → past role gate', pastRoleGate(t3), 'status=' + t3.status + ' body=' + JSON.stringify(t3.body).slice(0,80));

  const t4 = await call('PUT', tokenMember, BASE, { name: 'Test' });
  assert('T4: Member PUT → 403 role error', isRoleError(t4), 'status=' + t4.status + ' body=' + JSON.stringify(t4.body));

  // DELETE
  const t5 = await call('DELETE', tokenOwner);
  assert('T5: Owner DELETE → past role gate', pastRoleGate(t5), 'status=' + t5.status + ' body=' + JSON.stringify(t5.body).slice(0,80));

  const t6 = await call('DELETE', tokenMember);
  assert('T6: Member DELETE → 403 role error', isRoleError(t6), 'status=' + t6.status + ' body=' + JSON.stringify(t6.body));

  // PAUSE
  const pauseUrl = BASE + '/pause';
  const t7 = await call('POST', tokenOwner, pauseUrl);
  assert('T7: Owner POST pause → past role gate', pastRoleGate(t7), 'status=' + t7.status + ' body=' + JSON.stringify(t7.body).slice(0,80));

  const t8 = await call('POST', tokenMember, pauseUrl);
  assert('T8: Member POST pause → 403 role error', isRoleError(t8), 'status=' + t8.status + ' body=' + JSON.stringify(t8.body));

  // RESUME
  const resumeUrl = BASE + '/resume';
  const t9 = await call('POST', tokenOwner, resumeUrl);
  assert('T9: Owner POST resume → past role gate', pastRoleGate(t9), 'status=' + t9.status + ' body=' + JSON.stringify(t9.body).slice(0,80));

  const t10 = await call('POST', tokenMember, resumeUrl);
  assert('T10: Member POST resume → 403 role error', isRoleError(t10), 'status=' + t10.status + ' body=' + JSON.stringify(t10.body));

  // No auth
  const t11 = await call('GET', null);
  assert('T11: No auth GET → 401', t11.status === 401, 'status=' + t11.status);

  // auth_denials from T2
  await new Promise(r => setTimeout(r, 1000));
  const uidRes = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember } });
  const uidMember = (await uidRes.json()).id;
  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*chains*' + FAKE_ID + '*&required_role=eq.owner&select=user_id,workspace_id,route,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denials = await denialRes.json();
  const denial = Array.isArray(denials) ? denials[0] : null;
  assert(
    'T12: auth_denials row from T2 has correct fields',
    denial && denial.user_id === uidMember && denial.required_role === 'owner' && denial.actual_role === 'member',
    denial ? JSON.stringify(denial) : 'no row found'
  );

  if (denial) {
    console.log('\n  Sample auth_denials row (T12):');
    console.log('  ' + JSON.stringify(denial, null, 2).split('\n').join('\n  '));
  }

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
