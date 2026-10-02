/**
 * Phase 3 Components 2+9: Route-level changes (subscription validation, null safety)
 *
 * T1: /api/plan-change with no workspaceId still returns 400 (unchanged)
 * T2: /api/plan-change with valid body → gets past auth/role (sub validation or Stripe error, not 400/401/403)
 * T3: /api/topup-checkout as member → 403 role block (unchanged from Phase 2)
 * T4: /api/billing/topup-status route is live and requires auth
 * T5: /api/webhooks/stripe responds to invalid signatures with 400 (existing behavior preserved)
 * T6: verifyActiveSubscription helper path — plan-change returns 400 SUBSCRIPTION_INACTIVE for inactive sub
 *     (tested indirectly: passing fake subscriptionItemId for test-roger who has no real sub → 404 sub not found)
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
const ACCOUNTS = {
  prod: {
    owner:  { email: 'test-roger@3rdshift.ai',  pass: '<SCREENSHOT_TEST_PASSWORD>' },
    member: { email: 'test-member@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' },
  },
};
const accts = ACCOUNTS[TARGET] || ACCOUNTS.prod;
const WA = '908596ba-f86a-4ca6-b8e6-a6e70101d081';

const results = [];
let passed = 0;
let failed = 0;

function assert(name, ok, detail) {
  if (ok) { results.push('  PASS: ' + name); passed++; }
  else { results.push('  FAIL: ' + name + (detail ? ' -- ' + detail : '')); failed++; }
}

async function signIn(email, pass) {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password: pass }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Auth failed: ' + email);
  return d.access_token;
}

async function call(url, method, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API_BASE + url, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, body: data };
}

async function run() {
  console.log('=== Phase 3 C2+C9: Route changes [' + TARGET + '] ===\n');

  const tokenOwner  = await signIn(accts.owner.email,  accts.owner.pass);
  const tokenMember = await signIn(accts.member.email, accts.member.pass);
  console.log('Auth OK\n');

  // T1: plan-change without workspaceId → 400 (Phase 2 requirement preserved)
  const t1 = await call('/api/plan-change', 'POST', tokenOwner, {
    newPriceId: 'price_test', subscriptionItemId: 'si_test', isUpgrade: true,
  });
  assert('T1: plan-change without workspaceId → 400 "workspace_id required"',
    t1.status === 400 && t1.body && t1.body.error === 'workspace_id required',
    'status=' + t1.status + ' body=' + JSON.stringify(t1.body)
  );

  // T2: plan-change owner with workspaceId → gets past auth+role (hits sub validation or Stripe — not 400/401/403 role errors)
  const t2 = await call('/api/plan-change', 'POST', tokenOwner, {
    workspaceId: WA, newPriceId: 'price_placeholder', subscriptionItemId: 'si_placeholder', isUpgrade: true,
  });
  // Expect anything except 401 (no auth) or 403 (role block) — sub/Stripe errors are fine
  assert('T2: plan-change owner → past role gate (sub validation or Stripe, not role block)',
    t2.status !== 401 && t2.status !== 403,
    'status=' + t2.status + ' body=' + JSON.stringify(t2.body).slice(0, 100)
  );

  // T3: topup-checkout as member → 403 role block (Phase 2 preserved)
  const t3 = await call('/api/topup-checkout', 'POST', tokenMember, { pack: 'small' });
  assert('T3: topup-checkout member → 403 "requires owner access" (Phase 2 preserved)',
    t3.status === 403 && t3.body && t3.body.error && t3.body.error.includes('requires'),
    'status=' + t3.status + ' body=' + JSON.stringify(t3.body)
  );

  // T4: topup-status route exists and requires auth
  const t4 = await call('/api/billing/topup-status', 'GET', null);
  assert('T4: /api/billing/topup-status requires auth (401)', t4.status === 401, 'status=' + t4.status);

  // T5: Webhook rejects invalid signatures (existing behavior)
  const t5 = await fetch(API_BASE + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 'invalid_sig' },
    body: JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' }),
  });
  assert('T5: Webhook rejects invalid signature → 400', t5.status === 400, 'status=' + t5.status);

  // T6: Subscription inactive check — test-roger has no real Stripe sub
  // plan-change will hit: role check (pass) → sub lookup → 404 "No active subscription"
  // This confirms the subscription validation path executes (no sub = 404 before Stripe modification)
  const t6 = await call('/api/plan-change', 'POST', tokenOwner, {
    workspaceId: WA, newPriceId: 'price_placeholder', subscriptionItemId: 'si_placeholder', isUpgrade: true,
  });
  assert('T6: Sub validation fires — 404 "No active subscription" for owner with no sub',
    t6.status === 404 && t6.body && t6.body.error === 'No active subscription found',
    'status=' + t6.status + ' body=' + JSON.stringify(t6.body)
  );

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}
run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
