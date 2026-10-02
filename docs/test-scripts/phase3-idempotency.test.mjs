/**
 * Phase 3 Component 1 + 7: Webhook idempotency + topup-status endpoint
 *
 * T1: stripe_webhook_events table exists, RLS enabled, service-role writable
 * T2: Insert event row → duplicate insert blocked by UNIQUE constraint
 * T3: Anon cannot read stripe_webhook_events (service-role-only)
 * T4: GET /api/billing/topup-status without session_id → 400
 * T5: GET /api/billing/topup-status with unknown session_id → { credited: false }
 * T6: GET /api/billing/topup-status with known session_id → { credited: true, new_total: N }
 * T7: No auth on topup-status → 401
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
const ACCOUNTS = { prod: { owner: { email: 'test-roger@3rdshift.ai', pass: '<SCREENSHOT_TEST_PASSWORD>' } } };
const accts = ACCOUNTS[TARGET] || ACCOUNTS.prod;

const TEST_EVENT_ID = 'evt_phase3_test_' + Date.now();
const TEST_SESSION_ID = 'cs_test_phase3_' + Date.now();

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

async function svc(method, table, params, body) {
  params = params || '';
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + params, {
    method, headers: { apikey: SVC_KEY, Authorization: 'Bearer ' + SVC_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: r.status, data };
}

async function run() {
  console.log('=== Phase 3 C1+C7: Idempotency + topup-status [' + TARGET + '] ===\n');

  const tokenOwner = await signIn(accts.owner.email, accts.owner.pass);
  console.log('Auth OK\n');

  // T1: Table exists, RLS enabled, service-role writable
  const t1Insert = await svc('POST', 'stripe_webhook_events', '', {
    stripe_event_id: TEST_EVENT_ID, event_type: 'checkout.session.completed',
    payload: { test: true }, session_id: TEST_SESSION_ID,
  });
  assert('T1: stripe_webhook_events service-role INSERT', t1Insert.status === 201 || (Array.isArray(t1Insert.data) && t1Insert.data.length > 0), 'status=' + t1Insert.status + ' data=' + JSON.stringify(t1Insert.data).slice(0, 100));

  // T2: Duplicate event_id blocked by UNIQUE constraint (23505 = unique_violation)
  const t2 = await svc('POST', 'stripe_webhook_events', '', {
    stripe_event_id: TEST_EVENT_ID, event_type: 'checkout.session.completed',
    payload: { test: 'duplicate' },
  });
  assert('T2: Duplicate stripe_event_id blocked (UNIQUE constraint)', t2.status === 409 || (t2.data && t2.data.code === '23505'), 'status=' + t2.status + ' data=' + JSON.stringify(t2.data).slice(0, 100));

  // T3: Anon cannot read stripe_webhook_events
  const t3 = await fetch(SUPABASE_URL + '/rest/v1/stripe_webhook_events?select=id&limit=1', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + tokenOwner },
  });
  const t3Data = await t3.json();
  assert('T3: Anon cannot read stripe_webhook_events (RLS blocks)', Array.isArray(t3Data) && t3Data.length === 0 || t3.status === 403, 'status=' + t3.status + ' data=' + JSON.stringify(t3Data).slice(0, 80));

  // T4: topup-status without session_id → 400
  const t4 = await fetch(API_BASE + '/api/billing/topup-status', { headers: { Authorization: 'Bearer ' + tokenOwner } });
  assert('T4: /api/billing/topup-status no session_id → 400', t4.status === 400, 'status=' + t4.status);

  // T5: topup-status with unknown session_id → { credited: false }
  const t5 = await fetch(API_BASE + '/api/billing/topup-status?session_id=cs_unknown_xyz_12345', {
    headers: { Authorization: 'Bearer ' + tokenOwner },
  });
  const t5Data = await t5.json();
  assert('T5: Unknown session_id → { credited: false }', t5.status === 200 && t5Data.credited === false, 'status=' + t5.status + ' data=' + JSON.stringify(t5Data));

  // T6: topup-status with known session_id (we inserted it in T1) → { credited: true }
  const t6 = await fetch(API_BASE + '/api/billing/topup-status?session_id=' + TEST_SESSION_ID, {
    headers: { Authorization: 'Bearer ' + tokenOwner },
  });
  const t6Data = await t6.json();
  assert('T6: Known session_id → { credited: true, new_total: N }', t6.status === 200 && t6Data.credited === true && typeof t6Data.new_total === 'number', 'status=' + t6.status + ' data=' + JSON.stringify(t6Data));

  // T7: No auth → 401
  const t7 = await fetch(API_BASE + '/api/billing/topup-status?session_id=cs_test');
  assert('T7: No auth → 401', t7.status === 401, 'status=' + t7.status);

  // Cleanup test row
  await svc('DELETE', 'stripe_webhook_events', '?stripe_event_id=eq.' + TEST_EVENT_ID);

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}
run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
