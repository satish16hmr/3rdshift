import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';

function createAdminClient() {
  return supabaseAdmin;
}

// GET /api/agent-mode/runs/[id] — full run detail with all worker outputs
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const supabase = createAdminClient();

  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') return NextResponse.json({ error: 'Operator plan required' }, { status: 403 });

  const { data: run, error } = await supabase
    .from('agent_mode_runs')
    .select(`*, agent_mode_chains(name, workers)`)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

  return NextResponse.json({ run });
}
