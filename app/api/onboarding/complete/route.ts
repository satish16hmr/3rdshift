import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { BILLING_CATALOG } from '@/lib/billing/catalog';
import type { PlanSlug } from '@/lib/billing/types';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { full_name?: string; workspace_name?: string; goals?: string | string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const fullName = body.full_name?.trim() || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const workspaceName = body.workspace_name?.trim() || `${fullName.split(' ')[0] || 'My'}'s Workspace`;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const planSlug = (profile?.plan || 'none') as PlanSlug;

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, workspaces(owner_id)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const planConfig = BILLING_CATALOG[planSlug] || BILLING_CATALOG.none;
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        owner_id: user.id,
        name: workspaceName,
        plan: planSlug,
        heavy_credits_limit: planConfig.heavy_credits,
        light_tasks_limit: planConfig.light_task_limit,
        max_seats: planConfig.seats,
      })
      .select('id')
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'workspace_creation_failed' }, { status: 500 });
    }

    await supabaseAdmin.from('workspace_members').upsert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    }, { onConflict: 'workspace_id,user_id' });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: fullName,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) {
    return NextResponse.json({ error: 'profile_update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
