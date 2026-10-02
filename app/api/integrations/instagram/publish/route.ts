import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptStoredToken, META_GRAPH_VERSION, strippedSocialImageSignedUrl, taskImageUrl, taskText } from '@/lib/social-publishing';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { taskId } = await req.json().catch(() => ({}));
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

  const [{ data: integration }, { data: task }] = await Promise.all([
    supabaseAdmin.from('user_integrations').select('access_token, provider_ig_user_id').eq('user_id', userId).eq('provider', 'instagram').single(),
    supabaseAdmin.from('tasks').select('output, edited_output, status').eq('id', taskId).eq('workspace_id', workspaceId).single(),
  ]);
  if (!integration?.access_token || integration.access_token.startsWith('pending:')) {
    return NextResponse.json({ error: 'Instagram not connected.', not_connected: true }, { status: 403 });
  }
  if (!integration.provider_ig_user_id) return NextResponse.json({ error: 'No Instagram Business account found.' }, { status: 400 });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  const imageUrl = taskImageUrl(task);
  if (!imageUrl) return NextResponse.json({ error: 'Instagram requires an image. Use an image-generating worker result.' }, { status: 400 });
  const caption = taskText(task, 2100);
  const token = await decryptStoredToken(integration.access_token);
  let publishImageUrl = imageUrl;
  try {
    publishImageUrl = await strippedSocialImageSignedUrl({
      supabase: supabaseAdmin,
      imageUrl,
      taskId,
      provider: 'instagram',
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not prepare Instagram image' }, { status: 500 });
  }

  const createRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${integration.provider_ig_user_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image_url: publishImageUrl, caption, access_token: token }),
  });
  const container = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !container.id) {
    return NextResponse.json({ error: container.error?.message || 'Instagram media creation failed' }, { status: 500 });
  }

  const publishRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${integration.provider_ig_user_id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  });
  const published = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok || !published.id) {
    return NextResponse.json({ error: published.error?.message || 'Instagram did not confirm media publish' }, { status: 500 });
  }
  return NextResponse.json({ success: true, id: published.id });
}
