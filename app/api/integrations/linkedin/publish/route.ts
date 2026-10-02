import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptStoredToken, fetchImageWithoutMetadata, linkedinPostText, taskImageUrl, markdownToPlainText, trimLinkedInText } from '@/lib/social-publishing';

async function uploadLinkedInImage(token: string, author: string, imageUrl: string) {
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: author,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    }),
  });
  const registered = await registerRes.json().catch(() => ({}));
  const uploadUrl = registered?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset = registered?.value?.asset;
  if (!registerRes.ok || !uploadUrl || !asset) {
    throw new Error(registered?.message || 'LinkedIn image upload registration failed');
  }

  const strippedImage = await fetchImageWithoutMetadata(imageUrl);

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': strippedImage.contentType,
    },
    body: strippedImage.bytes,
  });
  if (!uploadRes.ok) {
    const uploadError = await uploadRes.text().catch(() => '');
    throw new Error(uploadError || 'LinkedIn image upload failed');
  }
  return asset;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { taskId, preview, confirm, text } = await req.json().catch(() => ({}));
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

  const [{ data: integration }, { data: task }] = await Promise.all([
    supabaseAdmin.from('user_integrations').select('access_token, provider_user_id, provider_name').eq('user_id', userId).eq('provider', 'linkedin').single(),
    supabaseAdmin.from('tasks').select('output, edited_output, status').eq('id', taskId).eq('workspace_id', workspaceId).single(),
  ]);

  if (!integration?.access_token || integration.access_token.startsWith('pending:')) {
    return NextResponse.json({ error: 'LinkedIn not connected.', not_connected: true }, { status: 403 });
  }
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  const imageUrl = taskImageUrl(task);
  const prepared = typeof text === 'string' && text.trim()
    ? trimLinkedInText(markdownToPlainText(text), 2900)
    : linkedinPostText(task, 2900);
  if (!prepared.text) return NextResponse.json({ error: 'No text content to publish.' }, { status: 400 });

  if (preview) {
    return NextResponse.json({
      preview: {
        text: prepared.text,
        trimmed: prepared.trimmed,
        imageUrl,
        accountName: integration.provider_name || 'LinkedIn',
        maxLength: 2900,
      },
    });
  }

  if (confirm !== true) {
    return NextResponse.json({ error: 'Confirmation required before publishing to LinkedIn.' }, { status: 400 });
  }

  const token = await decryptStoredToken(integration.access_token);
  const author = `urn:li:person:${integration.provider_user_id}`;
  let media: { status: string; media: string }[] = [];
  if (imageUrl) {
    try {
      const asset = await uploadLinkedInImage(token, author, imageUrl);
      media = [{ status: 'READY', media: asset }];
    } catch (err: unknown) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'LinkedIn image upload failed' }, { status: 500 });
    }
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: prepared.text },
          shareMediaCategory: media.length ? 'IMAGE' : 'NONE',
          ...(media.length ? { media } : {}),
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.message || data.error_description || 'LinkedIn publish failed' }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id || res.headers.get('x-restli-id') || null });
}
