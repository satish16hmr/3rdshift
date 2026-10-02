-- Adds explicit post-payment onboarding completion tracking.
-- New signups must complete onboarding before entering the dashboard.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
