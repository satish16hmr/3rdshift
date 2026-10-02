/**
 * POST /api/zapier/tasks/create
 *
 * F5: Now routes through lib/tasks/create-task.ts — same validation,
 * billing, and Inngest dispatch as /api/tasks/create.
 *
 * Differences from the regular tasks/create endpoint:
 *   - Uses Zapier API key auth (requireZapierAuth) instead of JWT
 *   - Accepts task_description as a convenience alias for common text fields
 *   - skipFieldValidation=true — Zapier integrators may send partial inputs
 *     (they set up field mappings at integration time, not always at task time)
 *   - Polls for up to 22s and returns result synchronously (Zapier 30s timeout)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireZapierAuth, supabaseAdmin } from '@/lib/zapier/helpers';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { createTask } from '@/lib/tasks/create-task';

export async function POST(req: NextRequest) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let body: { worker_slug?: string; task_description?: string; inputs?: Record<string, string> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { worker_slug } = body;

  // Map task_description (Zapier convenience field) into inputs
  const inputs: Record<string, string> = body.inputs || {};
  if (body.task_description && !inputs.topic && !inputs.task_description) {
    inputs.topic = body.task_description;
    inputs.task_description = body.task_description;
    inputs.description = body.task_description;
    inputs.subject = body.task_description;
  }

  if (!worker_slug) {
    return NextResponse.json({ error: 'worker_slug is required' }, { status: 400 });
  }

  const worker = getWorkerBySlug(worker_slug);
  if (!worker) {
    return NextResponse.json({ error: `Worker "${worker_slug}" not found in registry` }, { status: 404 });
  }

  // F5: route through shared createTask — handles mode derivation, plan gate, ledger, Inngest
  // skipFieldValidation=true: Zapier integrators configure field mappings at setup time
  const result = await createTask({
    userId,
    workspaceId,
    workerSlug: worker_slug,
    input: inputs,
    skipFieldValidation: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { taskId } = result;

  // Poll for up to 22 seconds (safe under Zapier's 30s timeout)
  let done = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 22000) {
    await new Promise(r => setTimeout(r, 3000));
    const { data: polled } = await supabaseAdmin
      .from('tasks')
      .select('id, status, output, created_at, completed_at')
      .eq('id', taskId)
      .single();
    if (polled?.status === 'completed' || polled?.status === 'failed') {
      done = polled;
      break;
    }
  }

  // If not done yet, return pending
  if (!done) {
    const { data: current } = await supabaseAdmin
      .from('tasks').select('id, status, created_at').eq('id', taskId).single();
    return NextResponse.json({
      id: current?.id || taskId,
      task_id: current?.id || taskId,
      status: 'pending',
      worker: worker_slug,
      worker_name: worker.personaName,
      worker_title: worker.name,
      output: '',
      created_at: current?.created_at,
      completed_at: null,
      note: 'Task is processing. You will receive a webhook notification when complete.',
    }, { status: 201 });
  }

  return NextResponse.json({
    id: done.id,
    task_id: done.id,
    status: done.status,
    worker: worker_slug,
    worker_name: worker.personaName,
    worker_title: worker.name,
    output: done.output?.text || done.output?.result || '',
    created_at: done.created_at,
    completed_at: done.completed_at || null,
  }, { status: 201 });
}
