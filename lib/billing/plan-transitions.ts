/**
 * lib/billing/plan-transitions.ts
 *
 * Single source of truth for all plan state transitions.
 * Phase 19: account-level billing model.
 * Phase 19.6: top-up preservation + centralized workspace limit enforcement.
 *
 * resolveAccountFromStripeEvent()
 *   → Determines which user account a Stripe event applies to.
 *   → metadata.user_id → stripe_customer_id → stripe_subscription_id
 *   → Throws if no account can be resolved.
 *
 * applyPlanToAccount()
 *   → Applies a plan to an entire user account atomically.
 *   → Updates profile (source of truth) first.
 *   → Preserves paid top-up credits across plan transitions (Phase 19.6).
 *   → Propagates to ALL workspaces owned by the user.
 *   → Clears integration tokens on cancellation (plan = 'none').
 *   → Idempotent — same call with same args produces same result.
 *
 * enforceWorkspaceLimitResolution()  [Phase 19.6]
 *   → Single source of truth for workspace over-limit resolution state.
 *   → Reads CURRENT workspace count vs new plan's max_workspaces.
 *   → Sets requires_workspace_resolution when over-limit.
 *   → Clears it when at or under limit (upgrade path).
 *   → MUST be called after every plan transition (checkout, updated, deleted).
 *   → Does NOT depend on comparing old vs new plan — current-state only.
 *
 * Invariants enforced after applyPlanToAccount + enforceWorkspaceLimitResolution:
 *   1. profile.plan === plan_slug (source of truth)
 *   2. profile.heavy_credits_remaining === planConfig.heavy_credits (plan bucket only)
 *   3. ALL workspaces owned by user: workspace.plan === plan_slug
 *   4. ALL workspaces: heavy_credits_limit, light_tasks_limit, max_seats from catalog
 *   5. plan === 'none' → all integration tokens deleted across all workspaces
 *   6. stripe_customer_id + stripe_subscription_id set on profile
 *   7. requires_workspace_resolution reflects current workspace count vs plan limit
 *
 * Phase 19 — 2026-04-30. Phase 19.6 — 2026-04-30.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BILLING_CATALOG } from './catalog';
import { calculatePlanCreditBalance } from './credit-balance';
import type { PlanSlug, StripePlanData, PlanTransitionResult } from './types';

// ─── Account resolution ────────────────────────────────────────────────────────

/**
 * Resolves which user account a Stripe event applies to.
 *
 * Priority:
 * 1. metadata.user_id (set on Checkout session creation)
 * 2. stripe_customer_id lookup in profiles table
 * 3. stripe_subscription_id lookup in profiles table
 *
 * Throws if no account can be resolved. Caller should return 500 so Stripe retries.
 */
export async function resolveAccountFromStripeEvent(
  supabase: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: { type: string; data: { object: any } }
): Promise<{ user_id: string; resolution_method: 'metadata' | 'customer_id' | 'subscription_id' }> {
  const obj = event.data.object;

  // Priority 1: explicit user_id in metadata (set at checkout creation)
  if (obj.metadata?.user_id) {
    return { user_id: obj.metadata.user_id, resolution_method: 'metadata' };
  }

  // Priority 2: stripe_customer_id lookup
  if (obj.customer) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', obj.customer)
      .maybeSingle();
    if (profile) {
      return { user_id: profile.id, resolution_method: 'customer_id' };
    }
  }

  // Priority 3: subscription_id lookup
  const subscriptionId: string | null = obj.subscription || obj.id || null;
  if (subscriptionId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (profile) {
      return { user_id: profile.id, resolution_method: 'subscription_id' };
    }
  }

  throw new Error(
    `[plan-transitions] Cannot resolve account for Stripe event ${event.type}. ` +
    `Missing metadata.user_id and no profile found by customer_id or subscription_id=${subscriptionId}.`
  );
}

// ─── Workspace limit enforcement (Phase 19.6) ────────────────────────────────

/**
 * Enforces workspace count limits after any plan transition.
 *
 * Single source of truth for requires_workspace_resolution state.
 * Does NOT compare old vs new plan — reads current workspace count only.
 * This avoids the silent failure bug where oldProfile lookup returns null
 * after applyPlanToAccount has already updated the subscription ID.
 *
 * MUST be called after every plan transition:
 *   - checkout.session.completed (new subscription)
 *   - customer.subscription.updated (upgrade OR downgrade)
 *   - customer.subscription.deleted (cancellation)
 *   - workspace/delete (after workspace is removed)
 *
 * Upgrades naturally clear resolution state when max_workspaces >= current count.
 */
