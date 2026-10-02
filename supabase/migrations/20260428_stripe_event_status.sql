-- Batch 1 / Item 3: Add event processing status to stripe_webhook_events
-- Enables a proper state machine: processing → completed (or retry on stale processing)
-- Previously: no status column — claimed-but-failed events were permanently skipped on retry

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

-- Existing rows are all completed (they were successfully processed before this migration)
-- New rows will be inserted as 'processing' and updated to 'completed' after all side effects

CREATE INDEX IF NOT EXISTS idx_stripe_events_status
  ON stripe_webhook_events (stripe_event_id, status);
