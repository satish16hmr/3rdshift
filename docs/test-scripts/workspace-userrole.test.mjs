/**
 * Phase 2 Step 4 — /api/workspace GET: userRole in response
 *
 * T1: Owner login → response includes userRole: 'owner'
 * T2: Member login → response includes userRole: 'member'
 * T3: No auth → 401
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
const SUPABASE_URL = SUPABASE_URLS[TARGET];
const ANON_KEY = ANON_KEYS[TARGET];
if (!ANON_KEY) throw new Error(`Missing Supabase anon key env for ${TARGET}`);
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

async function callWorkspace(token) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API_BASE + '/api/workspace', { headers });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, body: data };
}

async function run() {
  console.log('=== Step 4: /api/workspace GET userRole Tests [' + TARGET + '] ===\n');
  const tokenOwner  = await signIn(accts.owner.email,  accts.owner.pass);
  const tokenMember = await signIn(accts.member.email, accts.member.pass);
  console.log('Auth: owner, member signed in OK\n');

  // T1: Owner → userRole: 'owner'
  const t1 = await callWorkspace(tokenOwner);
  assert(
    'T1: Owner login → userRole: "owner" in response',
    t1.status === 200 && t1.body && t1.body.userRole === 'owner',
    'status=' + t1.status + ' userRole=' + (t1.body && t1.body.userRole)
  );
  if (t1.status === 200) console.log('  Owner response: activeWorkspaceId=' + t1.body.activeWorkspaceId + ' userRole=' + t1.body.userRole);

  // T2: Member → userRole: 'member'
  const t2 = await callWorkspace(tokenMember);
  assert(
    'T2: Member login → userRole: "member" in response',
    t2.status === 200 && t2.body && t2.body.userRole === 'member',
    'status=' + t2.status + ' userRole=' + (t2.body && t2.body.userRole)
  );
  if (t2.status === 200) console.log('  Member response: activeWorkspaceId=' + t2.body.activeWorkspaceId + ' userRole=' + t2.body.userRole);

  // T3: No auth → 401
  const t3 = await callWorkspace(null);
  assert('T3: No auth → 401', t3.status === 401, 'status=' + t3.status);

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}
run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
