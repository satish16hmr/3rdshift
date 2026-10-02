import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';

// GET — list user's custom playbooks
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R13: owner-only
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId: ownerUserId } = roleAuth;

  // F4: query by workspace_id now that column exists
  const { data, error } = await supabaseAdmin
    .from('custom_playbooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  return NextResponse.json({ playbooks: data ?? [] });
}

// POST — create a new custom playbook
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R13: owner-only — role check before plan check
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  let body: { name: string; workers: unknown[]; schedule_days?: string[]; description?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name?.trim() || !body.workers?.length) {
    return NextResponse.json({ error: 'name and workers are required' }, { status: 400 });
  }

  // Verify Operator plan — workspace owner's plan (works for seat members)
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') {
    return NextResponse.json({ error: 'Custom Playbooks require the Operator plan.', upgrade_required: true }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('custom_playbooks')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      name: body.name.trim(),
      description: body.description || '',
      workers: body.workers,
      schedule_days: body.schedule_days || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  return NextResponse.json({ playbook: data });
}
