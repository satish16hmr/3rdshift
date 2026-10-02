/**
 * Create push_tokens table directly via Supabase REST API
 */
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });
  const text = await res.text();
  console.log('Status:', res.status, 'Body:', text.slice(0, 200));
}

async function main() {
  // First check if table exists
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/push_tokens?select=id&limit=1`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  
  if (checkRes.status === 200) {
    console.log('✅ push_tokens table already exists');
    return;
  }
  
  console.log('Table does not exist (status:', checkRes.status, ') — need to create via migration');
  
  // Run via migration API
  const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '').replace('https://auth.3rdshift.ai', '');
  console.log('Project ref extraction attempted:', projectRef);
  
  // Since we can't easily get the project ref from the custom domain,
  // let's try the Postgres connection directly
  console.log('\nSQL that needs to run in Supabase Dashboard > SQL Editor:');
  console.log(`
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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'push_tokens_own' AND tablename = 'push_tokens') THEN
    CREATE POLICY "push_tokens_own" ON push_tokens FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
  `);
}
main().catch(console.error);
