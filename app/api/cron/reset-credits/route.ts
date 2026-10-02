import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { verifyCronRequest } from '@/lib/cron-auth';
import { getPlanHeavyCredits, getPlanLightTaskLimit } from '@/lib/billing/catalog';
import { reconcileProfilesWithStripe, type ReconciliationProfile } from '@/lib/billing/stripe-reconciliation';

const supabase = supabaseAdmin;

// F2: use catalog for plan credits (removed hardcoded PLAN_CREDITS map)
const PLAN_CREDITS: Record<string, number> = {
  starter: getPlanHeavyCredits('starter'),
  pro: getPlanHeavyCredits('pro'),
  operator: getPlanHeavyCredits('operator'),
  enterprise: 500, // enterprise is custom, not in catalog
};

const BASE_PROFILE_COLUMNS = 'id,email,plan,billing_status,billing_cycle,stripe_customer_id,stripe_subscription_id,heavy_credits_remaining,heavy_credits_reset_at,created_at';
const INTERNAL_GRANT_PROFILE_COLUMNS = `${BASE_PROFILE_COLUMNS},internal_grant`;

async function addMaintenanceEligibility(profiles: ReconciliationProfile[]) {
  const report = await reconcileProfilesWithStripe(profiles);
  const eligible = new Set<string>([
    ...report.verified.map((entry) => entry.id),
    ...report.internal_grants.map((entry) => entry.id),
  ]);
  const skipped = [...report.orphaned, ...report.mismatched, ...report.errors];
  return { report, eligible, skipped };
}

async function loadProfilesForMaintenance(userIds: string[]) {
  if (userIds.length === 0) return { profiles: [] as ReconciliationProfile[], internalGrantColumnAvailable: true };

  const withInternalGrant = await supabase
    .from('profiles')
    .select(INTERNAL_GRANT_PROFILE_COLUMNS)
    .in('id', userIds);

  if (!withInternalGrant.error) {
    return { profiles: (withInternalGrant.data ?? []) as ReconciliationProfile[], internalGrantColumnAvailable: true };
  }

  const message = `${withInternalGrant.error.code ?? ''} ${withInternalGrant.error.message ?? ''}`;
  if (!message.includes('internal_grant') && withInternalGrant.error.code !== 'PGRST204' && withInternalGrant.error.code !== '42703') {
    throw new Error(withInternalGrant.error.message);
  }

  const fallback = await supabase
    .from('profiles')
    .select(BASE_PROFILE_COLUMNS)
    .in('id', userIds);

  if (fallback.error) throw new Error(fallback.error.message);
  return { profiles: (fallback.data ?? []) as ReconciliationProfile[], internalGrantColumnAvailable: false };
}

