import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getUserWorkspaces } from '@/lib/workspace';
import { BILLING_CATALOG } from '@/lib/billing/catalog';
import { getAvailableCredits } from '@/lib/billing/available-credits';
import type { PlanSlug } from '@/lib/billing/types';

// GET /api/workspace — returns the active workspace(s) for the current user
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // Batch 1: getUserWorkspaces + role lookup + caller's profile (for resolution state) — all independent
  const [workspaces, membershipRes, callerProfileRes] = await Promise.all([
    getUserWorkspaces(userId),
    supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single(),
    supabaseAdmin
      .from('profiles')
      .select('requires_workspace_resolution, resolution_target_plan, resolution_excess_count, plan')
      .eq('id', userId)
      .single(),
  ]);

  // NS-HIGH-1: return resolution state if active — frontend shows blocking modal
  const callerProfile = callerProfileRes.data;
  if (callerProfile?.requires_workspace_resolution) {
    const targetPlan = callerProfile.resolution_target_plan ?? callerProfile.plan;
    const maxAllowed = (BILLING_CATALOG as Record<string, { max_workspaces: number }>)[targetPlan]?.max_workspaces ?? 0;
    return NextResponse.json({
      requires_resolution: true,
      resolution: {
        target_plan: targetPlan,
        excess_count: callerProfile.resolution_excess_count ?? 0,
        message: `You downgraded to ${targetPlan}, which allows ${maxAllowed} workspace${maxAllowed !== 1 ? 's' : ''}. You have ${callerProfile.resolution_excess_count ?? 0} too many. Delete the excess to continue, or re-upgrade.`,
      },
    });
  }

  // Batch 2: owner profile — needs owner_id from getUserWorkspaces (now available)
  // owner_id is embedded in the workspace row from the JOIN — no separate workspaces lookup needed
  const activeWs = workspaces.find(w => w.id === workspaceId);
  let ownerCredits = null;
  if (activeWs?.owner_id) {
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('heavy_credits_remaining, plan, stripe_subscription_id, billing_cycle')
      .eq('id', activeWs.owner_id)
      .single();
    if (ownerProfile) {
      const availableCredits = await getAvailableCredits(supabaseAdmin, activeWs.owner_id);
      ownerCredits = {
        // Keep heavy_credits_remaining as the monthly plan bucket only.
        heavy_credits_remaining: availableCredits.planCreditsRemaining,
        plan_credits_remaining: availableCredits.planCreditsRemaining,
        topup_credits_remaining: availableCredits.topupCreditsRemaining,
        available_credits_remaining: availableCredits.availableCreditsRemaining,
        included_credits_limit: availableCredits.includedCreditsLimit,
        heavy_credits_limit: availableCredits.includedCreditsLimit,
        plan: ownerProfile.plan || activeWs.plan,
        billing_cycle: ownerProfile.billing_cycle,
        stripe_subscription_id: ownerProfile.stripe_subscription_id,
      };
    }
  }

  // Count workspaces owned by this user for max_workspaces enforcement
  const { count: ownedWorkspaceCount } = await supabaseAdmin
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);

  const ownerPlan = (ownerCredits?.plan || 'none') as PlanSlug;
  const planConfig = BILLING_CATALOG[ownerPlan];

  return NextResponse.json({
    activeWorkspaceId: workspaceId,
    workspaces,
    ownerCredits,
    userRole: membershipRes.data?.role ?? 'member',
    max_workspaces: planConfig.max_workspaces,
    current_workspace_count: ownedWorkspaceCount ?? 0,
  });
}