export async function enforceWorkspaceLimitResolution(
  supabase: SupabaseClient,
  user_id: string,
  new_plan: PlanSlug
): Promise<{ resolution_set: boolean; excess_count: number }> {
  const planConfig = BILLING_CATALOG[new_plan];
  if (!planConfig) {
    throw new Error(`[plan-transitions] enforceWorkspaceLimitResolution: unknown plan_slug: ${new_plan}`);
  }

  const { count: workspaceCount } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user_id);

  const owned = workspaceCount ?? 0;
  const maxAllowed = planConfig.max_workspaces;

  if (owned > maxAllowed) {
    await supabase
      .from('profiles')
      .update({
        requires_workspace_resolution: true,
        resolution_target_plan: new_plan,
        resolution_excess_count: owned - maxAllowed,
      })
      .eq('id', user_id);

    console.warn(
      `[plan-transitions] workspace resolution SET: user=${user_id} plan=${new_plan} ` +
      `owned=${owned} max=${maxAllowed} excess=${owned - maxAllowed}`
    );
    return { resolution_set: true, excess_count: owned - maxAllowed };
  } else {
    await supabase
      .from('profiles')
      .update({
        requires_workspace_resolution: false,
        resolution_target_plan: null,
        resolution_excess_count: null,
      })
      .eq('id', user_id);

    return { resolution_set: false, excess_count: 0 };
  }
}

// ─── Plan application ──────────────────────────────────────────────────────────

function isMissingHeavyCreditAuditTableError(errorMessage: string) {
  return errorMessage.includes('heavy_credit_grant_audit_log') && (
    errorMessage.includes('does not exist') ||
    errorMessage.includes('schema cache') ||
    errorMessage.includes('relation')
  );
}

