import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';

/**
 * POST /api/tasks/save-edit
 *
 * Saves user-edited task output. Only `edited_output` can be written —
 * all other columns are rejected (whitelist enforced).
 *
 * Per v8 R2 spec (audit-rls-fix-design-v6.md Section R2).
 *
 * Request body:
 *   taskId        string   required — UUID of the task to update
 *   edited_output string   required — HTML content from the Tiptap editor
 *
 * Authorization:
 *   User must own the task (tasks.user_id = userId)
 *   OR be a member of the workspace the task belongs to (workspace_members).
 *
 * Auth: JWT only (same inline pattern as R1 — workspace not required).
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate via JWT only
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  // 2. Parse and validate body
  let body: { taskId?: string; edited_output?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { taskId, edited_output } = body;

  if (!taskId || typeof taskId !== 'string') {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }
  if (edited_output === undefined || edited_output === null) {
    return NextResponse.json({ error: 'edited_output is required' }, { status: 400 });
  }
  if (typeof edited_output !== 'string') {
    return NextResponse.json({ error: 'edited_output must be a string' }, { status: 400 });
  }

  // 3. Verify ownership: user owns the task OR is a member of the task's workspace
  const { data: task, error: fetchErr } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, workspace_id')
    .eq('id', taskId)
    .single();

  if (fetchErr || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const isOwner = task.user_id === userId;

  let isMember = false;
  if (!isOwner && task.workspace_id) {
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', task.workspace_id)
      .eq('user_id', userId)
      .single();
    isMember = !!membership;
  }

  if (!isOwner && !isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Atomic UPDATE — whitelist: edited_output + edited_at only (no arbitrary columns)
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ edited_output, edited_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('id');

  if (error) {
    console.error('[tasks/save-edit] FULL ERROR:', error);
    return NextResponse.json(
      { error: error.message, details: error },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
