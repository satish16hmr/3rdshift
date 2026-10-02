/**
 * lib/billing/catalog.ts
 *
 * Single source of truth for plan definitions, credit allocations, limits, and pricing.
 * All code that references plan amounts, credits, seats, or limits MUST read from here.
 *
 * Numbers locked by JR on 2026-04-30 (Phase 18):
 *   none     —             0 heavy,    0 light,  1 seat
 *   starter  $29 annual / $39 monthly  0 heavy,  200 light, 1 seat
 *   pro      $79 annual / $99 monthly  50 heavy, 500 light, 1 seat
 *   operator $199 annual / $249 monthly 150 heavy, 1250 light, 2 seats
 *
 * Top-up policy locked: credits never expire (NULL expires_at in credit_topups).
 *
 * Phase 18: uses Record<PlanSlug, BillingCatalogEntry> so TypeScript enforces
 * every plan has every required field and new plans can't ship without defining them.
 */

import type { PlanSlug, BillingCatalogEntry } from './types';

export type { PlanSlug, BillingCatalogEntry } from './types';

function stripePriceEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

export const BILLING_CATALOG: Record<PlanSlug, BillingCatalogEntry> = {
  none: {
    name: 'None',
    heavy_credits: 0,
    light_task_limit: 0,
    seats: 1,
    max_workspaces: 0,
    monthly_price_usd: 0,
    annual_price_usd: 0,
    annual_stripe_id: '',
    monthly_stripe_id: '',
  },
  starter: {
    name: 'Starter',
    heavy_credits: 0,
    light_task_limit: 200,
    seats: 1,
    max_workspaces: 1,
    monthly_price_usd: 39,
    annual_price_usd: 29,   // per month, billed annually ($348/yr)
    annual_stripe_id: stripePriceEnv('STRIPE_PRICE_STARTER_ANNUAL'),
    monthly_stripe_id: stripePriceEnv('STRIPE_PRICE_STARTER_MONTHLY'),
  },
  pro: {
    name: 'Pro',
    heavy_credits: 50,
    light_task_limit: 500,
    seats: 1,
    max_workspaces: 3,
    monthly_price_usd: 99,
    annual_price_usd: 79,   // per month, billed annually ($948/yr)
    annual_stripe_id: stripePriceEnv('STRIPE_PRICE_PRO_ANNUAL'),
    monthly_stripe_id: stripePriceEnv('STRIPE_PRICE_PRO_MONTHLY'),
  },
  operator: {
    name: 'Operator',
    heavy_credits: 150,
    light_task_limit: 1250,
    seats: 2,
    max_workspaces: 10,
    monthly_price_usd: 249,
    annual_price_usd: 199,  // per month, billed annually ($2,388/yr)
    annual_stripe_id: stripePriceEnv('STRIPE_PRICE_OPERATOR_ANNUAL'),
    monthly_stripe_id: stripePriceEnv('STRIPE_PRICE_OPERATOR_MONTHLY'),
  },
};

/** Policy: top-up credits never expire. NULL expires_at in DB = never expires. */
export const TOPUP_POLICY = {
  expires: false,
  expires_copy: 'never expire',
} as const;

/** Returns heavy_credits for a given plan slug. Falls back to 0 for unknown/none. */
export function getPlanHeavyCredits(plan: string): number {
  return (BILLING_CATALOG as Record<string, BillingCatalogEntry>)[plan]?.heavy_credits ?? 0;
}

/** Returns light_task_limit for a given plan slug. Falls back to 0. */
export function getPlanLightTaskLimit(plan: string): number {
  return (BILLING_CATALOG as Record<string, BillingCatalogEntry>)[plan]?.light_task_limit ?? 0;
}

/** Returns monthly price in cents for a given plan + cycle. */
export function getPlanPriceCents(plan: string, cycle: 'monthly' | 'annual'): number {
  const entry = (BILLING_CATALOG as Record<string, BillingCatalogEntry>)[plan];
  if (!entry) return 0;
  return cycle === 'annual' ? entry.annual_price_usd * 100 : entry.monthly_price_usd * 100;
}
