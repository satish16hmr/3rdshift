import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanSlug } from './types';

export const RENEWAL_INVOICE_PAYMENT_EVENTS = new Set([
  // Stripe docs: occurs whenever an invoice payment attempt succeeds.
  // This is the authoritative event for an actual successful renewal payment.
  'invoice.payment_succeeded',
  // Stripe docs: also occurs when a payment attempt succeeds, and additionally
  // when an invoice is marked paid out-of-band. Keep as a fallback for endpoints
  // that emit it; plan_credit_grants makes the paired event a no-op.
  'invoice.paid',
]);

export type StripeInvoiceForRenewalGrant = {
  id?: string;
  billing_reason?: string | null;
  subscription?: string | null;
  parent?: {
    subscription_details?: {
      subscription?: string | null;
    } | null;
  } | null;
  period_start?: number | null;
  period_end?: number | null;
};

export type RenewalGrantParams = {
  userId: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  plan: PlanSlug;
  planCredits: number;
};

export type RenewalGrantResult = {
  granted: boolean;
  balance_after: number | null;
  reason: 'granted' | 'already_granted';
};

export function isRenewalInvoicePaymentEvent(eventType: string, billingReason?: string | null): boolean {
  return RENEWAL_INVOICE_PAYMENT_EVENTS.has(eventType) && billingReason === 'subscription_cycle';
}

export function getInvoiceSubscriptionId(invoice: StripeInvoiceForRenewalGrant): string | null {
  return typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.parent?.subscription_details?.subscription ?? null;
}

export function getInvoicePeriod(invoice: StripeInvoiceForRenewalGrant): { periodStart: string; periodEnd: string } | null {
  if (!invoice.period_start || !invoice.period_end) return null;
  return {
    periodStart: new Date(invoice.period_start * 1000).toISOString(),
    periodEnd: new Date(invoice.period_end * 1000).toISOString(),
  };
}

export async function grantRenewalPlanCredits(
  supabase: SupabaseClient,
  params: RenewalGrantParams
): Promise<RenewalGrantResult> {
  const { userId, subscriptionId, periodStart, periodEnd, plan, planCredits } = params;
  const normalizedPlanCredits = Math.max(planCredits ?? 0, 0);

  const { data: existingGrant, error: existingGrantError } = await supabase
    .from('plan_credit_grants')
    .select('id, granted_credits')
    .eq('user_id', userId)
    .eq('stripe_subscription_id', subscriptionId)
    .eq('stripe_period_start', periodStart)
    .maybeSingle();

  if (existingGrantError) {
    throw new Error(`[renewal-credit-grants] Failed to check existing grant: ${existingGrantError.message}`);
  }

  if (existingGrant) {
    return {
      granted: false,
      balance_after: null,
      reason: 'already_granted',
    };
  }

  const balanceAfter = normalizedPlanCredits;

  // Reset/refresh only the plan bucket. Purchased top-ups remain in
  // credit_topups and are added by debit_credits at spend time.
  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ heavy_credits_remaining: balanceAfter })
    .eq('id', userId);

  if (profileUpdateError) {
    throw new Error(`[renewal-credit-grants] Failed to reset renewal credits: ${profileUpdateError.message}`);
  }

  const { error: insertGrantError } = await supabase
    .from('plan_credit_grants')
    .insert({
      user_id: userId,
      stripe_subscription_id: subscriptionId,
      stripe_period_start: periodStart,
      stripe_period_end: periodEnd,
      plan,
      granted_credits: normalizedPlanCredits,
    });

  if (insertGrantError) {
    if (insertGrantError.code === '23505') {
      return {
        granted: false,
        balance_after: null,
        reason: 'already_granted',
      };
    }
    throw new Error(`[renewal-credit-grants] Failed to record renewal grant: ${insertGrantError.message}`);
  }

  return {
    granted: true,
    balance_after: balanceAfter,
    reason: 'granted',
  };
}
