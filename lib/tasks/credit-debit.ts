import { getAvailableCredits } from '@/lib/billing/available-credits';
import { checkWeekOneHeavyCap } from '@/lib/billing/guarantee';
import { debitCredits } from '@/lib/credits/ledger';

export type TaskDebitResult =
  | { ok: true; alreadyDebited: boolean; debitedPlan: number; debitedTopup: number }
  | { ok: false; status: number; error: string; errorCode: string | null };

type SupabaseLike = {
  from(table: string): any;
};

export async function resolveTaskCreditOwner(
  db: SupabaseLike,
  params: { taskUserId: string; workspaceId?: string | null },
): Promise<{ creditOwnerId: string; workspaceId: string | null }> {
  let creditOwnerId = params.taskUserId;
  let workspaceId = params.workspaceId ?? null;

  if (!workspaceId) {
    const { data: memberRow } = await db
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', params.taskUserId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();
    workspaceId = memberRow?.workspace_id ?? null;
  }

  if (workspaceId) {
    const { data: ws } = await db
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();
    if (ws?.owner_id) creditOwnerId = ws.owner_id;
  }

  return { creditOwnerId, workspaceId };
}

export async function hasTaskDebit(
  db: SupabaseLike,
  params: { creditOwnerId: string; taskId: string },
): Promise<boolean> {
  const { data, error } = await db
    .from('credit_transactions')
    .select('id')
    .eq('user_id', params.creditOwnerId)
    .eq('reference_id', params.taskId)
    .eq('reference_type', 'task')
    .gt('amount', 0)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing task debit: ${error.message ?? String(error)}`);
  }

  return Boolean(data?.id);
}

/**
 * Authoritative heavy-task credit gate.
 *
 * The available-credit read provides a cheap 402 preflight before expensive work.
 * debitCredits remains the source of truth and performs the atomic row-locked debit.
 * Existing debit rows make retries/no-op execution idempotent so each task is charged once.
 */
export async function ensureTaskCreditsDebited(
  db: SupabaseLike,
  params: {
    creditOwnerId: string;
    workspaceId?: string | null;
    taskId: string;
    amount: number;
  },
): Promise<TaskDebitResult> {
  const amount = params.amount ?? 0;
  if (amount <= 0) {
    return { ok: true, alreadyDebited: false, debitedPlan: 0, debitedTopup: 0 };
  }

  if (await hasTaskDebit(db, { creditOwnerId: params.creditOwnerId, taskId: params.taskId })) {
    return { ok: true, alreadyDebited: true, debitedPlan: 0, debitedTopup: 0 };
  }

  const available = await getAvailableCredits(db, params.creditOwnerId);
  const capCheck = await checkWeekOneHeavyCap(db, {
    userId: params.creditOwnerId,
    plan: available.plan,
    attemptedAmount: amount,
  });
  if (!capCheck.allowed) {
    return {
      ok: false,
      status: capCheck.status,
      error: capCheck.error,
      errorCode: 'week_one_heavy_cap',
    };
  }

  if (available.availableCreditsRemaining < amount) {
    return {
      ok: false,
      status: 402,
      error: 'Not enough credits. Upgrade your plan or purchase top-up credits.',
      errorCode: 'insufficient_credits',
    };
  }

  const debit = await debitCredits({
    userId: params.creditOwnerId,
    amount,
    referenceId: params.taskId,
    referenceType: 'task',
    workspaceId: params.workspaceId ?? null,
    supabase: db as any,
  });

  if (!debit.ok) {
    return {
      ok: false,
      status: debit.errorCode === 'insufficient_credits' ? 402 : 409,
      error: debit.errorCode === 'insufficient_credits'
        ? 'Not enough credits. Upgrade your plan or purchase top-up credits.'
        : 'Credit reservation failed. Please try again.',
      errorCode: debit.errorCode,
    };
  }

  return {
    ok: true,
    alreadyDebited: false,
    debitedPlan: debit.debitedPlan,
    debitedTopup: debit.debitedTopup,
  };
}
