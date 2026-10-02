import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_subscription_id, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No subscription' }, { status: 404 });
  }

  const sk = process.env.STRIPE_SECRET_KEY!;

  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}?expand[]=items.data.price&expand[]=discount&expand[]=customer`,
    {
      headers: {
        'Authorization': `Bearer ${sk}`,
        'Stripe-Version': '2026-02-25.clover',
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }

  const sub = await res.json();
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount;
  const interval = item?.price?.recurring?.interval; // 'month' or 'year'
  const currentPeriodEnd = sub.current_period_end ?? item?.current_period_end ?? null;

  // For annual, convert total to monthly equivalent
  let pricePerMonth = unitAmount ? Math.round(unitAmount / 100) : null;
  let intervalLabel = 'annual';

  if (interval === 'month') {
    intervalLabel = 'monthly';
  } else if (interval === 'year' && pricePerMonth) {
    pricePerMonth = Math.round(pricePerMonth / 12);
    intervalLabel = 'annual';
  }


  // Check for active discount — subscription first, then customer (using customer ID from subscription)
  let discount = null;
  let customerDiscount = null;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!sub.discount && customerId) {
    try {
      const custRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
        headers: { 'Authorization': `Bearer ${sk}`, 'Stripe-Version': '2026-02-25.clover' },
      });
      const cust = await custRes.json();
      customerDiscount = cust.discount;
    } catch { /* ignore */ }
  }
  const activeDiscount = sub.discount || customerDiscount;
  if (activeDiscount?.coupon) {
    const coupon = activeDiscount.coupon;
    const endDate = activeDiscount.end
      ? new Date(activeDiscount.end * 1000)
      : null;

    // Calculate months remaining
    let monthsRemaining = null;
    if (endDate) {
      const msRemaining = endDate.getTime() - Date.now();
      monthsRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24 * 30)));
    } else if (coupon.duration === 'repeating' && coupon.duration_in_months) {
      monthsRemaining = coupon.duration_in_months;
    }

    const expiryDate = endDate
      ? endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;

    discount = {
      percentOff: coupon.percent_off || null,
      amountOff: coupon.amount_off ? Math.round(coupon.amount_off / 100) : null,
      monthsRemaining,
      expiryDate,
      duration: coupon.duration,
    };
  }

  return NextResponse.json({
    price: pricePerMonth,
    interval: intervalLabel,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: currentPeriodEnd,
    cancel_at: sub.cancel_at,
    discount,
  });
}
