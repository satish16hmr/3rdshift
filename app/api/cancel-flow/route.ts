import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';

const SK = () => process.env.STRIPE_SECRET_KEY!;
const STRIPE_VERSION = '2026-02-25.clover';

const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL?.trim() || '',
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY?.trim() || '',
  },
  pro: {
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL?.trim() || '',
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() || '',
  },
};

const PLAN_RANK: Record<string, number> = { starter: 1, pro: 2, operator: 3 };

const VALID_CANCEL_REASONS = new Set([
  'too_expensive',
  'not_using',
  'missing_feature',
  'switching',
  'other',
]);

async function stripePost(path: string, params: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SK()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_VERSION,
    },
    body: params.toString(),
  });
  return res.json();
}

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      'Authorization': `Bearer ${SK()}`,
      'Stripe-Version': STRIPE_VERSION,
    },
  });
  return res.json();
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json();
  const { action, cancelReason, targetPlan, featureText } = body;

  // Get user profile
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, billing_cycle, stripe_customer_id, stripe_subscription_id, retention_offer_used')
    .eq('id', userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const plan = profile.plan as string;
  const cycle = profile.billing_cycle === 'monthly' ? 'monthly' : 'annual';
  const offerUsed = profile.retention_offer_used ?? false;

  // ── GET OFFER ─────────────────────────────────────────────────────────────
  if (action === 'get_offer') {
    if (!VALID_CANCEL_REASONS.has(cancelReason)) {
      return NextResponse.json({ error: 'Please select a cancellation reason' }, { status: 400 });
    }

    console.info('[cancel-flow] cancellation survey response', { userId, plan, cycle, cancelReason });

    const { error: reasonError } = await supabaseAdmin
      .from('profiles')
      .update({
        cancellation_reason: cancelReason,
        cancellation_feedback: null,
      })
      .eq('id', userId);

    if (reasonError) {
      console.error('[cancel-flow] failed to record cancellation reason:', reasonError);
      return NextResponse.json({ error: 'Could not save cancellation reason' }, { status: 500 });
    }

    if (offerUsed) {
      return NextResponse.json({ offerType: 'none', skipOffer: true, plan, reason: 'offer_used' });
    }

    if (cycle !== 'monthly') {
      return NextResponse.json({ offerType: 'none', skipOffer: true, plan, reason: 'annual_subscription' });
    }

    if (plan === 'starter') {
      if (cancelReason === 'too_expensive') {
        return NextResponse.json({ offerType: 'discount_only', plan });
      }
      return NextResponse.json({ offerType: 'none', skipOffer: true, plan });
    }

    if (cancelReason === 'missing_feature') {
      return NextResponse.json({ offerType: 'feature_request', plan });
    }

    if (cancelReason === 'not_using') {
      const downgradeTo = plan === 'operator' ? ['pro'] : ['starter'];
      return NextResponse.json({ offerType: 'downgrade_only', downgradeTo, plan, reason: cancelReason });
    }

    if (cancelReason === 'switching' || cancelReason === 'other') {
      const downgradeTo = plan === 'operator' ? ['pro', 'starter'] : ['starter'];
      return NextResponse.json({ offerType: 'downgrade_only', downgradeTo, plan, reason: cancelReason });
    }

    const downgradeTo = plan === 'operator' ? ['pro'] : ['starter'];
    return NextResponse.json({ offerType: 'discount_or_downgrade', downgradeTo, plan });
  }

  // ── APPLY 20% DISCOUNT ────────────────────────────────────────────────────
  if (action === 'apply_discount') {
    if (offerUsed) {
      return NextResponse.json({ error: 'Discount already used' }, { status: 400 });
    }
    if (!profile.stripe_subscription_id || !profile.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }
    if (cycle !== 'monthly') {
      return NextResponse.json({ error: 'Retention discounts are available for monthly subscriptions only' }, { status: 400 });
    }

    // Step 1: Atomically claim the one-time retention offer before Stripe side effects.
    const { data: offerClaim, error: offerClaimError } = await supabaseAdmin
      .from('profiles')
      .update({ retention_offer_used: true })
      .eq('id', userId)
      .or('retention_offer_used.is.false,retention_offer_used.is.null')
      .select('id')
      .maybeSingle();

    if (offerClaimError) {
      console.error('[cancel-flow] failed to claim retention offer:', offerClaimError);
      return NextResponse.json({ error: 'Could not apply discount' }, { status: 500 });
    }

    if (!offerClaim) {
      return NextResponse.json({ error: 'Discount already used' }, { status: 400 });
    }

    // Step 2: Create a coupon
    const coupon = await stripePost('/coupons', new URLSearchParams({
      percent_off: '20',
      duration: 'repeating',
      duration_in_months: '3',
    }));

    if (!coupon.id) {
      console.error('Coupon creation failed:', JSON.stringify(coupon));
      return NextResponse.json({ error: coupon.error?.message || 'Failed to create coupon' }, { status: 500 });
    }

    // Step 3: Apply coupon to the subscription directly (correct Stripe API approach)
    const sub = await stripePost(`/subscriptions/${profile.stripe_subscription_id}`, new URLSearchParams({
      'discounts[0][coupon]': coupon.id,
    }));

    if (!sub.id) {
      // Fallback: try applying via customer
      console.error('Sub discount failed, trying customer:', JSON.stringify(sub));
      const customer = await stripePost(`/customers/${profile.stripe_customer_id}`, new URLSearchParams({
        coupon: coupon.id,
      }));
      if (!customer.id) {
        console.error('Customer discount also failed:', JSON.stringify(customer));
        return NextResponse.json({ error: sub.error?.message || 'Failed to apply discount' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  }

  // ── FEATURE FEEDBACK ──────────────────────────────────────────────────────
  if (action === 'submit_feature_feedback') {
    const feedback = typeof featureText === 'string' ? featureText.trim() : '';
    if (!feedback) {
      return NextResponse.json({ error: 'Please tell us what is missing' }, { status: 400 });
    }

    console.info('[cancel-flow] cancellation feature feedback', { userId, plan, feedback });

    const { error: feedbackError } = await supabaseAdmin
      .from('profiles')
      .update({
        cancellation_feedback: feedback,
      })
      .eq('id', userId);

    if (feedbackError) {
      console.error('[cancel-flow] failed to save cancellation feedback:', feedbackError);
      return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // ── DOWNGRADE PLAN ────────────────────────────────────────────────────────
  if (action === 'downgrade') {
    if (!targetPlan || !PRICE_IDS[targetPlan]) {
      return NextResponse.json({ error: 'Invalid target plan' }, { status: 400 });
    }
    const currentRank = PLAN_RANK[plan] ?? 0;
    const targetRank = PLAN_RANK[targetPlan] ?? 0;
    if (targetRank >= currentRank) {
      return NextResponse.json({ error: 'Target plan must be lower than current plan' }, { status: 400 });
    }
    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    const newPriceId = PRICE_IDS[targetPlan]?.[cycle];

    if (!newPriceId) {
      return NextResponse.json({ error: 'Price not configured for this plan' }, { status: 400 });
    }

    const sub = await stripeGet(`/subscriptions/${profile.stripe_subscription_id}`);
    const itemId = sub.items?.data?.[0]?.id;

    if (!itemId) {
      return NextResponse.json({ error: 'Could not find subscription item' }, { status: 500 });
    }

    let scheduleId = sub.schedule;
    if (!scheduleId) {
      const createdSchedule = await stripePost('/subscription_schedules', new URLSearchParams({
        from_subscription: profile.stripe_subscription_id,
      }));
      if (!createdSchedule.id) {
        console.error('Schedule create failed:', JSON.stringify(createdSchedule));
        return NextResponse.json({ error: 'Failed to schedule downgrade' }, { status: 500 });
      }
      scheduleId = createdSchedule.id;
    }

    const schedule = await stripeGet(`/subscription_schedules/${scheduleId}`);
    const currentPhase = schedule.phases?.[0];
    const periodEnd = currentPhase?.end_date || sub.current_period_end || sub.trial_end;

    if (!currentPhase || !periodEnd) {
      return NextResponse.json({ error: 'Could not schedule downgrade' }, { status: 500 });
    }

    const updated = await stripePost(`/subscription_schedules/${scheduleId}`, new URLSearchParams({
      'phases[0][start_date]': String(currentPhase.start_date),
      'phases[0][end_date]': String(periodEnd),
      'phases[0][items][0][price]': currentPhase.items?.[0]?.price || sub.items?.data?.[0]?.price?.id,
      'phases[0][items][0][quantity]': '1',
      'phases[1][start_date]': String(periodEnd),
      'phases[1][items][0][price]': newPriceId,
      'phases[1][items][0][quantity]': '1',
      'phases[1][iterations]': '1',
      end_behavior: 'release',
    }));

    if (!updated.id) {
      console.error('Schedule update failed:', JSON.stringify(updated));
      return NextResponse.json({ error: 'Failed to schedule downgrade' }, { status: 500 });
    }

    const effectiveDate = new Date(periodEnd * 1000).toISOString();
    const { error: profileUpdateError } = await supabaseAdmin.from('profiles').update({
      pending_downgrade_plan: targetPlan,
      pending_downgrade_date: effectiveDate,
      retention_offer_used: true,
    }).eq('id', userId);

    if (profileUpdateError) {
      console.error('[cancel-flow] failed to store pending downgrade:', profileUpdateError);
      return NextResponse.json({ error: 'Downgrade scheduled, but account update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, scheduled: true, newPlan: targetPlan, effectiveDate });
  }


  // ── RESUME SUBSCRIPTION ───────────────────────────────────────────────────
  if (action === 'resume_subscription') {
    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    const sub = await stripeGet(`/subscriptions/${profile.stripe_subscription_id}`);
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    const hasFutureCancelAt = typeof sub.cancel_at === 'number' && sub.cancel_at * 1000 > Date.now();

    if (!sub.id || !isActive) {
      return NextResponse.json({ error: 'Only an active subscription can be resumed' }, { status: 400 });
    }

    if (!sub.cancel_at_period_end && !hasFutureCancelAt) {
      return NextResponse.json({ success: true, alreadyActive: true, status: sub.status });
    }

    const resumeParams = new URLSearchParams({
      cancel_at_period_end: 'false',
    });
    if (!sub.cancel_at_period_end && hasFutureCancelAt) {
      resumeParams.set('cancel_at', '');
    }

    const resumed = await stripePost(`/subscriptions/${profile.stripe_subscription_id}`, resumeParams);

    if (!resumed.id) {
      console.error('Subscription resume failed:', JSON.stringify(resumed));
      return NextResponse.json({ error: resumed.error?.message || 'Failed to resume subscription' }, { status: 500 });
    }

    const { error: resumeProfileError } = await supabaseAdmin.from('profiles').update({
      billing_status: 'active',
      billing_delinquent_at: null,
      billing_block_reason: null,
    }).eq('id', userId);

    if (resumeProfileError) {
      console.error('[cancel-flow] failed to mark resumed subscription active:', resumeProfileError);
      return NextResponse.json({ error: 'Subscription resumed, but account update failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: resumed.status,
      cancel_at_period_end: resumed.cancel_at_period_end,
      cancel_at: resumed.cancel_at,
    });
  }

  // ── CONFIRM CANCEL ────────────────────────────────────────────────────────
  if (action === 'confirm_cancel') {
    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    const cancelled = await stripePost(`/subscriptions/${profile.stripe_subscription_id}`, new URLSearchParams({
      cancel_at_period_end: 'true',
    }));

    if (!cancelled.id) {
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
    }

    const cancelledItem = cancelled.items?.data?.[0];
    const accessEndTimestamp = cancelled.status === 'trialing' && cancelled.trial_end
      ? cancelled.trial_end
      : cancelled.current_period_end ?? cancelledItem?.current_period_end;

    const endDate = accessEndTimestamp
      ? new Date(accessEndTimestamp * 1000).toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        })
      : null;

    return NextResponse.json({ success: true, accessEndsOn: endDate });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
