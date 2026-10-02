/**
 * Run SQL against Supabase via management API
 * Requires SUPABASE_ACCESS_TOKEN (personal access token from supabase.com)
 */
require('dotenv').config({ path: '.env.local' });

const PROJECT_REF = 'ytqflszzzkkriqhyrroy';
const ACCESS_TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY; // We'll try service role

// Try via the pg REST API which supports raw SQL when using service role
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SQL = `
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
`;

async function main() {
  // Try Supabase Management API
  console.log('Attempting Supabase Management API...');
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });
  const body = await res.text();
  console.log('Management API status:', res.status);
  console.log('Body:', body.slice(0, 300));
}
main().catch(console.error);
