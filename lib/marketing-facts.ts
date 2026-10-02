import { BILLING_CATALOG } from '@/lib/billing/catalog'

export const PUBLIC_WORKER_COUNT = '70+'
export const STARTER_WORKER_COUNT = 40
export const CATEGORY_COUNT = 14

export const FOUNDING_ANCHORS = {
  starter: 59,
  pro: 159,
  operator: 399,
} as const

export const PLAN_PRICE_COPY = {
  starter: {
    monthly: BILLING_CATALOG.starter.monthly_price_usd,
    annualMonthly: BILLING_CATALOG.starter.annual_price_usd,
    annualTotal: BILLING_CATALOG.starter.annual_price_usd * 12,
    annualSavings: (BILLING_CATALOG.starter.monthly_price_usd - BILLING_CATALOG.starter.annual_price_usd) * 12,
    annualSavingsPercent: Math.round((1 - BILLING_CATALOG.starter.annual_price_usd / BILLING_CATALOG.starter.monthly_price_usd) * 100),
  },
  pro: {
    monthly: BILLING_CATALOG.pro.monthly_price_usd,
    annualMonthly: BILLING_CATALOG.pro.annual_price_usd,
    annualTotal: BILLING_CATALOG.pro.annual_price_usd * 12,
    annualSavings: (BILLING_CATALOG.pro.monthly_price_usd - BILLING_CATALOG.pro.annual_price_usd) * 12,
    annualSavingsPercent: Math.round((1 - BILLING_CATALOG.pro.annual_price_usd / BILLING_CATALOG.pro.monthly_price_usd) * 100),
  },
  operator: {
    monthly: BILLING_CATALOG.operator.monthly_price_usd,
    annualMonthly: BILLING_CATALOG.operator.annual_price_usd,
    annualTotal: BILLING_CATALOG.operator.annual_price_usd * 12,
    annualSavings: (BILLING_CATALOG.operator.monthly_price_usd - BILLING_CATALOG.operator.annual_price_usd) * 12,
    annualSavingsPercent: Math.round((1 - BILLING_CATALOG.operator.annual_price_usd / BILLING_CATALOG.operator.monthly_price_usd) * 100),
  },
} as const

export const formatPlanAnnualBilling = (plan: keyof typeof PLAN_PRICE_COPY) =>
  `Billed annually ($${PLAN_PRICE_COPY[plan].annualTotal}/yr)`
