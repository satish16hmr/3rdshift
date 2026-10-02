/**
 * Phase 1 Cleanup Script
 * 1.1 Delete all team_updates rows
 * 1.2 Delete all proactive chat messages (💡 prefix)
 * 1.5 Fix test account plans
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getUserId(email) {
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const u = users?.find(u => u.email === email);
  if (u) return u.id;
  const { data } = await supabase.from('profiles').select('id').eq('email', email).single();
  return data?.id || null;
}

async function main() {
  console.log('=== PHASE 1 CLEANUP ===\n');

  // 1.1 Delete ALL team_updates rows
  console.log('1.1 Deleting all team_updates rows...');
  const { error: del1, count: del1count } = await supabase
    .from('team_updates')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // match all
  if (del1) console.error('  Error:', del1.message);
  else console.log('  Deleted. Verifying...');

  const { count: remaining1 } = await supabase
    .from('team_updates')
    .select('id', { count: 'exact', head: true });
  console.log(`  team_updates rows remaining: ${remaining1}`);

  // 1.2 Delete all proactive chat messages (💡 prefix)
  console.log('\n1.2 Deleting all proactive chat messages (💡 prefix)...');
  const { error: del2 } = await supabase
    .from('team_chat_messages')
    .delete()
    .like('content', '💡%');
  if (del2) console.error('  Error:', del2.message);
  else console.log('  Deleted all 💡 prefixed messages');

  const { count: remaining2 } = await supabase
    .from('team_chat_messages')
    .select('id', { count: 'exact', head: true })
    .like('content', '💡%');
  console.log(`  Remaining proactive messages: ${remaining2}`);

  // 1.5 Fix test account plans
  console.log('\n1.5 Checking and fixing test account plans...');
  const operatorId = await getUserId('test-roger@3rdshift.ai');
  const starterId = await getUserId('test-starter@3rdshift.ai');
  console.log(`  Operator ID: ${operatorId}`);
  console.log(`  Starter ID:  ${starterId}`);

  if (operatorId) {
    const { data: opProf } = await supabase
      .from('profiles')
      .select('id, email, plan, team_updates_activated, team_updates_settings')
      .eq('id', operatorId)
      .single();
    console.log('\n  Operator profile:', JSON.stringify(opProf, null, 2));
    if (opProf?.plan !== 'operator') {
      await supabase.from('profiles').update({ plan: 'operator' }).eq('id', operatorId);
      console.log('  Fixed operator plan → operator');
    }
  }

  if (starterId) {
    const { data: stProf } = await supabase
      .from('profiles')
      .select('id, email, plan, team_updates_activated, team_updates_settings')
      .eq('id', starterId)
      .single();
    console.log('\n  Starter profile:', JSON.stringify(stProf, null, 2));
    if (stProf?.plan !== 'starter') {
      await supabase.from('profiles').update({ plan: 'starter' }).eq('id', starterId);
      console.log('  Fixed starter plan → starter');
    }
  }

  // Final counts
  console.log('\n=== FINAL STATE ===');
  const { count: finalTU } = await supabase.from('team_updates').select('id', { count: 'exact', head: true });
  const { count: finalChat } = await supabase.from('team_chat_messages').select('id', { count: 'exact', head: true }).like('content', '💡%');
  console.log(`team_updates rows: ${finalTU}`);
  console.log(`proactive chat messages: ${finalChat}`);

  // Show final profiles
  const { data: opFinal } = await supabase.from('profiles').select('id, email, plan, team_updates_activated').eq('id', operatorId).single();
  const { data: stFinal } = await supabase.from('profiles').select('id, email, plan, team_updates_activated').eq('id', starterId).single();
  console.log('\nOperator final:', JSON.stringify(opFinal));
  console.log('Starter final: ', JSON.stringify(stFinal));
}

main().catch(console.error);
