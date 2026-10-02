import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const userEmail = (auth.userEmail || '').toLowerCase();

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
  }

  try {
    // Use raw fetch — same pattern as founding-checkout and founding-link
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${sk}` },
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Stripe session error:', err);
      return NextResponse.json({ error: err?.error?.message || 'Invalid session' }, { status: 400 });
    }

    const session = await res.json();
    const sessionEmail = (session.customer_details?.email || session.customer_email || '').toLowerCase();

    if (!sessionEmail || !userEmail || sessionEmail !== userEmail) {
      return NextResponse.json(
        { error: 'Session does not belong to this account' },
        { status: 403 }
      );
    }

    const isFoundingMember = session.metadata?.founding_member === 'true';
    const plan = session.metadata?.founding_tier || null;
    const lockedPrice = session.metadata?.founding_locked_price
      ? Number(session.metadata.founding_locked_price)
      : null;

    // For regular (non-founding) checkouts, pull plan + price from subscription
    let regularPlan = null;
    let regularPrice = null;
    let billingCycle = 'annual';

    if (!isFoundingMember && session.subscription) {
      try {
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { 'Authorization': `Bearer ${sk}` },
        });
        if (subRes.ok) {
          const sub = await subRes.json();
          const item = sub.items?.data?.[0];
          if (item) {
            regularPlan = sub.metadata?.plan || null;
            regularPrice = item.price?.unit_amount ? Math.round(item.price.unit_amount / 100) : null;
            billingCycle = item.price?.recurring?.interval === 'month' ? 'monthly' : 'annual';
          }
        }
      } catch (subErr) {
        console.error('Subscription retrieve error (non-fatal):', subErr);
      }
    }

    // For founding members, derive billing cycle from the locked price
    if (isFoundingMember && lockedPrice) {
      // Monthly prices: Starter=$25, Pro=$75. Annual: Starter=$19, Pro=$59, Operator=$199
      const monthlyPrices = [25, 75];
      billingCycle = monthlyPrices.includes(lockedPrice) ? 'monthly' : 'annual';
    }

    return NextResponse.json({
      is_founding_member: isFoundingMember,
      plan: plan || regularPlan,
      locked_price: lockedPrice,
      regular_price: regularPrice,
      billing_cycle: billingCycle,
      customer_email: session.customer_details?.email,
    });
  } catch (error: unknown) {
    console.error('Session retrieve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid session' },
      { status: 400 }
    );
  }
}
