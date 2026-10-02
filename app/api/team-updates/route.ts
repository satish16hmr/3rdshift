export const maxDuration = 60;
/**
 * /api/team-updates
 * GET  — fetch unread count + recent updates for notification panel
 * PATCH — mark as read (single or all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  // Fetch recent updates (not dismissed) + user plan
  const [updatesResult, unreadResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from('team_updates')
      .select('id, worker_slug, suggestion_type, preview_text, chat_message_id, read, created_at')
      .eq('workspace_id', workspaceId)
      .eq('dismissed', false)
      .not('chat_message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('team_updates')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('dismissed', false)
      .not('chat_message_id', 'is', null)
      .eq('read', false),
    supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single(),
  ]);

  if (updatesResult.error) {
    return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
  }

  const updates = updatesResult.data ?? [];
  const plan = profileResult.data?.plan || 'starter';
  const unreadCount = unreadResult.count ?? 0;

  return NextResponse.json({
    updates,
    unread_count: unreadCount,
    plan,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  let body: { action: 'mark_read' | 'mark_all_read' | 'dismiss'; id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action === 'mark_all_read') {
    const { error } = await supabaseAdmin
      .from('team_updates')
      .update({ read: true })
      .eq('workspace_id', workspaceId)
      .not('chat_message_id', 'is', null)
      .eq('read', false);

    if (error) return NextResponse.json({ error: 'Failed to mark all read' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'mark_read' && body.id) {
    const { error } = await supabaseAdmin
      .from('team_updates')
      .update({ read: true })
      .eq('id', body.id)
      .eq('workspace_id', workspaceId);

    if (error) return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'dismiss' && body.id) {
    const { error } = await supabaseAdmin
      .from('team_updates')
      .update({ dismissed: true, read: true })
      .eq('id', body.id)
      .eq('workspace_id', workspaceId);

    if (error) return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
