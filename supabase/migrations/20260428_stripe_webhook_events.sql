-- Phase 3 Component 1: Stripe webhook idempotency
-- Prevents duplicate event processing on Stripe retries

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  payload JSONB
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No user-context policies — service-role-only

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_events_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_webhook_events(event_type, processed_at DESC);
-- Optional session_id column for efficient topup-status polling (Component 7)
ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_stripe_events_session ON stripe_webhook_events(session_id) WHERE session_id IS NOT NULL;
