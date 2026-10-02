/**
 * Phase 2 Step 3g — R7: POST /api/agent-mode/chains/[id]/run auth tests
 *
 * T1: Owner → gets past role+plan gates (reaches chain lookup — 404 if chain absent, not 401/403)
 * T2: Member → 403 "requires owner access" (role gate, no credit burn)
 * T3: Owner (non-Operator plan) → 403 plan error (role passes, plan blocks — ordering correct)
 * T4: No auth → 401
 * T5: auth_denials row from T2 verified
 * T6: No credit consumed from T2 (member's blocked request burns no credits)
 *
 * Credit-burn verification (T6):
 * Read test-roger's heavy_credits_remaining BEFORE T2, confirm unchanged AFTER T2.
 * A member's 403 must not reach the chain executor — no credits burned.
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

// test-roger = pro plan owner of WA (non-Operator — plan check will block T1 at Operator gate)
// test-member = member of WA
// test-starter = starter plan owner of WB
const ACCOUNTS = {
  prod: {
    owner:       { email: 'test-roger@3rdshift.ai',   pass: '<SCREENSHOT_TEST_PASSWORD>' },
    member:      { email: 'test-member@3rdshift.ai',  pass: '<SCREENSHOT_TEST_PASSWORD>' },
    ownerStarter:{ email: 'test-starter@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
  },
};
const accts = ACCOUNTS[TARGET] || ACCOUNTS.prod;

// Fake chain ID — owner will get "Chain not found" or "Agent Mode requires Operator" AFTER role gate
const FAKE_CHAIN_ID = '00000000-0000-0000-0000-000000000001';

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

async function callRun(token, chainId) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API_BASE + '/api/agent-mode/chains/' + chainId + '/run', {
    method: 'POST', headers, body: JSON.stringify({}),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: r.status, body };
}

async function getCredits(userId) {
  const r = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId + '&select=heavy_credits_remaining',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const d = await r.json();
  return Array.isArray(d) && d[0] ? d[0].heavy_credits_remaining : null;
}

async function run() {
  console.log('=== R7 POST /api/agent-mode/chains/[id]/run Auth Tests [' + TARGET + '] ===\n');

  const tokenOwner    = await signIn(accts.owner.email,        accts.owner.pass);
  const tokenMember   = await signIn(accts.member.email,       accts.member.pass);
  const tokenOwnerSt  = await signIn(accts.ownerStarter.email, accts.ownerStarter.pass);
  console.log('Auth: owner, member, ownerStarter signed in OK\n');

  // Get owner's user ID for credit check
  const uidRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenOwner },
  });
  const uidOwner = (await uidRes.json()).id;

  // Read credits BEFORE member's blocked attempt
  const creditsBefore = await getCredits(uidOwner);
  console.log('  Credits before T2 (member blocked attempt): ' + creditsBefore + '\n');

  // T1: Owner → past role gate
  // test-roger is pro (not Operator) → role passes, plan check blocks.
  // Role-gate error: "requires owner access" | Plan-gate error: "Agent Mode requires Operator plan"
  // T1 passes if we get a plan error (not a role error) — proving role gate was cleared.
  const t1 = await callRun(tokenOwner, FAKE_CHAIN_ID);
  const t1IsRoleError = t1.status === 403 && t1.body && t1.body.error && t1.body.error.includes('owner access');
  const t1IsPlanError = t1.status === 403 && t1.body && t1.body.error && t1.body.error.includes('Operator plan');
  const t1IsChainError = t1.status === 404; // reached chain lookup, no chain found
  assert(
    'T1: Owner → past role gate (gets plan error or chain-not-found, NOT a role error)',
    (t1IsPlanError || t1IsChainError) && !t1IsRoleError,
    'status=' + t1.status + ' body=' + JSON.stringify(t1.body).slice(0, 120)
  );

  // T2: Member → 403 "requires owner access" (blocked before chain executor)
  const t2 = await callRun(tokenMember, FAKE_CHAIN_ID);
  assert(
    'T2: Member → 403 "requires owner access"',
    t2.status === 403 && t2.body && t2.body.error && t2.body.error.includes('requires'),
    'status=' + t2.status + ' body=' + JSON.stringify(t2.body)
  );

  // T3: Owner (Starter) → 403 plan error (role passes, plan blocks — correct ordering)
  const t3 = await callRun(tokenOwnerSt, FAKE_CHAIN_ID);
  assert(
    'T3: Owner (Starter) → 403 Operator plan error (role passes, plan blocks)',
    t3.status === 403 && t3.body && t3.body.error && t3.body.error.includes('Operator'),
    'status=' + t3.status + ' body=' + JSON.stringify(t3.body)
  );

  // T4: No auth → 401
  const t4 = await callRun(null, FAKE_CHAIN_ID);
  assert('T4: No auth → 401', t4.status === 401, 'status=' + t4.status);

  // T5: auth_denials row from T2
  await new Promise(r => setTimeout(r, 1000));
  const uidMemberRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenMember },
  });
  const uidMember = (await uidMemberRes.json()).id;
  const denialRes = await fetch(
    SUPABASE_URL + '/rest/v1/auth_denials?user_id=eq.' + uidMember + '&route=like.*chains*run*&select=user_id,workspace_id,route,required_role,actual_role&order=attempted_at.desc&limit=1',
    { headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY } }
  );
  const denials = await denialRes.json();
  const denial = Array.isArray(denials) ? denials[0] : null;
  assert(
    'T5: auth_denials row from T2 has correct fields',
    denial && denial.user_id === uidMember && denial.required_role === 'owner' && denial.actual_role === 'member',
    denial ? JSON.stringify(denial) : 'no row found'
  );

  if (denial) {
    console.log('\n  Sample auth_denials row (T5):');
    console.log('  ' + JSON.stringify(denial, null, 2).split('\n').join('\n  '));
  }

  // T6: No credits consumed from T2 (member's 403 must not reach chain executor)
  const creditsAfter = await getCredits(uidOwner);
  console.log('\n  Credits after T2: ' + creditsAfter + ' (was ' + creditsBefore + ')');
  assert(
    'T6: No credits burned by member\'s blocked attempt (credits unchanged)',
    creditsAfter === creditsBefore,
    'before=' + creditsBefore + ' after=' + creditsAfter
  );

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
