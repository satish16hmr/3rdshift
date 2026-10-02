/**
 * verifyActiveSubscription — confirms a Stripe subscription is in an active state.
 * Used by plan-change and topup-checkout to gate operations on inactive subscriptions.
 */
export async function verifyActiveSubscription(subscriptionId: string): Promise<{
  active: boolean;
  status: string;
  reason?: string;
}> {
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Stripe-Version': '2026-02-25.clover',
        },
      }
    );
    if (!res.ok) {
      return { active: false, status: 'unknown', reason: 'lookup_failed' };
    }
    const sub = await res.json();
    const ACTIVE_STATUSES = ['active', 'trialing'];
    const isActive = ACTIVE_STATUSES.includes(sub.status);
    return {
      active: isActive,
      status: sub.status,
      reason: isActive ? undefined : `subscription_${sub.status}`,
    };
  } catch {
    return { active: false, status: 'unknown', reason: 'lookup_exception' };
  }
}
