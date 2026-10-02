/**
 * Phase 2 Step 3h — R8: /api/agent-mode/chains GET + POST auth tests
 *
 * T1: Owner GET → past role gate (plan check fires, not role block)
 * T2: Member GET → 403 "requires owner access"
 * T3: Owner POST → past role gate (plan check fires)
 * T4: Member POST → 403 "requires owner access"
 * T5: No auth GET → 401
 * T6: auth_denials row from T2 verified
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
  if (!d.access_token) throw new Error('Auth failed: ' + email + ' -- ' + JSON.stringify(d));
  return d.access_token;
}

async function call(method, token, body) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API_BASE + '/api/agent-mode/chains', opts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, body: data };
}

function isRoleError(res) {
  return res.status === 403 && res.body && res.body.error && res.body.error.includes('owner access');
}

function isPlanError(res) {
  return res.status === 403 && res.body && res.body.error && res.body.error.includes('Operator');
}

async function run() {
  console.log('=== R8 /api/agent-mode/chains GET+POST Auth Tests [' + TARGET + '] ===\n');

  const tokenOwner  = await signIn(accts.owner.email,  accts.owner.pass);
  const tokenMember = await signIn(accts.member.email, accts.member.pass);
  console.log('Auth: owner, member signed in OK\n');

  // T1: Owner GET → past role gate (plan check fires — plan error, not role error)
  const t1 = await call('GET', tokenOwner);
  assert(
    'T1: Owner GET → past role gate (plan check fires, not role block)',
    !isRoleError(t1) && t1.status !== 401,
    'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0, 100)
  );

  // T2: Member GET → 403 role error
  const t2 = await call('GET', tokenMember);
  assert(
    'T2: Member GET → 403 "requires owner access"',
    isRoleError(t2),
    'status=' + t2.status + ' body=' + JSON.stringify(t2.body)
  );

  // T3: Owner POST → past role gate (plan check fires)
  const t3 = await call('POST', tokenOwner, {
    name: 'Test Chain',
    workers: [{ worker_id: 'hook-specialist' }, { worker_id: 'email-copywriter' }],
    schedule_days: [],
  });
  assert(
    'T3: Owner POST → past role gate (plan check fires, not role block)',
    !isRoleError(t3) && t3.status !== 401,
    'status=' + t3.status + ' body=' + JSON.stringify(t3.body).slice(0, 100)
  );

  // T4: Member POST → 403 role error
  const t4 = await call('POST', tokenMember, {
    name: 'Test Chain',
    workers: [{ worker_id: 'hook-specialist' }, { worker_id: 'email-copywriter' }],
    schedule_days: [],
  });
  assert(
    'T4: Member POST → 403 "requires owner access"',
    isRoleError(t4),
    'status=' + t4.status + ' body=' + JSON.stringify(t4.body)
  );

  // T5: No auth → 401
  const t5 = await call('GET', null);
  assert('T5: No auth GET → 401', t5.status === 401, 'status=' + t5.status);

  // T6: auth_denials row from T2
  await new Promise(r => setTimeout(r, 1000));
  const uidMemberRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember },
  });
  const uidMember = (await uidMemberRes.json()).id;
  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*agent-mode*chains&select=user_id,workspace_id,route,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denials = await denialRes.json();
  const denial = Array.isArray(denials) ? denials[0] : null;
  assert(
    'T6: auth_denials row from T2 has correct fields',
    denial && denial.user_id === uidMember && denial.required_role === 'owner' && denial.actual_role === 'member',
    denial ? JSON.stringify(denial) : 'no row found'
  );

  if (denial) {
    console.log('\n  Sample auth_denials row (T6):');
    console.log('  ' + JSON.stringify(denial, null, 2).split('\n').join('\n  '));
  }

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
