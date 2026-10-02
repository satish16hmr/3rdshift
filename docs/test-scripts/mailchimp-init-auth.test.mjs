/**
 * Phase 2 Step 3k — R11: POST /api/mailchimp/auth/init auth tests
 *
 * T1: Owner POST → past role gate (plan check or OAuth URL returned)
 * T2: Member POST → 403 "requires owner access"
 * T3: No auth → 401
 * T4: auth_denials row from T2 verified
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
const ACCOUNTS = { prod: { owner: { email: 'test-roger@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' }, member: { email: 'test-member@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' } } };
const accts = ACCOUNTS[TARGET] || ACCOUNTS.prod;

const results = [];
let passed = 0;
let failed = 0;

function assert(name, ok, detail) {
  if (ok) { results.push('  PASS: ' + name); passed++; }
  else { results.push('  FAIL: ' + name + (detail ? ' -- ' + detail : '')); failed++; }
}

async function signIn(email, pass) {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON_KEY }, body: JSON.stringify({ email, password: pass }) });
  const d = await r.json();
  if (!d.access_token) throw new Error('Auth failed: ' + email);
  return d.access_token;
}

async function call(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API_BASE + '/api/mailchimp/auth/init', { method: 'POST', headers, body: JSON.stringify({}) });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, body: data };
}

function isRoleError(res) { return res.status === 403 && res.body && res.body.error && res.body.error.includes('owner access'); }

async function run() {
  console.log('=== R11 POST /api/mailchimp/auth/init Auth Tests [' + TARGET + '] ===\n');
  const tokenOwner  = await signIn(accts.owner.email,  accts.owner.pass);
  const tokenMember = await signIn(accts.member.email, accts.member.pass);
  console.log('Auth: owner, member signed in OK\n');

  const t1 = await call(tokenOwner);
  assert('T1: Owner POST → past role gate (plan check or OAuth URL)', !isRoleError(t1) && t1.status !== 401, 'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0, 100));

  const t2 = await call(tokenMember);
  assert('T2: Member POST → 403 "requires owner access"', isRoleError(t2), 'status=' + t2.status + ' body=' + JSON.stringify(t2.body));

  const t3 = await call(null);
  assert('T3: No auth → 401', t3.status === 401, 'status=' + t3.status);

  await new Promise(r => setTimeout(r, 1000));
  const uidRes = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember } });
  const uidMember = (await uidRes.json()).id;
  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*mailchimp*init*&select=user_id,workspace_id,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denial = (await denialRes.json())[0] || null;
  assert('T4: auth_denials row from T2 correct', denial && denial.required_role === 'owner' && denial.actual_role === 'member', denial ? JSON.stringify(denial) : 'no row');
  if (denial) { console.log('\n  auth_denials row (T4):'); console.log('  ' + JSON.stringify(denial, null, 2).split('\n').join('\n  ')); }

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}
run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
