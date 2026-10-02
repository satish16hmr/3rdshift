import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

// GET /api/workspace/activity — returns tasks + credit usage for the active workspace
// Uses service role to bypass RLS — auth check is done via requireAuth
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

  // Get workspace info
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('plan, max_seats, heavy_credits_limit, light_tasks_limit, owner_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace || workspace.plan !== 'operator') {
    return NextResponse.json({ error: 'Activity Dashboard requires Operator plan' }, { status: 403 });
  }

  const ownerId = workspace.owner_id ?? userId;

  // Get all workspace member user IDs
  const { data: memberRows } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId);
  const memberUserIds = Array.from(new Set([
    ownerId,
    ...(memberRows ?? []).map(m => m.user_id),
  ].filter(Boolean)));

  // Get all tasks for this workspace:
  // - tasks with workspace_id set (new tasks created after migration)
  // - tasks with user_id matching any member but no workspace_id (backfilled/old tasks)
  const { data: tasksByWorkspace } = await supabaseAdmin
    .from('tasks')
    .select('id, worker_slug, status, created_at, completed_at, user_id, category')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: tasksByUser } = await supabaseAdmin
    .from('tasks')
    .select('id, worker_slug, status, created_at, completed_at, user_id, category')
    .in('user_id', memberUserIds)
    .is('workspace_id', null)
    .order('created_at', { ascending: false })
    .limit(200);

  // Merge and deduplicate
  const allTasksMap = new Map();
  for (const t of [...(tasksByWorkspace ?? []), ...(tasksByUser ?? [])]) {
    allTasksMap.set(t.id, t);
  }
  const allTasks = Array.from(allTasksMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const tasks = allTasks
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 100);

  const { count: completedWorkspaceCount } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed');

  const { count: completedLegacyCount } = memberUserIds.length > 0
    ? await supabaseAdmin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('user_id', memberUserIds)
      .is('workspace_id', null)
      .eq('status', 'completed')
    : { count: 0 };

  // Get members with profile info
  const { data: members } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, role, joined_at')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true });

  const memberRecords = members ?? [];
  const ownerInMembers = memberRecords.some(m => m.user_id === ownerId);
  const membersWithOwner = ownerInMembers
    ? memberRecords
    : [{ user_id: ownerId, role: 'owner', joined_at: null }, ...memberRecords];

  const enrichedMembers = await Promise.all(
    membersWithOwner.map(async (m) => {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, avatar_url')
        .eq('id', m.user_id)
        .single();

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
        name: profile?.full_name || email || m.user_id.slice(0, 8),
        email,
        avatar_url: profile?.avatar_url || null,
        task_count: (workspaceTaskCount ?? 0) + (legacyTaskCount ?? 0),
      };
    })
  );

  const completedCount = (completedWorkspaceCount ?? 0) + (completedLegacyCount ?? 0);

  // Get real credit usage from the WORKSPACE OWNER's profile (source of truth)
  // Always use owner's profile — seat members have no subscription on their own profile
  const { data: ownerProfile } = await supabaseAdmin
    .from('profiles')
    .select('heavy_credits_remaining')
    .eq('id', ownerId)
    .single();

  const heavyLimit = workspace.heavy_credits_limit ?? 0;
  const heavyRemaining = ownerProfile?.heavy_credits_remaining ?? heavyLimit;
  const heavyUsed = Math.max(0, heavyLimit - heavyRemaining);

  return NextResponse.json({
    workspace: {
      plan: workspace.plan,
      heavy_credits_limit: heavyLimit,
      heavy_credits_used: heavyUsed,
      light_tasks_limit: workspace.light_tasks_limit,
    },
    tasks: tasks ?? [],
    members: enrichedMembers,
    completed_count: completedCount,
  });
}
