/**
 * Test script: manually activate and test proactive updates pipeline
 * for test-roger@3rdshift.ai (Operator) and test-starter@3rdshift.ai (Starter)
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
const BASE_URL = 'https://3rdshift.ai';

async function manuallyActivate(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({
      team_updates_activated: true,
      team_updates_activated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) console.error('activate error:', error.message);
  else console.log(`✅ Activated user ${userId}`);
}

async function getUserId(email) {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find(u => u.email === email);
  return user?.id;
}

async function getCompletedTaskCount(workspaceId) {
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'complete');
  return count || 0;
}

async function getWorkspace(userId) {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .single();
  return data;
}

async function triggerCron(path) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n🔄 Triggering ${path}...`);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${INTERNAL_SECRET}` },
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  try { console.log('Response:', JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log('Response:', text.slice(0, 500)); }
}

async function checkTeamUpdates(userId) {
  const { data, error } = await supabase
    .from('team_updates')
    .select('id, worker_slug, suggestion_type, preview_text, read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) console.error('team_updates fetch error:', error.message);
  else {
    console.log(`\n📋 team_updates for user ${userId}: ${data.length} rows`);
    data.forEach(u => console.log(`  - [${u.worker_slug}] ${u.suggestion_type}: "${u.preview_text?.slice(0, 80)}…"`));
  }
  return data || [];
}

async function main() {
  console.log('=== Proactive Team Updates Test ===\n');
  
  // Get test account IDs
  const operatorId = await getUserId('test-roger@3rdshift.ai');
  const starterId = await getUserId('test-starter@3rdshift.ai');
  
  console.log('Operator user ID:', operatorId);
  console.log('Starter user ID:', starterId);

  if (!operatorId) {
    console.error('Could not find test-roger@3rdshift.ai');
    return;
  }

  // Check existing tasks
  const operatorWs = await getWorkspace(operatorId);
  const starterWs = starterId ? await getWorkspace(starterId) : null;
  
  if (operatorWs) {
    const taskCount = await getCompletedTaskCount(operatorWs.id);
    console.log(`Operator completed tasks: ${taskCount}`);
  }
  if (starterWs) {
    const taskCount = await getCompletedTaskCount(starterWs.id);
    console.log(`Starter completed tasks: ${taskCount}`);
  }

  // Manually activate both test accounts
  if (operatorId) await manuallyActivate(operatorId);
  if (starterId) await manuallyActivate(starterId);

  // Clear any existing today's suggestions (to test idempotency later)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  await supabase
    .from('team_updates')
    .delete()
    .eq('user_id', operatorId)
    .gte('created_at', todayStart.toISOString());

  console.log('\n✅ Cleared today\'s suggestions for fresh test');

  // Trigger the proactive cron
  await triggerCron('/api/cron/proactive-updates');

  // Give it 2 seconds for async ops
  await new Promise(r => setTimeout(r, 2000));

  // Check results
  if (operatorId) await checkTeamUpdates(operatorId);
  if (starterId) await checkTeamUpdates(starterId);

  // Test idempotency: trigger again — should see 0 new suggestions
  console.log('\n🔄 Testing idempotency (second trigger)...');
  await triggerCron('/api/cron/proactive-updates');
  if (operatorId) {
    const updates = await checkTeamUpdates(operatorId);
    const todayCount = updates.filter(u => new Date(u.created_at) >= todayStart).length;
    console.log(`\nIdempotency check: ${todayCount} suggestions today (should be same as before)`);
  }
}

main().catch(console.error);
