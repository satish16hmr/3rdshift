import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { verifyActiveSubscription } from '@/lib/stripe/verify-subscription';
import { enforceBillingAccess } from '@/lib/billing/billing-access';
import { getSafeSiteOrigin } from '@/lib/security';
import { applyDubCheckoutMetadata, getDubClickId, updateStripeCustomerDubMetadata } from '@/lib/dub/stripe';

function createAdminClient() {
  return supabaseAdmin;
}

// Top-up pack definitions — FA approved prices (flat rate, no annual/monthly split)
const PACKS = {
  small:  { credits: 25,  annual: 4700, monthly: 4700, label: 'Small — 25 credits' },
  medium: { credits: 50,  annual: 8700, monthly: 8700, label: 'Medium — 50 credits' },
  large:  { credits: 100, annual: 16700, monthly: 16700, label: 'Large — 100 credits' },
} as const;

type PackName = keyof typeof PACKS;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R2: owner-only — role check BEFORE plan check so members get the right error
  const roleAuth = await requireWorkspaceRole(request, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  const supabase = createAdminClient();

  // Operator only — workspace owner's plan (runs after role check)
  const wsPlan = await getWorkspaceOwnerPlan(workspaceId);
  if (wsPlan !== 'operator') {
    return NextResponse.json({ error: 'Top-up credits are available for Operator plan only' }, { status: 403 });
  }

  // Get workspace owner profile for billing details
  const { data: wsRow } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single();
  const ownerId = wsRow?.owner_id ?? userId;
  const { data: profile } = await supabase
    .from('profiles')
    .select('billing_cycle, stripe_customer_id, email, stripe_subscription_id')
    .eq('id', ownerId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Phase 23 Step 2 — billing delinquency gate
  {
    const billingAccess = await enforceBillingAccess(supabase, ownerId);
    if (billingAccess.blocked) {
      return NextResponse.json(
        {
          error: billingAccess.code,
          message: billingAccess.code === 'billing_past_due'
            ? 'Your payment is past due. Please update your billing information before purchasing credits.'
            : 'No active subscription.',
        },
        { status: 402 }
      );
    }
  }

  // Component 2: verify subscription is active before creating top-up session
  if (profile.stripe_subscription_id) {
    const subStatus = await verifyActiveSubscription(profile.stripe_subscription_id);
    if (!subStatus.active) {
      return NextResponse.json(
        { error: 'No active subscription for top-up', code: 'SUBSCRIPTION_INACTIVE' },
        { status: 400 }
      );
    }
  }

  let body: { pack?: PackName };
  try {
    body = await request.json() as { pack?: PackName };
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { pack } = body;
  if (!pack || !PACKS[pack]) {
    return NextResponse.json({ error: 'Invalid pack name' }, { status: 400 });
  }

  const packInfo = PACKS[pack];
  const isAnnual = (profile.billing_cycle ?? 'annual') !== 'monthly';
  const priceCents = isAnnual ? packInfo.annual : packInfo.monthly;

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const siteUrl = getSafeSiteOrigin(request);
  const dubClickId = getDubClickId(request);

  // Ensure the owner has a Stripe customer — create one on the fly if not
  let stripeCustomerId = profile.stripe_customer_id;
  if (!stripeCustomerId && profile.email) {
    const createRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: profile.email,
        'metadata[user_id]': ownerId,
        'metadata[dubCustomerExternalId]': ownerId,
        ...(dubClickId ? { 'metadata[dubClickId]': dubClickId } : {}),
      }).toString(),
    });
    const customer = await createRes.json() as { id?: string };
    if (customer.id) {
      stripeCustomerId = customer.id;
      // Persist to profile so future calls skip this step
      await supabase.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', ownerId);
    }
  }

  await updateStripeCustomerDubMetadata({
    stripeKey,
    customerId: stripeCustomerId,
    userId: ownerId,
    dubClickId,
  });

  // Build Stripe Checkout session via raw fetch (avoid SDK version issues)
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': packInfo.label,
    'line_items[0][price_data][product_data][description]': `${packInfo.credits} heavy credits — never expire`,
    'line_items[0][price_data][unit_amount]': String(priceCents),
    'line_items[0][quantity]': '1',
    'success_url': `${siteUrl}/dashboard/settings/billing?topup=success`,
    'cancel_url': `${siteUrl}/dashboard/settings/billing#top-up`,
    // Session-level metadata (for checkout.session.completed)
    'metadata[type]': 'credit_topup',
    'metadata[pack]': pack,
    'metadata[credits]': String(packInfo.credits),
    'metadata[user_id]': ownerId,   // Phase 23 Step 5: use ownerId, not userId (top-ups go to owner pool)
    'metadata[price_cents]': String(priceCents),
    // Phase 23 Step 5: PaymentIntent-level metadata so charge.refunded can classify correctly.
    // charge.metadata mirrors PaymentIntent metadata — ensures refund handler reads type=credit_topup
    // regardless of whether Session metadata is available on the charge object.
    'payment_intent_data[metadata][type]': 'credit_topup',
    'payment_intent_data[metadata][pack]': pack,
    'payment_intent_data[metadata][credits]': String(packInfo.credits),
    'payment_intent_data[metadata][user_id]': ownerId,
    'payment_intent_data[metadata][price_cents]': String(priceCents),
  });

  applyDubCheckoutMetadata(params, ownerId, dubClickId, { paymentIntent: true });

  if (stripeCustomerId) {
    params.append('customer', stripeCustomerId);
  } else {
    params.append('customer_creation', 'always');
    if (profile.email) {
      params.append('customer_email', profile.email);
    }
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await stripeRes.json() as { id?: string; url?: string; error?: { message: string } };

  if (!stripeRes.ok || !session.url) {
    console.error('Stripe error:', session.error);
    return NextResponse.json({ error: 'Failed to create checkout session. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
