/**
 * lib/stripe/config.ts
 *
 * Stripe plan configuration. Credit amounts and limits are read from
 * lib/billing/catalog.ts — do NOT hardcode them here.
 */

import { BILLING_CATALOG } from '@/lib/billing/catalog';

export const STRIPE_PLANS = {
  starter: {
    name: 'Starter',
    monthly: { priceId: BILLING_CATALOG.starter.monthly_stripe_id, amount: BILLING_CATALOG.starter.monthly_price_usd * 100 },
    annual:  { priceId: BILLING_CATALOG.starter.annual_stripe_id,  amount: BILLING_CATALOG.starter.annual_price_usd * 100 * 12 },
    heavyCredits: BILLING_CATALOG.starter.heavy_credits,
    lightTaskLimit: BILLING_CATALOG.starter.light_task_limit,
  },
  pro: {
    name: 'Pro',
    monthly: { priceId: BILLING_CATALOG.pro.monthly_stripe_id, amount: BILLING_CATALOG.pro.monthly_price_usd * 100 },
    annual:  { priceId: BILLING_CATALOG.pro.annual_stripe_id,  amount: BILLING_CATALOG.pro.annual_price_usd * 100 * 12 },
    heavyCredits: BILLING_CATALOG.pro.heavy_credits,
    lightTaskLimit: BILLING_CATALOG.pro.light_task_limit,
  },
  operator: {
    name: 'Operator',
    monthly: { priceId: BILLING_CATALOG.operator.monthly_stripe_id, amount: BILLING_CATALOG.operator.monthly_price_usd * 100 },
    annual:  { priceId: BILLING_CATALOG.operator.annual_stripe_id,  amount: BILLING_CATALOG.operator.annual_price_usd * 100 * 12 },
    heavyCredits: BILLING_CATALOG.operator.heavy_credits,
    lightTaskLimit: BILLING_CATALOG.operator.light_task_limit,
  },
} as const;

export type PlanSlug = keyof typeof STRIPE_PLANS;

export function getPlanByPriceId(priceId: string): { plan: PlanSlug; cycle: 'monthly' | 'annual' } | null {
  for (const [plan, config] of Object.entries(STRIPE_PLANS)) {
    if (config.monthly.priceId === priceId) return { plan: plan as PlanSlug, cycle: 'monthly' };
    if (config.annual.priceId === priceId) return { plan: plan as PlanSlug, cycle: 'annual' };
  }
  return null;
}
