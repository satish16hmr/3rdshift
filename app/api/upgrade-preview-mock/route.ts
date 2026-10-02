import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Mock proration data for UI testing without a real Stripe subscription.
// Accepts currentPlan + currentCycle from query params so it reflects the actual user's plan.

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, operator: 2 };

const MOCK_PRICE_IDS: Record<string, Record<string, string>> = {
  starter: { monthly: 'price_mock_starter_monthly', annual: 'price_mock_starter_annual' },
  pro: { monthly: 'price_mock_pro_monthly', annual: 'price_mock_pro_annual' },
  operator: { monthly: 'price_mock_operator_monthly', annual: 'price_mock_operator_annual' },
};

const MOCK_PRICES: Record<string, Record<string, number>> = {
  starter: { monthly: 39, annual: 29 },
  pro: { monthly: 99, annual: 79 },
  operator: { monthly: 249, annual: 199 },
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const targetPlan = searchParams.get('plan') || 'operator';
  const targetCycle = (searchParams.get('cycle') || 'annual') as 'monthly' | 'annual';
  // Read actual current plan/cycle from query params (passed by the modal)
  const currentPlan = searchParams.get('currentPlan') || 'starter';
  const currentCycle = (searchParams.get('currentCycle') || 'annual') as 'monthly' | 'annual';

  const MOCK_PERIOD_END = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60; // 15 days from now

  const isUpgrade = (PLAN_ORDER[targetPlan] ?? 0) > (PLAN_ORDER[currentPlan] ?? 0);
  const isDowngrade = (PLAN_ORDER[targetPlan] ?? 0) < (PLAN_ORDER[currentPlan] ?? 0);

  // Simulate proration: 15 days remaining out of 30
  const currentMonthlyPrice = MOCK_PRICES[currentPlan]?.[currentCycle] ?? 0;
  const newMonthlyPrice = MOCK_PRICES[targetPlan]?.[targetCycle] ?? 0;
  const prorationCredit = isUpgrade ? parseFloat((currentMonthlyPrice * (15 / 30)).toFixed(2)) : 0;
  const newPlanFullPrice = targetCycle === 'annual' ? newMonthlyPrice * 12 : newMonthlyPrice;
  const amountDue = isUpgrade ? parseFloat(Math.max(0, newPlanFullPrice - prorationCredit).toFixed(2)) : 0;

  return NextResponse.json({
    currentPlan,
    currentCycle,
    currentPriceId: `price_mock_${currentPlan}_${currentCycle}`,
    subscriptionItemId: 'si_mock_item_001',
    newPlan: targetPlan,
    newCycle: targetCycle,
    newPriceId: MOCK_PRICE_IDS[targetPlan]?.[targetCycle] || 'price_mock',
    newPlanLabel: targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1),
    isUpgrade,
    isDowngrade,
    prorationCredit,
    amountDue,
    currentPeriodEnd: MOCK_PERIOD_END,
    isFounding: false,
    _isMock: true,
  });
}
