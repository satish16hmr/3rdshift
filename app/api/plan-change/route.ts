import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { buildPlanDowngradeScheduleParams, buildPlanUpgradeParams, resolvePlanChangeTarget } from '@/lib/billing/plan-change';
import { STRIPE_PLANS } from '@/lib/stripe/config';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // R3: body-supplied workspaceId required — validates caller is workspace owner
  const body = await request.json();
  const { workspaceId, targetPlan, targetCycle } = body;

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Role check — owner-only
  // Multi-workspace ownership note: a user owning multiple workspaces has a single profile/plan.
  // Plan changes via one workspace_id affect billing across all owned workspaces by design —
  // plan lives on the user, not the workspace.
  const roleAuth = await requireWorkspaceRole(request, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  // Get subscription from caller's profile — caller IS the workspace owner per role check above
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_subscription_id, plan, is_founding_member')
    .eq('id', userId)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  }

  const target = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: profile.plan,
    targetPlan,
    targetCycle,
  });
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }
  const { newPriceId, isUpgrade } = target;

  // C05/F3: Block founding price IDs before any DB calls — fast input validation
  {
    const { FOUNDING_CONFIG: _fc } = await import('@/lib/founding-config');
    const _foundingPriceIds = new Set(
      Object.values(_fc.plans).flatMap((p) => [
        p.annual_price_id,
        p.monthly_price_id,
      ]).filter((id): id is string => id !== null)
    );
    if (_foundingPriceIds.has(newPriceId)) {
      return NextResponse.json(
        { error: 'Founding plan pricing cannot be applied through plan-change.' },
        { status: 400 }
      );
    }
  }

  const subscriptionId = profile.stripe_subscription_id;

  const sk = process.env.STRIPE_SECRET_KEY!;

  // Derive the subscription item from this caller's actual Stripe subscription.
  const subVerifyRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${sk}`, 'Stripe-Version': '2026-02-25.clover' },
  });
  if (!subVerifyRes.ok) {
    return NextResponse.json({ error: 'Subscription lookup failed' }, { status: 500 });
  }
  const subVerifyData = await subVerifyRes.json();
  const subscriptionItemId = subVerifyData.items?.data?.[0]?.id;
  if (!subscriptionItemId) {
    return NextResponse.json({ error: 'No subscription item found' }, { status: 500 });
  }

  // Component 2: verify subscription is still active
  const ACTIVE_STATUSES = ['active', 'trialing'];
  if (!ACTIVE_STATUSES.includes(subVerifyData.status)) {
    return NextResponse.json(
      { error: 'No active subscription found', code: 'SUBSCRIPTION_INACTIVE' },
      { status: 400 }
    );
  }

  if (isUpgrade) {
    // Immediate upgrade with proration
    const params = buildPlanUpgradeParams({ subscriptionItemId, newPriceId });

    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sk}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-02-25.clover',
        },
        body: params.toString(),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error('Stripe upgrade error:', err);
      return NextResponse.json({ error: 'Upgrade failed. Please try again.' }, { status: 500 });
    }

    const updatedSub = await res.json();

    // The webhook will fire and handle DB update too, but we return the
    // server-validated target plan for instant UI feedback.
    const newPlan: string = target.targetPlan;

    // C05/F3 fix: DO NOT update profiles.plan here.
    // The webhook (customer.subscription.updated) is the authoritative source
    // for plan, credit, workspace, and transition updates. Using
    // payment_behavior=error_if_incomplete keeps this inline: Stripe either
    // successfully applies/collects the prorated subscription update or rejects
    // the request without changing local entitlements.
    // The webhook already handles: plan update, credits reset, workspace sync,
    // plan_transitions log.
    //
    // UX note: the UI polls /api/subscription-details after this returns.
    // The plan change will reflect within seconds once the webhook fires.

    return NextResponse.json({ success: true, newPlan, status: updatedSub.status });
  } else {
    // Downgrade — schedule for end of billing period
    // Use subscription schedule for clean end-of-period change
    // First check if there's already a subscription schedule
    const subRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${sk}`, 'Stripe-Version': '2026-02-25.clover' } }
    );
    const subData = await subRes.json();

    let scheduleId = subData.schedule;

    if (!scheduleId) {
      // Create a schedule from the existing subscription
      const scheduleParams = new URLSearchParams({
        from_subscription: subscriptionId,
      });
      const schedRes = await fetch('https://api.stripe.com/v1/subscription_schedules', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sk}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-02-25.clover',
        },
        body: scheduleParams.toString(),
      });

      if (!schedRes.ok) {
        const err = await schedRes.json();
        console.error('Schedule create error:', err);
        return NextResponse.json({ error: 'Downgrade scheduling failed. Please try again.' }, { status: 500 });
      }

      const schedule = await schedRes.json();
      scheduleId = schedule.id;
    }

    // Fetch the schedule to get current phase details
    const schedFetchRes = await fetch(`https://api.stripe.com/v1/subscription_schedules/${scheduleId}`, {
      headers: { Authorization: `Bearer ${sk}`, 'Stripe-Version': '2026-02-25.clover' },
    });
    const schedData = await schedFetchRes.json();
    const currentPhase = schedData.phases?.[0];

    if (!currentPhase) {
      return NextResponse.json({ error: 'No current phase found' }, { status: 500 });
    }

    // Update schedule: keep current phase as-is, add new phase starting at period end with downgraded price
    const updateParams = buildPlanDowngradeScheduleParams({
      currentPhase,
      currentPeriodEnd: subData.current_period_end,
      newPriceId,
    });

    const schedUpdateRes = await fetch(
      `https://api.stripe.com/v1/subscription_schedules/${scheduleId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sk}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-02-25.clover',
        },
        body: new URLSearchParams(updateParams).toString(),
      }
    );

    if (!schedUpdateRes.ok) {
      const err = await schedUpdateRes.json();
      console.error('Schedule update error:', err);
      return NextResponse.json({ error: 'Downgrade scheduling failed. Please try again.' }, { status: 500 });
    }

    // Store the pending downgrade in the profile so UI can show it.
    const newPlan: string = target.targetPlan;

    await supabaseAdmin.from('profiles').update({
      pending_downgrade_plan: newPlan,
      pending_downgrade_date: new Date(
        (currentPhase.end_date || subData.current_period_end) * 1000
      ).toISOString(),
    }).eq('id', userId);

    // Component 4: log pending downgrade as transition
    Promise.resolve(supabaseAdmin.from('plan_transitions').insert({
      user_id: userId,
      from_plan: profile.plan,
      to_plan: newPlan,
      reason: 'user_initiated',
      initiated_by: userId,
      stripe_subscription_id: subscriptionId,
      metadata: { trigger_route: '/api/plan-change', is_upgrade: false, effective_at: new Date((currentPhase.end_date || subData.current_period_end) * 1000).toISOString() },
    })).catch((e: unknown) => console.error('[plan_transitions] Insert failed:', e));

    return NextResponse.json({
      success: true,
      scheduled: true,
      newPlan,
      effectiveDate: new Date(
        (currentPhase.end_date || subData.current_period_end) * 1000
      ).toISOString(),
    });
  }
}
