import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

const SaveArtifactSchema = z.object({
  taskId: z.string().uuid(),
  artifact: z.record(z.string(), z.unknown()),
  assembledHtml: z.string(),
}).strict();

// POST /api/website-builder/save-artifact
// Persists reordered/modified website builder artifacts to the tasks table.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SaveArtifactSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }

  const { taskId, artifact, assembledHtml } = parsed.data;

  // ── Fetch task to verify workspace/user authorization ───────────────────
  const { data: task, error: fetchError } = await supabaseAdmin
    .from('tasks')
    .select('id, workspace_id, user_id, output')
    .eq('id', taskId)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Authorization check: User must own the task or belong to its workspace
  const isOwner = task.user_id === userId;
  let isMember = false;
  if (!isOwner && task.workspace_id) {
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', task.workspace_id)
      .eq('user_id', userId)
      .maybeSingle();
    isMember = !!membership;
  }

  if (!isOwner && !isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Preserve existing output fields and update the artifact/assembledHtml
  const taskOutput = (task.output as Record<string, unknown>) ?? {};
  const updatedOutput = {
    ...taskOutput,
    artifact,
    assembledHtml,
  };

  const { error: updateError } = await supabaseAdmin
    .from('tasks')
    .update({
      output: updatedOutput,
    })
    .eq('id', taskId);

  if (updateError) {
    console.error('[save-artifact] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update website artifact' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
