import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';

// DELETE — remove a custom playbook
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;
  const { id } = await params;

  // R14: owner-only
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId: ownerUserId } = roleAuth;

  // custom_playbooks has no workspace_id column — filter by user_id (owner)
  const { error } = await supabaseAdmin
    .from('custom_playbooks')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerUserId);

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  return NextResponse.json({ deleted: id });
}

// PATCH — update a custom playbook
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;
  const { id } = await params;

  // R14: owner-only
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId: ownerUserId } = roleAuth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowedFields = new Set(['name', 'description', 'workers', 'schedule_days', 'status']);
  const rejectedFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (rejectedFields.length > 0) {
    return NextResponse.json({ error: 'Invalid fields in request body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      return NextResponse.json({ error: 'description must be a string' }, { status: 400 });
    }
    updates.description = body.description;
  }
  if (body.workers !== undefined) {
    if (!Array.isArray(body.workers)) {
      return NextResponse.json({ error: 'workers must be an array' }, { status: 400 });
    }
    updates.workers = body.workers;
  }
  if (body.schedule_days !== undefined) {
    if (!Array.isArray(body.schedule_days)) {
      return NextResponse.json({ error: 'schedule_days must be an array' }, { status: 400 });
    }
    updates.schedule_days = body.schedule_days;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !['active', 'paused', 'inactive'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = body.status;
  }

  // custom_playbooks has no workspace_id column — filter by user_id (owner)
  const { data, error } = await supabaseAdmin
    .from('custom_playbooks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', ownerUserId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  return NextResponse.json({ playbook: data });
}
