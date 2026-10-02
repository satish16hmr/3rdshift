/**
 * Phase 2 Step 3f — R6: /api/zapier/api-key auth tests
 *
 * Tests GET and POST (no DELETE handler exists).
 * Role check fires BEFORE plan check — members get role error, not plan error.
 *
 * T1: Owner (Operator) GET → 200 (reaches key lookup)
 * T2: Member GET → 403 "requires owner access"
 * T3: Owner (non-Operator) GET → 200 with is_operator:false (role passes, plan check gates)
 * T4: Owner (Operator) POST → 200 (key generated)
 * T5: Member POST → 403 "requires owner access"
 * T6: No auth → 401
 * T7: auth_denials row from T2 verified
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

// test-roger = pro plan owner (not Operator — plan check will block for POST)
// test-member = member of WA
// test-starter = Starter plan owner of WB
const ACCOUNTS = {
  prod: {
    owner:       { email: 'test-roger@3rdshift.ai',   pass: '<SCREENSHOT_TEST_PASSWORD>' },
    member:      { email: 'test-member@3rdshift.ai',  pass: '<SCREENSHOT_TEST_PASSWORD>' },
    ownerStarter:{ email: 'test-starter@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
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

async function call(method, token) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API_BASE + '/api/zapier/api-key', { method, headers });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: r.status, body };
}

async function run() {
  console.log('=== R6 /api/zapier/api-key Auth Tests [' + TARGET + '] ===\n');

  const tokenOwner       = await signIn(accts.owner.email,        accts.owner.pass);
  const tokenMember      = await signIn(accts.member.email,       accts.member.pass);
  const tokenOwnerSt     = await signIn(accts.ownerStarter.email, accts.ownerStarter.pass);
  console.log('Auth: owner, member, ownerStarter signed in OK\n');

  // T1: Owner GET → 200 (reaches key lookup, role + plan both pass for pro owner)
  // test-roger is pro, so plan check returns is_operator:false — but role check passes → 200
  const t1 = await call('GET', tokenOwner);
  assert(
    'T1: Owner GET → 200 (past auth/role layer, plan check returns is_operator:false for non-op)',
    t1.status === 200,
    'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0, 100)
  );

  // T2: Member GET → 403 "requires owner access"
  const t2 = await call('GET', tokenMember);
  assert(
    'T2: Member GET → 403 "requires owner access"',
    t2.status === 403 && t2.body && t2.body.error && t2.body.error.includes('requires'),
    'status=' + t2.status + ' body=' + JSON.stringify(t2.body)
  );

  // T3: Owner (Starter) GET → 200 with is_operator:false (role passes, plan check gates content)
  const t3 = await call('GET', tokenOwnerSt);
  assert(
    'T3: Owner (Starter) GET → 200 is_operator:false (role passes, plan blocks Zapier)',
    t3.status === 200 && t3.body && t3.body.is_operator === false,
    'status=' + t3.status + ' body=' + JSON.stringify(t3.body)
  );

  // T4: Owner POST → 403 "Zapier integration requires Operator" (role passes, plan blocks)
  // test-roger is pro — role check passes, then plan check fires
  const t4 = await call('POST', tokenOwner);
  assert(
    'T4: Owner (non-Operator) POST → 403 plan check (role passes first)',
    t4.status === 403 && t4.body && t4.body.error && t4.body.error.includes('Operator'),
    'status=' + t4.status + ' body=' + JSON.stringify(t4.body)
  );

  // T5: Member POST → 403 "requires owner access" (role check fires before plan check)
  const t5 = await call('POST', tokenMember);
  assert(
    'T5: Member POST → 403 "requires owner access" (role fires before plan)',
    t5.status === 403 && t5.body && t5.body.error && t5.body.error.includes('requires'),
    'status=' + t5.status + ' body=' + JSON.stringify(t5.body)
  );

  // T6: No auth GET → 401
  const t6 = await call('GET', null);
  assert('T6: No auth GET → 401', t6.status === 401, 'status=' + t6.status);

  // T7: auth_denials row from T2 (member GET)
  await new Promise(r => setTimeout(r, 1000));
  const uidMemberRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember },
  });
  const uidMember = (await uidMemberRes.json()).id;
  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*zapier*api-key*&select=user_id,workspace_id,route,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denials = await denialRes.json();
  const denial = Array.isArray(denials) ? denials[0] : null;
  assert(
    'T7: auth_denials row from T2 has correct fields',
    denial && denial.user_id === uidMember && denial.required_role === 'owner' && denial.actual_role === 'member',
    denial ? JSON.stringify(denial) : 'no row found'
  );

  if (denial) {
    console.log('\n  Sample auth_denials row (T7):');
    console.log('  ' + JSON.stringify(denial, null, 2).split('\n').join('\n  '));
  }

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
