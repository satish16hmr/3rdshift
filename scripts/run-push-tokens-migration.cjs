/**
 * Directly run the push_tokens migration via Supabase admin
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Check if push_tokens already exists
  const { data: existing } = await supabase
    .from('push_tokens')
    .select('id')
    .limit(1);

  if (existing !== null) {
    console.log('✅ push_tokens table already exists');
    return;
  }

  console.log('Creating push_tokens table via Supabase...');

  // Use the Supabase REST API to run SQL directly
  const sql = `
    CREATE TABLE IF NOT EXISTS push_tokens (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(token)
    );
    CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_workspace ON push_tokens(workspace_id);
    ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "push_tokens_own" ON push_tokens FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  `;

  // Try via rpc
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('RPC error (expected):', error.message);
    console.log('Table needs to be created via Supabase Dashboard SQL editor.');
    console.log('\nSQL to run:\n', sql);
  } else {
    console.log('✅ push_tokens table created');
  }
}
main().catch(console.error);
