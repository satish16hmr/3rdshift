import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

// GET /api/workspace/members — list members + pending invites for a workspace
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // Verify user is a member of this workspace
  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
  }

  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single();
  const ownerId = workspace?.owner_id ?? null;

  // Get all members with their profile info
  const { data: members } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, role, joined_at')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true });

  const memberRecords = members ?? [];
  const ownerInMembers = ownerId ? memberRecords.some(m => m.user_id === ownerId) : true;
  const membersWithOwner = ownerId && !ownerInMembers
    ? [{ user_id: ownerId, role: 'owner', joined_at: null }, ...memberRecords]
    : memberRecords;

  // Fetch profile info for each member
  const enrichedMembers = await Promise.all(
    membersWithOwner.map(async (m) => {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, avatar_url')
        .eq('id', m.user_id)
        .single();

      // Also get email from auth.users if not in profiles
      let email = profile?.email;
      if (!email) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        email = user?.email;
      }

      const [{ count: workspaceTaskCount }, { count: legacyTaskCount }] = await Promise.all([
        supabaseAdmin
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('user_id', m.user_id),
        supabaseAdmin
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', m.user_id)
          .is('workspace_id', null),
      ]);

      return {
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        name: profile?.full_name || null,
        email: email || null,
        avatar_url: profile?.avatar_url || null,
        task_count: (workspaceTaskCount ?? 0) + (legacyTaskCount ?? 0),
      };
    })
  );

  // Get pending (unaccepted, non-expired) invites
  const { data: pendingInvites } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, email, token, created_at, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('accepted', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return NextResponse.json({
    members: enrichedMembers,
    pending_invites: pendingInvites ?? [],
  });
}
