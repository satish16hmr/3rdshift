/**
 * lib/tasks/create-task.ts
 *
 * F5: Shared task creation module used by both /api/tasks/create and
 * /api/zapier/tasks/create. Ensures Zapier tasks go through the same
 * validation, billing, and dispatch pipeline as regular tasks.
 *
 * Handles:
 *   - Required field validation (validateRequiredFields)
 *   - Mode derivation and credit cost (workerModeField + modeCredits)
 *   - Plan gate (workspace billing authority)
 *   - Atomic credit debit via ledger RPC
 *   - Inngest dispatch for durable execution
 *   - Refund on dispatch failure
 */

import { createClient } from '@supabase/supabase-js';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { validateRequiredFields } from '@/lib/workers/validate-input';
import { refundCredits } from '@/lib/credits/ledger';
import { inngest } from '@/lib/inngest/client';
import { refundLightTasks, reserveLightTask } from '@/lib/billing/light-tasks';
import { ensureTaskCreditsDebited } from '@/lib/tasks/credit-debit';
import { deriveEffectiveCreditCost } from '@/lib/workers/credit-cost';
import { applyDefaultWorkerMode } from '@/lib/workers/required-fields';
import { enforceBillingAccess } from '@/lib/billing/billing-access';
import { enforceResolutionGate } from '@/lib/billing/resolution-gate';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface CreateTaskParams {
  userId: string;
  workspaceId: string | null;
  workerSlug: string;
  input: Record<string, unknown>;
  /** Skip required-field validation (Zapier may pass partial inputs intentionally) */
  skipFieldValidation?: boolean;
}

export interface CreateTaskResult {
  ok: true;
  taskId: string;
  creditsCharged: number;
}

export interface CreateTaskError {
  ok: false;
  error: string;
  status: number;
}

