-- Adds an explicit report-only exemption flag for internal/manual paid-plan grants.
-- Do not set this flag automatically. Account owners must approve specific rows first.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS internal_grant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS internal_grant_reason text,
  ADD COLUMN IF NOT EXISTS internal_grant_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_grant_marked_by uuid;

COMMENT ON COLUMN public.profiles.internal_grant IS
  'Explicit owner-approved internal/manual grant. Excludes account from Stripe reconciliation alarms and reset-credit Stripe verification guard.';
COMMENT ON COLUMN public.profiles.internal_grant_reason IS
  'Human-readable reason for internal_grant=true. Do not store secrets.';
COMMENT ON COLUMN public.profiles.internal_grant_marked_at IS
  'Timestamp when internal_grant was approved/marked.';
COMMENT ON COLUMN public.profiles.internal_grant_marked_by IS
  'Admin user id that marked internal_grant, when available.';

CREATE INDEX IF NOT EXISTS profiles_internal_grant_idx
  ON public.profiles (internal_grant)
  WHERE internal_grant = true;
