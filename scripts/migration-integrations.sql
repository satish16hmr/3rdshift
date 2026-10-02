-- ============================================================
-- Integrations Migration — Run in Supabase SQL Editor
-- April 7, 2026
-- ============================================================

-- 1. Zapier API Keys
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
CREATE POLICY IF NOT EXISTS zapier_api_keys_user ON zapier_api_keys FOR ALL USING (auth.uid() = user_id);

-- 2. Zapier Webhook Subscriptions
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
CREATE POLICY IF NOT EXISTS zapier_hooks_user ON zapier_webhook_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 3. Notion Tokens
CREATE TABLE IF NOT EXISTS notion_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  workspace_id text,
  workspace_name text,
  bot_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notion_tokens_user_id_idx ON notion_tokens(user_id);
ALTER TABLE notion_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS notion_tokens_user ON notion_tokens FOR ALL USING (auth.uid() = user_id);

-- 4. WordPress Connections
CREATE TABLE IF NOT EXISTS wordpress_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  site_url text NOT NULL,
  username text NOT NULL,
  app_password text NOT NULL,
  site_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wordpress_connections_user_id_idx ON wordpress_connections(user_id);
ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS wordpress_connections_user ON wordpress_connections FOR ALL USING (auth.uid() = user_id);

-- 5. Buffer Tokens
CREATE TABLE IF NOT EXISTS buffer_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buffer_tokens_user_id_idx ON buffer_tokens(user_id);
ALTER TABLE buffer_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS buffer_tokens_user ON buffer_tokens FOR ALL USING (auth.uid() = user_id);

-- 6. Mailchimp Tokens
CREATE TABLE IF NOT EXISTS mailchimp_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  dc text DEFAULT 'us1',
  login_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mailchimp_tokens_user_id_idx ON mailchimp_tokens(user_id);
ALTER TABLE mailchimp_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS mailchimp_tokens_user ON mailchimp_tokens FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Done. All 6 tables created.
-- ============================================================
