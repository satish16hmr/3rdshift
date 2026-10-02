-- Create founding_members table to track founding member subscriptions
CREATE TABLE IF NOT EXISTS founding_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  email text,
  tier text CHECK (tier IN ('starter', 'pro', 'operator')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  cancelled_at timestamptz
);

-- Index for fast spot count queries
CREATE INDEX IF NOT EXISTS founding_members_active_idx ON founding_members(active);
