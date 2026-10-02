import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { decryptToken } from '@/lib/crypto';
import { strippedSocialImageSignedUrl } from '@/lib/social-publishing';

type BufferPostAsset = {
  image: {
    url: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const candidate = value[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

async function buildBufferAssets(output: unknown, taskId: string): Promise<BufferPostAsset[]> {
  if (!isRecord(output)) return [];

  const urls = new Set<string>();
  const directImageUrl = getString(output, 'imageUrl');
  if (directImageUrl) urls.add(directImageUrl);

  const images = output.images;
  if (Array.isArray(images)) {
    images.forEach((image) => {
      const imageUrl = getString(image, 'url');
      if (imageUrl) urls.add(imageUrl);
    });
  }

  const sanitizedUrls = await Promise.all(Array.from(urls).map(async (url) => (
    strippedSocialImageSignedUrl({
      supabase: supabaseAdmin,
      imageUrl: url,
      taskId,
      provider: 'buffer',
    })
  )));

  return sanitizedUrls.map((url) => ({ image: { url } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan === 'starter') {
    return NextResponse.json({ error: 'Buffer integration requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  const { data: tokenRow } = await supabaseAdmin
    .from('buffer_tokens')
    .select('access_token')
    .eq('workspace_id', workspaceId)
    .single();

  if (!tokenRow?.access_token || tokenRow.access_token.startsWith('pending:')) {
    return NextResponse.json({ error: 'Buffer not connected.', not_connected: true }, { status: 403 });
  }

  let body: { taskId?: string; channel_ids?: string[]; schedule_type?: 'queue' | 'now' };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { taskId, channel_ids, schedule_type = 'queue' } = body;
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  if (!channel_ids || channel_ids.length === 0) return NextResponse.json({ error: 'channel_ids are required' }, { status: 400 });

  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('output, edited_output, status')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  // Prefer edited_output; strip HTML tags if needed (Buffer expects plain text)
  const rawText = task.edited_output
    ? task.edited_output.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : (task.output?.text || '');
  const text = rawText.slice(0, 2000);
  let assets: BufferPostAsset[] = [];
  try {
    assets = await buildBufferAssets(task.output, taskId);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not prepare Buffer image' }, { status: 500 });
  }
  const apiKey = await decryptToken(tokenRow.access_token);

  // Get org ID for channel validation
  const accountRes = await fetch('https://api.buffer.com/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ account { organizations { id } } }' }),
  });
  const accountData = await accountRes.json().catch(() => ({}));
  if (!accountRes.ok || accountData?.errors?.length) {
    return NextResponse.json({ error: accountData?.errors?.[0]?.message || 'Buffer rejected the account lookup. Reconnect Buffer and try again.' }, { status: 502 });
  }
  const orgId = accountData?.data?.account?.organizations?.[0]?.id;
  if (!orgId) return NextResponse.json({ error: 'Could not resolve Buffer organization.' }, { status: 502 });

  // Buffer GraphQL API — create post
  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on CreatePostSuccess { post { id status } }
        ... on CreatePostError { message }
      }
    }
  `;

  const results = await Promise.all(channel_ids.map(async (channelId) => {
    const variables = {
      input: {
        text,
        channelId,
        organizationId: orgId,
        ...(assets.length > 0 ? { assets } : {}),
        ...(schedule_type === 'now' ? { scheduledAt: new Date().toISOString() } : {}),
      },
    };

    const res = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.errors?.length) {
      return { message: data?.errors?.[0]?.message || 'Buffer API request failed' };
    }
    const result = data.data?.createPost;
    if (!result?.post?.id && !result?.message) {
      return { message: 'Buffer did not confirm post creation' };
    }
    return result;
  }));

  const hasError = results.some(r => r?.message);
  if (hasError) {
    const errMsg = results.find(r => r?.message)?.message;
    return NextResponse.json({ error: errMsg || 'Failed to send to Buffer' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    posts: results.map(r => r?.post).filter(Boolean),
    message: schedule_type === 'now' ? 'Posted to Buffer!' : 'Queued in Buffer.',
  });
}
