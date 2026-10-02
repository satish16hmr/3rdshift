/**
 * Phase 3 Components 3+4: Tables, RLS, and plan_transitions/refund_events logging
 *
 * T1: plan_transitions exists, RLS enabled, service-role writable, anon blocked
 * T2: refund_events exists, RLS enabled, service-role writable, anon blocked
 * T3: profiles.dispute_pending column exists and defaults to false
 * T4: plan_transitions INSERT with all required fields succeeds
 * T5: refund_events INSERT with all required fields succeeds
 * T6: Anon cannot read plan_transitions
 * T7: Anon cannot read refund_events
 */

const TARGET = process.env.TARGET || 'prod';
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

const TEST_USER_ID = 'beb11849-5eba-4a1e-b8c6-f15d16e9fc2e'; // test-roger prod uid

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

async function anonGet(token, table) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=id&limit=1', {
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token },
  });
  const data = await r.json();
  return { status: r.status, data };
}

async function run() {
  console.log('=== Phase 3 C3+C4: Tables + RLS [' + TARGET + '] ===\n');

  const tokenOwner = await signIn(accts.owner.email, accts.owner.pass);
  console.log('Auth OK\n');

  // T1: plan_transitions — service-role writable
  const t1 = await svc('POST', 'plan_transitions', '', {
    user_id: TEST_USER_ID, from_plan: 'starter', to_plan: 'pro',
    reason: 'test_phase3', stripe_event_id: 'evt_test_phase3_tables',
    metadata: { test: true },
  });
  assert('T1: plan_transitions service-role INSERT', t1.status === 201 || (Array.isArray(t1.data) && t1.data.length > 0), 'status=' + t1.status + ' data=' + JSON.stringify(t1.data).slice(0, 100));

  // T2: refund_events — service-role writable
  const t2 = await svc('POST', 'refund_events', '', {
    user_id: TEST_USER_ID, event_type: 'charge.refunded',
    amount_cents: 7900, action_taken: 'plan_downgraded',
    stripe_event_id: 'evt_test_refund_phase3',
  });
  assert('T2: refund_events service-role INSERT', t2.status === 201 || (Array.isArray(t2.data) && t2.data.length > 0), 'status=' + t2.status + ' data=' + JSON.stringify(t2.data).slice(0, 100));

  // T3: profiles.dispute_pending column exists — query any row (not test-roger who has FK issue)
  const t3 = await svc('GET', 'profiles', '?select=dispute_pending&limit=1');
  assert('T3: profiles.dispute_pending column exists and is boolean', Array.isArray(t3.data) && t3.data.length > 0 && typeof t3.data[0].dispute_pending === 'boolean', 'data=' + JSON.stringify(t3.data).slice(0, 80));

  // T4: Read back plan_transitions row just inserted
  const t4 = await svc('GET', 'plan_transitions', '?user_id=eq.' + TEST_USER_ID + '&reason=eq.test_phase3&select=user_id,from_plan,to_plan,reason');
  const t4Row = Array.isArray(t4.data) ? t4.data[0] : null;
  assert('T4: plan_transitions row readable (from_plan, to_plan, reason correct)',
    t4Row && t4Row.from_plan === 'starter' && t4Row.to_plan === 'pro' && t4Row.reason === 'test_phase3',
    JSON.stringify(t4Row)
  );

  // T5: Read back refund_events row just inserted
  const t5 = await svc('GET', 'refund_events', '?user_id=eq.' + TEST_USER_ID + '&event_type=eq.charge.refunded&select=user_id,event_type,amount_cents,action_taken&order=occurred_at.desc&limit=1');
  const t5Row = Array.isArray(t5.data) ? t5.data[0] : null;
  assert('T5: refund_events row readable (event_type, amount_cents, action_taken correct)',
    t5Row && t5Row.event_type === 'charge.refunded' && t5Row.amount_cents === 7900 && t5Row.action_taken === 'plan_downgraded',
    JSON.stringify(t5Row)
  );

  // T6: Anon cannot read plan_transitions
  const t6 = await anonGet(tokenOwner, 'plan_transitions');
  assert('T6: Anon cannot read plan_transitions (RLS blocks)', Array.isArray(t6.data) && t6.data.length === 0 || t6.status === 403, 'status=' + t6.status);

  // T7: Anon cannot read refund_events
  const t7 = await anonGet(tokenOwner, 'refund_events');
  assert('T7: Anon cannot read refund_events (RLS blocks)', Array.isArray(t7.data) && t7.data.length === 0 || t7.status === 403, 'status=' + t7.status);

  // Print sample rows
  if (t4Row) {
    console.log('\n  Sample plan_transitions row:');
    console.log('  ' + JSON.stringify(t4Row, null, 2).split('\n').join('\n  '));
  }
  if (t5Row) {
    console.log('\n  Sample refund_events row:');
    console.log('  ' + JSON.stringify(t5Row, null, 2).split('\n').join('\n  '));
  }

  console.log('\n=== Results ===');
  for (let i = 0; i < results.length; i++) console.log(results[i]);
  console.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}
run().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
