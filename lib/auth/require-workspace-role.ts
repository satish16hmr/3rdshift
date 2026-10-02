/**
 * requireWorkspaceRole — Phase 2 authorization middleware
 *
 * Combines JWT authentication and workspace role enforcement in a single DB query.
 * Use this instead of requireAuth for any workspace-scoped route that has role restrictions.
 *
 * Usage:
 *   const auth = await requireWorkspaceRole(req, workspaceId, ['owner']);
 *   if (auth instanceof NextResponse) return auth;
 *   const { userId, role } = auth;
 *
 * workspaceId must be derived server-side (from requireAuth, URL params, or a related
 * resource's foreign key) — never trust a raw client-supplied workspace_id without
 * verifying the caller's membership in that workspace, which this function does.
 *
 * Note on multi-workspace ownership (plan-change edge case):
 *   A user who owns multiple workspaces has a single profile/plan. Plan changes via
 *   one workspace_id affect billing across all owned workspaces. This is by design —
 *   plan lives on the user, not the workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceAuthSuccess {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export async function requireWorkspaceRole(
  req: NextRequest,
  workspaceId: string,
  allowedRoles: WorkspaceRole[]
): Promise<WorkspaceAuthSuccess | NextResponse> {
  // ── 1. JWT auth ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  // ── 2. Workspace membership + role check (single DB query) ───────────────
  const { data: membership, error: roleErr } = await supabaseAdmin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (roleErr || !membership) {
    return NextResponse.json(
      { error: 'Not a member of this workspace' },
      { status: 403 }
    );
  }

  if (!allowedRoles.includes(membership.role as WorkspaceRole)) {
    // Fire-and-forget denial log — auth_denials table added in Step 2.
    // Until the table exists, the insert fails and Promise.catch() swallows it silently.
    // The 403 response is always returned regardless.
    Promise.resolve(
      supabaseAdmin
        .from('auth_denials')
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          route: req.url,
          required_role: allowedRoles.join('|'),
          actual_role: membership.role,
        })
    ).catch(() => {});

    return NextResponse.json(
      { error: `This action requires ${allowedRoles.join(' or ')} access` },
      { status: 403 }
    );
  }

  return { userId, workspaceId, role: membership.role as WorkspaceRole };
}
