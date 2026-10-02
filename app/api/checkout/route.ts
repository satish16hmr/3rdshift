import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getSafeSiteOrigin } from '@/lib/security';
import { STRIPE_PLANS } from '@/lib/stripe/config';
import { isActiveSubscriptionStatus } from '@/lib/billing/subscription-status';
import { applyDubCheckoutMetadata, getDubClickId, updateStripeCustomerDubMetadata } from '@/lib/dub/stripe';

export async function POST(request: NextRequest) {
  try {
    const { plan, billing_cycle = 'annual' } = await request.json();
    const cycle = billing_cycle === 'monthly' ? 'monthly' : 'annual';
    const planConfig = STRIPE_PLANS[plan as keyof typeof STRIPE_PLANS];

    if (!plan || !planConfig) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const priceId = planConfig[cycle].priceId;

    if (!priceId) {
      // C3 fix: return 503 instead of 200 with null url — callers must handle this as an error
      return NextResponse.json(
        { error: 'checkout_not_configured', message: 'Checkout is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, email')
      .eq('id', user.id)
      .single();

    const sk = process.env.STRIPE_SECRET_KEY!;
    const origin = getSafeSiteOrigin(request);
    const dubClickId = getDubClickId(request);

    // Existing active subscribers must change plans by updating their current
    // Stripe subscription item. Never create a fresh Checkout subscription for
    // an active subscriber — that double-charges and stacks entitlements.
    if (profile?.stripe_subscription_id) {
      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}`, {
        headers: {
          Authorization: `Bearer ${sk}`,
          'Stripe-Version': '2026-02-25.clover',
        },
      });
      if (subRes.ok) {
        const subscription = await subRes.json();
        if (isActiveSubscriptionStatus(subscription.status)) {
          return NextResponse.json(
            {
              error: 'active_subscription_exists',
              message: 'You already have an active subscription. Use Change plan to upgrade or downgrade your current plan.',
            },
            { status: 409 }
          );
        }
      } else {
        console.warn('[checkout] Could not verify existing subscription status; blocking duplicate checkout for safety', {
          user_id: user.id,
          stripe_subscription_id: profile.stripe_subscription_id,
        });
        return NextResponse.json(
          {
            error: 'subscription_verification_failed',
            message: 'We could not verify your existing subscription. Please use Manage Plan or contact support.',
          },
          { status: 409 }
        );
      }
    }

    if (profile?.stripe_customer_id) {
      const activeSubsRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(profile.stripe_customer_id)}&status=all&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${sk}`,
            'Stripe-Version': '2026-02-25.clover',
          },
        }
      );
      if (activeSubsRes.ok) {
        const activeSubs = await activeSubsRes.json();
        const existingActiveSub = (activeSubs.data ?? []).find((sub: { status?: string }) => isActiveSubscriptionStatus(sub.status));
        if (existingActiveSub) {
          return NextResponse.json(
            {
              error: 'active_subscription_exists',
              message: 'You already have an active subscription. Use Change plan to upgrade or downgrade your current plan.',
            },
            { status: 409 }
          );
        }
      }
    }

    // Use raw fetch instead of SDK to avoid connection issues on Vercel
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'metadata[user_id]': user.id,
      'metadata[plan]': plan,
      'metadata[billing_cycle]': cycle,
      // Phase 18: workspace_id in metadata enables resolveWorkspaceFromStripeEvent
      // to route the webhook to the correct workspace (CRIT-2 fix).
      // workspace_id removed — subscriptions are account-level (Phase 19)
      'subscription_data[metadata][user_id]': user.id,
      'custom_text[submit][message]': 'Try it — 7-day money-back guarantee. Terms: https://3rdshift.ai/terms#refund-policy',
      success_url: `${origin}/onboarding/personalDetails?checkout=success`,
      cancel_url: `${origin}/onboarding/plan?checkout=cancelled`,
    });

    applyDubCheckoutMetadata(params, user.id, dubClickId, { subscription: true });

    if (profile?.stripe_customer_id) {
      await updateStripeCustomerDubMetadata({
        stripeKey: sk,
        customerId: profile.stripe_customer_id,
        userId: user.id,
        dubClickId,
      });
    }

    if (profile?.stripe_customer_id) {
      params.set('customer', profile.stripe_customer_id);
    } else {
      params.set('customer_email', user.email || '');
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sk}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2026-02-25.clover',
      },
      body: params.toString(),
    });

    const session = await res.json();

    if (!res.ok || !session.url) {
      console.error('Stripe checkout error:', session);
      return NextResponse.json(
        { error: 'Checkout failed. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Checkout failed. Please try again.' },
      { status: 500 }
    );
  }
}
