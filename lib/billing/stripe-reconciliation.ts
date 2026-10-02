import { getPlanByPriceId } from '@/lib/stripe/config';
import { FOUNDING_CONFIG } from '@/lib/founding-config';
import type Stripe from 'stripe';

export type ReconciliationProfile = {
  id: string;
  email: string | null;
  plan: string | null;
  billing_status?: string | null;
  billing_cycle?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  internal_grant?: boolean | null;
  created_at?: string | null;
};

export type StripeSubscriptionSnapshot = {
  id: string;
  status: string | null;
  customer: string | null;
  price_id: string | null;
  amount: number | null;
  interval: string | null;
  resolved_plan: string | null;
  resolved_cycle: string | null;
  cancel_at_period_end?: boolean | null;
};

export type ReconciliationEntry = {
  id: string;
  email: string | null;
  plan: string | null;
  billing_status?: string | null;
  billing_cycle?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  internal_grant: boolean;
  created_at?: string | null;
  stripe?: StripeSubscriptionSnapshot;
  reason?: string;
};

export type ReconciliationReport = {
  generated_at: string;
  verified: ReconciliationEntry[];
  orphaned: ReconciliationEntry[];
  mismatched: ReconciliationEntry[];
  internal_grants: ReconciliationEntry[];
  errors: ReconciliationEntry[];
  summary: {
    total_checked: number;
    verified: number;
    orphaned: number;
    mismatched: number;
    internal_grants: number;
    errors: number;
  };
};

export function resolvePlanFromStripePrice(priceId: string | null | undefined): { plan: string; cycle: string } | null {
  if (!priceId) return null;

  const regular = getPlanByPriceId(priceId);
  if (regular) return regular;

  for (const [plan, config] of Object.entries(FOUNDING_CONFIG.plans)) {
    if (config.monthly_price_id === priceId) return { plan, cycle: 'monthly' };
    if (config.annual_price_id === priceId) return { plan, cycle: 'annual' };
  }

  return null;
}

function normalizeCustomerId(customer: unknown): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  if (typeof customer === 'object' && 'id' in customer && typeof (customer as { id?: unknown }).id === 'string') {
    return (customer as { id: string }).id;
  }
  return null;
}

function toSnapshot(subscription: Stripe.Subscription): StripeSubscriptionSnapshot {
  const item = subscription?.items?.data?.[0];
  const price = item?.price;
  const resolved = resolvePlanFromStripePrice(price?.id ?? null);

  return {
    id: subscription?.id ?? '',
    status: subscription?.status ?? null,
    customer: normalizeCustomerId(subscription?.customer),
    price_id: price?.id ?? null,
    amount: typeof price?.unit_amount === 'number' ? price.unit_amount : null,
    interval: price?.recurring?.interval ?? null,
    resolved_plan: resolved?.plan ?? null,
    resolved_cycle: resolved?.cycle ?? null,
    cancel_at_period_end: subscription?.cancel_at_period_end ?? null,
  };
}

async function stripeGet(path: string): Promise<{ ok: true; data: Stripe.Subscription } | { ok: false; status: number; code?: string; message: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, status: 500, code: 'missing_stripe_secret', message: 'STRIPE_SECRET_KEY is not configured' };
  }

  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Stripe-Version': '2026-02-25.clover',
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error ?? {};
    return {
      ok: false,
      status: response.status,
      code: error.code,
      message: error.message || `Stripe request failed with ${response.status}`,
    };
  }

  return { ok: true, data };
}

export async function reconcileProfilesWithStripe(profiles: ReconciliationProfile[]): Promise<ReconciliationReport> {
  const verified: ReconciliationEntry[] = [];
  const orphaned: ReconciliationEntry[] = [];
  const mismatched: ReconciliationEntry[] = [];
  const internal_grants: ReconciliationEntry[] = [];
  const errors: ReconciliationEntry[] = [];

  for (const profile of profiles) {
    const base: ReconciliationEntry = {
      id: profile.id,
      email: profile.email ?? null,
      plan: profile.plan ?? null,
      billing_status: profile.billing_status ?? null,
      billing_cycle: profile.billing_cycle ?? null,
      stripe_customer_id: profile.stripe_customer_id ?? null,
      stripe_subscription_id: profile.stripe_subscription_id ?? null,
      internal_grant: Boolean(profile.internal_grant),
      created_at: profile.created_at ?? null,
    };

    if (base.internal_grant) {
      internal_grants.push({ ...base, reason: 'internal_grant=true' });
      continue;
    }

    const subscriptionId = base.stripe_subscription_id;
    if (!subscriptionId || !subscriptionId.startsWith('sub_') || subscriptionId.includes('test')) {
      orphaned.push({ ...base, reason: subscriptionId ? 'missing_or_fake_subscription_id' : 'missing_subscription_id' });
      continue;
    }

    const subResult = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (!subResult.ok) {
      if (subResult.status === 404 || subResult.code === 'resource_missing') {
        orphaned.push({ ...base, reason: 'stripe_subscription_missing' });
      } else {
        errors.push({ ...base, reason: `${subResult.code ?? 'stripe_error'}: ${subResult.message}` });
      }
      continue;
    }

    const stripe = toSnapshot(subResult.data);
    const active = stripe.status === 'active' || stripe.status === 'trialing';
    const paid = typeof stripe.amount === 'number' && stripe.amount > 0;
    const planMatches = Boolean(stripe.resolved_plan) && stripe.resolved_plan === base.plan;
    const customerMatches = !base.stripe_customer_id || !stripe.customer || stripe.customer === base.stripe_customer_id;

    if (active && paid && planMatches && customerMatches) {
      verified.push({ ...base, stripe, reason: 'stripe_subscription_active_paid' });
      continue;
    }

    const reasons: string[] = [];
    if (!active) reasons.push(`stripe_status_${stripe.status ?? 'unknown'}`);
    if (!paid) reasons.push('stripe_price_not_paid');
    if (!stripe.resolved_plan) reasons.push('unknown_stripe_price_id');
    if (!planMatches && stripe.resolved_plan) reasons.push(`plan_mismatch_db_${base.plan}_stripe_${stripe.resolved_plan}`);
    if (!customerMatches) reasons.push(`customer_mismatch_db_${base.stripe_customer_id}_stripe_${stripe.customer}`);

    mismatched.push({ ...base, stripe, reason: reasons.join(';') || 'mismatch' });
  }

  return {
    generated_at: new Date().toISOString(),
    verified,
    orphaned,
    mismatched,
    internal_grants,
    errors,
    summary: {
      total_checked: profiles.length,
      verified: verified.length,
      orphaned: orphaned.length,
      mismatched: mismatched.length,
      internal_grants: internal_grants.length,
      errors: errors.length,
    },
  };
}

export function isReconciledForBillingMaintenance(entry: ReconciliationEntry): boolean {
  return entry.internal_grant || Boolean(entry.stripe && (entry.stripe.status === 'active' || entry.stripe.status === 'trialing'));
}
