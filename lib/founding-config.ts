/**
 * lib/founding-config.ts
 *
 * Founding member program configuration.
 *
 * is_open: controlled by FOUNDING_OPEN env var.
 *   Set FOUNDING_OPEN=false in prod to disable the founding flow entirely.
 *   The /api/founding-checkout route returns 503 when is_open=false.
 *
 * Price IDs: env-driven. If FOUNDING_OPEN=false (launch default), these are
 * not needed and can be left unset. They only matter if founding is re-enabled.
 *
 * Phase 18: switched from hardcoded price IDs to env vars (HIGH-2 fix).
 * Launch default: FOUNDING_OPEN=false in prod.
 */

export const FOUNDING_CONFIG = {
  current_wave: 1,
  wave_cap: 100,
  is_open: process.env.FOUNDING_OPEN === 'true',
  plans: {
    starter: {
      annual_price_id:      process.env.STRIPE_PRICE_FOUNDING_STARTER_ANNUAL?.trim()   ?? null,
      monthly_price_id:     process.env.STRIPE_PRICE_FOUNDING_STARTER_MONTHLY?.trim()  ?? null,
      locked_price_annual:  19,
      locked_price_monthly: 25,
    },
    pro: {
      annual_price_id:      process.env.STRIPE_PRICE_FOUNDING_PRO_ANNUAL?.trim()   ?? null,
      monthly_price_id:     process.env.STRIPE_PRICE_FOUNDING_PRO_MONTHLY?.trim()  ?? null,
      locked_price_annual:  59,
      locked_price_monthly: 75,
    },
    operator: {
      annual_price_id:      process.env.STRIPE_PRICE_FOUNDING_OPERATOR_ANNUAL?.trim()   ?? null,
      monthly_price_id:     process.env.STRIPE_PRICE_FOUNDING_OPERATOR_MONTHLY?.trim()  ?? null,
      locked_price_annual:  199,
      locked_price_monthly: 249,
    },
  },
} as const;

export type FoundingPlan = keyof typeof FOUNDING_CONFIG.plans;
export type FoundingBilling = 'annual' | 'monthly';
export type FoundingConfig = typeof FOUNDING_CONFIG;
