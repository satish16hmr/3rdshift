import { NextRequest } from 'next/server';

function cleanDubClickId(value?: string | null) {
  const clean = value?.trim();
  return clean || undefined;
}

export function getDubClickId(request: NextRequest) {
  const queryClickId = cleanDubClickId(request.nextUrl?.searchParams.get('dub_id'));
  if (queryClickId) return queryClickId;

  const exactCookie = cleanDubClickId(request.cookies.get('dub_id')?.value);
  if (exactCookie) return exactCookie;

  const prefixedCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith('dub_id_'));

  return cleanDubClickId(prefixedCookie?.value);
}

export function applyDubCheckoutMetadata(
  params: URLSearchParams,
  userId: string,
  dubClickId?: string,
  options: { subscription?: boolean; paymentIntent?: boolean } = {}
) {
  params.set('metadata[dubCustomerExternalId]', userId);
  if (dubClickId) {
    params.set('metadata[dubClickId]', dubClickId);
    params.set('client_reference_id', `dub_id_${dubClickId}`);
  }

  if (options.subscription) {
    params.set('subscription_data[metadata][dubCustomerExternalId]', userId);
    if (dubClickId) {
      params.set('subscription_data[metadata][dubClickId]', dubClickId);
    }
  }

  if (options.paymentIntent) {
    params.set('payment_intent_data[metadata][dubCustomerExternalId]', userId);
    if (dubClickId) {
      params.set('payment_intent_data[metadata][dubClickId]', dubClickId);
    }
  }
}

export async function updateStripeCustomerDubMetadata({
  stripeKey,
  customerId,
  userId,
  dubClickId,
}: {
  stripeKey: string;
  customerId?: string | null;
  userId: string;
  dubClickId?: string;
}) {
  if (!customerId || !dubClickId) return;

  const params = new URLSearchParams({
    'metadata[dubCustomerExternalId]': userId,
    'metadata[dubClickId]': dubClickId,
  });

  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2026-02-25.clover',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    console.warn('[dub-stripe] Failed to update Stripe customer metadata', {
      customerId,
      status: res.status,
    });
  }
}
