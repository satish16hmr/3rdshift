/**
 * Phase 2 Step 3j — R10: /api/buffer/connect POST + DELETE auth tests
 *
 * T1: Owner POST → past role gate (plan check fires — blocked for non-Pro, not role block)
 * T2: Member POST → 403 "requires owner access"
 * T3: Owner DELETE → past role gate (200 or plan/other error)
 * T4: Member DELETE → 403 "requires owner access"
 * T5: No auth POST → 401
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
  if (!d.access_token) throw new Error('Auth failed: ' + email);
  return d.access_token;
}

async function call(method, token, body) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API_BASE + '/api/buffer/connect', opts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, body: data };
}

function isRoleError(res) {
  return res.status === 403 && res.body && res.body.error && res.body.error.includes('owner access');
}

async function run() {
  console.log('=== R10 /api/buffer/connect POST+DELETE Auth Tests [' + TARGET + '] ===\n');

  const tokenOwner  = await signIn(accts.owner.email,  accts.owner.pass);
  const tokenMember = await signIn(accts.member.email, accts.member.pass);
  console.log('Auth: owner, member signed in OK\n');

  // T1: Owner POST → past role gate (plan check fires — test-roger is pro, not starter, so may pass plan check then fail at Buffer API validation)
  const t1 = await call('POST', tokenOwner, { api_key: 'test_invalid_key' });
  assert(
    'T1: Owner POST → past role gate (plan check or Buffer API error, not role block)',
    !isRoleError(t1) && t1.status !== 401,
    'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0, 100)
  );

  // T2: Member POST → 403 role error
  const t2 = await call('POST', tokenMember, { api_key: 'test_invalid_key' });
  assert(
    'T2: Member POST → 403 "requires owner access"',
    isRoleError(t2),
    'status=' + t2.status + ' body=' + JSON.stringify(t2.body)
  );

  // T3: Owner DELETE → past role gate (200 or any non-role non-401 response)
  const t3 = await call('DELETE', tokenOwner);
  assert(
    'T3: Owner DELETE → past role gate',
    !isRoleError(t3) && t3.status !== 401,
    'status=' + t3.status + ' body=' + JSON.stringify(t3.body).slice(0, 100)
  );

  // T4: Member DELETE → 403 role error
  const t4 = await call('DELETE', tokenMember);
  assert(
    'T4: Member DELETE → 403 "requires owner access"',
    isRoleError(t4),
    'status=' + t4.status + ' body=' + JSON.stringify(t4.body)
  );

  // T5: No auth → 401
  const t5 = await call('POST', null, { api_key: 'x' });
  assert('T5: No auth POST → 401', t5.status === 401, 'status=' + t5.status);

  // T6: auth_denials from T2
  await new Promise(r => setTimeout(r, 1000));
  const uidRes = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember } });
  const uidMember = (await uidRes.json()).id;
  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*buffer*connect*&select=user_id,workspace_id,route,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denials = await denialRes.json();
  const denial = Array.isArray(denials) ? denials[0] : null;
  assert(
    'T6: auth_denials row from T2 correct',
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
