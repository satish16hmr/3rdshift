import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type TaskOutput = {
  audio_path?: string;
  audio_filename?: string;
};

function isSafeAudioOutputPath(path: string): boolean {
  return (
    typeof path === 'string'
    && path.length > 0
    && !path.startsWith('/')
    && !path.includes('..')
    && !path.includes('\\')
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const taskId = typeof body.taskId === 'string' ? body.taskId : '';
  const requestedPath = typeof body.audioPath === 'string' ? body.audioPath : '';

  if (!taskId || !requestedPath || !isSafeAudioOutputPath(requestedPath)) {
    return NextResponse.json({ error: 'Missing or invalid audio path' }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, workspace_id, output')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) {
    console.error('[audio-output-url] task lookup failed:', taskError.message);
    return NextResponse.json({ error: 'Could not load task' }, { status: 500 });
  }
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const output = (task.output ?? {}) as TaskOutput;
  if (output.audio_path !== requestedPath) {
    return NextResponse.json({ error: 'Audio path does not match task output' }, { status: 403 });
  }

  let authorized = task.user_id === auth.userId;

  if (!authorized && task.workspace_id) {
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', task.workspace_id)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (membership) authorized = true;
  }

  if (!authorized && task.workspace_id) {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', task.workspace_id)
      .eq('owner_id', auth.userId)
      .maybeSingle();

    if (workspace) authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Not authorized for this audio output' }, { status: 403 });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from('audio-outputs')
    .createSignedUrl(requestedPath, 60 * 60); // 1 hour, refreshed at view time

  if (signError || !signed?.signedUrl) {
    console.error('[audio-output-url] signed URL failed:', signError?.message);
    return NextResponse.json({ error: 'Could not create audio URL' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: 60 * 60 });
}
