import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { supabaseAdmin } from '../../../lib/api-auth';

// Called after a user creates an account post-founding purchase.
// Matches by Stripe customer email and links the founding member status to their profile.
export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json();
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });

    const supabase = await createClient();

    // Get current logged-in user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Retrieve the Stripe session via raw fetch
    const sk = process.env.STRIPE_SECRET_KEY!;
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=subscription`, {
      headers: { 'Authorization': `Bearer ${sk}` },
    });

    if (!res.ok) return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    const session = await res.json();

    // R4: Verify this Stripe session belongs to the authenticated user (email match)
    // Prevents any user from claiming another user's founding membership session.
    const sessionEmail = (session.customer_details?.email || session.customer_email || '').toLowerCase();
    const userEmail = (user.email || '').toLowerCase();
    if (!sessionEmail || sessionEmail !== userEmail) {
      // Log session-claim attempt to auth_denials for monitoring
      Promise.resolve(supabaseAdmin.from('auth_denials').insert({
        user_id: user.id,
        workspace_id: null,
        route: request.url,
        required_role: 'session_owner',
        actual_role: 'non_owner',
      })).catch(() => {});
      return NextResponse.json(
        { error: 'Session does not belong to this account' },
        { status: 403 }
      );
    }

    const isFoundingMember = session.metadata?.founding_member === 'true';
    if (!isFoundingMember) return NextResponse.json({ error: 'Not a founding session' }, { status: 400 });

    // Item 6: verify payment was actually completed before granting founding status
    // Prevents claiming founding membership from an unpaid/incomplete checkout session
    if (session.payment_status !== 'paid') {
      console.warn(`[founding-link] Session ${session.id} payment_status=${session.payment_status} — not paid`);
      return NextResponse.json(
        { error: 'Payment has not been completed for this session.' },
        { status: 402 }
      );
    }

    // Verify the expanded subscription is active/trialing
    const subStatus = session.subscription?.status;
    if (subStatus && !['active', 'trialing'].includes(subStatus)) {
      console.warn(`[founding-link] Subscription status=${subStatus} — not active`);
      return NextResponse.json(
        { error: 'Subscription is not active. Please contact support.' },
        { status: 402 }
      );
    }

    const foundingTier = session.metadata?.founding_tier || 'starter';
    const foundingWave = parseInt(session.metadata?.founding_wave || '1');
    // Pull actual price from Stripe metadata — never hardcode a fallback
    const lockedPriceRaw = session.metadata?.founding_locked_price;
    const lockedPrice = lockedPriceRaw ? parseInt(lockedPriceRaw) : null;
    const stripeCustomerId = session.customer;
    const stripeSubscriptionId = session.subscription?.id || session.subscription;
    const HEAVY_CREDITS: Record<string, number> = { starter: 0, pro: 50, operator: 150 };

    // Insert into founding_members if not already there (service role — C1.5)
    await supabaseAdmin.from('founding_members').upsert({
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      plan: foundingTier,
      wave: foundingWave,
      locked_price: lockedPrice,
    }, { onConflict: 'stripe_subscription_id', ignoreDuplicates: true });

    // Update profile via service role (C10: user-context UPDATE policy dropped)
    await supabaseAdmin.from('profiles').update({
      is_founding_member: true,
      founding_tier: foundingTier,
      founding_wave: foundingWave,
      founding_locked_price: lockedPrice,
      plan: foundingTier,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      heavy_credits_remaining: HEAVY_CREDITS[foundingTier] ?? 0,
      heavy_credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', user.id);

    return NextResponse.json({ ok: true, plan: foundingTier });
  } catch (error: unknown) {
    console.error('Founding link error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
