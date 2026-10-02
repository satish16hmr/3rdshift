-- Phase 23 Step 3: cycle-aware credit grants ledger
-- Prevents re-granting credits on plan cycling within the same billing period.
-- Unique constraint on (user_id, stripe_subscription_id, stripe_period_start) ensures
-- only one grant row per user per billing period — upserts are idempotent.

CREATE TABLE IF NOT EXISTS plan_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  stripe_subscription_id TEXT,
  stripe_period_start TIMESTAMPTZ NOT NULL,
  stripe_period_end TIMESTAMPTZ NOT NULL,
  plan TEXT NOT NULL,
  granted_credits INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, stripe_subscription_id, stripe_period_start)
);

-- add_heavy_credits: atomic increment of heavy_credits_remaining on profiles.
-- Used by cycle-aware grant logic to apply only the delta for the current period.
CREATE OR REPLACE FUNCTION add_heavy_credits(p_user_id UUID, p_amount INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET heavy_credits_remaining = heavy_credits_remaining + p_amount
  WHERE id = p_user_id;
END;
$$;
