export const PLAN_CHANGE_ORDER = {
  starter: 0,
  pro: 1,
  operator: 2,
} as const;

export type PlanChangePlan = keyof typeof PLAN_CHANGE_ORDER;
export type PlanChangeCycle = 'monthly' | 'annual';

export type StripePlanPriceCatalog = Record<
  PlanChangePlan,
  {
    monthly: { priceId: string };
    annual: { priceId: string };
  }
>;

export function isPlanChangePlan(value: unknown): value is PlanChangePlan {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLAN_CHANGE_ORDER, value);
}

export function isPlanChangeCycle(value: unknown): value is PlanChangeCycle {
  return value === 'monthly' || value === 'annual';
}

export function resolvePlanChangeTarget(params: {
  stripePlans: StripePlanPriceCatalog;
  currentPlan: string | null | undefined;
  targetPlan: unknown;
  targetCycle: unknown;
}):
  | { ok: true; targetPlan: PlanChangePlan; targetCycle: PlanChangeCycle; newPriceId: string; isUpgrade: boolean; isDowngrade: boolean }
  | { ok: false; error: string; status: number } {
  if (!isPlanChangePlan(params.targetPlan)) {
    return { ok: false, error: 'Invalid plan', status: 400 };
  }

  if (!isPlanChangeCycle(params.targetCycle)) {
    return { ok: false, error: 'Invalid billing cycle', status: 400 };
  }

  if (!isPlanChangePlan(params.currentPlan)) {
    return { ok: false, error: 'Invalid current plan', status: 400 };
  }

  const newPriceId = params.stripePlans[params.targetPlan][params.targetCycle].priceId;
  if (!newPriceId) {
    return { ok: false, error: 'Price not configured for this plan', status: 503 };
  }

  const isUpgrade = PLAN_CHANGE_ORDER[params.targetPlan] > PLAN_CHANGE_ORDER[params.currentPlan];
  const isDowngrade = PLAN_CHANGE_ORDER[params.targetPlan] < PLAN_CHANGE_ORDER[params.currentPlan];

  if (!isUpgrade && !isDowngrade) {
    return { ok: false, error: 'Same plan', status: 400 };
  }

  return {
    ok: true,
    targetPlan: params.targetPlan,
    targetCycle: params.targetCycle,
    newPriceId,
    isUpgrade,
    isDowngrade,
  };
}

export function buildPlanUpgradeParams(params: {
  subscriptionItemId: string;
  newPriceId: string;
}): URLSearchParams {
  return new URLSearchParams({
    'items[0][id]': params.subscriptionItemId,
    'items[0][price]': params.newPriceId,
    proration_behavior: 'always_invoice',
    payment_behavior: 'error_if_incomplete',
  });
}

export function buildPlanDowngradeScheduleParams(params: {
  currentPhase: { start_date: number; end_date?: number | null; items: Array<{ price: string }> };
  currentPeriodEnd: number;
  newPriceId: string;
}): Record<string, string> {
  const phaseEnd = params.currentPhase.end_date || params.currentPeriodEnd;

  return {
    'phases[0][start_date]': String(params.currentPhase.start_date),
    'phases[0][end_date]': String(phaseEnd),
    'phases[0][items][0][price]': params.currentPhase.items[0].price,
    'phases[0][items][0][quantity]': '1',
    'phases[1][start_date]': String(phaseEnd),
    'phases[1][items][0][price]': params.newPriceId,
    'phases[1][items][0][quantity]': '1',
    'phases[1][iterations]': '1',
    end_behavior: 'release',
  };
}
