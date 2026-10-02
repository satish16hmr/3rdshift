import { NextRequest, NextResponse } from 'next/server';
import { requireZapierAuth, supabaseAdmin } from '@/lib/zapier/helpers';

export async function DELETE(req: NextRequest) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // Zapier may send as JSON or application/x-www-form-urlencoded
  let body: { id?: string; target_url?: string; hookUrl?: string } = {};
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

  if (!body.target_url && body.hookUrl) body.target_url = body.hookUrl;

  if (!body.id && !body.target_url) {
    return NextResponse.json({ error: 'Provide id or target_url to unsubscribe' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('zapier_webhook_subscriptions')
    .update({ active: false })
    .eq('workspace_id', workspaceId);

  if (body.id) {
    query = query.eq('id', body.id);
  } else if (body.target_url) {
    query = query.eq('target_url', body.target_url);
  }

  const { error } = await query;

  if (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe webhook' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
