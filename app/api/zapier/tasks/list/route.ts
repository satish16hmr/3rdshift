import { NextRequest, NextResponse } from 'next/server';
import { requireZapierAuth } from '@/lib/zapier/helpers';
import { supabaseAdmin } from '@/lib/api-auth';
import { getWorkerBySlug } from '@/lib/workers/registry';

// GET /api/zapier/tasks/list — returns recent completed tasks for sample data in Zapier
export async function GET(req: NextRequest) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, worker_slug, status, output, created_at, completed_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3);

  const formatted = (tasks || []).map(t => {
    const workerConfig = getWorkerBySlug(t.worker_slug);
    return {
      id: t.id,
      worker: t.worker_slug,
      worker_name: workerConfig?.personaName || t.worker_slug,
      worker_title: workerConfig?.name || t.worker_slug,
      status: t.status,
      output: t.output?.text || t.output?.result || '',
      created_at: t.created_at,
      completed_at: t.completed_at,
    };
  });

  return NextResponse.json(formatted);
}
