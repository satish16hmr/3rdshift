import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/api-auth';
import Stripe from 'stripe';
import { getPlanByPriceId } from '../../../../lib/stripe/config';
import { getPlanHeavyCredits, getPlanLightTaskLimit, BILLING_CATALOG } from '../../../../lib/billing/catalog';
import { resolveAccountFromStripeEvent, applyPlanToAccount, enforceWorkspaceLimitResolution } from '../../../../lib/billing/plan-transitions';
import { getInvoicePeriod, getInvoiceSubscriptionId, grantRenewalPlanCredits, isRenewalInvoicePaymentEvent } from '../../../../lib/billing/renewal-credit-grants';
import type { PlanSlug } from '../../../../lib/billing/types';
import { FOUNDING_CONFIG } from '../../../../lib/founding-config';
import { sendMetaPurchaseEvent } from '../../../../lib/meta/conversions-api';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLAN_RANK: Record<string, number> = { none: 0, starter: 1, pro: 2, operator: 3 };

// Look up plan from any known price ID (regular + founding)
function resolvePlanFromPriceId(priceId: string): string | null {
  const regular = getPlanByPriceId(priceId);
  if (regular) return regular.plan;
  for (const [plan, config] of Object.entries(FOUNDING_CONFIG.plans)) {
    if (config.annual_price_id === priceId || config.monthly_price_id === priceId) {
      return plan;
    }
  }
  return null;
}

// HEAVY_CREDITS sourced from billing catalog — single source of truth
function HEAVY_CREDITS(plan: string): number { return getPlanHeavyCredits(plan); }

function centsToDollars(cents?: number | null) {
  return typeof cents === 'number' && Number.isFinite(cents) ? cents / 100 : 0;
}

function normalizeCurrency(currency?: string | null) {
  return (currency || 'usd').toUpperCase();
}

async function getStripeCustomerEmail(customerId?: string | null) {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && typeof customer.email === 'string') {
      return customer.email;
    }
  } catch (error) {
    console.warn(`[stripe-webhook] Could not retrieve customer email for ${customerId}:`, error);
  }
  return null;
}

async function getSubscriptionPeriod(subscriptionId?: string | null): Promise<{ period_start: string; period_end: string } | undefined> {
  if (!subscriptionId) return undefined;

  const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': '2026-02-25.clover',
    },
  });

  if (!subRes.ok) {
    console.warn(`[stripe-webhook] Could not load subscription period for ${subscriptionId}`);
    return undefined;
  }

  const sub = await subRes.json() as {
    current_period_start?: number;
    current_period_end?: number;
    trial_start?: number;
    trial_end?: number;
    items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
  };

  // Newer Stripe API versions expose subscription periods on subscription items,
  // not always on the top-level subscription. If checkout falls through to the
  // legacy no-period path, checkout.session.completed grants the full balance,
  // then invoice.paid grants the same period again. Always use the item period
  // fallback so both events share one idempotency key in plan_credit_grants.
  const firstItem = sub.items?.data?.[0];
  const periodStart = sub.current_period_start ?? firstItem?.current_period_start ?? sub.trial_start;
  const periodEnd = sub.current_period_end ?? firstItem?.current_period_end ?? sub.trial_end;
  if (!periodStart || !periodEnd) return undefined;

  return {
    period_start: new Date(periodStart * 1000).toISOString(),
    period_end: new Date(periodEnd * 1000).toISOString(),
  };
}

