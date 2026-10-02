import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface WorkspaceInfo {
  id: string;
  name: string;
  company_logo_url: string | null;
  plan: string;
  role: 'owner' | 'member';
  owner_id: string;
  max_seats: number;
  heavy_credits_limit: number;
  light_tasks_limit: number;
}

/**
 * Gets the active workspace ID for a user.
 *
 * Priority:
 * 1. If preferredWorkspaceId is supplied AND user is a member of that workspace → use it.
 *    User's explicit choice is always respected, regardless of plan rank.
 * 2. Fall back to the most recently joined workspace.
 *
 * The old plan-rank fallback (always returning the highest-plan workspace) is removed.
 * It silently overrode the user's selected workspace, causing operations to land in
 * the wrong workspace for multi-workspace users.
 */
export async function getActiveWorkspaceId(
  userId: string,
  preferredWorkspaceId?: string | null
): Promise<string | null> {
  // If a preferred workspace is supplied, verify membership and return it if valid
  if (preferredWorkspaceId) {
    const { data: preferred } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', preferredWorkspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (preferred) {
      return preferred.workspace_id;
    }
    // F6 fix: explicit workspace provided but user is not a member — return null (403).
    // Never silently fall back to user's default when an explicit workspace ID was given.
    // Caller errors (wrong workspace ID) must surface as 403, not silently redirect.
    return null;
  }

  // Fallback: return the user's most recently joined workspace
  const { data: memberships } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1);

  if (!memberships || memberships.length === 0) return null;
  return memberships[0]?.workspace_id ?? null;
}

/**
 * Gets all workspaces a user belongs to (for the workspace switcher).
 */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceInfo[]> {
  const workspaceQuery = await supabaseAdmin
    .from('workspace_members')
    .select(`
      role,
      workspaces (
        id, name, company_logo_url, plan, owner_id, max_seats, heavy_credits_limit, light_tasks_limit
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  let data: any[] | null = workspaceQuery.data;
  const error = workspaceQuery.error;

  if (error?.message?.toLowerCase().includes('company_logo_url')) {
    const fallback = await supabaseAdmin
      .from('workspace_members')
      .select(`
        role,
        workspaces (
          id, name, plan, owner_id, max_seats, heavy_credits_limit, light_tasks_limit
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });
    data = fallback.data as any;
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.workspaces.id,
    name: row.workspaces.name,
    company_logo_url: row.workspaces.company_logo_url ?? null,
    plan: row.workspaces.plan,
    role: row.role,
    owner_id: row.workspaces.owner_id,
    max_seats: row.workspaces.max_seats,
    heavy_credits_limit: row.workspaces.heavy_credits_limit,
    light_tasks_limit: row.workspaces.light_tasks_limit,
  }));
}

/**
 * Returns the effective plan for a workspace.
 * Always reads from the workspace owner's profile — the single source of truth.
 * Use this in ALL API routes instead of reading profile.plan directly.
 * This ensures seat members (who have no plan on their own profile) get the workspace owner's plan.
 */
export async function getWorkspaceOwnerPlan(workspaceId: string): Promise<string> {
  console.log('[getWorkspaceOwnerPlan] workspaceId:', workspaceId);
  // Get workspace owner
  const { data: ws } = await supabaseAdmin
    .from('workspaces')
    .select('owner_id, plan')
    .eq('id', workspaceId)
    .single();

  if (!ws) return 'starter';

  // Get owner's profile plan (source of truth — Stripe updates this)
  const { data: ownerProfile } = await supabaseAdmin
    .from('profiles')
    .select('plan, is_founding_member, founding_tier')
    .eq('id', ws.owner_id)
    .single();

  if (!ownerProfile) { console.log('[getWorkspaceOwnerPlan] no ownerProfile, returning ws.plan:', ws?.plan); return ws?.plan || 'starter'; }

  // Founding members: use founding_tier as their plan
  const finalPlan = (ownerProfile.is_founding_member && ownerProfile.founding_tier)
    ? ownerProfile.founding_tier
    : (ownerProfile.plan || ws?.plan || 'starter');
  console.log('[getWorkspaceOwnerPlan] ownerProfile.plan:', ownerProfile.plan, 'founding_tier:', ownerProfile.founding_tier, 'FINAL:', finalPlan);
  return finalPlan;
}

/**
 * Gets full workspace info for a given workspace ID.
 * Verifies the user is a member before returning.
 */
export async function getWorkspace(
  workspaceId: string,
  userId: string
): Promise<WorkspaceInfo | null> {
  const workspaceQuery = await supabaseAdmin
    .from('workspace_members')
    .select(`
      role,
      workspaces (
        id, name, company_logo_url, plan, owner_id, max_seats, heavy_credits_limit, light_tasks_limit
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  let data: any | null = workspaceQuery.data;
  const error = workspaceQuery.error;

  if (error?.message?.toLowerCase().includes('company_logo_url')) {
    const fallback = await supabaseAdmin
      .from('workspace_members')
      .select(`
        role,
        workspaces (
          id, name, plan, owner_id, max_seats, heavy_credits_limit, light_tasks_limit
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();
    data = fallback.data as any;
  }

  if (!data) return null;

  return {
    id: (data as any).workspaces.id,
    name: (data as any).workspaces.name,
    company_logo_url: (data as any).workspaces.company_logo_url ?? null,
    plan: (data as any).workspaces.plan,
    role: data.role as 'owner' | 'member',
    owner_id: (data as any).workspaces.owner_id,
    max_seats: (data as any).workspaces.max_seats,
    heavy_credits_limit: (data as any).workspaces.heavy_credits_limit,
    light_tasks_limit: (data as any).workspaces.light_tasks_limit,
  };
}
