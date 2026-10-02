import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';

// POST /api/workspace/join — accept a workspace invite
// NOTE: Uses direct JWT auth (not requireAuth) because the joining user may have
// no workspace yet — requireAuth returns 403 if no workspace found, which would
// break the join flow for brand new users accepting their first invite.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = user.id;

  let body: { token: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token: inviteToken } = body;
  if (!inviteToken) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  // Find the invite
  const { data: invite } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, workspace_id, email, accepted, expires_at, workspaces(name, max_seats, plan)')
    .eq('token', inviteToken)
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
  }

  if (invite.accepted) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
  }

  // P7-1: Verify the authenticated user's email matches the invite email (case-insensitive)
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: 'This invite was sent to a different email address.' },
      { status: 403 }
    );
  }

  const workspace = (invite as any).workspaces;

  // Check not already a member
  const { data: existing } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', userId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'You are already a member of this workspace' }, { status: 400 });
  }

  // P7-2: Atomic seat check — INSERT only if current member count < max_seats.
  // Uses a conditional INSERT to eliminate the TOCTOU race between count check and insert.
  const maxSeats: number = workspace?.max_seats ?? 1;

  const { data: inserted, error: insertError } = await supabaseAdmin.rpc(
    'insert_workspace_member_if_seat_available',
    {
      p_workspace_id: invite.workspace_id,
      p_user_id: userId,
      p_role: 'member',
      p_max_seats: maxSeats,
    }
  );

  // If RPC not available yet (pre-migration), fall back to two-step with count check
  if (insertError?.code === 'PGRST202' || insertError?.message?.includes('function') ) {
    // RPC doesn't exist — fall back to non-atomic check (pre-migration path)
    const { count: memberCount } = await supabaseAdmin
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', invite.workspace_id);

    if ((memberCount ?? 0) >= maxSeats) {
      return NextResponse.json({ error: 'This workspace is full' }, { status: 400 });
    }

    await supabaseAdmin.from('workspace_members').insert({
      workspace_id: invite.workspace_id,
      user_id: userId,
      role: 'member',
    });
  } else if (insertError) {
    console.error('[workspace/join] insert error:', insertError);
    return NextResponse.json({ error: 'Failed to join workspace' }, { status: 500 });
  } else if (inserted === false || inserted === 0) {
    // RPC returned false/0 = seat limit reached
    return NextResponse.json({ error: 'This workspace is full' }, { status: 400 });
  }

  // Mark invite as accepted
  await supabaseAdmin
    .from('workspace_invites')
    .update({ accepted: true })
    .eq('id', invite.id);

  return NextResponse.json({
    success: true,
    workspace_id: invite.workspace_id,
    workspace_name: workspace?.name || 'workspace',
  });
}
