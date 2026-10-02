import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/api-auth';
import { reconcileProfilesWithStripe, type ReconciliationProfile } from '@/lib/billing/stripe-reconciliation';

const BASE_COLUMNS = 'id,email,plan,billing_status,billing_cycle,stripe_customer_id,stripe_subscription_id,created_at';
const INTERNAL_GRANT_COLUMNS = `${BASE_COLUMNS},internal_grant`;

async function loadPaidActiveProfiles(): Promise<{ profiles: ReconciliationProfile[]; internalGrantColumnAvailable: boolean }> {
  const query = supabaseAdmin
    .from('profiles')
    .select(INTERNAL_GRANT_COLUMNS)
    .in('plan', ['pro', 'operator', 'enterprise'])
    .eq('billing_status', 'active')
    .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (!error) return { profiles: (data ?? []) as ReconciliationProfile[], internalGrantColumnAvailable: true };

  const message = `${error.code ?? ''} ${error.message ?? ''}`;
  if (!message.includes('internal_grant') && error.code !== 'PGRST204' && error.code !== '42703') {
    throw new Error(error.message);
  }

  const fallback = await supabaseAdmin
    .from('profiles')
    .select(BASE_COLUMNS)
    .in('plan', ['pro', 'operator', 'enterprise'])
    .eq('billing_status', 'active')
    .order('created_at', { ascending: true });

  if (fallback.error) throw new Error(fallback.error.message);
  return { profiles: (fallback.data ?? []) as ReconciliationProfile[], internalGrantColumnAvailable: false };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { profiles, internalGrantColumnAvailable } = await loadPaidActiveProfiles();
    const report = await reconcileProfilesWithStripe(profiles);

    return NextResponse.json({
      success: true,
      mode: 'report_only',
      internal_grant_column_available: internalGrantColumnAvailable,
      report,
    });
  } catch (error) {
    console.error('[admin/stripe-reconciliation] failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'reconciliation_failed' }, { status: 500 });
  }
}
