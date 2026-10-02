-- Phase 3 Component 4: Plan transition audit log
-- Records every plan change with who, when, why, and from/to

CREATE TABLE IF NOT EXISTS plan_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID,
  from_plan TEXT,
  to_plan TEXT NOT NULL,
  reason TEXT NOT NULL,
  -- reason values: 'user_initiated' | 'webhook_checkout' | 'webhook_subscription_updated'
  --               | 'webhook_subscription_deleted' | 'refund' | 'dispute' | 'cancellation'
  --               | 'admin_override'
  initiated_by UUID,           -- userId if user-initiated; null for webhook/system
  stripe_subscription_id TEXT,
  stripe_event_id TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_transitions ENABLE ROW LEVEL SECURITY;
-- No user-context policies — service-role-only

CREATE INDEX IF NOT EXISTS idx_plan_transitions_user ON plan_transitions(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_transitions_event ON plan_transitions(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;
