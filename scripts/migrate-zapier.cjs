/**
 * Zapier Integration DB Migration
 * Creates zapier_api_keys and zapier_webhook_subscriptions tables
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Running Zapier migration...');

  // Create zapier_api_keys table via raw SQL using RPC
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS zapier_api_keys (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        api_key text NOT NULL UNIQUE,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS zapier_api_keys_user_id_idx ON zapier_api_keys(user_id);
      CREATE INDEX IF NOT EXISTS zapier_api_keys_api_key_idx ON zapier_api_keys(api_key);
      ALTER TABLE zapier_api_keys ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS zapier_api_keys_user ON zapier_api_keys;
      CREATE POLICY zapier_api_keys_user ON zapier_api_keys
        FOR ALL USING (auth.uid() = user_id);
    `
  });

  if (e1) {
    // Try direct approach
    console.log('RPC not available, using direct insert test...');
    // Tables may already exist or need Supabase dashboard
  } else {
    console.log('✅ zapier_api_keys table created');
  }

  const { error: e2 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS zapier_webhook_subscriptions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        event text NOT NULL DEFAULT 'task.completed',
        target_url text NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS zapier_hooks_user_id_idx ON zapier_webhook_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS zapier_hooks_event_idx ON zapier_webhook_subscriptions(event);
      ALTER TABLE zapier_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS zapier_hooks_user ON zapier_webhook_subscriptions;
      CREATE POLICY zapier_hooks_user ON zapier_webhook_subscriptions
        FOR ALL USING (auth.uid() = user_id);
    `
  });

  if (e2) {
    console.log('Note: run SQL manually in Supabase dashboard if RPC not available');
  } else {
    console.log('✅ zapier_webhook_subscriptions table created');
  }

  console.log('\nMigration SQL (run in Supabase SQL editor if needed):');
  console.log(`
-- zapier_api_keys
CREATE TABLE IF NOT EXISTS zapier_api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zapier_api_keys_user_id_idx ON zapier_api_keys(user_id);
CREATE INDEX IF NOT EXISTS zapier_api_keys_api_key_idx ON zapier_api_keys(api_key);
ALTER TABLE zapier_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY zapier_api_keys_user ON zapier_api_keys FOR ALL USING (auth.uid() = user_id);

-- zapier_webhook_subscriptions
CREATE TABLE IF NOT EXISTS zapier_webhook_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL DEFAULT 'task.completed',
  target_url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zapier_hooks_user_id_idx ON zapier_webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS zapier_hooks_event_idx ON zapier_webhook_subscriptions(event);
ALTER TABLE zapier_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY zapier_hooks_user ON zapier_webhook_subscriptions FOR ALL USING (auth.uid() = user_id);
  `);
}

run().catch(console.error);
