import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { encryptToken } from '@/lib/crypto';
import { assertSafeUrl, safeFetchExternal, SsrfError, SsrfFetchError } from '@/lib/ssrf';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';

function getPlan(profile: { plan: string; is_founding_member: boolean; founding_tier: string | null } | null): string {
  if (!profile) return 'starter';
  return profile.is_founding_member ? (profile.founding_tier || 'starter') : profile.plan;
}

// POST — connect WordPress site
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // F6 fix: owner-only — connecting WP is a workspace-level integration
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, is_founding_member, founding_tier')
    .eq('id', userId)
    .single();

  if (getPlan(profile) === 'starter') {
    return NextResponse.json({ error: 'WordPress integration requires a Pro plan or higher.' }, { status: 403 });
  }

  let body: { site_url?: string; username?: string; app_password?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { site_url, username, app_password } = body;
  if (!site_url || !username || !app_password) {
    return NextResponse.json({ error: 'site_url, username, and app_password are required' }, { status: 400 });
  }

  // Normalize site URL
  const normalizedUrl = site_url.replace(/\/$/, '');

  // Phase 6: SSRF protection — must be HTTPS, must not be internal/private IP
  try {
    assertSafeUrl(normalizedUrl);
  } catch (e) {
    const msg = e instanceof SsrfError ? e.message : 'Invalid site URL';
    return NextResponse.json({
      error: `Invalid site URL: ${msg}. Your WordPress site must use HTTPS and be publicly accessible.`,
    }, { status: 400 });
  }

  // Test connection by fetching site info
  // F3: use safeFetchExternal — validates URL, follows redirects safely, caps response size
  const credentials = Buffer.from(`${username}:${app_password}`).toString('base64');
  let testRes: Response;
  try {
    testRes = await safeFetchExternal(`${normalizedUrl}/wp-json/wp/v2/`, {
      headers: { 'Authorization': `Basic ${credentials}` },
      allowedContentTypes: ['application/json', 'application/json; charset=utf-8'],
      maxBytes: 512 * 1024, // 512 KB max for site info response
    });
  } catch (e) {
    if (e instanceof SsrfError || e instanceof SsrfFetchError) {
      return NextResponse.json({
        error: `Could not connect to WordPress: ${e.message}`,
      }, { status: 400 });
    }
    return NextResponse.json({
      error: 'Could not connect to WordPress. Check your site URL and credentials.',
    }, { status: 400 });
  }

  if (!testRes.ok) {
    return NextResponse.json({
      error: 'Could not connect to WordPress. Check your site URL and credentials.',
    }, { status: 400 });
  }

  const siteInfo = await testRes.json().catch(() => ({}));

  // Encrypt the app password using AES-GCM before storing
  const encryptedPassword = await encryptToken(app_password);

  // F6 fix: upsert by (user_id, workspace_id) — not user_id alone
  await supabaseAdmin.from('wordpress_connections').upsert({
    user_id: userId,
    workspace_id: workspaceId,
    site_url: normalizedUrl,
    username,
    app_password: encryptedPassword,
    site_name: siteInfo.name || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,workspace_id' });

  return NextResponse.json({ success: true, site_name: siteInfo.name || null });
}

// DELETE — disconnect WordPress
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // F6 fix: delete by (user_id, workspace_id) — not user_id alone
  await supabaseAdmin.from('wordpress_connections')
    .delete()
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  return NextResponse.json({ success: true });
}
