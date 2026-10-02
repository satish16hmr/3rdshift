import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';
import { emailSchema } from '@/src/schema/setting.schema';

const STRIPE_VERSION = '2026-02-25.clover';

async function updateStripeCustomerEmail(customerId: string, email: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error('Stripe is not configured');
  }

  const res = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_VERSION,
    },
    body: new URLSearchParams({ email }).toString(),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.id) {
    const message = typeof json?.error?.message === 'string'
      ? json.error.message
      : 'Stripe customer update failed';
    throw new Error(message);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const rawEmail = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).email
    : null;
  const parsedEmail = emailSchema.safeParse(rawEmail);

  if (!parsedEmail.success) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const email = parsedEmail.data.trim();

  const { data: profile, error: profileReadError } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', auth.userId)
    .single();

  if (profileReadError || !profile) {
    console.error('[account/email-sync] profile read error:', profileReadError);
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.stripe_customer_id) {
    try {
      await updateStripeCustomerEmail(profile.stripe_customer_id, email);
    } catch (error) {
      console.error('[account/email-sync] stripe customer update error:', error);
      return NextResponse.json({ error: 'Billing email update failed' }, { status: 502 });
    }
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from('profiles')
    .update({ email })
    .eq('id', auth.userId);

  if (profileUpdateError) {
    console.error('[account/email-sync] profile email update error:', profileUpdateError);
    return NextResponse.json({ error: 'Profile email update failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
