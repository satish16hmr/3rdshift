// Adversarial tests for C11 + C12b-e
// Branch: nwouqhjndtouyizixvtn (rls-fix-test)

const BRANCH_URL = 'https://nwouqhjndtouyizixvtn.supabase.co';
const ANON_KEY = process.env.BRANCH_SUPABASE_ANON_KEY;
if (!ANON_KEY) throw new Error('Missing BRANCH_SUPABASE_ANON_KEY env');
const SERVICE_ROLE_KEY = process.env.BRANCH_SUPABASE_SERVICE_ROLE_KEY || process.env.BRANCH_SUPABASE_SECRET_KEY;
if (!SERVICE_ROLE_KEY) throw new Error('Missing BRANCH_SUPABASE_SERVICE_ROLE_KEY/BRANCH_SUPABASE_SECRET_KEY env');

// Seed users from D2
const USER_A = { email: 'user-a@3rdshift-test.dev', password: 'TestPass123!' };
const USER_B = { email: 'user-b@3rdshift-test.dev', password: 'TestPass123!' };
const USER_C = { email: 'user-c@3rdshift-test.dev', password: 'TestPass123!' };
const WA = 'aaaaaaaa-0000-0000-0000-000000000001';
const WB = 'bbbbbbbb-0000-0000-0000-000000000001';

