/**
 * Phase 2 Step 3b — R2: /api/topup-checkout auth tests
 *
 * T1: Owner (Operator plan) → 200 with checkout URL
 * T2: Member (Operator workspace) → 403 "requires owner access"
 * T3: Owner (non-Operator plan) → 403 plan check (existing behavior preserved)
 * T4: No auth → 401
 * T5: auth_denials row from T2 verified
 *
 * Critical regression: T3 confirms Operator plan check still works after role check added.
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

async function callTopup(token, pack) {
  pack = pack || 'small';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API_BASE + '/api/topup-checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pack }),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: r.status, body };
}

async function run() {
  console.log('=== R2 /api/topup-checkout Auth Tests [' + TARGET + '] ===\n');

  const tokenOwnerOp = await signIn(accts.ownerOperator.email, accts.ownerOperator.pass);
  const tokenMember  = await signIn(accts.member.email, accts.member.pass);
  const tokenOwnerSt = await signIn(accts.ownerStarter.email, accts.ownerStarter.pass);
  console.log('Auth: ownerOperator, member, ownerStarter signed in OK\n');

  // T1: Owner (Operator plan) → 200 with checkout URL (reaches Stripe)
  const t1 = await callTopup(tokenOwnerOp, 'small');
  assert(
    'T1: Owner (Operator) → reaches Stripe, not blocked by auth/role layer',
    t1.status !== 401 && t1.status !== 403,
    'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0, 120)
  );

  // T2: Member (Operator workspace) → 403 "requires owner access"
  // Role check fires BEFORE plan check — member gets role error, not plan error
  const t2 = await callTopup(tokenMember, 'small');
  assert(
    'T2: Member → 403 "requires owner access" (role check fires before plan check)',
    t2.status === 403 &&
    typeof t2.body === 'object' &&
    t2.body.error &&
    t2.body.error.includes('requires'),
    'status=' + t2.status + ' body=' + JSON.stringify(t2.body)
  );

  // T3: Owner (Starter plan) → 403 from plan check (existing behavior preserved)
  // Role passes (they're owner), but plan check then blocks them — correct
  const t3 = await callTopup(tokenOwnerSt, 'small');
  assert(
    'T3: Owner (Starter plan) → 403 Operator-only (plan check, role passes first)',
    t3.status === 403 &&
    typeof t3.body === 'object' &&
    t3.body.error &&
    t3.body.error.includes('Operator'),
    'status=' + t3.status + ' body=' + JSON.stringify(t3.body)
  );

  // T4: No auth → 401
  const t4 = await callTopup(null, 'small');
  assert('T4: No auth → 401', t4.status === 401, 'status=' + t4.status);

  // T5: auth_denials row created from T2
  await new Promise(r => setTimeout(r, 1000));

  const uidMemberRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember },
  });
  const uidMember = (await uidMemberRes.json()).id;

  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*topup-checkout*&select=user_id,workspace_id,route,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denials = await denialRes.json();
  const denial = Array.isArray(denials) ? denials[0] : null;

  assert(
    'T5: auth_denials row from T2 has correct user_id, required_role=owner, actual_role=member',
    denial &&
    denial.user_id === uidMember &&
    denial.required_role === 'owner' &&
    denial.actual_role === 'member',
    denial ? JSON.stringify(denial) : 'no row found'
  );

  if (denial) {
    console.log('\n  Sample auth_denials row (T5):');
    console.log('  ' + JSON.stringify(denial, null, 2).split('\n').join('\n  '));
  }

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
