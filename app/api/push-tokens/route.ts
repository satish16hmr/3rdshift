/**
 * /api/push-tokens
 * POST — register or update a push notification token for the current user
 * DELETE — remove a push token (on logout)
 *
 * Called by the Capacitor mobile app when push notifications are initialized.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let body: { token: string; platform: 'ios' | 'android' | 'web' };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, platform } = body;
  if (!token?.trim() || !['ios', 'android', 'web'].includes(platform)) {
    return NextResponse.json({ error: 'token and platform (ios/android/web) are required' }, { status: 400 });
  }

  // Upsert — if same token already registered, just update the user/workspace
  const { error } = await supabaseAdmin
    .from('push_tokens')
    .upsert({
      user_id: userId,
      workspace_id: workspaceId,
      token: token.trim(),
      platform,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'token' });

  if (error) {
    // Gracefully handle missing table (migration not yet run) — never crash on push token issues
    if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
      return NextResponse.json({ ok: true, note: 'push_tokens table pending migration' });
    }
    console.error('push-tokens upsert error:', error);
    // Graceful fail — push tokens are non-critical, never surface errors to client
    return NextResponse.json({ ok: true, note: 'token registration deferred' });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { token: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token } = body;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('push_tokens')
    .delete()
    .eq('token', token.trim())
    .eq('user_id', userId);

  if (error && !error.message?.includes('does not exist')) {
    return NextResponse.json({ error: 'Failed to remove token' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
