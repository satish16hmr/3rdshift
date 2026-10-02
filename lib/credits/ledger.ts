/**
 * lib/credits/ledger.ts
 *
 * D6: Atomic credit ledger helpers.
 * All credit debit/refund operations must go through these helpers.
 * They call the debit_credits / refund_credits Postgres RPCs which use
 * row-level locking to prevent concurrent race conditions.
 *
 * Callsites replaced:
 *   - app/api/execute-task/route.ts (debit on start, refund on failure)
 *   - app/api/chat/trigger-chain/route.ts (debit upfront, refund on step failure)
 *   - lib/agent-mode/executor.ts (per-step debit + refund)
 *   - app/api/website-builder/add-section/route.ts (1 credit debit)
 *   - app/api/website-builder/refine-section/route.ts (1 credit debit)
 *   - app/api/cron/cleanup-stale-tasks/route.ts (refund on stale task cleanup)
 *   - app/api/cron/poll-video/route.ts (refund on video failure)
 */

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface DebitResult {
  ok: boolean;
  debitedPlan: number;
  debitedTopup: number;
  errorCode: string | null;
}

export interface RefundResult {
  ok: boolean;
  refunded: number;
  errorCode: string | null;
}

/**
 * Atomically debit credits from a user.
 * Deducts from plan credits first, then topup FIFO.
 * Uses Postgres row lock — safe under concurrent requests.
 */
export async function debitCredits(params: {
  userId: string;
  amount: number;
  referenceId: string;
  referenceType: 'task' | 'chain_step' | 'website_section';
  workspaceId?: string | null;
  supabase?: ReturnType<typeof createClient>;
}): Promise<DebitResult> {
  const { userId, amount, referenceId, referenceType, workspaceId, supabase: externalClient } = params;
  const db = externalClient ?? getAdmin();

  if (amount <= 0) return { ok: true, debitedPlan: 0, debitedTopup: 0, errorCode: null };

  const { data, error } = await (db as any).rpc('debit_credits', {
    p_user_id:        userId,
    p_amount:         amount,
    p_reference_id:   referenceId,
    p_reference_type: referenceType,
    p_workspace_id:   workspaceId ?? null,
  });

  if (error) {
    console.error('[ledger] debit_credits RPC error:', error.message);
    return { ok: false, debitedPlan: 0, debitedTopup: 0, errorCode: 'rpc_error' };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: row?.ok ?? false,
    debitedPlan: row?.debited_plan ?? 0,
    debitedTopup: row?.debited_topup ?? 0,
    errorCode: row?.error_code ?? null,
  };
}

/**
 * Atomically refund credits to a user.
 * Always refunds to plan credits bucket.
 */
export async function refundCredits(params: {
  userId: string;
  amount: number;
  referenceId: string;
  referenceType: 'task' | 'chain_step' | 'website_section' | 'stale_task' | 'video_failure' | 'trigger-chain-failure' | 'trigger-chain-exception' | 'trigger-chain-reservation-failure';
  workspaceId?: string | null;
  supabase?: ReturnType<typeof createClient>;
}): Promise<RefundResult> {
  const { userId, amount, referenceId, referenceType, workspaceId, supabase: externalClient } = params;
  const db = externalClient ?? getAdmin();

  if (amount <= 0) return { ok: true, refunded: 0, errorCode: null };

  const { data, error } = await (db as any).rpc('refund_credits', {
    p_user_id:        userId,
    p_amount:         amount,
    p_reference_id:   referenceId,
    p_reference_type: referenceType,
    p_workspace_id:   workspaceId ?? null,
  });

  if (error) {
    console.error('[ledger] refund_credits RPC error:', error.message);
    return { ok: false, refunded: 0, errorCode: 'rpc_error' };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const result: RefundResult = {
    ok: row?.ok ?? false,
    refunded: row?.refunded ?? 0,
    errorCode: row?.error_code ?? null,
  };

  // Alert if no_original_debit — means we tried to refund credits that were never debited.
  // This should not happen in normal flow; indicates a bug or a cron double-refund attempt.
  if (result.errorCode === 'no_original_debit') {
    console.error(
      '[ledger] no_original_debit: refund attempted with no matching debit row.',
      { referenceId: params.referenceId, referenceType: params.referenceType, userId: params.userId, amount: params.amount }
    );
  }

  return result;
}
