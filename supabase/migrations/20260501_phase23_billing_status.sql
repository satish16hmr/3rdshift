-- Phase 23 Step 2: billing delinquency gate
-- Adds billing_status, billing_delinquent_at, billing_block_reason to profiles.
-- billing_status values: 'active' | 'past_due' | 'canceled'
-- Default 'active' so all existing accounts are unaffected.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_delinquent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_block_reason TEXT;
