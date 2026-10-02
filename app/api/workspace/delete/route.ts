import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { enforceWorkspaceLimitResolution } from '@/lib/billing/plan-transitions';
import type { PlanSlug } from '@/lib/billing/types';

/**
 * DELETE /api/workspace/delete
 *
 * Deletes a workspace owned by the caller.
 * After deletion, checks if user is now at or below workspace limit
 * and clears resolution state if so.
 *
 * Request body: { workspace_id: string }
 *
 * Rules:
 * - Caller must be the workspace owner
 * - Cannot delete last workspace (would leave user with 0)
 * - Cleans up all workspace-scoped data
 * - Clears requires_workspace_resolution when count drops to allowed limit
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { workspace_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { workspace_id } = body;

  if (!workspace_id || typeof workspace_id !== 'string') {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }

  // Verify ownership
  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .select('id, owner_id, name')
    .eq('id', workspace_id)
    .single();

  if (wsErr || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (workspace.owner_id !== userId) {
    return NextResponse.json({ error: 'Only the workspace owner can delete it' }, { status: 403 });
  }

  // Delete workspace (cascade handles members, tasks, integrations via FK or explicit cleanup)
  // Explicit cleanup for tables that may not have CASCADE
  const integrationTables = [
    'wordpress_connections',
    'zapier_api_keys',
    'zapier_webhook_subscriptions',
    'buffer_tokens',
    'mailchimp_tokens',
    'notion_tokens',
    'google_workspace_tokens',
    'workspace_invites',
    'workspace_members',
    'agent_mode_chains',
    'agent_mode_presets',
    'custom_playbooks',
  ] as const;

  for (const table of integrationTables) {
    await supabaseAdmin.from(table).delete().eq('workspace_id', workspace_id);
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('workspaces')
    .delete()
    .eq('id', workspace_id);

  if (deleteErr) {
    console.error('[workspace/delete] delete failed:', deleteErr);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }

  // Phase 19.6: use centralized enforceWorkspaceLimitResolution instead of inline logic.
  // Re-evaluates current workspace count vs plan limit and sets/clears resolution state.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  if (profile?.plan) {
    await enforceWorkspaceLimitResolution(supabaseAdmin, userId, profile.plan as PlanSlug);
  }

  return NextResponse.json({ deleted: true, workspace_id });
}
