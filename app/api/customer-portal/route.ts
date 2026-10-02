import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getSafeSiteOrigin } from '@/lib/security';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const workspaceId = request.headers.get('x-workspace-id');

  // If a workspace is selected, enforce owner-only billing actions.
  if (workspaceId) {
    const roleAuth = await requireWorkspaceRole(request, workspaceId, ['owner']);
    if (roleAuth instanceof NextResponse) return roleAuth;
  }

  const origin = getSafeSiteOrigin(request);
  const sk = process.env.STRIPE_SECRET_KEY!;

  // Resolve workspace owner (seat members don't have their own Stripe customer)
  let ownerId = userId;
  if (workspaceId) {
    const { data: wsRow } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();
    if (wsRow?.owner_id) ownerId = wsRow.owner_id;
  }

  // Get the workspace owner's Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', ownerId)
    .single();

  let stripeCustomerId = profile?.stripe_customer_id;

  // Create a Stripe customer on the fly if one doesn't exist yet (manually provisioned accounts)
  if (!stripeCustomerId) {
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', ownerId)
      .single();
    if (ownerProfile?.email) {
      const createRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sk}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ email: ownerProfile.email, 'metadata[user_id]': ownerId }).toString(),
      });
      const customer = await createRes.json() as { id?: string };
      if (customer.id) {
        stripeCustomerId = customer.id;
        await supabaseAdmin.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', ownerId);
      }
    }
  }

  // Use sk (already defined above) for the portal session

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account found. Please contact us through Help & Support in your dashboard.' },
      { status: 400 }
    );
  }

  // Create a Stripe Customer Portal session
  const params = new URLSearchParams({
    customer: stripeCustomerId,
    return_url: `${origin}/dashboard/settings/billing`,
  });

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
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
    console.error('Stripe portal error:', session);
    return NextResponse.json(
      { error: session.error?.message || 'Failed to open billing portal' },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
