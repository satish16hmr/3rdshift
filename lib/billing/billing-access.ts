/**
 * lib/billing/billing-access.ts
 *
 * Phase 23 Step 2 — Billing delinquency gate.
 *
 * enforceBillingAccess() checks that a user has an active subscription AND
 * is not past_due before allowing consumption of any state-mutating surface.
 *
 * Called in:
 *   - app/api/tasks/create/route.ts
 *   - app/api/agent-mode/chains/[id]/run/route.ts
 *   - app/api/workspace/invite/route.ts
 *   - app/api/topup-checkout/route.ts
 *
 * Returns HTTP 402 (Payment Required) when billing_status != 'active'.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BillingAccessResult {
  blocked: boolean;
  code?: 'subscription_required' | 'billing_past_due';
}

export async function enforceBillingAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<BillingAccessResult> {
  const { data } = await supabase
    .from('profiles')
    .select('plan, billing_status')
    .eq('id', userId)
    .single();

  if (!data || data.plan === 'none') {
    return { blocked: true, code: 'subscription_required' };
  }

  if (data.billing_status && data.billing_status !== 'active') {
    return { blocked: true, code: 'billing_past_due' };
  }

  return { blocked: false };
}
