import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { STRIPE_PLANS, getPlanByPriceId } from '@/lib/stripe/config';
import { FOUNDING_CONFIG } from '@/lib/founding-config';

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, operator: 2 };

// Returns the correct price ID for a plan change, respecting founding member pricing
function getTargetPriceId(
  targetPlan: string,
  targetCycle: 'monthly' | 'annual',
  isFounding: boolean
): string | null {
  if (isFounding) {
    const foundingPlan = FOUNDING_CONFIG.plans[targetPlan as keyof typeof FOUNDING_CONFIG.plans];
    if (foundingPlan) {
      // Founding Operator is annual only
      if (targetPlan === 'operator') return foundingPlan.annual_price_id ?? null;
      return targetCycle === 'monthly'
        ? foundingPlan.monthly_price_id ?? null
        : foundingPlan.annual_price_id ?? null;
    }
  }
  const plan = STRIPE_PLANS[targetPlan as keyof typeof STRIPE_PLANS];
  if (!plan) throw new Error(`Unknown plan: ${targetPlan}`);
  return targetCycle === 'monthly' ? plan.monthly.priceId : plan.annual.priceId;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { searchParams } = new URL(request.url);
  const targetPlan = searchParams.get('plan') || '';
  const targetCycle = (searchParams.get('cycle') || 'annual') as 'monthly' | 'annual';

  if (!PLAN_ORDER.hasOwnProperty(targetPlan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const sk = process.env.STRIPE_SECRET_KEY!;

  // Load profile: subscription + founding status
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_subscription_id, plan, billing_cycle, is_founding_member')
    .eq('id', userId)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
  }

  const isFounding = !!profile.is_founding_member;
  const currentPlan = profile.plan || 'starter';

  // Fetch current Stripe subscription
  const subRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}?expand[]=items.data.price`,
    { headers: { Authorization: `Bearer ${sk}`, 'Stripe-Version': '2026-02-25.clover' } }
  );
  if (!subRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
  const sub = await subRes.json();
  const item = sub.items?.data?.[0];
  if (!item) {
    return NextResponse.json({ error: 'No subscription item found' }, { status: 500 });
  }

  const currentPriceId = item.price?.id;
  const currentCycleFromStripe = item.price?.recurring?.interval === 'month' ? 'monthly' : 'annual';
  const currentPeriodEnd: number = sub.current_period_end;

  const isUpgrade = PLAN_ORDER[targetPlan] > PLAN_ORDER[currentPlan];
  const isDowngrade = PLAN_ORDER[targetPlan] < PLAN_ORDER[currentPlan];

  if (!isUpgrade && !isDowngrade) {
    return NextResponse.json({ error: 'Same plan' }, { status: 400 });
  }

  // For founding Operator upgrades, force annual cycle
  const effectiveTargetCycle = (isFounding && targetPlan === 'operator') ? 'annual' : targetCycle;

  let newPriceId: string;
  try {
    const resolvedPriceId = getTargetPriceId(targetPlan, effectiveTargetCycle, isFounding);
    if (!resolvedPriceId) {
      return NextResponse.json({ error: 'Price not configured for this plan' }, { status: 503 });
    }
    newPriceId = resolvedPriceId;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // For upgrades, calculate proration via upcoming invoice preview
  let prorationCredit = 0;
  let amountDue = 0;

  if (isUpgrade) {
    const params = new URLSearchParams({
      subscription: profile.stripe_subscription_id,
      [`subscription_items[0][id]`]: item.id,
      [`subscription_items[0][price]`]: newPriceId,
      subscription_proration_behavior: 'create_prorations',
    });

    const previewRes = await fetch(
      `https://api.stripe.com/v1/invoices/upcoming?${params.toString()}`,
      { headers: { Authorization: `Bearer ${sk}`, 'Stripe-Version': '2026-02-25.clover' } }
    );

    if (previewRes.ok) {
      const preview = await previewRes.json();
      // Sum proration line items (negative = credit, positive = charge)
      const lines: Array<{ amount: number; proration: boolean }> = preview.lines?.data || [];
      let credit = 0;
      let charge = 0;
      for (const line of lines) {
        if (line.proration) {
          if (line.amount < 0) credit += Math.abs(line.amount);
          else charge += line.amount;
        } else {
          // New subscription charge
          charge += line.amount;
        }
      }
      prorationCredit = Math.round(credit) / 100;
      amountDue = Math.max(0, Math.round(preview.amount_due)) / 100;
    }
  }

  // Look up new plan/cycle label for founding upgrades
  const newPlanLabel = isFounding
    ? `${targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)} (Founding)`
    : targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1);

  return NextResponse.json({
    currentPlan,
    currentCycle: currentCycleFromStripe,
    currentPriceId,
    subscriptionItemId: item.id,
    // Note: subscriptionId is NOT returned to client for security.
    // The plan-change API resolves it server-side from the authenticated user's profile.
    newPlan: targetPlan,
    newCycle: effectiveTargetCycle,
    newPriceId,
    newPlanLabel,
    isUpgrade,
    isDowngrade,
    prorationCredit,
    amountDue,
    currentPeriodEnd,
    isFounding,
  });
}
