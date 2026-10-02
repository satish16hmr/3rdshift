/**
 * cleanup-stale-tasks - runs every 5 minutes
 *
 * Does two things:
 * 1. Marks tasks stuck in 'processing' for >15 min as failed + refunds credits.
 * 2. Auto-refund sweep: finds failed tasks where credits_charged > 0 but refund
 *    never ran (race condition: Vercel killed function before catch block completed).
 *    Refunds those credits and marks the task with refund_applied = true.
 *    Logs a warning if >5 orphaned charges found in a single run (indicates systemic issue).
 */

import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { refundCredits as ledgerRefund } from '@/lib/credits/ledger';
import { refundLightTasks } from '@/lib/billing/light-tasks';

export const maxDuration = 30;

async function resolveCredits(
  supabaseAdmin: any,
  userId: string,
  workspaceId: string | null,
): Promise<string> {
  let creditOwnerId = userId;
  if (workspaceId) {
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();
    if (ws?.owner_id) creditOwnerId = ws.owner_id;
  }
  return creditOwnerId;
}

async function debitExists(
  supabaseAdmin: any,
  taskId: string,
): Promise<boolean> {
  // Check credit_transactions for a positive (debit) row for this task.
  // If none found, the task was never charged and should not be refunded.
  const { data, error } = await supabaseAdmin
    .from('credit_transactions')
    .select('id')
    .eq('reference_id', taskId)
    .gt('amount', 0)
    .limit(1);
  if (error) {
    // If the table doesn't exist yet or query errors, assume debit exists (safe default).
    console.warn('[cleanup-stale-tasks] debitExists check error:', error.message);
    return true;
  }
  return Array.isArray(data) && data.length > 0;
}

async function refundCredits(
  supabaseAdmin: any,
  creditOwnerId: string,
  amount: number,
  taskId: string,
  reason: string,
): Promise<void> {
  const { data: taskRefundState, error: refundStateError } = await supabaseAdmin
    .from('tasks')
    .select('refund_applied')
    .eq('id', taskId)
    .single();
  if (refundStateError) {
    console.warn(`[${reason}] refund_applied check error for task ${taskId}:`, refundStateError.message);
  } else if (taskRefundState?.refund_applied === true) {
    console.log(`[${reason}] Skipping refund for task ${taskId} — refund_applied is already true.`);
    return;
  }

  // F1: verify a debit row exists before attempting refund.
  // Prevents minting credits for tasks that were never charged.
  const hasDebit = await debitExists(supabaseAdmin, taskId);
  if (!hasDebit) {
    console.log(`[${reason}] Skipping refund for task ${taskId} — no debit row found (task was never charged).`);
    // Still mark refund_applied so we don't revisit this task on every sweep.
    await supabaseAdmin.from('tasks').update({ refund_applied: true }).eq('id', taskId);
    return;
  }

  // D6 fix: use atomic ledger RPC instead of non-atomic read+write
  const result = await ledgerRefund({
    userId: creditOwnerId,
    amount,
    referenceId: taskId,
    referenceType: 'stale_task',
  });
  if (!result.ok && result.errorCode === 'no_original_debit') {
    // Debit row was found in credit_transactions but the RPC couldn’t match it.
    // This means the debit was already fully refunded. Log and skip.
    console.warn(`[${reason}] no_original_debit from RPC for task ${taskId} — already refunded or debit already consumed.`);
  }
  // Mark task so we don't double-refund on next sweep
  await supabaseAdmin
    .from('tasks')
    .update({ refund_applied: true })
    .eq('id', taskId);
  console.log(`[${reason}] Refunded ${amount} credits for task ${taskId} (ok=${result.ok})`);
}

