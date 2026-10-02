-- 7-day money-back guarantee support (internal fair-use gates)
-- Customer-facing terms stay in app copy; thresholds remain admin-only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_purchase_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_purchase_stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS first_purchase_stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS first_purchase_stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS guarantee_heavy_cap_lifted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guarantee_heavy_cap_lifted_by UUID,
  ADD COLUMN IF NOT EXISTS guarantee_heavy_cap_lift_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_first_purchase_at
  ON public.profiles(first_purchase_at)
  WHERE first_purchase_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created_debits
  ON public.credit_transactions(user_id, created_at)
  WHERE amount > 0;

CREATE INDEX IF NOT EXISTS idx_tasks_user_type_created_status
  ON public.tasks(user_id, task_type, created_at, status);

ALTER TABLE public.refund_events
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