async function fallbackClaimPlanCreditGrant(
  supabase: SupabaseClient,
  user_id: string,
  period: { subscription_id: string; period_start: string; period_end: string },
  plan_slug: PlanSlug,
  planCredits: number
): Promise<{ granted_delta: number; granted_credits: number; balance_after: number }> {
  const desiredCredits = Math.max(planCredits ?? 0, 0);
  const { data: existingGrant, error: existingGrantError } = await supabase
    .from('plan_credit_grants')
    .select('id, granted_credits')
    .eq('user_id', user_id)
    .eq('stripe_subscription_id', period.subscription_id)
    .eq('stripe_period_start', period.period_start)
    .maybeSingle();

  if (existingGrantError) {
    throw new Error(`[plan-transitions] Fallback grant lookup failed: ${existingGrantError.message}`);
  }

  const existingCredits = existingGrant?.granted_credits ?? 0;
  const nextGrantedCredits = Math.max(existingCredits, desiredCredits);
  const delta = nextGrantedCredits - existingCredits;

  if (existingGrant) {
    if (nextGrantedCredits > existingCredits) {
      const { error: updateGrantError } = await supabase
        .from('plan_credit_grants')
        .update({
          granted_credits: nextGrantedCredits,
          stripe_period_end: period.period_end,
          plan: plan_slug,
        })
        .eq('id', existingGrant.id);

      if (updateGrantError) {
        throw new Error(`[plan-transitions] Fallback grant update failed: ${updateGrantError.message}`);
      }
    }
  } else {
    const { error: insertGrantError } = await supabase
      .from('plan_credit_grants')
      .insert({
        user_id,
        stripe_subscription_id: period.subscription_id,
        stripe_period_start: period.period_start,
        stripe_period_end: period.period_end,
        plan: plan_slug,
        granted_credits: nextGrantedCredits,
      });

    if (insertGrantError) {
      if (insertGrantError.code === '23505') {
        return fallbackClaimPlanCreditGrant(supabase, user_id, period, plan_slug, planCredits);
      }
      throw new Error(`[plan-transitions] Fallback grant insert failed: ${insertGrantError.message}`);
    }
  }

  const { data: profile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('heavy_credits_remaining')
    .eq('id', user_id)
    .single();

  if (profileLookupError) {
    throw new Error(`[plan-transitions] Fallback profile lookup failed: ${profileLookupError.message}`);
  }

  const balanceBefore = profile?.heavy_credits_remaining ?? 0;
  const balanceAfter = existingGrant ? Math.max(0, balanceBefore + delta) : desiredCredits;
  if (delta > 0 && balanceBefore !== balanceAfter) {
    const { error: creditUpdateError } = await supabase
      .from('profiles')
      .update({ heavy_credits_remaining: balanceAfter })
      .eq('id', user_id);

    if (creditUpdateError) {
      throw new Error(`[plan-transitions] Fallback credit update failed: ${creditUpdateError.message}`);
    }
  }

  return {
    granted_delta: delta,
    granted_credits: nextGrantedCredits,
    balance_after: balanceAfter,
  };
}

/**
 * Applies a plan to an entire user account — single source of truth.
 *
 * Updates profile (plan source of truth) first, then propagates plan + limits
 * to ALL workspaces owned by the user. Purchased top-ups live only in
 * credit_topups and are added by debit_credits at spend time.
 *
 * Phase 19.6: Preserves paid top-up credits across transitions by leaving
 * credit_topups untouched. The stored profile balance is the plan bucket only.
 *
 * Idempotent — calling twice with the same args produces the same result.
 */
export async function applyPlanToAccount(
  supabase: SupabaseClient,
  user_id: string,
  plan_slug: PlanSlug,
  stripe_data: StripePlanData,
  // Phase 23 Step 3: optional period bounds for cycle-aware grant logic.
  // When provided, credits are granted via delta (only the amount not yet granted
  // this period). When absent (e.g. checkout first-grant), full plan credits granted.
  period?: { subscription_id: string; period_start: string; period_end: string }
): Promise<PlanTransitionResult> {
  const planConfig = BILLING_CATALOG[plan_slug];
  if (!planConfig) {
    throw new Error(`[plan-transitions] Unknown plan_slug: ${plan_slug}`);
  }

  // Phase 23 Step 3: cycle-aware heavy credit grant.
  // If period is provided: grant only the delta between what's already been granted
  // this period and the plan's full allowance. Prevents re-granting credits on cycling.
  // If no period: fall through to legacy full-grant path (checkout, manual transitions).
  let newCreditsRemaining: number;
  let shouldWritePlanCredits = true;

  if (period && plan_slug !== 'none') {
    const planCredits = planConfig.heavy_credits;

    const { data: grantRows, error: grantRpcError } = await supabase.rpc('claim_plan_credit_grant', {
      p_user_id: user_id,
      p_stripe_subscription_id: period.subscription_id,
      p_stripe_period_start: period.period_start,
      p_stripe_period_end: period.period_end,
      p_plan: plan_slug,
      p_plan_credits: planCredits,
    });

    let grantResult = Array.isArray(grantRows) ? grantRows[0] : grantRows;

    if (grantRpcError) {
      if (isMissingHeavyCreditAuditTableError(grantRpcError.message)) {
        console.warn('[plan-transitions] heavy_credit_grant_audit_log missing; using REST fallback for plan credit grant until migration is applied');
        grantResult = await fallbackClaimPlanCreditGrant(supabase, user_id, period, plan_slug, planCredits);
      } else {
        throw new Error(`[plan-transitions] Failed to claim/grant plan credits atomically: ${grantRpcError.message}`);
      }
    }

    const delta = grantResult?.granted_delta ?? 0;
    shouldWritePlanCredits = delta > 0;
    newCreditsRemaining = grantResult?.balance_after ?? calculatePlanCreditBalance({ planCredits });

    if (delta > 0) {
      console.log(`[plan-transitions] cycle-aware atomic grant: user=${user_id} plan=${plan_slug} delta=${delta} newBalance=${newCreditsRemaining}`);
    } else {
      console.log(`[plan-transitions] cycle-aware atomic grant: no-op (already granted ${grantResult?.granted_credits ?? planCredits}/${planCredits} for period ${period.period_start}); preserving spent balance`);
    }

  } else {
    // Legacy full-grant path: checkout or non-period transitions.
    // Store only the new plan allowance; paid top-ups remain in credit_topups.
    newCreditsRemaining = calculatePlanCreditBalance({
      planCredits: planConfig.heavy_credits,
    });
  }

  // 2. Update profile — source of truth for plan + Stripe IDs.
  // Legacy/non-period transitions still write heavy_credits_remaining here.
  // Cycle-aware grants write the credit balance inside claim_plan_credit_grant().
  const profileUpdate: Record<string, unknown> = {
    plan: plan_slug,
    stripe_subscription_id: stripe_data.subscription_id,
  };

  // Cycle-aware grants mutate the plan bucket inside claim_plan_credit_grant().
  // Do not overwrite spent balance on same-period no-op events such as
  // cancel→resume subscription.updated replays. Only include the plan bucket
  // when a new period grant or same-period upgrade delta actually changed it,
  // or on legacy/non-period transitions.
  if (shouldWritePlanCredits) {
    profileUpdate.heavy_credits_remaining = newCreditsRemaining;
  }

  if (stripe_data.customer_id !== null && stripe_data.customer_id !== undefined) {
    profileUpdate.stripe_customer_id = stripe_data.customer_id;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user_id);

  if (profileError) {
    throw new Error(`[plan-transitions] Failed to update profile ${user_id}: ${profileError.message}`);
  }

  // 2. Fetch all workspaces owned by this user
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user_id);

  if (wsError) {
    throw new Error(`[plan-transitions] Failed to fetch workspaces for user ${user_id}: ${wsError.message}`);
  }

  // 3. Propagate plan + limits to ALL owned workspaces
  const { error: wsUpdateError } = await supabase
    .from('workspaces')
    .update({
      plan: plan_slug,
      heavy_credits_limit: planConfig.heavy_credits,
      light_tasks_limit: planConfig.light_task_limit,
      max_seats: planConfig.seats,
    })
    .eq('owner_id', user_id);

  if (wsUpdateError) {
    throw new Error(`[plan-transitions] Failed to update workspaces for user ${user_id}: ${wsUpdateError.message}`);
  }

  // 4. On cancellation: clear all integration tokens across all workspaces
  let integrations_cleared = false;
  if (plan_slug === 'none') {
    const integrationTables = [
      'wordpress_connections',
      'zapier_api_keys',
      'zapier_webhook_subscriptions',
      'buffer_tokens',
      'mailchimp_tokens',
      'notion_tokens',
      'google_workspace_tokens',
    ] as const;

    const workspaceIds = workspaces?.map(w => w.id) ?? [];
    if (workspaceIds.length > 0) {
      for (const table of integrationTables) {
        await supabase.from(table).delete().in('workspace_id', workspaceIds);
      }

      // Cancel scheduled agent chains across all workspaces on cancellation.
      await supabase
        .from('agent_mode_chains')
        .update({ status: 'inactive' })
        .in('workspace_id', workspaceIds)
        .in('status', ['active', 'paused']);
    }

    // Also clear user-scoped tokens (older rows without workspace_id)
    await supabase.from('mailchimp_tokens').delete().eq('user_id', user_id);
    await supabase.from('notion_tokens').delete().eq('user_id', user_id);
    await supabase.from('google_workspace_tokens').delete().eq('user_id', user_id);
    await supabase.from('wordpress_connections').delete().eq('user_id', user_id);
    await supabase.from('zapier_api_keys').delete().eq('user_id', user_id);
    await supabase.from('zapier_webhook_subscriptions').delete().eq('user_id', user_id);

    integrations_cleared = true;
  }

  // Scheduled Agent Mode chains are an Operator-only entitlement. Any downgrade
  // below Operator must stop active/paused scheduled chains immediately; waiting
  // for cancellation only lets Pro/Starter accounts keep running paid automations.
  if (plan_slug !== 'operator') {
    const workspaceIds = workspaces?.map(w => w.id) ?? [];
    if (workspaceIds.length > 0) {
      await supabase
        .from('agent_mode_chains')
        .update({ status: 'inactive' })
        .in('workspace_id', workspaceIds)
        .in('status', ['active', 'paused']);
    }
  }

  return {
    user_id,
    new_plan: plan_slug,
    workspaces_updated: workspaces?.length ?? 0,
    heavy_credits_set: newCreditsRemaining,
    integrations_cleared,
    applied_at: new Date().toISOString(),
  };
}