// ── Component 5: Event authenticity verification ─────────────────────────────
// Re-fetches subscription from Stripe to confirm payload status matches live data.
// Fail open: if Stripe API is unavailable, proceed (signature is the primary guard).
async function verifyEventAuthenticity(event: Stripe.Event): Promise<boolean> {
  try {
    const entitlementSubEvents = ['customer.subscription.updated', 'customer.subscription.deleted'];
    if (entitlementSubEvents.includes(event.type)) {
      const sub = event.data.object as Stripe.Subscription;
      const liveRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${sub.id}`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2026-02-25.clover' } }
      );
      if (!liveRes.ok) {
        console.warn(`[authenticity] Could not fetch live subscription ${sub.id} — proceeding (fail open)`);
        return true;
      }
      const liveSub = await liveRes.json();
      if (liveSub.status !== sub.status) {
        console.error(`[CRITICAL] Webhook payload status mismatch: event=${event.id} payload=${sub.status} live=${liveSub.status}`);
        return false;
      }
    }
    return true;
  } catch {
    console.warn(`[authenticity] Verification exception for event ${event.id} — proceeding (fail open)`);
    return true;
  }
}

// ── Component 4: Log plan transition ─────────────────────────────────────────
async function logPlanTransition(params: {
  userId: string;
  workspaceId?: string | null;
  fromPlan: string | null;
  toPlan: string;
  reason: string;
  initiatedBy?: string | null;
  stripeSubscriptionId?: string | null;
  stripeEventId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from('plan_transitions').insert({
      user_id: params.userId,
      workspace_id: params.workspaceId ?? null,
      from_plan: params.fromPlan,
      to_plan: params.toPlan,
      reason: params.reason,
      initiated_by: params.initiatedBy ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_event_id: params.stripeEventId ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (e) {
    console.error('[plan_transitions] Insert failed:', e);
  }
}

async function recordFirstSubscriptionPurchase(params: {
  userId: string;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  chargeId?: string | null;
  chargedAt?: number | null;
}) {
  const firstPurchaseAt = params.chargedAt
    ? new Date(params.chargedAt * 1000).toISOString()
    : new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      first_purchase_at: firstPurchaseAt,
      first_purchase_stripe_charge_id: params.chargeId ?? null,
      first_purchase_stripe_invoice_id: params.invoiceId ?? null,
      first_purchase_stripe_subscription_id: params.subscriptionId ?? null,
    })
    .eq('id', params.userId)
    .is('first_purchase_at', null);

  if (error) {
    throw new Error(`[stripe-webhook] Failed to record first purchase: ${error.message}`);
  }
}

async function getCheckoutChargeInfo(session: {
  invoice?: string | null;
  payment_intent?: string | { id?: string; created?: number } | null;
}): Promise<{ invoiceId: string | null; chargeId: string | null; chargedAt: number | null }> {
  const invoiceId = typeof session.invoice === 'string' ? session.invoice : null;

  if (invoiceId) {
    const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['charge'] } as any) as Stripe.Invoice & {
      charge?: string | Stripe.Charge | null;
    };
    const charge = invoice.charge;
    return {
      invoiceId,
      chargeId: typeof charge === 'string' ? charge : charge?.id ?? null,
      chargedAt: typeof charge === 'string' ? invoice.created ?? null : charge?.created ?? invoice.created ?? null,
    };
  }

  const paymentIntent = session.payment_intent;
  return {
    invoiceId: null,
    chargeId: typeof paymentIntent === 'string' ? null : paymentIntent?.id ?? null,
    chargedAt: typeof paymentIntent === 'string' ? null : paymentIntent?.created ?? null,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: unknown) {
    console.error('Stripe webhook signature verification failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }


  // ── Component 1: Atomic idempotency claim — F1 Phase 13 fix ─────────────────
  // Strategy:
  //   1. Generate a unique owner_token for this attempt.
  //   2. Try INSERT with status='processing', processing_started_at=NOW(), owner_token=myToken.
  //      ON CONFLICT DO NOTHING. If 0 rows inserted → conflict (dup or retry).
  //   3. On conflict: check existing row status.
  //      - completed → skip (idempotent)
  //      - processing + NOT stale → skip (another instance owns it)
  //      - processing + stale (>5 min) OR failed → atomic UPDATE WHERE owner_token still matches
  //        old value or status is failed → only ONE retrier wins (CAS via owner_token)
  //   4. On success path: mark completed WHERE owner_token = myToken (proves ownership)
  //   5. On failure: mark failed WHERE owner_token = myToken
  //
  // This eliminates: (a) created_at column bug — now uses processing_started_at;
  //                  (b) two concurrent retriers both winning — CAS via owner_token.
  const stripeEventId = event.id;
  const myToken = crypto.randomUUID();
  const sessionId = event.type === 'checkout.session.completed'
    ? (event.data.object as { id?: string })?.id ?? null
    : null;

  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Attempt: INSERT as new event
  const { data: insertResult, error: insertError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({
      stripe_event_id: stripeEventId,
      event_type: event.type,
      payload: event.data,
      session_id: sessionId,
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      owner_token: myToken,
    })
    .select('id')
    .maybeSingle();

  if (insertError && insertError.code !== '23505') {
    console.error('[stripe-webhook] Failed to claim event:', stripeEventId, insertError.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  let ownedByMe = !!insertResult;

  if (!ownedByMe) {
    // Conflict: row already exists. Check status.
    const { data: existingEvent } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('id, status, processing_started_at, owner_token')
      .eq('stripe_event_id', stripeEventId)
      .single();

    if (existingEvent?.status === 'completed') {
      console.log(`[stripe-webhook] Duplicate completed event ${stripeEventId} — skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (existingEvent?.status === 'processing') {
      const startedAt = existingEvent.processing_started_at;
      const isStale = !startedAt || startedAt < staleCutoff;

      if (!isStale) {
        // Fresh active run — skip
        console.log(`[stripe-webhook] Event ${stripeEventId} is actively being processed — skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Stale: atomic CAS — only the winner (owner_token changes) proceeds
      const prevToken = existingEvent.owner_token;
      const { data: claimed } = await supabaseAdmin
        .from('stripe_webhook_events')
        .update({
          status: 'processing',
          processing_started_at: new Date().toISOString(),
          owner_token: myToken,
        })
        .eq('stripe_event_id', stripeEventId)
        .eq('status', 'processing')
        .eq('owner_token', prevToken)  // CAS: only update if no other retrier changed it
        .select('id');

      if (!claimed || claimed.length === 0) {
        console.log(`[stripe-webhook] Event ${stripeEventId}: lost CAS race for stale row — skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.log(`[stripe-webhook] Reclaimed stale event ${stripeEventId}`);
      ownedByMe = true;
    } else {
      // status='failed' — atomic reclaim (only one retrier wins by checking owner_token)
      const prevToken = existingEvent?.owner_token ?? null;
      const updateQuery = supabaseAdmin
        .from('stripe_webhook_events')
        .update({
          status: 'processing',
          processing_started_at: new Date().toISOString(),
          owner_token: myToken,
        })
        .eq('stripe_event_id', stripeEventId)
        .eq('status', 'failed');
      const { data: reclaimedFailed } = await updateQuery.select('id');

      if (!reclaimedFailed || reclaimedFailed.length === 0) {
        console.log(`[stripe-webhook] Event ${stripeEventId}: failed row already reclaimed — skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.log(`[stripe-webhook] Retrying failed event ${stripeEventId}`);
      ownedByMe = true;
    }
  }

  if (!ownedByMe) {
    // Should not reach here, but safety net
    return NextResponse.json({ received: true, duplicate: true });
  }

  // ── Component 5: Event authenticity ──────────────────────────────────────
  const entitlementEvents = [
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ];
  if (entitlementEvents.includes(event.type)) {
    const verified = await verifyEventAuthenticity(event);
    if (!verified) {
      console.error(`[CRITICAL] Event authenticity check failed: ${event.id}`);
      // Return 200 to stop retries — this is a suspected tampered event
      return NextResponse.json({ received: true, rejected: true });
    }
  }

  try {
    switch (event.type) {

      // ── checkout.session.completed ──────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as {
          id: string;
          metadata: Record<string, string>;
          customer: string;
          subscription: string;
          invoice?: string;
          payment_intent?: string;
          payment_status?: string;
          amount_total?: number | null;
          currency?: string | null;
          customer_details?: { email?: string };
        };
        const { user_id, plan, billing_cycle, founding_member, founding_reservation_id } = session.metadata;

        // Founding member checkout — F2B fix: verify payment_status + subscription before granting
        if (founding_member === 'true') {
          // Must have confirmed payment before granting founding entitlements
          if (session.payment_status !== 'paid') {
            console.error(`[stripe-webhook] Founding checkout ${stripeEventId} has payment_status=${session.payment_status} — rejecting`);
            return NextResponse.json({ error: 'Payment not confirmed' }, { status: 500 });
          }

          // Verify subscription is active or trialing (not incomplete/past_due/canceled)
          if (session.subscription) {
            const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
              headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2026-02-25.clover' },
            });
            if (subRes.ok) {
              const sub = await subRes.json();
              if (sub.status !== 'active' && sub.status !== 'trialing') {
                console.error(`[stripe-webhook] Founding subscription ${session.subscription} status=${sub.status} — rejecting`);
                return NextResponse.json({ error: 'Subscription not active' }, { status: 500 });
              }
            } else {
              // Stripe API unavailable — fail closed, Stripe will retry
              console.error(`[stripe-webhook] Could not verify founding subscription status — rejecting`);
              return NextResponse.json({ error: 'Could not verify subscription' }, { status: 500 });
            }
          }

          const foundingPlan = session.metadata.founding_tier || 'starter';
          const foundingWave = parseInt(session.metadata.founding_wave || '1');
          const lockedPrice = session.metadata.founding_locked_price
            ? parseInt(session.metadata.founding_locked_price)
            : (foundingPlan === 'starter' ? 19 : foundingPlan === 'pro' ? 59 : 199);

          if (founding_reservation_id) {
            const { data: claimedReservation, error: reservationClaimError } = await supabaseAdmin
              .from('founding_members')
              .update({
                user_id: user_id || null,
                stripe_subscription_id: session.subscription as string,
                stripe_customer_id: session.customer as string,
                stripe_session_id: session.id,
                plan: foundingPlan,
                wave: foundingWave,
                locked_price: lockedPrice,
                reservation_status: 'active',
                reservation_expires_at: null,
              })
              .eq('id', founding_reservation_id)
              .select('id')
              .single();

            if (reservationClaimError || !claimedReservation) {
              console.error(`[stripe-webhook] Could not claim founding reservation ${founding_reservation_id}:`, reservationClaimError);
              return NextResponse.json({ error: 'Founding reservation claim failed' }, { status: 500 });
            }
          } else {
            console.error(`[stripe-webhook] Founding checkout ${session.id} missing founding_reservation_id — rejecting to preserve wave cap`);
            return NextResponse.json({ error: 'Missing founding reservation' }, { status: 500 });
          }

          if (user_id) {
            await supabaseAdmin.from('profiles').update({
              is_founding_member: true,
              founding_tier: foundingPlan,
              founding_wave: foundingWave,
              founding_locked_price: lockedPrice,
              plan: foundingPlan,
              billing_status: 'active',
              billing_delinquent_at: null,
              billing_block_reason: null,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              heavy_credits_remaining: HEAVY_CREDITS(foundingPlan),
              heavy_credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq('id', user_id);

            const chargeInfo = await getCheckoutChargeInfo(session);
            await recordFirstSubscriptionPurchase({
              userId: user_id,
              subscriptionId: session.subscription,
              ...chargeInfo,
            });

            await sendMetaPurchaseEvent({
              eventId: session.id,
              value: centsToDollars(session.amount_total),
              currency: normalizeCurrency(session.currency),
              userData: {
                email: session.customer_details?.email || await getStripeCustomerEmail(session.customer),
              },
              eventTime: chargeInfo.chargedAt ?? event.created,
            });

            // Component 4: log founding plan grant
            await logPlanTransition({
              userId: user_id,
              fromPlan: null,
              toPlan: foundingPlan,
              reason: 'webhook_checkout',
              stripeSubscriptionId: session.subscription,
              stripeEventId,
              metadata: { founding: true, wave: foundingWave },
            });
          }
          break;
        }

        // Top-up credit purchase
        if (session.metadata.type === 'credit_topup' && user_id) {
          const pack = session.metadata.pack as string;
          const credits = parseInt(session.metadata.credits ?? '0');
          const pricePaid = parseInt(session.metadata.price_cents ?? '0');
          const paymentIntent = (session as any).payment_intent;
          const paymentIntentId = typeof paymentIntent === 'string'
            ? paymentIntent
            : (paymentIntent as { id?: string } | null)?.id ?? '';

          if (!paymentIntentId) {
            throw new Error('[stripe-webhook] credit_topup missing payment_intent');
          }

          const { data: existingTopup, error: existingTopupError } = await supabaseAdmin
            .from('credit_topups')
            .select('id')
            .eq('stripe_payment_id', paymentIntentId)
            .maybeSingle();

          if (existingTopupError) {
            throw new Error(`[stripe-webhook] Failed to check existing top-up: ${existingTopupError.message}`);
          }

          if (existingTopup) {
            console.log(`[stripe-webhook] Top-up already granted for payment_intent ${paymentIntentId}`);
            break;
          }

          // F3 fix: top-up credits never expire (locked policy).
          // expires_at set to NULL — credits persist until spent.
          const { error: topupInsertError } = await supabaseAdmin.from('credit_topups').insert({
            user_id,
            pack_name: pack,
            credits_purchased: credits,
            credits_remaining: credits,
            price_paid: pricePaid,
            stripe_payment_id: paymentIntentId,
            expires_at: null,
          });

          if (topupInsertError) {
            throw new Error(`[stripe-webhook] Failed to insert top-up: ${topupInsertError.message}`);
          }

          // Purchased top-ups are stored only in credit_topups. Do not also add
          // them to profiles.heavy_credits_remaining; debit_credits sums the
          // plan bucket plus credit_topups at spend time.

          // Component 1: record session_id for topup-status polling (Component 7)
          // Will be stored in stripe_webhook_events at end of handler with session_id populated
          break;
        }

        // Phase 19: account-level checkout — apply plan to entire account
        // workspace_create case removed (workspaces are now free containers, no per-workspace subscription)
        if (user_id && plan) {
          try {
            const { resolution_method } = await resolveAccountFromStripeEvent(
              supabaseAdmin,
              event as unknown as { type: string; data: { object: Record<string, unknown> } }
            );

            const subscriptionId = session.subscription as string;
            const subscriptionPeriod = await getSubscriptionPeriod(subscriptionId);

            const result = await applyPlanToAccount(
              supabaseAdmin,
              user_id,
              plan as PlanSlug,
              {
                customer_id: session.customer as string,
                subscription_id: subscriptionId,
              },
              subscriptionPeriod
                ? { subscription_id: subscriptionId, ...subscriptionPeriod }
                : undefined
            );

            // Set billing_cycle + reset_at (Stripe-level, not in catalog)
            await supabaseAdmin.from('profiles').update({
              billing_cycle: billing_cycle || 'annual',
              billing_status: 'active',
              billing_delinquent_at: null,
              billing_block_reason: null,
              heavy_credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq('id', user_id);

            const chargeInfo = await getCheckoutChargeInfo(session);
            await recordFirstSubscriptionPurchase({
              userId: user_id,
              subscriptionId,
              ...chargeInfo,
            });

            await sendMetaPurchaseEvent({
              eventId: session.id,
              value: centsToDollars(session.amount_total),
              currency: normalizeCurrency(session.currency),
              userData: {
                email: session.customer_details?.email || await getStripeCustomerEmail(session.customer),
              },
              eventTime: chargeInfo.chargedAt ?? event.created,
            });

            // Phase 19.6: enforce workspace limit resolution after every checkout
            // (upgrades clear resolution; new subscriptions also enforce limits)
            const { resolution_set: checkoutResolution, excess_count: checkoutExcess } =
              await enforceWorkspaceLimitResolution(supabaseAdmin, user_id, plan as PlanSlug);

            await logPlanTransition({
              userId: user_id,
              fromPlan: null,
              toPlan: plan,
              reason: 'webhook_checkout',
              stripeSubscriptionId: session.subscription,
              stripeEventId,
              metadata: { workspaces_updated: result.workspaces_updated, resolution_method, resolution_set: checkoutResolution, excess_count: checkoutExcess },
            });
          } catch (err) {
            console.error('[stripe-webhook] checkout.session.completed account resolution failed:', err);
            return NextResponse.json({ error: 'Account resolution failed' }, { status: 500 });
          }
        }
        break;
      }

      // ── customer.subscription.updated ──────────────────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          id: string;
          customer: string;
          metadata: Record<string, string>;
          status: string;
          current_period_start?: number;
          current_period_end?: number;
          cancel_at_period_end?: boolean;
          items?: { data: Array<{ price: { id: string }; current_period_start?: number; current_period_end?: number }> };
        };

        // Item 4: gate entitlement grants on active/trialing subscription status only.
        // With payment_behavior=default_incomplete, Stripe fires subscription.updated
        // before payment is confirmed. Only grant credits/plan when subscription is paid.
        const ENTITLEMENT_STATUSES = ['active', 'trialing'];
        if (!ENTITLEMENT_STATUSES.includes(sub.status)) {
          console.log(`[stripe-webhook] subscription.updated status=${sub.status} — skipping entitlement grant`);
          break;
        }

        const priceId = sub.items?.data?.[0]?.price?.id;
        const resolvedPlan = priceId ? resolvePlanFromPriceId(priceId) : null;
        const plan = resolvedPlan || sub.metadata?.plan;

        if (plan) {
          try {
            // Phase 19: account-level subscription update
            const { user_id: accountUserId, resolution_method } = await resolveAccountFromStripeEvent(
              supabaseAdmin,
              event as unknown as { type: string; data: { object: Record<string, unknown> } }
            );

            // Phase 23 Step 3: pass period bounds for cycle-aware grant logic
            const firstSubItem = sub.items?.data?.[0];
            const subPeriodStartSeconds = sub.current_period_start ?? firstSubItem?.current_period_start;
            const subPeriodEndSeconds = sub.current_period_end ?? firstSubItem?.current_period_end;
            const subPeriodStart = subPeriodStartSeconds
              ? new Date(subPeriodStartSeconds * 1000).toISOString()
              : null;
            const subPeriodEnd = subPeriodEndSeconds
              ? new Date(subPeriodEndSeconds * 1000).toISOString()
              : null;

            const result = await applyPlanToAccount(
              supabaseAdmin,
              accountUserId,
              plan as PlanSlug,
              {
                customer_id: sub.customer,
                subscription_id: sub.id,
              },
              subPeriodStart && subPeriodEnd
                ? { subscription_id: sub.id, period_start: subPeriodStart, period_end: subPeriodEnd }
                : undefined
            );

            // Clear pending downgrade flags + delinquency (Phase 23 Step 2)
            await supabaseAdmin.from('profiles').update({
              pending_downgrade_plan: null,
              pending_downgrade_date: null,
              billing_status: 'active',
              billing_delinquent_at: null,
              billing_block_reason: null,
            }).eq('id', accountUserId);

            // Component 6: warn if tasks running during plan change
            const { data: runningTasks } = await supabaseAdmin
              .from('tasks').select('id').eq('user_id', accountUserId)
              .in('status', ['pending', 'processing']).limit(1);
            if (runningTasks?.length) {
              console.warn(`[subscription-updated] Plan changed while tasks running for user ${accountUserId} → ${plan}`);
            }

            // Phase 19.6: centralized workspace limit enforcement.
            // Replaces broken isDowngrade block (oldProfile lookup was unreliable after
            // applyPlanToAccount already changed the subscription_id).
            // enforceWorkspaceLimitResolution reads CURRENT state only — no old/new comparison.
            const { resolution_set: updatedResolution, excess_count: updatedExcess } =
              await enforceWorkspaceLimitResolution(supabaseAdmin, accountUserId, plan as PlanSlug);

            await logPlanTransition({
              userId: accountUserId,
              fromPlan: null,
              toPlan: plan,
              reason: 'webhook_subscription_updated',
              stripeSubscriptionId: sub.id,
              stripeEventId,
              metadata: { workspaces_updated: result.workspaces_updated, resolution_method, resolution_set: updatedResolution, excess_count: updatedExcess },
            });
          } catch (err) {
            console.error('[stripe-webhook] subscription.updated account resolution failed:', err);
            return NextResponse.json({ error: 'Account resolution failed' }, { status: 500 });
          }
        }
        break;
      }

      // ── customer.subscription.deleted ──────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as { id: string; metadata?: Record<string, string> };

        // Phase 19: account-level cancellation — cancel access across all workspaces
        try {
          const { user_id: accountUserId, resolution_method } = await resolveAccountFromStripeEvent(
            supabaseAdmin,
            event as unknown as { type: string; data: { object: Record<string, unknown> } }
          );

          const result = await applyPlanToAccount(
            supabaseAdmin,
            accountUserId,
            'none',
            { customer_id: null, subscription_id: null }
          );

          // Phase 19.6: centralized workspace limit enforcement after cancellation.
          // none plan allows 0 workspaces — any existing workspace triggers resolution.
          const { resolution_set: deletedResolution, excess_count: deletedExcess } =
            await enforceWorkspaceLimitResolution(supabaseAdmin, accountUserId, 'none');

          await logPlanTransition({
            userId: accountUserId,
            fromPlan: null,
            toPlan: 'none',
            reason: 'webhook_subscription_deleted',
            stripeSubscriptionId: sub.id,
            stripeEventId,
            metadata: { workspaces_updated: result.workspaces_updated, resolution_method, resolution_set: deletedResolution, excess_count: deletedExcess },
          });
        } catch (err) {
          console.error('[stripe-webhook] subscription.deleted account resolution failed:', err);
          return NextResponse.json({ error: 'Account resolution failed' }, { status: 500 });
        }
        break;
      }

      // ── renewal invoice payment success ─────────────────────────────────
      // Stripe docs distinguish these events as:
      // - invoice.payment_succeeded: payment attempt succeeded (authoritative for paid renewals)
      // - invoice.paid: payment attempt succeeded OR invoice was marked paid out-of-band
      // Handle the webhook event we actually receive, keep invoice.paid as a fallback, and
      // dedupe paired events/replays via plan_credit_grants' period key.
      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        const invoice = event.data.object as unknown as {
          id?: string;
          billing_reason?: string | null;
          subscription?: string | null;
          parent?: {
            subscription_details?: {
              subscription?: string | null;
            };
          };
          metadata?: Record<string, string>;
          // Phase 23 Step 3: invoice-level period bounds (authoritative for this payment)
          period_start?: number;
          period_end?: number;
          amount_paid?: number | null;
          currency?: string | null;
          customer?: string | null;
          customer_email?: string | null;
        };

        if (!isRenewalInvoicePaymentEvent(event.type, invoice.billing_reason)) {
          console.log(`[stripe-webhook] ${event.type} billing_reason=${invoice.billing_reason ?? 'unknown'} — skipping renewal credit grant`);
          break;
        }

        // Phase 22 fix: resolve subscription ID from both Stripe payload shapes.
        // Current Stripe API versions nest it at invoice.parent.subscription_details.subscription.
        // Older events and replays still use top-level invoice.subscription.
        // INV-1: check both so neither shape breaks.
        const subscriptionId = getInvoiceSubscriptionId(invoice);

        // INV-2: warn (not silent skip) when subscription ID can't be resolved.
        if (!subscriptionId) {
          console.warn('[stripe-webhook] renewal invoice payment success received without resolvable subscription ID', {
            event_id: event.id,
            invoice_id: invoice.id,
          });
          break;
        }

        const invoicePeriod = getInvoicePeriod(invoice);
        if (!invoicePeriod) {
          console.warn('[stripe-webhook] renewal invoice payment success received without period bounds', {
            event_id: event.id,
            invoice_id: invoice.id,
            subscription_id: subscriptionId,
          });
          break;
        }

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, plan')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (profile?.plan && profile?.id) {
          const planCredits = HEAVY_CREDITS(profile.plan);
          const grantResult = await grantRenewalPlanCredits(supabaseAdmin, {
            userId: profile.id,
            subscriptionId,
            periodStart: invoicePeriod.periodStart,
            periodEnd: invoicePeriod.periodEnd,
            plan: profile.plan as PlanSlug,
            planCredits,
          });

          if (grantResult.granted) {
            console.log(`[stripe-webhook] renewal grant applied: invoice=${invoice.id ?? 'unknown'} subscription=${subscriptionId} plan=${profile.plan} credits=${planCredits} balance=${grantResult.balance_after}`);
          } else {
            console.log(`[stripe-webhook] renewal grant already processed: invoice=${invoice.id ?? 'unknown'} subscription=${subscriptionId} period=${invoicePeriod.periodStart}`);
          }

          // Phase 23 Step 2 + Phase 21: clear delinquency + set reset_at
          await supabaseAdmin.from('profiles').update({
            heavy_credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            billing_status: 'active',
            billing_delinquent_at: null,
            billing_block_reason: null,
          }).eq('stripe_subscription_id', subscriptionId);

          await sendMetaPurchaseEvent({
            eventId: invoice.id ? `invoice:${invoice.id}` : stripeEventId,
            value: centsToDollars(invoice.amount_paid),
            currency: normalizeCurrency(invoice.currency),
            userData: {
              email: invoice.customer_email || await getStripeCustomerEmail(invoice.customer),
            },
            eventTime: event.created,
          });
        }
        break;
      }

      // ── invoice.payment_failed ───────────────────────────────────────────
      // Phase 23 Step 2: set billing_status = 'past_due' when payment fails.
      // Consumption gates read this field and return 402.
      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as any;
        const failedSubscriptionId =
          typeof failedInvoice.subscription === 'string'
            ? failedInvoice.subscription
            : failedInvoice.parent?.subscription_details?.subscription ?? null;

        if (!failedSubscriptionId) {
          console.warn('[stripe-webhook] invoice.payment_failed without subscription', { event_id: event.id });
          break;
        }

        await supabaseAdmin
          .from('profiles')
          .update({
            billing_status: 'past_due',
            billing_delinquent_at: new Date().toISOString(),
            billing_block_reason: 'invoice_payment_failed',
          })
          .eq('stripe_subscription_id', failedSubscriptionId);

        break;
      }

      // ── Component 3: Refund handling ────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const customerId = charge.customer as string;

        const { data: profile } = await supabaseAdmin
          .from('profiles').select('id, plan, heavy_credits_remaining, first_purchase_stripe_charge_id')
          .eq('stripe_customer_id', customerId).single();

        if (!profile) {
          console.warn(`[refund] No profile for customer ${customerId}`);
          break;
        }

        const refundAmount = charge.amount_refunded;
        const refundReason = charge.refunds?.data?.[0]?.reason ?? 'unknown';
        const chargeMeta = charge.metadata as Record<string, string>;
        const dubClickId = chargeMeta?.dubClickId || chargeMeta?.dub_id || null;
        let actionTaken = 'no_action';
        let refundMetadata: Record<string, unknown> = {
          guarantee_flow: chargeMeta?.guarantee_flow === 'true' || chargeMeta?.refund_policy === '7_day_guarantee',
          dub_click_id_present: Boolean(dubClickId),
          dub_commission_void: dubClickId ? 'stripe_refund_should_void_associated_commission' : 'no_dub_click_id',
        };

        // Claim this refunded charge before side effects. The DB has a partial
        // unique index on charge.refunded/stripe_charge_id, so a second Stripe
        // event for the same charge becomes a no-op before downgrade/deduction.
        const { error: refundClaimError } = await supabaseAdmin.from('refund_events').insert({
          user_id: profile.id,
          stripe_charge_id: charge.id,
          stripe_payment_intent_id: charge.payment_intent as string,
          stripe_event_id: stripeEventId,
          event_type: event.type,
          amount_cents: refundAmount,
          reason: refundReason,
          action_taken: 'processing',
          metadata: refundMetadata,
        });

        if (refundClaimError) {
          if (refundClaimError.code === '23505') {
            console.log(`[refund] charge.refunded already processed for charge ${charge.id}; skipping replay event ${stripeEventId}`);
            break;
          }
          throw new Error(`[refund] Failed to claim refund event for charge ${charge.id}: ${refundClaimError.message}`);
        }

        // Phase 23 Step 5: charge.metadata mirrors PaymentIntent metadata (set in topup-checkout).
        // Classification reads charge.metadata.type — always present for top-up charges.
        if (chargeMeta?.type === 'credit_topup') {
          // Top-up refund — purchased credits live only in credit_topups. Zero
          // the matching PaymentIntent row atomically under a DB row lock; do
          // not burn the user's monthly plan bucket in profiles.
          const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
          if (!paymentIntentId) {
            console.warn(`[refund] credit_topup charge ${charge.id} missing payment_intent; cannot zero top-up row`);
            actionTaken = 'topup_refund_missing_payment_intent';
          } else {
            const { data: topupRefundRows, error: topupRefundError } = await supabaseAdmin.rpc('zero_refunded_credit_topup', {
              p_user_id: profile.id,
              p_stripe_payment_intent_id: paymentIntentId,
              p_stripe_charge_id: charge.id,
              p_stripe_event_id: stripeEventId,
            });

            if (topupRefundError) {
              throw new Error(`[refund] Failed to zero refunded top-up for charge ${charge.id}: ${topupRefundError.message}`);
            }

            const topupRefund = Array.isArray(topupRefundRows) ? topupRefundRows[0] : topupRefundRows;
            actionTaken = topupRefund?.ok ? 'topup_zeroed' : 'topup_not_found';
          }
        } else {
          // Phase 23 Step 6: subscription refund — route through applyPlanToAccount.
          // Ensures workspaces, seats, integrations, and resolution state all align.
          // Replaces raw profile.update({ plan: 'none', heavy_credits_remaining: 0 }).
          await applyPlanToAccount(supabaseAdmin, profile.id, 'none', {
            customer_id: null,
            subscription_id: null,
          });
          await enforceWorkspaceLimitResolution(supabaseAdmin, profile.id, 'none');

          await logPlanTransition({
            userId: profile.id,
            fromPlan: profile.plan,
            toPlan: 'none',
            reason: 'refund',
            stripeEventId,
            metadata: { charge_id: charge.id, amount_refunded: refundAmount },
          });
          actionTaken = 'plan_downgraded';
          refundMetadata = {
            ...refundMetadata,
            subscription_refund_processed: true,
            first_purchase_charge_id: profile.first_purchase_stripe_charge_id ?? null,
          };
        }

        const { error: refundUpdateError } = await supabaseAdmin
          .from('refund_events')
          .update({ action_taken: actionTaken, metadata: refundMetadata })
          .eq('stripe_charge_id', charge.id)
          .eq('event_type', event.type);

        if (refundUpdateError) {
          throw new Error(`[refund] Failed to finalize refund event for charge ${charge.id}: ${refundUpdateError.message}`);
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        // Fetch charge to get customer
        let customerId: string | null = null;
        try {
          const chargeRes = await stripe.charges.retrieve(dispute.charge as string);
          customerId = chargeRes.customer as string;
        } catch (e) {
          console.error('[dispute] Could not retrieve charge:', e);
          break;
        }

        const { data: profile } = await supabaseAdmin
          .from('profiles').select('id, plan').eq('stripe_customer_id', customerId).single();
        if (!profile) break;

        // Phase 23 Step 6: dispute — route through applyPlanToAccount.
        await applyPlanToAccount(supabaseAdmin, profile.id, 'none', {
          customer_id: null,
          subscription_id: null,
        });
        await enforceWorkspaceLimitResolution(supabaseAdmin, profile.id, 'none');

        // Set dispute_pending flag (not part of plan-transitions; dispute-specific state)
        await supabaseAdmin.from('profiles').update({
          dispute_pending: true,
        }).eq('id', profile.id);

        await logPlanTransition({
          userId: profile.id, fromPlan: profile.plan, toPlan: 'none',
          reason: 'dispute', stripeEventId,
          metadata: { dispute_id: dispute.id, dispute_reason: dispute.reason },
        });

        await supabaseAdmin.from('refund_events').insert({
          user_id: profile.id,
          stripe_charge_id: dispute.charge as string,
          stripe_event_id: stripeEventId,
          event_type: event.type,
          amount_cents: dispute.amount,
          reason: dispute.reason,
          action_taken: 'dispute_flagged',
        });
        break;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        let customerId: string | null = null;
        try {
          const chargeRes = await stripe.charges.retrieve(dispute.charge as string);
          customerId = chargeRes.customer as string;
        } catch (e) {
          console.error('[dispute] Could not retrieve charge:', e);
          break;
        }

        const { data: profile } = await supabaseAdmin
          .from('profiles').select('id').eq('stripe_customer_id', customerId).single();
        if (!profile) break;

        // Clear dispute flag regardless of outcome
        await supabaseAdmin.from('profiles').update({ dispute_pending: false }).eq('id', profile.id);

        if (dispute.status === 'won') {
          // Attempt to restore prior plan from plan_transitions
          const { data: lastTransition } = await supabaseAdmin
            .from('plan_transitions')
            .select('from_plan')
            .eq('user_id', profile.id)
            .eq('reason', 'dispute')
            .order('occurred_at', { ascending: false })
            .limit(1)
            .single();

          if (lastTransition?.from_plan && lastTransition.from_plan !== 'none') {
            await supabaseAdmin.from('profiles').update({
              plan: lastTransition.from_plan,
              heavy_credits_remaining: HEAVY_CREDITS(lastTransition.from_plan),
            }).eq('id', profile.id);
            await logPlanTransition({
              userId: profile.id, fromPlan: 'none', toPlan: lastTransition.from_plan,
              reason: 'dispute', stripeEventId,
              metadata: { dispute_id: dispute.id, outcome: 'won', restored: true },
            });
          }
        }

        await supabaseAdmin.from('refund_events').insert({
          user_id: profile.id,
          stripe_charge_id: dispute.charge as string,
          stripe_event_id: stripeEventId,
          event_type: event.type,
          amount_cents: dispute.amount,
          reason: dispute.reason,
          action_taken: 'dispute_resolved',
        });
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Mark event as failed so next retry can reclaim and reprocess
    // (status='processing' rows are retryable; 'completed' rows are skipped)
    // Non-fatal status update — fire and forget, don't mask the original error
    // Mark failed — scoped to our owner_token so we don't clobber a concurrent winner
    void supabaseAdmin
      .from('stripe_webhook_events')
      .update({ status: 'failed' })
      .eq('stripe_event_id', stripeEventId)
      .eq('owner_token', myToken);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  // Mark completed — scoped to our owner_token
  const { error: completeError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('stripe_event_id', stripeEventId)
    .eq('owner_token', myToken);

  if (completeError) {
    console.error('[stripe-webhook] Failed to mark event completed:', completeError.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
