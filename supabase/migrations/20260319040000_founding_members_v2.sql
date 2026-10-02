-- Drop and recreate founding_members to match the brief schema exactly
DROP TABLE IF EXISTS founding_members;

CREATE TABLE founding_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  wave INTEGER NOT NULL DEFAULT 1,
  locked_price INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_founding_wave ON founding_members(wave);

-- Profile columns for founding member status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_founding_member BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS founding_tier TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS founding_wave INTEGER;
