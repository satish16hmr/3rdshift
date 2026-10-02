import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptStoredToken, META_GRAPH_VERSION, strippedSocialImageSignedUrl, taskImageUrl, taskText } from '@/lib/social-publishing';

async function pageToken(userToken: string, pageId: string) {
  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(userToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Could not load Facebook Pages.');
  return data.data?.find((p: any) => p.id === pageId)?.access_token || null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { taskId, preview, confirm, text } = await req.json().catch(() => ({}));
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

  const [{ data: integration }, { data: task }] = await Promise.all([
    supabaseAdmin.from('user_integrations').select('access_token, provider_name, provider_page_id').eq('user_id', userId).eq('provider', 'facebook').single(),
    supabaseAdmin.from('tasks').select('output, edited_output, status').eq('id', taskId).eq('workspace_id', workspaceId).single(),
  ]);
  if (!integration?.access_token || integration.access_token.startsWith('pending:')) {
    return NextResponse.json({ error: 'Facebook not connected.', not_connected: true }, { status: 403 });
  }
  if (!integration.provider_page_id) return NextResponse.json({ error: 'No Facebook Page selected — reconnect or choose a Page in Settings.' }, { status: 400 });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  const message = typeof text === 'string' && text.trim() ? text.trim().slice(0, 63206) : taskText(task, 63206);
  if (!message) return NextResponse.json({ error: 'No text content to publish.' }, { status: 400 });
  const imageUrl = taskImageUrl(task);

  if (preview) {
    return NextResponse.json({
      preview: {
        text: message,
        imageUrl,
        accountName: integration.provider_name || 'Facebook Page',
        maxLength: 63206,
      },
    });
  }

  if (confirm !== true) {
    return NextResponse.json({ error: 'Confirmation required before publishing to Facebook.' }, { status: 400 });
  }

  const userToken = await decryptStoredToken(integration.access_token);
  let token: string | null = null;
  try {
    token = await pageToken(userToken, integration.provider_page_id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not resolve Facebook Page token.' }, { status: 500 });
  }
  if (!token) return NextResponse.json({ error: 'Could not resolve Facebook Page token.' }, { status: 500 });

  let res: Response;
  if (imageUrl) {
    let publishImageUrl = imageUrl;
    try {
      publishImageUrl = await strippedSocialImageSignedUrl({
        supabase: supabaseAdmin,
        imageUrl,
        taskId,
        provider: 'facebook',
      });
    } catch (err: unknown) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not prepare Facebook image' }, { status: 500 });
    }
    res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${integration.provider_page_id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: publishImageUrl, caption: message, access_token: token }),
    });
  } else {
    res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${integration.provider_page_id}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message, access_token: token }),
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error?.message || 'Facebook publish failed' }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id || null });
}
