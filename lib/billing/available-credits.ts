import { BILLING_CATALOG } from './catalog';
import { calculateAvailableCreditBalance } from './credit-balance';
import type { PlanSlug } from './types';

type SupabaseLike = {
  from(table: string): {
    // Supabase's fluent PostgREST builders are thenable but not Promise-typed.
    // Keep this narrow helper adapter permissive so service-role and test fakes both fit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select(columns?: string): any;
  };
};

export type AvailableCredits = {
  /** Monthly/included plan bucket only: profiles.heavy_credits_remaining. */
  planCreditsRemaining: number;
  /** Purchased top-up bucket only: active credit_topups.credits_remaining. */
  topupCreditsRemaining: number;
  /** Canonical readable balance: planCreditsRemaining + topupCreditsRemaining. */
  availableCreditsRemaining: number;
  plan: string;
  includedCreditsLimit: number;
};

function toNonNegativeNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? Math.max(num, 0) : 0;
}

function isActiveTopup(row: { expires_at?: string | null }): boolean {
  return !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
}

function includedCreditsForPlan(plan: string): number {
  return (BILLING_CATALOG as Record<string, { heavy_credits: number }>)[plan]?.heavy_credits ?? 0;
}

/**
 * Read active purchased top-up credits using the same effective eligibility as debit_credits:
 * credits_remaining > 0 and (expires_at IS NULL OR expires_at > now()).
 */
export async function getActiveTopupCredits(db: SupabaseLike, userId: string): Promise<number> {
  const { data, error } = await db
    .from('credit_topups')
    .select('credits_remaining, expires_at')
    .eq('user_id', userId)
    .gt('credits_remaining', 0);

  if (error) throw new Error(`Failed to read top-up credits: ${error.message ?? String(error)}`);

  return (data ?? [])
    .filter(isActiveTopup)
    .reduce((sum: number, row: { credits_remaining?: number | null }) => (
      sum + toNonNegativeNumber(row.credits_remaining)
    ), 0);
}

/**
 * Canonical read-side credit balance. Does not overload heavy_credits_remaining:
 * planCreditsRemaining is the plan bucket, topupCreditsRemaining is purchased top-ups,
 * availableCreditsRemaining is the sum that UI/gates should read.
 */
export async function getAvailableCredits(db: SupabaseLike, userId: string): Promise<AvailableCredits> {
  const [{ data: profileRow, error: profileError }, topupCreditsRemaining] = await Promise.all([
    db
      .from('profiles')
      .select('plan, heavy_credits_remaining')
      .eq('id', userId)
      .single(),
    getActiveTopupCredits(db, userId),
  ]);

  if (profileError) throw new Error(`Failed to read profile credits: ${profileError.message ?? String(profileError)}`);

  const profile = profileRow as { plan?: string | null; heavy_credits_remaining?: number | null } | null;
  const plan = profile?.plan || 'none';
  const planCreditsRemaining = toNonNegativeNumber(profile?.heavy_credits_remaining);
  const availableCreditsRemaining = calculateAvailableCreditBalance({
    planCreditsRemaining,
    topupCreditsRemaining,
  });

  return {
    planCreditsRemaining,
    topupCreditsRemaining,
    availableCreditsRemaining,
    plan,
    includedCreditsLimit: includedCreditsForPlan(plan as PlanSlug),
  };
}

/** Resolve the workspace billing owner and return their canonical available credit balance. */
export async function getWorkspaceOwnerAvailableCredits(db: SupabaseLike, workspaceId: string): Promise<AvailableCredits> {
  const { data: workspace, error } = await db
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single();

  if (error) throw new Error(`Failed to resolve workspace owner: ${error.message ?? String(error)}`);
  const workspaceRow = workspace as { owner_id?: string | null } | null;
  if (!workspaceRow?.owner_id) throw new Error('Workspace owner not found');

  return getAvailableCredits(db, workspaceRow.owner_id);
}
