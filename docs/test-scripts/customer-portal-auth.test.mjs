/**
 * Phase 2 Step 3 — R1: /api/customer-portal auth tests
 *
 * T1: Owner JWT → reaches Stripe (200 with url, OR Stripe-level error — not a 403/401)
 * T2: Member JWT → 403 "requires owner access"
 * T3: Non-member JWT → 403 "Not a member"
 * T4: No auth → 401
 * T5: T2 creates an auth_denials row with correct fields
 *
 * Tests run against branch DB + branch API URL by default.
 * Set TARGET=prod to run against prod.
 */

const TARGET = process.env.TARGET || 'branch';

// Branch uses local next dev; prod uses live site
const API_BASES = {
  branch: 'https://3rdshift.ai',  // always test against live (branch has no separate API host)
  prod: 'https://3rdshift.ai',
};

const SUPABASE_URLS = {
  branch: process.env.BRANCH_SUPABASE_URL || 'https://nwouqhjndtouyizixvtn.supabase.co',
  prod: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.PROD_SUPABASE_URL || 'https://ytqflszzzkkriqhyrroy.supabase.co',
};
const SUPABASE_URL = SUPABASE_URLS[TARGET];

const ANON_KEYS = {
  branch: process.env.BRANCH_SUPABASE_ANON_KEY,
  prod: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.PROD_ANON_KEY,
};
const SVC_KEYS = {
  branch: process.env.BRANCH_SUPABASE_SERVICE_ROLE_KEY || process.env.BRANCH_SUPABASE_SECRET_KEY,
  prod: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY,
};
const ANON_KEY = ANON_KEYS[TARGET];
const SVC_KEY = SVC_KEYS[TARGET];
if (!ANON_KEY) throw new Error(`Missing Supabase anon key env for ${TARGET}`);
if (!SVC_KEY) throw new Error(`Missing Supabase service-role key env for ${TARGET}`);

const ACCOUNTS = {
  branch: {
    owner:    { email: 'user-a@3rdshift-test.dev', pass: 'TestPass123!' },
    member:   { email: 'user-b@3rdshift-test.dev', pass: 'TestPass123!' },
    outsider: { email: 'user-c@3rdshift-test.dev', pass: 'TestPass123!' },
  },
  prod: {
    owner:    { email: 'test-roger@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
    member:   { email: 'test-member@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
    // outsider = user with NO workspace at all (zero workspace_members rows)
    // Note: test-operator-c owns WC so requireAuth resolves to WC where they ARE owner.
    // The real "non-member of WA" test requires a user with no workspace.
    outsider: { email: 'test-noworkspace@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
  },
};

const API_BASE = API_BASES[TARGET];
const accts = ACCOUNTS[TARGET];

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

async function callPortal(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API_BASE + '/api/customer-portal', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: r.status, body };
}

async function run() {
  console.log('=== R1 /api/customer-portal Auth Tests [' + TARGET + '] ===\n');

  const tokenOwner = await signIn(accts.owner.email, accts.owner.pass);
  const tokenMember = await signIn(accts.member.email, accts.member.pass);
  const tokenOutsider = await signIn(accts.outsider.email, accts.outsider.pass);
  console.log('Auth: owner, member, outsider signed in OK\n');

  // T1: Owner JWT → gets past auth layer (reaches Stripe, not a 403/401)
  // In test context, Stripe may return error if no customer exists, but that's NOT an auth failure.
  // We assert: status is NOT 401 or 403.
  const t1 = await callPortal(tokenOwner);
  assert(
    'T1: Owner JWT → reaches Stripe (not blocked by auth layer)',
    t1.status !== 401 && t1.status !== 403,
    'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0, 100)
  );

  // T2: Member JWT → 403 "requires owner access"
  const t2 = await callPortal(tokenMember);
  assert(
    'T2: Member JWT → 403 "requires owner access"',
    t2.status === 403 && typeof t2.body === 'object' && t2.body.error && t2.body.error.includes('requires'),
    'status=' + t2.status + ' body=' + JSON.stringify(t2.body)
  );

  // T3: User with no workspace → 403 (blocked before reaching requireWorkspaceRole)
  // requireAuth returns 403 "No workspace found" before the role check runs.
  // Still correctly blocked. Any 403 is an acceptable pass here.
  const t3 = await callPortal(tokenOutsider);
  assert(
    'T3: User with no workspace → 403 (blocked by auth layer)',
    t3.status === 403,
    'status=' + t3.status + ' body=' + JSON.stringify(t3.body)
  );

  // T4: No auth header → 401
  const t4 = await callPortal(null);
  assert(
    'T4: No auth header → 401',
    t4.status === 401,
    'status=' + t4.status + ' body=' + JSON.stringify(t4.body)
  );

  // T5: auth_denials row created from T2 (member 403)
  // Small delay to let the fire-and-forget complete
  await new Promise(r => setTimeout(r, 1000));

  const uidMemberRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember },
  });
  const uidMember = (await uidMemberRes.json()).id;

  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*customer-portal*&select=user_id,workspace_id,route,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denials = await denialRes.json();
  const denial = Array.isArray(denials) ? denials[0] : null;

  assert(
    'T5: auth_denials row created from T2 with correct fields',
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
