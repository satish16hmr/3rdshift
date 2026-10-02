/**
 * lib/billing/resolution-gate.ts
 *
 * Single helper for enforcing workspace resolution state at every state-mutation surface.
 *
 * When a user downgrades or cancels and exceeds their workspace limit,
 * `profiles.requires_workspace_resolution` is set to true.
 * While in this state, no state-mutation API may proceed for that account.
 *
 * INV-1: When requires_workspace_resolution=true for the credit owner, no
 *         state-mutation API may proceed for that account.
 * INV-2: For workspace-scoped operations, the credit owner's resolution state
 *         is checked, not the caller's. (Member-on-owner-account case.)
 *
 * Phase 21 — 2026-04-30.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolutionGateResult {
  blocked: boolean;
  target_plan: string | null;
  excess_count: number;
}

/**
 * Checks whether the given credit owner's account is in workspace resolution state.
 *
 * Always pass the CREDIT OWNER's user_id — for workspace-scoped operations,
 * this is the workspace owner_id, not the caller's user_id.
 *
 * Returns { blocked: false } when account is clear to proceed.
 * Returns { blocked: true, target_plan, excess_count } when blocked.
 */
export async function enforceResolutionGate(
  supabase: SupabaseClient,
  owner_user_id: string
): Promise<ResolutionGateResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('requires_workspace_resolution, resolution_target_plan, resolution_excess_count')
    .eq('id', owner_user_id)
    .single();

  if (error || !profile) {
    // If we can't read the profile, fail open — don't block on a missing row.
    // The caller's own auth checks already confirmed the user exists.
    console.warn(`[resolution-gate] Could not read profile for user ${owner_user_id}: ${error?.message}`);
    return { blocked: false, target_plan: null, excess_count: 0 };
  }

  if (!profile.requires_workspace_resolution) {
    return { blocked: false, target_plan: null, excess_count: 0 };
  }

  return {
    blocked: true,
    target_plan: profile.resolution_target_plan ?? null,
    excess_count: profile.resolution_excess_count ?? 0,
  };
}
