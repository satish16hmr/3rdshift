const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data, error } = await supabase
    .from('team_updates')
    .select('id, workspace_id, user_id, worker_slug, suggestion_type, suggestion_text, preview_text, source_data, chat_message_id, read, dismissed, created_at')
    .limit(1);
  
  if (error) {
    console.error('ERROR team_updates:', error.message);
  } else {
    console.log('✅ team_updates table exists, columns verified, rows:', data.length);
  }

  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('team_updates_settings, team_updates_activated, team_updates_activated_at')
    .limit(1);

  if (profErr) {
    console.error('ERROR profiles:', profErr.message);
  } else {
    console.log('✅ profiles team_updates columns exist');
    console.log('   Default settings:', JSON.stringify(prof[0]?.team_updates_settings));
  }
}
main();
