import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptToken } from '@/lib/crypto';
import { assertSafeUrl, safeFetchExternal, SsrfError, SsrfFetchError } from '@/lib/ssrf';

const PAGE_TYPE_LABELS: Record<string, string> = {
  landing: 'Landing Page',
  coming_soon: 'Coming Soon Page',
  lead_magnet: 'Lead Magnet Page',
  sales_page: 'Sales Page',
  service_business: 'Service Business Page',
};

// POST /api/website-builder/push-wordpress
// Pushes the assembled website HTML to WordPress as a draft PAGE (not Post).
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // Plan check: WP integration requires Pro+
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, is_founding_member, founding_tier')
    .eq('id', userId)
    .single();

  const effectivePlan = profile?.is_founding_member ? (profile.founding_tier || 'starter') : (profile?.plan || 'starter');
  if (effectivePlan === 'starter') {
    return NextResponse.json({ error: 'WordPress integration requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  let body: { taskId?: string; assembledHtml?: string; businessName?: string; pageType?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // F9: require taskId — server-assemble HTML from task output, ignore body HTML
  const { taskId } = body;
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

  // Verify task ownership / workspace membership
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, workspace_id, worker_slug, status, output, input')
    .eq('id', taskId)
    .maybeSingle();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Access check: own task OR workspace member
  if (task.user_id !== userId) {
    if (task.workspace_id) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members').select('id')
        .eq('workspace_id', task.workspace_id).eq('user_id', userId).maybeSingle();
      if (!membership) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
  }

  if (task.worker_slug !== 'website-builder') {
    return NextResponse.json({ error: 'Task is not a website-builder task' }, { status: 400 });
  }

  if (task.status !== 'completed') {
    return NextResponse.json({ error: 'Task must be completed before pushing' }, { status: 400 });
  }

  // Server-assemble HTML from task output or body HTML
  const taskOutput = task.output as Record<string, unknown> | null;
  let assembledHtml = (taskOutput?.assembledHtml ?? taskOutput?.assembled_html ?? taskOutput?.html ?? body.assembledHtml ?? '') as string;

  // Fallback: assemble from artifact sections if assembledHtml is not present
  if (!assembledHtml && taskOutput?.artifact) {
    const art = taskOutput.artifact as Record<string, unknown>;
    const sections = (art?.sections ?? {}) as Record<string, { order: number; html: string; css: string }>;
    const shared = (art?.shared ?? {}) as { head_html?: string; global_css?: string; global_js?: string; tailwind_cdn?: boolean };
    const sortedSections = Object.values(sections).sort((a, b) => a.order - b.order);
    const sectionsHtml = sortedSections.map(s => s.html || '').join('\n');
    const sectionsCss = sortedSections.map(s => s.css || '').filter(Boolean).join('\n');
    const tailwindTag = shared.tailwind_cdn !== false ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
    assembledHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${tailwindTag}\n${shared.head_html || ''}\n<style>\n${shared.global_css || ''}\n${sectionsCss}\n</style>\n</head>\n<body>\n${sectionsHtml}\n<script>\n${shared.global_js || ''}\n</script>\n</body>\n</html>`;
  }

  if (!assembledHtml) return NextResponse.json({ error: 'No HTML found in task output' }, { status: 400 });

  // Derive businessName and pageType from task input (server-side)
  const taskInput = task.input as Record<string, string> | null;
  const businessName = taskInput?.business_name || 'Website';
  const pageType = taskInput?.page_type || 'landing';

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
    const msg = e instanceof SsrfError ? e.message : 'Invalid URL';
    return NextResponse.json({ error: 'WordPress site URL is invalid. Please reconnect.' }, { status: 400 });
  }

  const decryptedPassword = await decryptToken(wpConn.app_password);
  const credentials = Buffer.from(`${wpConn.username}:${decryptedPassword}`).toString('base64');

  // Extract body content from assembled HTML for WordPress content field
  // WordPress handles <head> separately, so we push just the body content
  const bodyMatch = assembledHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : assembledHtml;

  // Also inject the CSS inline via a <style> block prepended to content
  const cssMatch = assembledHtml.match(/<style>([\s\S]*?)<\/style>/i);
  const inlineStyle = cssMatch ? `<style>\n${cssMatch[1]}\n</style>\n\n` : '';

  const wpContent = inlineStyle + bodyContent;
  const pageTitle = `${businessName} — ${PAGE_TYPE_LABELS[pageType] || 'Website'}`;

  // Create as PAGE (not post) — better for one-page sites
  // F3: use safeFetchExternal — validates site_url redirect hops, caps response size
  let pageRes: Response;
  try {
    pageRes = await safeFetchExternal(`${wpConn.site_url}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: pageTitle,
        content: wpContent,
        status: 'draft',
      }),
      allowedContentTypes: ['application/json'],
      maxBytes: 512 * 1024,
    });
  } catch (e) {
    if (e instanceof SsrfError || e instanceof SsrfFetchError) {
      return NextResponse.json({ error: `WordPress push blocked: ${e.message}` }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create WordPress page. Check your WordPress connection.' }, { status: 500 });
  }

  if (!pageRes.ok) {
    const errData = await pageRes.json().catch(() => ({}));
    console.error('[Silas WP push] error:', errData);
    return NextResponse.json({ error: 'Failed to create WordPress page. Check your WordPress connection.' }, { status: 500 });
  }

  const pageData = await pageRes.json();

  return NextResponse.json({
    success: true,
    page_id: pageData.id,
    page_url: pageData.link,
    edit_url: `${wpConn.site_url}/wp-admin/post.php?post=${pageData.id}&action=edit`,
    status: pageData.status,
    notes: [
      'Page created as draft. Review before publishing.',
      'Custom CSS is embedded inline — some themes may override it.',
      'Recommend using a "Blank Canvas" or "Full Width" page template.',
      'JavaScript interactions (smooth scroll, countdown timers) may be blocked by WP security plugins.',
    ],
  });
}
