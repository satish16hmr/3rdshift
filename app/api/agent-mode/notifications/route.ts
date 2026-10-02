import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

function createAdminClient() {
  return supabaseAdmin;
}

// GET /api/agent-mode/notifications
// Returns completed/failed chain runs from the last 7 days, formatted as notifications.
// Query param: since=<ISO timestamp> — only return runs after this time (for unread count).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const supabase = createAdminClient();

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since'); // ISO string — last-seen timestamp

  // Fetch last 7 days of finished runs
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: runs, error } = await supabase
    .from('agent_mode_runs')
    .select('id, status, started_at, completed_at, agent_mode_chains(name), worker_results, total_light_refunded, total_heavy_refunded')
    .eq('user_id', userId)
    .in('status', ['completed', 'partial', 'failed'])
    .gte('started_at', sevenDaysAgo)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ notifications: [], unreadCount: 0 });

  const notifications = (runs ?? []).map(run => {
    const chainName = (run as any).agent_mode_chains?.name ?? 'Workflow';
    const workerResults: any[] = (run as any).worker_results ?? [];
    const completed = workerResults.filter(w => w.status === 'completed').length;
    const total = workerResults.length;
    const refunded = ((run as any).total_light_refunded ?? 0) + ((run as any).total_heavy_refunded ?? 0);

    let emoji = '✅';
    let title = '';
    let description = '';

    if (run.status === 'completed') {
      emoji = '✅';
      title = `${chainName} completed`;
      description = `${total} deliverable${total !== 1 ? 's' : ''} ready.`;
    } else if (run.status === 'partial') {
      emoji = '⚠️';
      title = `${chainName} partially completed`;
      description = `${completed} of ${total} steps succeeded.${refunded > 0 ? ` ${refunded} credit${refunded !== 1 ? 's' : ''} refunded.` : ''}`;
    } else {
      emoji = '❌';
      title = `${chainName} failed`;
      description = `${refunded > 0 ? `${refunded} credit${refunded !== 1 ? 's' : ''} refunded.` : 'Check Activity for details.'}`;
    }

    const isNew = since ? new Date(run.started_at) > new Date(since) : true;

    return {
      id: run.id,
      run_id: run.id,
      emoji,
      title,
      description,
      time: run.started_at,
      read: !isNew,
      group: isNew ? 'new' : 'earlier',
      status: run.status,
    };
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return NextResponse.json({ notifications, unreadCount });
}
