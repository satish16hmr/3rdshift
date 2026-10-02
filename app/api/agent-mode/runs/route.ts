import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';

function createAdminClient() {
  return supabaseAdmin;
}

// GET /api/agent-mode/runs — list run history
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const supabase = createAdminClient();

  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') return NextResponse.json({ error: 'Operator plan required' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const status = searchParams.get('status'); // completed | partial | failed | all
  const timeframe = searchParams.get('timeframe'); // week | month
  const chainId = searchParams.get('chain_id');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('agent_mode_runs')
    .select(`*, agent_mode_chains(name)`)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (timeframe === 'week') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('started_at', weekAgo);
  } else if (timeframe === 'month') {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('started_at', monthAgo);
  }

  if (chainId) {
    query = query.eq('chain_id', chainId);
  }

  const { data: runs, error } = await query;
  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  return NextResponse.json({ runs: runs ?? [] });
}
