import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { BILLING_CATALOG } from '@/lib/billing/catalog';
import type { PlanSlug } from '@/lib/billing/types';

const PLAN_RANK: Record<string, number> = { none: 0, starter: 1, pro: 2, operator: 3 };
const VALID_PLANS = ['starter', 'pro', 'operator'];

/**
 * POST /api/billing/downgrade-check
 *
 * Pre-flight check before sending user to Stripe customer portal for a downgrade.
 * Checks if workspace count exceeds new plan's allowed maximum.
 *
 * The frontend calls this BEFORE redirecting to Stripe portal.
 * If requires_action: true, show blocking modal with delete buttons.
 *
 * Request: { target_plan: 'starter' | 'pro' | 'operator' }
 *
 * Response (ok): { ok: true, requires_action: false }
 * Response (action needed): {
 *   ok: false,
 *   requires_action: true,
 *   action_required: 'delete_workspaces',
 *   current_workspace_count: number,
 *   target_max_workspaces: number,
 *   excess_count: number,
 *   message: string
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { target_plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { target_plan } = body;

  if (!target_plan || !VALID_PLANS.includes(target_plan)) {
    return NextResponse.json({ error: 'invalid_plan', message: 'target_plan must be starter, pro, or operator' }, { status: 400 });
  }

  // Get current plan
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
  }

  const currentPlanRank = PLAN_RANK[profile.plan] ?? 0;
  const targetPlanRank = PLAN_RANK[target_plan] ?? 0;

  // If upgrading or same plan, no pre-flight needed
  if (targetPlanRank >= currentPlanRank) {
    return NextResponse.json({ ok: true, requires_action: false });
  }

  // Count owned workspaces
  const { count: workspaceCount, error: countErr } = await supabaseAdmin
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (countErr) {
    console.error('[downgrade-check] workspace count failed:', countErr);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  const targetMaxWorkspaces = BILLING_CATALOG[target_plan as PlanSlug].max_workspaces;
  const currentCount = workspaceCount ?? 0;
  const excess = currentCount - targetMaxWorkspaces;

  if (excess > 0) {
    return NextResponse.json({
      ok: false,
      requires_action: true,
      action_required: 'delete_workspaces',
      current_workspace_count: currentCount,
      target_max_workspaces: targetMaxWorkspaces,
      excess_count: excess,
      message: `You have ${currentCount} workspace${currentCount !== 1 ? 's' : ''}. The ${target_plan} plan allows ${targetMaxWorkspaces}. Delete ${excess} workspace${excess !== 1 ? 's' : ''} before downgrading.`,
    });
  }

  return NextResponse.json({ ok: true, requires_action: false });
}
