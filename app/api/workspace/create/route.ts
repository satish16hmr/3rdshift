/**
 * POST /api/workspace/create
 *
 * Creates a new workspace as an organizational container under the user's account.
 *
 * Phase 19: workspaces are free containers — no Stripe checkout, no per-workspace
 * subscription. The user's existing account plan (profile.plan) is inherited by
 * the new workspace. Enforces max_workspaces limit from BILLING_CATALOG.
 *
 * Previous behavior (Phase 18 and earlier): created a Stripe checkout session to
 * purchase a new per-workspace subscription. That model is removed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';
import { BILLING_CATALOG } from '@/lib/billing/catalog';
import type { PlanSlug } from '@/lib/billing/types';

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { name?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'workspace_name_required' }, { status: 400 });
  }

  // Get user's current plan
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('plan, heavy_credits_remaining')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
  }

  const planSlug = (profile.plan || 'none') as PlanSlug;
  const planConfig = BILLING_CATALOG[planSlug] ?? BILLING_CATALOG.none;

  // Count existing owned workspaces
  const { count: currentCount, error: countError } = await supabaseAdmin
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (countError) {
    return NextResponse.json({ error: 'workspace_count_failed' }, { status: 500 });
  }

  // Enforce max_workspaces limit
  if ((currentCount ?? 0) >= planConfig.max_workspaces) {
    const workspaceLabel = planConfig.max_workspaces === 1 ? 'workspace' : 'workspaces';
    return NextResponse.json({
      error: 'workspace_limit_reached',
      message: `Your plan allows ${planConfig.max_workspaces} ${workspaceLabel} — upgrade to add more.`,
      current_count: currentCount,
      max_allowed: planConfig.max_workspaces,
    }, { status: 403 });
  }

  // Create workspace, inheriting account plan and limits
  const { data: workspace, error: createError } = await supabaseAdmin
    .from('workspaces')
    .insert({
      owner_id: userId,
      name,
      plan: planSlug,
      heavy_credits_limit: planConfig.heavy_credits,
      light_tasks_limit: planConfig.light_task_limit,
      max_seats: planConfig.seats,
    })
    .select()
    .single();

  if (createError || !workspace) {
    console.error('[workspace/create] DB insert failed:', createError?.message);
    return NextResponse.json({
      error: 'workspace_creation_failed',
      message: createError?.message ?? 'Unknown error',
    }, { status: 500 });
  }

  // Add owner as workspace member (ignore conflict if already exists)
  await supabaseAdmin.from('workspace_members').upsert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'owner',
  }, { onConflict: 'workspace_id,user_id' });

  return NextResponse.json({
    ok: true,
    workspace_id: workspace.id,
    workspace,
  });
}
