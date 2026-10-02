import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

const supabase = supabaseAdmin;

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Fetch plan for target_plan filtering
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  const plan = profile?.plan || 'starter';

  // User-specific alerts (credit depleted, credit low)
  const { data: userAlerts } = await supabase
    .from('user_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Global announcements — filter by target_plan (null = all)
  const now = new Date().toISOString();
  const { data: systemNotifs } = await supabase
    .from('system_notifications')
    .select('*')
    .or(`target_plan.is.null,target_plan.cs.{${plan}}`)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(20);

  // Which system notifications has this user read?
  const systemIds = (systemNotifs || []).map((n) => n.id);
  let readIds = new Set<string>();
  if (systemIds.length > 0) {
    const { data: reads } = await supabase
      .from('user_notification_reads')
      .select('notification_id')
      .eq('user_id', userId)
      .in('notification_id', systemIds);
    readIds = new Set((reads || []).map((r) => r.notification_id));
  }

  // Normalize system notifications into same shape as user_alerts
  const systemNormalized = (systemNotifs || []).map((n) => ({
    id: n.id,
    user_id: null,
    type: n.type,
    title: n.title,
    body: n.body,
    link_url: n.link_url,
    link_text: n.link_text,
    is_read: readIds.has(n.id),
    created_at: n.created_at,
    _source: 'system' as const,
  }));

  const userNormalized = (userAlerts || []).map((a) => ({
    ...a,
    _source: 'user' as const,
  }));

  // Merge and sort by created_at desc
  const all = [...userNormalized, ...systemNormalized]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const unreadCount = all.filter((a) => !a.is_read).length;

  return NextResponse.json({ alerts: all, unread_count: unreadCount });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  let body: { action?: string; id?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { action, id, source } = body;

  if (action === 'mark_read') {
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (source !== 'system' && source !== 'user') {
      return NextResponse.json({ error: 'source must be system or user' }, { status: 400 });
    }
    if (source === 'system') {
      const { error } = await supabase
        .from('user_notification_reads')
        .upsert({ user_id: userId, notification_id: id }, { onConflict: 'user_id,notification_id' });
      if (error) return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
    } else {
      const { error } = await supabase
        .from('user_alerts')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
    }
  } else if (action === 'mark_all_read') {
    // Mark all user_alerts read
    const { error: userAlertError } = await supabase
      .from('user_alerts')
      .update({ is_read: true })
      .eq('user_id', userId);
    if (userAlertError) return NextResponse.json({ error: 'Failed to update alerts' }, { status: 500 });
    // Mark all system notifications read via user_notification_reads
    const { data: systemNotifs } = await supabase
      .from('system_notifications')
      .select('id');
    if (systemNotifs?.length) {
      const { error: readError } = await supabase
        .from('user_notification_reads')
        .upsert(
          systemNotifs.map((n) => ({ user_id: userId, notification_id: n.id })),
          { onConflict: 'user_id,notification_id' }
        );
      if (readError) return NextResponse.json({ error: 'Failed to update alerts' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
