const { createClient } = require('../node_modules/@supabase/supabase-js');

const supabase = createClient(
  'https://auth.3rdshift.ai',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY
);

async function check() {
  console.log('=== EMBER DB COUNTS (BEFORE MIGRATION) ===\n');
  
  const tables = ['tasks', 'team_chat_messages', 'team_member_memories', 'worker_ratings', 'pinned_workers', 'task_results'];
  
  for (const table of tables) {
    try {
      const r1 = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('worker_slug', 'brand-voice-guide-writer');
      const r2 = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('worker_slug', 'image-cleanup');
      const old = r1.count ?? 0;
      const neu = r2.count ?? 0;
      console.log(table + ': brand-voice-guide-writer=' + old + ' | image-cleanup=' + neu + ' | sum=' + (old + neu));
    } catch(e) {
      console.log(table + ': ERROR - ' + e.message);
    }
  }
  
  console.log('\n=== PRESET/CHAIN/PLAYBOOK TABLES ===\n');
  
  const jsonTables = ['agent_mode_presets', 'agent_mode_chains', 'custom_playbooks', 'user_preferences'];
  for (const table of jsonTables) {
    try {
      const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' });
      if (error) {
        console.log(table + ': TABLE_NOT_FOUND or ERROR - ' + error.message);
        continue;
      }
      const matching = (data || []).filter(function(row) { return JSON.stringify(row).includes('brand-voice-guide-writer'); });
      console.log(table + ': total_rows=' + (count ?? 0) + ' | rows_containing_slug=' + matching.length);
      if (matching.length > 0) {
        matching.forEach(function(r) { console.log('  -> id=' + r.id + ' | ' + JSON.stringify(r).substring(0, 120)); });
      }
    } catch(e) {
      console.log(table + ': ERROR - ' + e.message);
    }
  }
}

check().catch(console.error);