export async function GET(request: NextRequest) {
  const cronAuth = verifyCronRequest(request);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Find all profiles where credits need resetting:
  // - plan is not 'none'
  // - heavy_credits_reset_at is in the past (or null)
  // - plan has credits (pro or operator)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(INTERNAL_GRANT_PROFILE_COLUMNS)
    .in('plan', ['pro', 'operator', 'enterprise'])
    .eq('billing_status', 'active')
    .or(`heavy_credits_reset_at.lt.${now},heavy_credits_reset_at.is.null`);

  let profilesToReset = (profiles ?? []) as ReconciliationProfile[];
  let internalGrantColumnAvailable = true;

  if (error) {
    const message = `${error.code ?? ''} ${error.message ?? ''}`;
    if (!message.includes('internal_grant') && error.code !== 'PGRST204' && error.code !== '42703') {
      console.error('Credit reset query error:', error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    internalGrantColumnAvailable = false;
    const fallback = await supabase
      .from('profiles')
      .select(BASE_PROFILE_COLUMNS)
      .in('plan', ['pro', 'operator', 'enterprise'])
      .eq('billing_status', 'active')
      .or(`heavy_credits_reset_at.lt.${now},heavy_credits_reset_at.is.null`);

    if (fallback.error) {
      console.error('Credit reset fallback query error:', fallback.error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
    profilesToReset = (fallback.data ?? []) as ReconciliationProfile[];
  }

  const heavyEligibility = await addMaintenanceEligibility(profilesToReset);

  let reset = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const profile of profilesToReset || []) {
    const credits = PLAN_CREDITS[profile.plan ?? ''] ?? 0;

    if (credits === 0) {
      skipped++;
      continue;
    }

    if (!heavyEligibility.eligible.has(profile.id)) {
      skipped++;
      console.warn('[reset-credits] skipped heavy reset for unverified paid profile', {
        id: profile.id,
        email: profile.email,
        plan: profile.plan,
      });
      continue;
    }

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        // Reset only the monthly plan bucket. Purchased top-ups remain in
        // credit_topups and are added by debit_credits at spend time.
        heavy_credits_remaining: credits,
        heavy_credits_reset_at: nextReset.toISOString(),
        updated_at: now,
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error(`Failed to reset credits for ${profile.id}:`, updateError);
      errors.push(profile.id);
    } else {
      reset++;
    }
  }

  // F10: Reset light_task_count for workspaces whose billing period has started/passed.
  // Billing period anchor = light_task_period_start (set when workspace was provisioned).
  // Workspaces with NULL period_start: initialize it to now (first cycle).
  let lightReset = 0;
  try {
    // Initialize workspaces with no period_start
    const { error: initLightError } = await supabase
      .from('workspaces')
      .update({ light_task_period_start: now })
      .is('light_task_period_start', null)
      .neq('plan', 'none');

    if (initLightError) {
      console.error('[reset-credits] light_task period initialization failed:', initLightError);
      return NextResponse.json({ error: 'light_task_period_init_failed', message: initLightError.message }, { status: 500 });
    }

    // Find workspaces whose light-task period is at least one calendar month old.
    // This avoids early resets in 30/31 day billing months.
    const periodCutoffDate = new Date();
    periodCutoffDate.setMonth(periodCutoffDate.getMonth() - 1);
    const periodCutoff = periodCutoffDate.toISOString();
    const { data: wsToReset, error: wsToResetError } = await supabase
      .from('workspaces')
      .select('id, owner_id, plan, light_task_period_start')
      .neq('plan', 'none')
      .lt('light_task_period_start', periodCutoff);

    if (wsToResetError) {
      console.error('[reset-credits] light_task reset query failed:', wsToResetError);
      return NextResponse.json({ error: 'light_task_reset_query_failed', message: wsToResetError.message }, { status: 500 });
    }

    const ownerIds = Array.from(new Set((wsToReset || []).map((ws) => ws.owner_id).filter(Boolean))) as string[];
    const ownerProfiles = await loadProfilesForMaintenance(ownerIds);
    if (!ownerProfiles.internalGrantColumnAvailable) internalGrantColumnAvailable = false;
    const lightEligibility = await addMaintenanceEligibility(ownerProfiles.profiles);

    for (const ws of wsToReset || []) {
      const limit = getPlanLightTaskLimit(ws.plan);
      if (limit === 0) continue;

      if (!ws.owner_id || !lightEligibility.eligible.has(ws.owner_id)) {
        console.warn('[reset-credits] skipped light reset for unverified workspace owner', {
          workspaceId: ws.id,
          ownerId: ws.owner_id,
          plan: ws.plan,
        });
        continue;
      }

      const { error: updateLightError } = await supabase.from('workspaces').update({
        light_task_count: 0,
        light_task_period_start: now,
      }).eq('id', ws.id);

      if (updateLightError) {
        console.error(`[reset-credits] failed to reset light tasks for workspace ${ws.id}:`, updateLightError);
        return NextResponse.json({ error: 'light_task_workspace_reset_failed', workspaceId: ws.id, message: updateLightError.message }, { status: 500 });
      }
      lightReset++;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown light task reset error';
    console.error('[reset-credits] light_task reset failed:', e);
    return NextResponse.json({ error: 'light_task_reset_failed', message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    reset,
    skipped,
    lightReset,
    guarded: true,
    internalGrantColumnAvailable,
    stripeReconciliation: {
      heavy: heavyEligibility.report.summary,
      heavySkippedUnverified: heavyEligibility.skipped.length,
    },
    errors: errors.length > 0 ? errors : undefined,
    timestamp: now,
  });
}

// Auto-fail tasks stuck > 5 minutes — called from the same cron
export async function timeoutStaleTasks() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: stuck } = await supabase
    .from('tasks')
    .select('id')
    .in('status', ['pending', 'processing'])
    .lt('created_at', fiveMinAgo);
  for (const t of stuck || []) {
    await supabase.from('tasks').update({
      status: 'failed',
      error_message: 'Task timed out — please try again.',
    }).eq('id', t.id);
  }
  return stuck?.length ?? 0;
}