const results = [];
let passed = 0, failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    results.push(`  ✅ ${name}`);
    passed++;
  } else {
    results.push(`  ❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function signIn(email, password) {
  const r = await fetch(`${BRANCH_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Sign in failed for ${email}: ${JSON.stringify(d)}`);
  return d.access_token;
}

async function query(token, table, params = '', method = 'GET', body = null) {
  const key = token === 'service' ? SERVICE_ROLE_KEY : ANON_KEY;
  const authHeader = token === 'service' ? `Bearer ${SERVICE_ROLE_KEY}` : `Bearer ${token}`;
  const r = await fetch(`${BRANCH_URL}/rest/v1/${table}${params}`, {
    method,
    headers: {
      'apikey': key,
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Prefer': method === 'GET' ? 'count=exact' : 'return=representation'
    },
    body: body ? JSON.stringify(body) : null
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data, count: r.headers.get('content-range') };
}

async function run() {
  console.log('=== Step 14 Adversarial Tests: C11 + C12b-e ===\n');

  let tokenA, tokenB, tokenC;
  try {
    tokenA = await signIn(USER_A.email, USER_A.password);
    tokenB = await signIn(USER_B.email, USER_B.password);
    tokenC = await signIn(USER_C.email, USER_C.password);
    console.log('Auth: User A, B, C signed in ✅\n');
  } catch (e) {
    console.error('AUTH FAILURE:', e.message);
    process.exit(1);
  }

  // Get user IDs
  const meA = await fetch(`${BRANCH_URL}/auth/v1/user`, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${tokenA}` } });
  const { id: uidA } = await meA.json();
  const meC = await fetch(`${BRANCH_URL}/auth/v1/user`, { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${tokenC}` } });
  const { id: uidC } = await meC.json();

  // ─── C11: agent_mode_settings ─────────────────────────────────────────────
  console.log('── C11: agent_mode_settings ──');

  // Ensure a settings row exists for User A (via service role)
  await query('service', 'agent_mode_settings', '', 'POST', { user_id: uidA, email_on_complete: true, email_on_failure: false, email_on_credit_alert: true });

  // T-C11-1: User A can read own settings
  const c11OwnRead = await query(tokenA, 'agent_mode_settings', `?user_id=eq.${uidA}&select=user_id,email_on_complete`);
  assert('T-C11-1: User A reads own settings', Array.isArray(c11OwnRead.data) && c11OwnRead.data.length > 0);

  // T-C11-2: User C cannot read User A's settings (cross-user)
  const c11CrossRead = await query(tokenC, 'agent_mode_settings', `?user_id=eq.${uidA}&select=user_id`);
  assert('T-C11-2: User C cannot read User A settings', Array.isArray(c11CrossRead.data) && c11CrossRead.data.length === 0);

  // T-C11-3: Anon-key INSERT blocked
  const c11Insert = await query(tokenA, 'agent_mode_settings', '', 'POST', { user_id: uidC, email_on_complete: false });
  assert('T-C11-3: Anon INSERT blocked', c11Insert.status === 403 || c11Insert.status === 401 || c11Insert.status === 405 || (Array.isArray(c11Insert.data) && c11Insert.data.length === 0));

  // T-C11-4: Anon-key UPDATE blocked
  const c11Update = await query(tokenC, 'agent_mode_settings', `?user_id=eq.${uidA}`, 'PATCH', { email_on_complete: false });
  assert('T-C11-4: Anon UPDATE blocked', c11Update.status === 403 || c11Update.status === 401 || (Array.isArray(c11Update.data) && c11Update.data.length === 0));

  console.log('');

  // ─── C12b: team_chat_messages ─────────────────────────────────────────────
  console.log('── C12b: team_chat_messages ──');

  // Insert test messages for WA via service role
  const tcmInsert = await query('service', 'team_chat_messages', '', 'POST', { user_id: uidA, workspace_id: WA, member_id: 'hook-specialist', role: 'member', content: 'Test message WA' });
  const tcmInsertC = await query('service', 'team_chat_messages', '', 'POST', { user_id: uidC, workspace_id: WB, member_id: 'email-copywriter', role: 'member', content: 'Test message WB' });

  // T-C12b-1: User A (owner of WA) can read WA messages
  const c12bOwn = await query(tokenA, 'team_chat_messages', `?workspace_id=eq.${WA}&select=content`);
  assert('T-C12b-1: User A reads own WA messages', Array.isArray(c12bOwn.data) && c12bOwn.data.length > 0);

  // T-C12b-2: User B (member of WA) can read WA messages
  const c12bMember = await query(tokenB, 'team_chat_messages', `?workspace_id=eq.${WA}&select=content`);
  assert('T-C12b-2: User B (member of WA) reads WA messages', Array.isArray(c12bMember.data) && c12bMember.data.length > 0);

  // T-C12b-3: User C (owner of WB) cannot read WA messages
  const c12bCross = await query(tokenC, 'team_chat_messages', `?workspace_id=eq.${WA}&select=content`);
  assert('T-C12b-3: User C cannot read WA messages', Array.isArray(c12bCross.data) && c12bCross.data.length === 0);

  // T-C12b-4: Anon INSERT blocked
  const c12bInsert = await query(tokenC, 'team_chat_messages', '', 'POST', { user_id: uidC, workspace_id: WA, member_id: 'test', role: 'user', content: 'Injected' });
  assert('T-C12b-4: INSERT blocked for non-WA user', c12bInsert.status === 403 || c12bInsert.status === 401 || (Array.isArray(c12bInsert.data) && c12bInsert.data.length === 0));

  console.log('');

  // ─── C12c: team_member_memories ───────────────────────────────────────────
  console.log('── C12c: team_member_memories ──');

  // Insert test memory for WA via service role
  await query('service', 'team_member_memories', '', 'POST', { user_id: uidA, workspace_id: WA, member_id: 'hook-specialist', memory_type: 'summary', content: 'User A prefers concise output' });

  // T-C12c-1: User A (owner of WA) can read WA memories
  const c12cOwn = await query(tokenA, 'team_member_memories', `?workspace_id=eq.${WA}&select=content`);
  assert('T-C12c-1: User A reads own WA memories', Array.isArray(c12cOwn.data) && c12cOwn.data.length > 0);

  // T-C12c-2: User B (member of WA) can read WA memories
  const c12cMember = await query(tokenB, 'team_member_memories', `?workspace_id=eq.${WA}&select=content`);
  assert('T-C12c-2: User B (member of WA) reads WA memories', Array.isArray(c12cMember.data) && c12cMember.data.length > 0);

  // T-C12c-3: User C (not in WA) cannot read WA memories
  const c12cCross = await query(tokenC, 'team_member_memories', `?workspace_id=eq.${WA}&select=content`);
  assert('T-C12c-3: User C cannot read WA memories', Array.isArray(c12cCross.data) && c12cCross.data.length === 0);

  // T-C12c-4: Anon INSERT blocked
  const c12cInsert = await query(tokenC, 'team_member_memories', '', 'POST', { user_id: uidC, workspace_id: WA, member_id: 'test', memory_type: 'summary', content: 'Injected' });
  assert('T-C12c-4: INSERT blocked for non-WA user', c12cInsert.status === 403 || c12cInsert.status === 401 || (Array.isArray(c12cInsert.data) && c12cInsert.data.length === 0));

  console.log('');

  // ─── C12d: worker_ratings ─────────────────────────────────────────────────
  console.log('── C12d: worker_ratings ──');

  // Insert rating for User A via service role
  const ratingInsert = await query('service', 'worker_ratings', '', 'POST', { user_id: uidA, workspace_id: WA, worker_slug: 'hook-specialist', rating: 5 });

  // T-C12d-1: User A reads own ratings
  const c12dOwn = await query(tokenA, 'worker_ratings', `?user_id=eq.${uidA}&select=rating`);
  assert('T-C12d-1: User A reads own ratings', Array.isArray(c12dOwn.data) && c12dOwn.data.length > 0);

  // T-C12d-2: User C cannot read User A's ratings
  const c12dCross = await query(tokenC, 'worker_ratings', `?user_id=eq.${uidA}&select=rating`);
  assert('T-C12d-2: User C cannot read User A ratings', Array.isArray(c12dCross.data) && c12dCross.data.length === 0);

  // T-C12d-3: Anon INSERT blocked
  const c12dInsert = await query(tokenC, 'worker_ratings', '', 'POST', { user_id: uidC, workspace_id: WA, worker_slug: 'test', rating: 5 });
  assert('T-C12d-3: INSERT blocked', c12dInsert.status === 403 || c12dInsert.status === 401 || (Array.isArray(c12dInsert.data) && c12dInsert.data.length === 0));

  // T-C12d-4: Anon UPDATE blocked
  const c12dUpdate = await query(tokenC, 'worker_ratings', `?user_id=eq.${uidA}`, 'PATCH', { rating: 1 });
  assert('T-C12d-4: UPDATE blocked', c12dUpdate.status === 403 || c12dUpdate.status === 401 || (Array.isArray(c12dUpdate.data) && c12dUpdate.data.length === 0));

  // T-C12d-5: Service role write works (already tested above via ratingInsert)
  assert('T-C12d-5: Service role INSERT succeeded', ratingInsert.status === 201 || ratingInsert.status === 200 || (Array.isArray(ratingInsert.data) && ratingInsert.data.length > 0));

  console.log('');

  // ─── C12e: pinned_workers ─────────────────────────────────────────────────
  console.log('── C12e: pinned_workers ──');

  // Insert pin for User A via service role
  // DELETE first to avoid dupe key on repeated runs, then INSERT
  await query('service', 'pinned_workers', '?user_id=eq.' + uidA + '&worker_slug=eq.hook-specialist', 'DELETE');
  const pinInsert = await query('service', 'pinned_workers', '', 'POST', { user_id: uidA, workspace_id: WA, worker_slug: 'hook-specialist', pinned_at: new Date().toISOString() });

  // T-C12e-1: User A reads own pins
  const c12eOwn = await query(tokenA, 'pinned_workers', `?user_id=eq.${uidA}&select=worker_slug`);
  assert('T-C12e-1: User A reads own pins', Array.isArray(c12eOwn.data) && c12eOwn.data.length > 0);

  // T-C12e-2: User C cannot read User A's pins
  const c12eCross = await query(tokenC, 'pinned_workers', `?user_id=eq.${uidA}&select=worker_slug`);
  assert('T-C12e-2: User C cannot read User A pins', Array.isArray(c12eCross.data) && c12eCross.data.length === 0);

  // T-C12e-3: Anon INSERT blocked
  const c12eInsert = await query(tokenC, 'pinned_workers', '', 'POST', { user_id: uidC, workspace_id: WA, worker_slug: 'test', pinned_at: new Date().toISOString() });
  assert('T-C12e-3: INSERT blocked', c12eInsert.status === 403 || c12eInsert.status === 401 || (Array.isArray(c12eInsert.data) && c12eInsert.data.length === 0));

  // T-C12e-4: Anon DELETE blocked
  const c12eDel = await query(tokenC, 'pinned_workers', `?user_id=eq.${uidA}`, 'DELETE');
  assert('T-C12e-4: DELETE blocked', c12eDel.status === 403 || c12eDel.status === 401 || (Array.isArray(c12eDel.data) && c12eDel.data.length === 0));

  // T-C12e-5: Service role INSERT succeeded
  assert('T-C12e-5: Service role INSERT succeeded', pinInsert.status === 201 || pinInsert.status === 200 || (Array.isArray(pinInsert.data) && pinInsert.data.length > 0));

  console.log('');
  console.log('=== Results ===');
  results.forEach(r => console.log(r));
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