export async function GET(request: Request) {
  const cronAuth = verifyCronRequest(request);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const { supabaseAdmin } = await import('@/lib/api-auth');
  const now = Date.now();
  const cutoff15m = new Date(now - 15 * 60 * 1000).toISOString();
  const cutoff2h = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // only sweep tasks >2h old

  // ── Part 1: Stale processing tasks ──────────────────────────────────────
  const { data: staleTasks, error: staleError } = await supabaseAdmin
    .from('tasks')
    .select('id, worker_slug, user_id, workspace_id, credits_charged, task_type')
    .eq('status', 'processing')
    .lt('created_at', cutoff15m);

  let cleaned = 0;
  let refunded = 0;

  if (staleError) {
    console.error('[cleanup-stale-tasks] Stale query error:', staleError);
    return NextResponse.json({ error: 'stale_tasks_query_failed', message: staleError.message }, { status: 500 });
  } else if (staleTasks && staleTasks.length > 0) {
    for (const task of staleTasks) {
      await supabaseAdmin
        .from('tasks')
        .update({
          status: 'failed',
          error_message: 'Task timed out - please try again. Your credits have been refunded.',
          output: { error: 'Task timed out. Your credits have been refunded.' },
        })
        .eq('id', task.id);
      cleaned++;

      const creditsCharged = (task.credits_charged as number) ?? 0;
      if (creditsCharged > 0) {
        try {
          const ownerId = await resolveCredits(supabaseAdmin as any, task.user_id, task.workspace_id);
          await refundCredits(supabaseAdmin as any, ownerId, creditsCharged, task.id, 'stale-task-refund');
          refunded++;
        } catch (e) {
          console.error(`[cleanup-stale-tasks] Stale refund failed for task ${task.id}:`, e);
        }
      } else if (task.task_type === 'light') {
        await refundLightTasks({ supabase: supabaseAdmin as any, workspaceId: task.workspace_id, amount: 1 });
      }
    }
  }

  // ── Part 2: Auto-refund sweep (orphaned charges) ─────────────────────────
  // Find failed tasks where credits_charged > 0 but refund_applied is not true.
  // Only sweep tasks older than 2h to give the in-flight auto-refund time to fire first.
  const { data: orphanedTasks, error: orphanError } = await supabaseAdmin
    .from('tasks')
    .select('id, worker_slug, user_id, workspace_id, credits_charged, task_type')
    .eq('status', 'failed')
    .gt('credits_charged', 0)
    // F1 fix: .eq('refund_applied', false) misses NULL values (column default).
    // Use .or() to catch both false AND NULL — ensures all unrefunded tasks are swept.
    .or('refund_applied.eq.false,refund_applied.is.null')
    .lt('created_at', cutoff2h);

  let swept = 0;

  if (orphanError) {
    console.error('[cleanup-stale-tasks] Auto-refund sweep query error:', orphanError);
    return NextResponse.json({ error: 'auto_refund_sweep_query_failed', message: orphanError.message }, { status: 500 });
  } else if (orphanedTasks && orphanedTasks.length > 0) {
    // Launch-volume alerting: ANY orphaned refund = log prominently (at scale every refund matters)
    // Alert threshold raised to >5 for systemic-failure detection
    console.warn(
      `[cleanup-stale-tasks] ⚠️ AUTO-REFUND SWEEP: ${orphanedTasks.length} orphaned charge(s) found.`,
      orphanedTasks.map((t: any) => ({ id: t.id, slug: t.worker_slug, credits: t.credits_charged })),
    );
    if (orphanedTasks.length > 5) {
      console.error(
        `[cleanup-stale-tasks] ❗ SYSTEMIC ALERT: ${orphanedTasks.length} orphaned charges in one sweep - investigate execute-task refund path.`,
      );
    }

    for (const task of orphanedTasks) {
      const creditsCharged = (task.credits_charged as number) ?? 0;
      try {
        const ownerId = await resolveCredits(supabaseAdmin as any, task.user_id, task.workspace_id);
        await refundCredits(supabaseAdmin as any, ownerId, creditsCharged, task.id, 'auto-refund-sweep');
        swept++;
      } catch (e) {
        console.error(`[cleanup-stale-tasks] Auto-refund sweep failed for task ${task.id}:`, e);
      }
    }
  }

  // ── Part 3: Ghost pending tasks ────────────────────────────────────
  // Tasks stuck in 'pending' for >30 min never had execute-task called (or the call failed
  // before the task transitioned to 'processing'). No credits charged. Mark failed to prevent
  // them from counting against rate limits (e.g. Charlie's 5-per-24h window).
  const cutoff30m = new Date(now - 30 * 60 * 1000).toISOString();
  const { data: ghostTasks, error: ghostError } = await supabaseAdmin
    .from('tasks')
    .select('id, worker_slug, user_id, workspace_id, credits_charged, task_type')
    .eq('status', 'pending')
    .lt('created_at', cutoff30m);

  let ghostsCleaned = 0;

  if (ghostError) {
    console.error('[cleanup-stale-tasks] Ghost pending query error:', ghostError);
    return NextResponse.json({ error: 'ghost_pending_query_failed', message: ghostError.message }, { status: 500 });
  } else if (ghostTasks && ghostTasks.length > 0) {
    for (const task of ghostTasks) {
      // F1 fix: Since Phase 13, credits are debited at task creation time, not
      // inside execute-task. Ghost pending tasks CAN have debit rows. Must check
      // and refund before marking failed. Old comment 'No credits charged' was wrong.
      const ghostCredits = (task.credits_charged as number) ?? 0;
      const ghostOutput = ghostCredits > 0
        ? { error: 'Task was never started - execute-task was not called. Credits refunded.' }
        : { error: 'Task was never started - execute-task was not called. No credits charged.' };
      await supabaseAdmin
        .from('tasks')
        .update({ status: 'failed', output: ghostOutput })
        .eq('id', task.id);
      ghostsCleaned++;
      if (ghostCredits > 0) {
        try {
          const ownerId = await resolveCredits(supabaseAdmin as any, task.user_id, task.workspace_id);
          await refundCredits(supabaseAdmin as any, ownerId, ghostCredits, task.id, 'ghost-pending-refund');
        } catch (e) {
          console.error(`[cleanup-stale-tasks] Ghost pending refund failed for task ${task.id}:`, e);
        }
      } else if (task.task_type === 'light') {
        await refundLightTasks({ supabase: supabaseAdmin as any, workspaceId: task.workspace_id, amount: 1 });
      }
    }
    console.log(`[cleanup-stale-tasks] Ghost tasks cleaned: ${ghostsCleaned}`);
  }

  // ── Part 4: Stale queued tasks (Inngest tasks that never got picked up) ────────────
  // Tasks stuck in 'queued' for >30 min means Inngest never invoked the function
  // (signing key issue, event never delivered, etc). Refund credits and mark failed.
  const cutoff30mQueued = new Date(now - 30 * 60 * 1000).toISOString();
  const { data: staleQueued, error: queuedError } = await supabaseAdmin
    .from('tasks')
    .select('id, worker_slug, user_id, workspace_id, credits_charged, task_type')
    .eq('status', 'queued')
    .lt('created_at', cutoff30mQueued);

  let queuedCleaned = 0;

  if (queuedError) {
    console.error('[cleanup-stale-tasks] Stale queued query error:', queuedError);
    return NextResponse.json({ error: 'stale_queued_query_failed', message: queuedError.message }, { status: 500 });
  } else if (staleQueued && staleQueued.length > 0) {
    console.warn(`[cleanup-stale-tasks] ⚠️ ${staleQueued.length} stale queued task(s) found - Inngest may not have picked them up.`);
    for (const task of staleQueued) {
      await supabaseAdmin
        .from('tasks')
        .update({
          status: 'failed',
          error_message: 'Task was queued but never processed - please try again. Credits refunded.',
          output: { error: 'Task queued but not processed. Credits refunded.' },
        })
        .eq('id', task.id);
      queuedCleaned++;

      const creditsCharged = (task.credits_charged as number) ?? 0;
      if (creditsCharged > 0) {
        try {
          const ownerId = await resolveCredits(supabaseAdmin as any, task.user_id, task.workspace_id);
          await refundCredits(supabaseAdmin as any, ownerId, creditsCharged, task.id, 'stale-queued-refund');
        } catch (e) {
          console.error(`[cleanup-stale-tasks] Stale queued refund failed for task ${task.id}:`, e);
        }
      } else if (task.task_type === 'light') {
        await refundLightTasks({ supabase: supabaseAdmin as any, workspaceId: task.workspace_id, amount: 1 });
      }
    }
    console.log(`[cleanup-stale-tasks] Stale queued tasks cleaned: ${queuedCleaned}`);
  }

  // ── Part 5: Stranded Agent Mode runs ─────────────────────────────────
  // Any run stuck in 'running' for >2h should fail closed and refund debited,
  // undelivered chain steps. Heavy debits are idempotently refunded by ledger
  // reference_id (<runId>:<position>:<worker_id>); light reservations are returned
  // for non-completed worker_results that recorded light consumption.
  const { data: strandedRuns, error: strandedError } = await supabaseAdmin
    .from('agent_mode_runs')
    .select('id, user_id, chain_id, worker_results, agent_mode_chains(workspace_id)')
    .eq('status', 'running')
    .lt('started_at', cutoff2h);

  let strandedRunsFailed = 0;
  let strandedHeavyRefunded = 0;
  let strandedLightRefunded = 0;

  if (strandedError) {
    console.error('[cleanup-stale-tasks] Stranded run query error:', strandedError);
    return NextResponse.json({ error: 'stranded_runs_query_failed', message: strandedError.message }, { status: 500 });
  } else if (strandedRuns && strandedRuns.length > 0) {
    for (const run of strandedRuns) {
      const chain = Array.isArray(run.agent_mode_chains) ? run.agent_mode_chains[0] : run.agent_mode_chains;
      const workspaceId = chain?.workspace_id ?? null;
      const ownerId = await resolveCredits(supabaseAdmin as any, run.user_id, workspaceId);
      const runHeavyRefundedStart = strandedHeavyRefunded;
      const runLightRefundedStart = strandedLightRefunded;

      const workerResults = Array.isArray(run.worker_results) ? run.worker_results : [];
      const completedStepKeys = new Set<string>();
      for (const step of workerResults) {
        if (step?.status !== 'completed') continue;
        const position = step?.position ?? step?.step_position ?? step?.stepIndex ?? step?.index;
        const workerId = step?.worker_id ?? step?.workerId ?? step?.worker_slug ?? step?.slug;
        if (position != null) completedStepKeys.add(`pos:${position}`);
        if (workerId) completedStepKeys.add(`worker:${workerId}`);
        if (position != null && workerId) completedStepKeys.add(`pos-worker:${position}:${workerId}`);
      }

      const { data: stepDebits, error: debitQueryError } = await supabaseAdmin
        .from('credit_transactions')
        .select('reference_id, amount')
        .eq('reference_type', 'chain_step')
        .gt('amount', 0)
        .like('reference_id', `${run.id}:%`);

      if (debitQueryError) {
        console.warn(`[cleanup-stale-tasks] Stranded run debit query failed for ${run.id}:`, debitQueryError.message);
      }

      for (const debit of stepDebits ?? []) {
        const amount = Number(debit.amount) || 0;
        if (amount <= 0 || !debit.reference_id) continue;
        const [, position, workerId] = String(debit.reference_id).split(':');
        const delivered = completedStepKeys.has(`pos-worker:${position}:${workerId}`)
          || completedStepKeys.has(`pos:${position}`)
          || completedStepKeys.has(`worker:${workerId}`);
        if (delivered) continue;
        const result = await ledgerRefund({
          userId: ownerId,
          amount,
          referenceId: debit.reference_id,
          referenceType: 'chain_step',
          workspaceId,
          supabase: supabaseAdmin as any,
        });
        if (result.ok) strandedHeavyRefunded += amount;
      }

      for (const step of workerResults) {
        if (step?.status === 'completed') continue;
        const light = Number(step?.credits_consumed?.light ?? 0);
        if (light > 0) {
          strandedLightRefunded += await refundLightTasks({ supabase: supabaseAdmin as any, workspaceId, amount: light });
        }
      }

      await supabaseAdmin
        .from('agent_mode_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Run timed out after 2 hours. Undelivered credits were refunded.',
          total_heavy_refunded: strandedHeavyRefunded - runHeavyRefundedStart,
          total_light_refunded: strandedLightRefunded - runLightRefundedStart,
        })
        .eq('id', run.id);
      strandedRunsFailed++;
    }
  }

  console.log(`[cleanup-stale-tasks] stale=${cleaned} refunded=${refunded} swept=${swept} ghosts=${ghostsCleaned} staleQueued=${queuedCleaned} strandedRuns=${strandedRunsFailed} strandedHeavyRefunded=${strandedHeavyRefunded} strandedLightRefunded=${strandedLightRefunded}`);
  return NextResponse.json({ cleaned, refunded, swept, ghostsCleaned, staleQueued: queuedCleaned, strandedRunsFailed, strandedHeavyRefunded, strandedLightRefunded });
}
