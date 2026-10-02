import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { saveToGoogle, isConnected } from '@/lib/google/workspace';
import { getWorkerBySlug } from '@/lib/workers/registry';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let body: { taskId: string; title?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { taskId, title } = body;
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

  // Check plan — Pro+ only, workspace owner's plan
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan === 'starter') {
    return NextResponse.json({ error: 'Google Workspace requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  // Check connection
  const connected = await isConnected(userId);
  if (!connected) {
    return NextResponse.json({ error: 'Google Workspace not connected.', not_connected: true }, { status: 403 });
  }

  // Load task
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('worker_slug, input, output, status')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  const worker = getWorkerBySlug(task.worker_slug);
  const memberName = worker?.personaName || task.worker_slug;

  // Build title from task input — prefer topic/subject/title fields
  const input = task.input || {};
  const preferredKeys = ['topic', 'subject', 'title', 'keyword', 'company_name', 'product_name', 'task_description', 'task_input'];
  const inputTitle = (
    preferredKeys.map(k => input[k]).find(v => typeof v === 'string' && v.length > 3) as string
  ) || (Object.values(input).find(v => typeof v === 'string' && v.length > 3) as string) || 'Untitled';
  const docTitle = title || `${worker?.personaName || worker?.name || task.worker_slug} — ${inputTitle.slice(0, 60)}`;

  try {
    const result = await saveToGoogle({
      userId,
      memberSlug: task.worker_slug,
      memberName,
      title: docTitle,
      output: task.output || {},
      workerSlug: task.worker_slug,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save to Google';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/save-to-google — check connection status
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const connected = await isConnected(userId);
  return NextResponse.json({ connected });
}
