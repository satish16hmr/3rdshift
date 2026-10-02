import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';

function createAdminClient() {
  return supabaseAdmin;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // R9: owner-only
  const roleAuth = await requireWorkspaceRole(request, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  const supabase = createAdminClient();
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') return NextResponse.json({ error: 'Operator plan required' }, { status: 403 });

  const { data: chain } = await supabase.from('agent_mode_chains').select('*').eq('id', id).eq('workspace_id', workspaceId).single();
  if (!chain) return NextResponse.json({ error: 'Chain not found' }, { status: 404 });

  await supabase.from('agent_mode_chains').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ success: true });
}
