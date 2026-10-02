-- Add pending downgrade tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pending_downgrade_plan text,
  ADD COLUMN IF NOT EXISTS pending_downgrade_date timestamptz;
