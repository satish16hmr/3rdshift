import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/api-auth';
import {
  GUARANTEE_DAYS,
  GUARANTEE_HEAVY_CREDIT_THRESHOLD,
  GUARANTEE_LIGHT_TASK_THRESHOLD,
  getGuaranteeEligibility,
  getWeekOneHeavyCap,
} from '@/lib/billing/guarantee';

function normalizeAccount(input: string) {
  return input.trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function findProfile(account: string) {
  const value = normalizeAccount(account);
  if (!value) return null;

  const columns = `
    id,
    email,
    plan,
    billing_status,
    stripe_customer_id,
    stripe_subscription_id,
    first_purchase_at,
    first_purchase_stripe_charge_id,
    first_purchase_stripe_invoice_id,
    first_purchase_stripe_subscription_id,
    guarantee_heavy_cap_lifted_at,
    guarantee_heavy_cap_lifted_by,
    guarantee_heavy_cap_lift_reason
  `;

  if (isUuid(value)) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(columns)
      .eq('id', value)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const { data: customerMatch, error: customerError } = await supabaseAdmin
    .from('profiles')
    .select(columns)
    .eq('stripe_customer_id', value)
    .limit(1)
    .maybeSingle();

  if (customerError) throw new Error(customerError.message);
  if (customerMatch) return customerMatch;

  const { data: emailMatch, error: emailError } = await supabaseAdmin
    .from('profiles')
    .select(columns)
    .eq('email', value)
    .limit(1)
    .maybeSingle();

  if (emailError) throw new Error(emailError.message);
  if (emailMatch) return emailMatch;

  if (value.includes('@')) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(columns)
      .ilike('email', `%${value}%`)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const account = request.nextUrl.searchParams.get('account') ?? '';
    const profile = await findProfile(account);

    if (!profile) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const eligibility = await getGuaranteeEligibility(supabaseAdmin, { userId: profile.id });
    const heavyCap = getWeekOneHeavyCap(profile.plan);

    return NextResponse.json({
      account: {
        id: profile.id,
        email: profile.email,
        plan: profile.plan,
        billing_status: profile.billing_status,
        stripe_customer_id: profile.stripe_customer_id,
        stripe_subscription_id: profile.stripe_subscription_id,
      },
      guarantee: {
        days: GUARANTEE_DAYS,
        first_purchase_at: profile.first_purchase_at,
        first_purchase_stripe_charge_id: profile.first_purchase_stripe_charge_id,
        first_purchase_stripe_invoice_id: profile.first_purchase_stripe_invoice_id,
        first_purchase_stripe_subscription_id: profile.first_purchase_stripe_subscription_id,
        ...eligibility,
        thresholds: {
          light_tasks: GUARANTEE_LIGHT_TASK_THRESHOLD,
          heavy_credits: GUARANTEE_HEAVY_CREDIT_THRESHOLD,
        },
      },
      heavy_cap: {
        cap: heavyCap,
        lifted_at: profile.guarantee_heavy_cap_lifted_at,
        lifted_by: profile.guarantee_heavy_cap_lifted_by,
        lift_reason: profile.guarantee_heavy_cap_lift_reason,
      },
    });
  } catch (error) {
    console.error('[admin/refund-guarantee] GET failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load guarantee data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const account = normalizeAccount(body.account ?? '');
    const reason = String(body.reason ?? '').trim().slice(0, 500) || 'Admin lifted week-one heavy cap';
    const profile = await findProfile(account);

    if (!profile) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        guarantee_heavy_cap_lifted_at: new Date().toISOString(),
        guarantee_heavy_cap_lifted_by: admin.userId,
        guarantee_heavy_cap_lift_reason: reason,
      })
      .eq('id', profile.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, account_id: profile.id });
  } catch (error) {
    console.error('[admin/refund-guarantee] POST failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to lift cap' }, { status: 500 });
  }
}
