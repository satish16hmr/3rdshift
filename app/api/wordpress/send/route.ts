import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptToken } from '@/lib/crypto';
import { assertSafeUrl, safeFetchExternal, SsrfError, SsrfFetchError } from '@/lib/ssrf';

// Convert markdown to simple HTML for WordPress
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold / Italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr />');

  // Unordered lists — group consecutive items
  html = html.replace(/((?:^[-*] .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[-*] /, '').trim()}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Numbered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Paragraphs — wrap bare lines not already wrapped in block elements
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.match(/^<(h[1-6]|ul|ol|pre|hr|blockquote)/)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

function getPlan(profile: { plan: string; is_founding_member: boolean; founding_tier: string | null } | null): string {
  if (!profile) return 'starter';
  return profile.is_founding_member ? (profile.founding_tier || 'starter') : profile.plan;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, is_founding_member, founding_tier')
    .eq('id', userId)
    .single();

  if (getPlan(profile) === 'starter') {
    return NextResponse.json({ error: 'WordPress integration requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  // F6 fix: query by both workspace_id AND user_id
  const { data: wpConn } = await supabaseAdmin
    .from('wordpress_connections')
    .select('site_url, username, app_password')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (!wpConn) {
    return NextResponse.json({ error: 'WordPress not connected.', not_connected: true }, { status: 403 });
  }

  // Phase 6: defence-in-depth SSRF check on DB-stored URL
  try { assertSafeUrl(wpConn.site_url); } catch (e) {
    return NextResponse.json({ error: 'WordPress site URL is invalid. Please reconnect.' }, { status: 400 });
  }

  let body: { taskId?: string; title?: string; status?: string; category_id?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { taskId, title, status = 'draft', category_id } = body;
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

  // ALWAYS draft or pending — never publish
  const postStatus = status === 'pending' ? 'pending' : 'draft';

  // Load task
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('worker_slug, input, output, edited_output, status')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  // Prefer edited_output (HTML from Tiptap) if available (already HTML); otherwise convert markdown
  const htmlContent = task.edited_output || markdownToHtml(task.output?.text || '');
  const postTitle = title || 'Untitled Post';

  const decryptedPassword = await decryptToken(wpConn.app_password);
  const credentials = Buffer.from(`${wpConn.username}:${decryptedPassword}`).toString('base64');
  const postPayload: Record<string, unknown> = {
    title: postTitle,
    content: htmlContent,
    status: postStatus,
  };
  if (category_id) postPayload.categories = [category_id];

  let postRes: Response;
  try {
    postRes = await safeFetchExternal(`${wpConn.site_url}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postPayload),
      allowedContentTypes: ['application/json'],
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 30_000,
    });
  } catch (error) {
    if (error instanceof SsrfError || error instanceof SsrfFetchError) {
      console.error('WordPress post SSRF/safe-fetch error:', error.message);
      return NextResponse.json({ error: 'WordPress site URL is invalid. Please reconnect.' }, { status: 400 });
    }
    throw error;
  }

  if (!postRes.ok) {
    const errData = await postRes.json().catch(() => ({}));
    console.error('WordPress post error:', errData);
    return NextResponse.json({ error: 'Failed to create WordPress post. Check your connection settings.' }, { status: 500 });
  }

  const postData = await postRes.json();

  return NextResponse.json({
    success: true,
    post_id: postData.id,
    post_url: postData.link,
    edit_url: `${wpConn.site_url}/wp-admin/post.php?post=${postData.id}&action=edit`,
    status: postData.status,
  });
}

// GET — fetch categories from connected WordPress site
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data: wpConn } = await supabaseAdmin
    .from('wordpress_connections')
    .select('site_url, username, app_password')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)  // F6: also filter by user_id
    .single();

  if (!wpConn) {
    return NextResponse.json({ error: 'WordPress not connected.', not_connected: true }, { status: 403 });
  }

  const decryptedPassword = await decryptToken(wpConn.app_password);
  const credentials = Buffer.from(`${wpConn.username}:${decryptedPassword}`).toString('base64');
  let catRes: Response;
  try {
    catRes = await safeFetchExternal(`${wpConn.site_url}/wp-json/wp/v2/categories?per_page=100`, {
      headers: { 'Authorization': `Basic ${credentials}` },
      allowedContentTypes: ['application/json'],
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 30_000,
    });
  } catch (error) {
    if (error instanceof SsrfError || error instanceof SsrfFetchError) {
      console.error('WordPress category SSRF/safe-fetch error:', error.message);
      return NextResponse.json({ categories: [] });
    }
    throw error;
  }

  if (!catRes.ok) return NextResponse.json({ categories: [] });

  const categories = await catRes.json();
  return NextResponse.json({
    categories: categories.map((c: { id: number; name: string; slug: string }) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    })),
  });
}
