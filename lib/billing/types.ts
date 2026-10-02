/**
 * lib/billing/types.ts
 *
 * Type definitions for the billing system.
 * PlanSlug and BillingCatalogEntry are the source of truth for plan type safety.
 * All billing code must import from here — not re-declare locally.
 *
 * Phase 18: introduced to make wrong plan slugs uncompilable and enforce
 * that every plan defines every required field.
 */

export type PlanSlug = 'none' | 'starter' | 'pro' | 'operator';

export type BillingCatalogEntry = {
  name: string;
  heavy_credits: number;
  light_task_limit: number;
  seats: number;
  max_workspaces: number;      // max workspaces owner can create on this plan
  monthly_price_usd: number;   // per-month billed monthly (0 for 'none')
  annual_price_usd: number;    // per-month billed annually (0 for 'none')
  annual_stripe_id: string;
  monthly_stripe_id: string;
};

/** Data carried from a Stripe event into applyPlanToWorkspace. */
export type StripePlanData = {
  customer_id: string | null;
  subscription_id: string | null;
  billing_period_start?: Date | null;
  billing_period_end?: Date | null;
  cancel_at_period_end?: boolean;
};

/** Structured result returned by applyPlanToAccount. */
export type PlanTransitionResult = {
  user_id: string;
  new_plan: PlanSlug;
  workspaces_updated: number;
  heavy_credits_set: number;
  integrations_cleared: boolean;
  applied_at: string;
};