export async function createTask(params: CreateTaskParams): Promise<CreateTaskResult | CreateTaskError> {
  const { userId, workspaceId, workerSlug, input, skipFieldValidation = false } = params;
  const supabaseAdmin = getAdmin();

  // Phase 23 Step 1 — INV-1: workspace_id required on all tasks (including Zapier path).
  if (!workspaceId) {
    return { ok: false, error: 'workspace_required', status: 400 };
  }

  // 1. Resolve worker
  const worker = getWorkerBySlug(workerSlug);
  if (!worker || !worker.active) {
    return { ok: false, error: 'Worker not found', status: 400 };
  }

  const effectiveInput = applyDefaultWorkerMode(workerSlug, input);

  // 2. Required field validation (unless caller opts out)
  if (!skipFieldValidation) {
    const fieldValidation = validateRequiredFields(workerSlug, effectiveInput);
    if (!fieldValidation.valid) {
      return {
        ok: false,
        error: 'missing_required_fields',
        status: 400,
      };
    }
  }

  // 3. Derive credit cost via canonical workerModeField. Match /api/tasks/create:
  // do not trust arbitrary input values or Zapier payload aliases for billing mode.
  let effectiveCreditCost: number;
  try {
    effectiveCreditCost = deriveEffectiveCreditCost(worker, effectiveInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to derive worker credit cost.';
    console.error(`[createTask] cost derivation failed for '${workerSlug}':`, message);
    return { ok: false, error: message, status: message.includes('workerModeField is required') ? 500 : 400 };
  }

  const taskType: 'light' | 'heavy' = effectiveCreditCost > 0 ? 'heavy' : 'light';

  // 4. Workspace membership validation
  if (workspaceId) {
    const { data: membership } = await supabaseAdmin
      .from('workspace_members').select('id')
      .eq('workspace_id', workspaceId).eq('user_id', userId).single();
    if (!membership) return { ok: false, error: 'Not a member of that workspace', status: 403 };
  }

  let billingPlan = 'none';
  let creditOwnerId = userId;
  if (workspaceId) {
    const { data: ws } = await supabaseAdmin
      .from('workspaces').select('owner_id, plan').eq('id', workspaceId).single();
    if (ws?.owner_id) {
      creditOwnerId = ws.owner_id;
      const { data: ownerProfile } = await supabaseAdmin
        .from('profiles').select('plan').eq('id', ws.owner_id).single();
      billingPlan = ownerProfile?.plan || ws.plan || 'none';
    } else {
      billingPlan = ws?.plan || 'none';
    }
  } else {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('plan').eq('id', userId).single();
    if (!profile) return { ok: false, error: 'Profile lookup failed', status: 500 };
    billingPlan = profile.plan;
  }

  const PLAN_RANK: Record<string, number> = { none: 0, starter: 1, pro: 2, operator: 3 };
  const planRank = PLAN_RANK[billingPlan] ?? 0;
  const workerMinRank = PLAN_RANK[worker.minPlan] ?? 1;
  if (planRank < workerMinRank) {
    return { ok: false, error: `${worker.name ?? workerSlug} requires ${worker.minPlan} plan or higher. Your plan: ${billingPlan}.`, status: 403 };
  }
  if (billingPlan === 'none') {
    return { ok: false, error: 'subscription_required', status: 403 };
  }

  const billingAccess = await enforceBillingAccess(supabaseAdmin, creditOwnerId);
  if (billingAccess.blocked) {
    return { ok: false, error: billingAccess.code ?? 'billing_access_blocked', status: 402 };
  }

  const resolutionGate = await enforceResolutionGate(supabaseAdmin, creditOwnerId);
  if (resolutionGate.blocked) {
    return { ok: false, error: 'workspace_resolution_required', status: 403 };
  }

  // 5. Plan/usage gate
  let lightTaskReserved = false;
  if (effectiveCreditCost > 0) {
    if (billingPlan === 'starter' || billingPlan === 'none') {
      return { ok: false, error: 'Heavy tasks require Pro or Operator plan.', status: 403 };
    }
  } else {
    const lightReservation = await reserveLightTask({ supabase: supabaseAdmin, workspaceId, billingPlan });
    if (!lightReservation.ok) {
      return { ok: false, error: lightReservation.error, status: lightReservation.status };
    }
    lightTaskReserved = true;
  }

  // 6. Insert task
  const { data, error: insertError } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: userId,
      workspace_id: workspaceId || null,
      worker_slug: workerSlug,
      worker_title_at_creation: worker.name ?? null,
      category: worker.category,
      input: effectiveInput,
      status: 'pending',
      task_type: taskType,
      credits_charged: effectiveCreditCost,
    })
    .select('id')
    .single();

  if (insertError || !data) {
    console.error('[createTask] insert error:', insertError);
    if (lightTaskReserved) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId, amount: 1 });
    }
    return { ok: false, error: 'Failed to create task', status: 500 };
  }

  // 7. Debit credits through the shared gate. It preflights the shared
  // available-credit balance and then calls the atomic debit_credits RPC.
  if (effectiveCreditCost > 0) {
    const debitResult = await ensureTaskCreditsDebited(supabaseAdmin, {
      creditOwnerId,
      amount: effectiveCreditCost,
      taskId: data.id,
      workspaceId: workspaceId || null,
    });
    if (!debitResult.ok) {
      await supabaseAdmin.from('tasks').update({
        status: 'failed',
        output: { error: debitResult.error },
      }).eq('id', data.id);
      return { ok: false, error: debitResult.error, status: debitResult.status };
    }
  }

  // 8. Dispatch to Inngest
  if (!process.env.INNGEST_EVENT_KEY) {
    await supabaseAdmin.from('tasks').update({
      status: 'failed',
      output: { error: 'Task execution service unavailable. Please try again.' },
    }).eq('id', data.id);
    if (effectiveCreditCost > 0) {
      const refund = await refundCredits({ userId: creditOwnerId, amount: effectiveCreditCost, referenceId: data.id, referenceType: 'task', workspaceId: workspaceId || null });
      if (refund.ok || refund.errorCode === 'no_original_debit') {
        await supabaseAdmin.from('tasks').update({ refund_applied: true }).eq('id', data.id);
      }
    }
    if (lightTaskReserved) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId, amount: 1 });
    }
    return { ok: false, error: 'Task execution service temporarily unavailable. Please try again.', status: 503 };
  }

  try {
    // F6: pass only taskId — no user JWT in event payload
    await inngest.send({ name: 'tasks/execute', data: { taskId: data.id } });
  } catch (err) {
    console.error('[createTask] Inngest dispatch failed:', err);
    await supabaseAdmin.from('tasks').update({
      status: 'failed',
      output: { error: 'Task could not be queued. Please try again.' },
    }).eq('id', data.id);
    if (effectiveCreditCost > 0) {
      const refund = await refundCredits({ userId: creditOwnerId, amount: effectiveCreditCost, referenceId: data.id, referenceType: 'task', workspaceId: workspaceId || null });
      if (refund.ok || refund.errorCode === 'no_original_debit') {
        await supabaseAdmin.from('tasks').update({ refund_applied: true }).eq('id', data.id);
      }
    }
    if (lightTaskReserved) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId, amount: 1 });
    }
    return { ok: false, error: 'Failed to queue task. Please try again.', status: 503 };
  }

  return { ok: true, taskId: data.id, creditsCharged: effectiveCreditCost };
}
