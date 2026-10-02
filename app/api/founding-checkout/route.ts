import { NextRequest, NextResponse } from 'next/server';
import { FOUNDING_CONFIG } from '../../../lib/founding-config';
import { requireUser, supabaseAdmin } from '../../../lib/api-auth';
import { getSafeSiteOrigin } from '@/lib/security';
import { applyDubCheckoutMetadata, getDubClickId } from '@/lib/dub/stripe';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    // HIGH-2 fix: FOUNDING_OPEN env var controls program availability.
    // Default at launch: FOUNDING_OPEN=false → 503.
    // Re-enable by setting FOUNDING_OPEN=true + providing price IDs in env.
    if (!FOUNDING_CONFIG.is_open) {
      return NextResponse.json(
        { error: 'founding_not_available', message: 'Founding member program is not currently open.' },
        { status: 503 }
      );
    }

    const { plan, billingCycle } = await request.json();

    if (!plan || !(plan in FOUNDING_CONFIG.plans)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const { current_wave, wave_cap } = FOUNDING_CONFIG;

    const planConfig = FOUNDING_CONFIG.plans[plan as keyof typeof FOUNDING_CONFIG.plans];
    const billing = (billingCycle as 'annual' | 'monthly') || 'annual';
    const priceId =
      billing === 'annual' ? planConfig.annual_price_id : planConfig.monthly_price_id;

    // HIGH-2 fix: founding price IDs are now env-driven. If unset, return 503.
    if (!priceId) {
      return NextResponse.json(
        { error: 'founding_not_configured', message: 'Founding pricing not configured for this plan.' },
        { status: 503 }
      );
    }

    const lockedPrice = billing === 'annual' ? planConfig.locked_price_annual : planConfig.locked_price_monthly;

    const { data: reservation, error: reservationError } = await supabaseAdmin
      .rpc('reserve_founding_member_spot', {
        p_user_id: userId,
        p_wave: current_wave,
        p_wave_cap: wave_cap,
        p_plan: plan,
        p_locked_price: lockedPrice,
      });

    if (reservationError) {
      if (reservationError.message?.includes('founding_wave_closed')) {
        return NextResponse.json({ error: 'founding_wave_closed' }, { status: 400 });
      }
      console.error('Founding reservation error:', reservationError);
      return NextResponse.json({ error: 'founding_reservation_failed' }, { status: 500 });
    }

    const reservationRow = Array.isArray(reservation) ? reservation[0] : reservation;
    if (!reservationRow?.id) {
      return NextResponse.json({ error: 'founding_wave_closed' }, { status: 400 });
    }

    const origin = getSafeSiteOrigin(request);
    const sk = process.env.STRIPE_SECRET_KEY!;
    const dubClickId = getDubClickId(request);

    // Use raw fetch instead of SDK to avoid connection issues
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/founding/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/founding`,
      'metadata[founding_member]': 'true',
      'metadata[founding_wave]': String(current_wave),
      'metadata[founding_tier]': plan,
      'metadata[founding_locked_price]': String(lockedPrice),
      'metadata[founding_reservation_id]': reservationRow.id,
      'metadata[user_id]': userId,
      'subscription_data[metadata][founding_member]': 'true',
      'subscription_data[metadata][founding_wave]': String(current_wave),
      'subscription_data[metadata][founding_tier]': plan,
      'subscription_data[metadata][founding_locked_price]': String(lockedPrice),
      'subscription_data[metadata][founding_reservation_id]': reservationRow.id,
      'subscription_data[metadata][user_id]': userId,
      'custom_text[submit][message]': 'Try it — 7-day money-back guarantee. Terms: https://3rdshift.ai/terms#refund-policy',
      allow_promotion_codes: 'false',
    });

    applyDubCheckoutMetadata(params, userId, dubClickId, { subscription: true });

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
      console.error('Stripe error:', session);
      await supabaseAdmin
        .from('founding_members')
        .update({ reservation_status: 'checkout_failed' })
        .eq('id', reservationRow.id);
      return NextResponse.json(
        { error: session.error?.message || 'Checkout failed' },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('founding_members')
      .update({
        stripe_session_id: session.id,
        stripe_customer_id: session.customer || 'pending',
      })
      .eq('id', reservationRow.id);

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Founding checkout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
