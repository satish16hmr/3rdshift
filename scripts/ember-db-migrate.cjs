// DB migration: update agent_mode_presets and agent_mode_chains rows
// that contain 'brand-voice-guide-writer' string -> 'image-cleanup'
// Run BEFORE commit.

const { createClient } = require('../node_modules/@supabase/supabase-js');

const supabase = createClient(
  'https://auth.3rdshift.ai',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY
);

function replaceSlug(obj) {
  const str = JSON.stringify(obj);
  const replaced = str.replace(/brand-voice-guide-writer/g, 'image-cleanup');
  return JSON.parse(replaced);
}

async function migrate() {
  console.log('=== EMBER DB MIGRATION ===\n');
  let totalUpdated = 0;

  // agent_mode_presets
  try {
    const { data, error } = await supabase.from('agent_mode_presets').select('*');
    if (error) throw error;
    const matches = (data || []).filter(function(row) { return JSON.stringify(row).includes('brand-voice-guide-writer'); });
    console.log('agent_mode_presets: ' + matches.length + ' rows to update');
    for (const row of matches) {
      const updated = replaceSlug(row);
      const { error: updateErr } = await supabase.from('agent_mode_presets').update(updated).eq('id', row.id);
      if (updateErr) {
        console.log('  ERROR updating row ' + row.id + ': ' + updateErr.message);
      } else {
        console.log('  Updated preset id=' + row.id + ' name="' + row.name + '"');
        totalUpdated++;
      }
    }
  } catch(e) {
    console.log('agent_mode_presets: ERROR - ' + e.message);
  }

  // agent_mode_chains
  try {
    const { data, error } = await supabase.from('agent_mode_chains').select('*');
    if (error) throw error;
    const matches = (data || []).filter(function(row) { return JSON.stringify(row).includes('brand-voice-guide-writer'); });
    console.log('agent_mode_chains: ' + matches.length + ' rows to update');
    for (const row of matches) {
      const updated = replaceSlug(row);
      const { error: updateErr } = await supabase.from('agent_mode_chains').update(updated).eq('id', row.id);
      if (updateErr) {
        console.log('  ERROR updating row ' + row.id + ': ' + updateErr.message);
      } else {
        console.log('  Updated chain id=' + row.id + ' name="' + row.name + '"');
        totalUpdated++;
      }
    }
  } catch(e) {
    console.log('agent_mode_chains: ERROR - ' + e.message);
  }

  console.log('\nTotal rows updated: ' + totalUpdated);

  // Verification pass
  console.log('\n=== VERIFICATION ===\n');
  const tables = ['agent_mode_presets', 'agent_mode_chains'];
  for (const table of tables) {
    try {
      const { data } = await supabase.from(table).select('*');
      const remaining = (data || []).filter(function(row) { return JSON.stringify(row).includes('brand-voice-guide-writer'); });
      console.log(table + ': remaining brand-voice-guide-writer refs=' + remaining.length + (remaining.length === 0 ? ' ✓ CLEAN' : ' ✗ NEEDS REVIEW'));
    } catch(e) {
      console.log(table + ': ERROR - ' + e.message);
    }
  }
}

migrate().catch(console.error);
