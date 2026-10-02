-- Phase 3 Component 3: Refund and dispute event log
-- Records Stripe charge.refunded, charge.dispute.created, charge.dispute.closed

CREATE TABLE IF NOT EXISTS refund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_event_id TEXT,
  event_type TEXT NOT NULL,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'usd',
  reason TEXT,
  action_taken TEXT,
  -- action_taken values: 'plan_downgraded' | 'credits_deducted' | 'dispute_flagged'
  --                      | 'dispute_resolved' | 'no_action'
  occurred_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE refund_events ENABLE ROW LEVEL SECURITY;
-- No user-context policies — service-role-only

CREATE INDEX IF NOT EXISTS idx_refund_events_user ON refund_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_events_charge ON refund_events(stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

-- Phase 3 Component 3: Add dispute_pending flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dispute_pending BOOLEAN DEFAULT false;
