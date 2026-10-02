import { NextRequest, NextResponse } from 'next/server';
import { requireZapierAuth, supabaseAdmin } from '@/lib/zapier/helpers';
import { assertSafeUrl, SsrfError } from '@/lib/ssrf';

export async function POST(req: NextRequest) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // Zapier may send as JSON or application/x-www-form-urlencoded,
  // and may use 'hookUrl' instead of 'target_url'
  let body: { target_url?: string; hookUrl?: string; event?: string } = {};
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries()) as typeof body;
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Body logging removed — contained webhook URLs (PII-adjacent)

  // Accept target_url, hookUrl, or any key whose value looks like an https URL
  const target_url =
    body.target_url ||
    body.hookUrl ||
    Object.values(body as Record<string, string>).find(
      (v) => typeof v === 'string' && v.startsWith('http')
    );
  const event = (body as Record<string, string>).event || 'task.completed';

  if (!target_url || !(target_url as string).startsWith('http')) {
    console.log('[zapier/subscribe] ERROR: no valid URL found in body (keys:', Object.keys(body).join(','), ')');
    return NextResponse.json({ error: 'target_url is required and must be a valid URL' }, { status: 400 });
  }

  // Phase 6: SSRF protection — must be HTTPS and from hooks.zapier.com only
  try {
    assertSafeUrl(target_url as string, ['hooks.zapier.com']);
  } catch (e) {
    const msg = e instanceof SsrfError ? e.message : 'Invalid webhook URL';
    return NextResponse.json({ error: `Invalid target_url: ${msg}` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('zapier_webhook_subscriptions')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      event,
      target_url,
      active: true,
    })
    .select('id, event, target_url')
    .single();

  if (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Failed to register webhook' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, event: data.event, target_url: data.target_url }, { status: 201 });
}
