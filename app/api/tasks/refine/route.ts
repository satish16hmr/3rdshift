import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { validateRequiredFields } from '@/lib/workers/validate-input';
import { refundCredits } from '@/lib/credits/ledger';
import { inngest } from '@/lib/inngest/client';
import { refundLightTasks, reserveLightTask } from '@/lib/billing/light-tasks';
import { ensureTaskCreditsDebited } from '@/lib/tasks/credit-debit';

/**
 * POST /api/tasks/refine
 *
 * F1 fix (Phase 12): Previously hardcoded effectiveCreditCost = 0 for every
 * refinement, allowing unlimited free refinements of heavy workers (Shay, Gus,
 * Mack, Reed, Blair, etc.) while burning fal.ai/OpenAI at zero credit cost.
 *
 * Now uses identical billing/mode/plan derivation as /api/tasks/create.
 * Light workers remain free (0 credits). Heavy workers charge their normal cost.
 * Mode-credit workers use the canonical workerModeField scan (same as tasks/create).
 *
 * Request body:
 *   original_task_id  string   required — the task being refined
 *   refine_input      object   required — merged input with _refine_instruction
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;

  // 2. Parse body
  let body: { original_task_id?: string; refine_input?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { original_task_id, refine_input } = body;
  if (!original_task_id) return NextResponse.json({ error: 'original_task_id is required' }, { status: 400 });
  if (!refine_input || typeof refine_input !== 'object') {
    return NextResponse.json({ error: 'refine_input is required' }, { status: 400 });
  }

  // 3. Load original task — verify ownership or workspace membership
  const { data: originalTask } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, workspace_id, worker_slug, category')
    .eq('id', original_task_id)
    .maybeSingle();

  if (!originalTask) return NextResponse.json({ error: 'Original task not found' }, { status: 404 });

  // Access check: own task OR workspace member
  if (originalTask.user_id !== userId) {
    if (originalTask.workspace_id) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', originalTask.workspace_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!membership) return NextResponse.json({ error: 'Not authorized to refine this task' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Not authorized to refine this task' }, { status: 403 });
    }
  }

  // 4. Resolve worker from registry
  const worker = getWorkerBySlug(originalTask.worker_slug);
  if (!worker || !worker.active) {
    return NextResponse.json({ error: 'Worker not found' }, { status: 400 });
  }

  // 4b. Server-side required-field validation on refine_input
  // Refinements must also pass required-field validation — prevents burning credits
  // on heavy workers (Shay, Gus, Reed, Blair, Mack) with empty/garbage input.
  // The _refine_instruction field is added by the frontend and is not a form field,
  // so the validator only checks fields that are in the actual formSchema.
  const fieldValidation = validateRequiredFields(originalTask.worker_slug, refine_input as Record<string, unknown>);
  if (!fieldValidation.valid) {
    return NextResponse.json(
      { error: 'missing_required_fields', fields: fieldValidation.missing },
      { status: 400 }
    );
  }

  // 5. Derive effective credit cost — same logic as /api/tasks/create (F1 fix)
  // Previously hardcoded to 0 — heavy worker refinements now charge their normal credit cost.
  let effectiveCreditCost = worker.creditCost ?? 0;

  if (worker.modeCredits && worker.workerModeField) {
    const modeCreditsMap = worker.modeCredits;
    const canonicalMode = refine_input[worker.workerModeField] as string | undefined;
    // Fall back to original task's mode if not in refine_input
    const modeToUse = canonicalMode !== undefined ? canonicalMode : undefined;
    if (modeToUse !== undefined) {
      if (modeCreditsMap[modeToUse] === undefined) {
        return NextResponse.json(
          { error: `Invalid mode '${modeToUse}' for this worker.` },
          { status: 400 }
        );
      }
      effectiveCreditCost = modeCreditsMap[modeToUse];
    }
  } else if (worker.modeCredits && !worker.workerModeField) {
    // Hard error: every worker with modeCredits MUST declare workerModeField.
    // If this fires, a worker was added to the registry without workerModeField — fix the registry.
    console.error(`[tasks/refine] REGISTRY ERROR: worker '${worker.slug}' has modeCredits but no workerModeField. Refine blocked.`);
    return NextResponse.json(
      { error: 'Worker registry misconfiguration: workerModeField is required when modeCredits is set. Contact support.' },
      { status: 500 }
    );
  }

  const task_type: 'light' | 'heavy' = effectiveCreditCost > 0 ? 'heavy' : 'light';
  const worker_title_at_creation = worker.name ?? null;
  const workspace_id = originalTask.workspace_id || null;

  // 6. Plan/usage gate — use workspace billing authority (same as tasks/create)
  let billingPlan: string = 'none';
  let creditOwnerId = userId;
  if (workspace_id) {
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id, plan')
      .eq('id', workspace_id)
      .single();
    if (ws?.owner_id) {
      creditOwnerId = ws.owner_id;
      const { data: ownerProfile } = await supabaseAdmin
        .from('profiles')
        .select('plan')
        .eq('id', ws.owner_id)
        .single();
      billingPlan = ownerProfile?.plan || ws.plan || 'none';
    } else {
      billingPlan = ws?.plan || 'none';
    }
  } else {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    if (!profile) return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 });
    billingPlan = profile.plan;
  }

  let lightTaskReserved = false;
  if (effectiveCreditCost > 0) {
    if (billingPlan === 'starter' || billingPlan === 'none') {
      return NextResponse.json(
        { error: 'Heavy task refinements require Pro or Operator plan.' },
        { status: 403 }
      );
    }
  } else {
    const lightReservation = await reserveLightTask({
      supabase: supabaseAdmin,
      workspaceId: workspace_id,
      billingPlan,
    });
    if (!lightReservation.ok) {
      return NextResponse.json(
        { error: lightReservation.error, limit_reached: lightReservation.status === 402 },
        { status: lightReservation.status }
      );
    }
    lightTaskReserved = true;
  }

  // 8. Insert task FIRST — workspace_id inherited from original task
  // F2 fix (Phase 13): insert before debit so task.id can be used as referenceId.
  // Debit before insert used a temp referenceId that refundCredits could never find
  // → every refund minted credits from nothing.
  const { data: newTask, error: insertError } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: userId,
      workspace_id,
      worker_slug: originalTask.worker_slug,
      worker_title_at_creation,
      category: worker.category,
      input: refine_input,
      status: 'pending',
      task_type,
      credits_charged: effectiveCreditCost,
    })
    .select('id')
    .single();

  if (insertError || !newTask) {
    console.error('[tasks/refine] insert error:', insertError);
    if (lightTaskReserved) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId: workspace_id, amount: 1 });
    }
    return NextResponse.json({ error: 'Failed to create refinement task' }, { status: 500 });
  }

  // 9. Debit credits through the shared gate. It preflights the shared
  // available-credit balance and then calls the atomic debit_credits RPC.
  if (effectiveCreditCost > 0) {
    const debitResult = await ensureTaskCreditsDebited(supabaseAdmin, {
      creditOwnerId,
      amount: effectiveCreditCost,
      taskId: newTask.id,
      workspaceId: workspace_id,
    });

    if (!debitResult.ok) {
      // Debit failed — mark task failed, no dispatch/model call.
      await supabaseAdmin.from('tasks').update({
        status: 'failed',
        output: { error: debitResult.error },
      }).eq('id', newTask.id);
      return NextResponse.json({ error: debitResult.error }, { status: debitResult.status });
    }
  }

  // 10. F4 fix: dispatch to Inngest for durable execution
  if (!process.env.INNGEST_EVENT_KEY) {
    await supabaseAdmin.from('tasks').update({
      status: 'failed',
      output: { error: 'Task execution service unavailable. Please try again.' },
    }).eq('id', newTask.id);
    if (effectiveCreditCost > 0) {
      const refund = await refundCredits({
        userId: creditOwnerId,
        amount: effectiveCreditCost,
        referenceId: newTask.id,
        referenceType: 'task',
        workspaceId: workspace_id,
      });
      if (refund.ok || refund.errorCode === 'no_original_debit') {
        await supabaseAdmin.from('tasks').update({ refund_applied: true }).eq('id', newTask.id);
      }
    }
    if (lightTaskReserved) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId: workspace_id, amount: 1 });
    }
    return NextResponse.json(
      { error: 'Task execution service temporarily unavailable. Please try again.' },
      { status: 503 }
    );
  }

  try {
    await inngest.send({
      name: 'tasks/execute',
      // F6: taskId only — no JWT in event payload
      data: { taskId: newTask.id },
    });
  } catch (err) {
    console.error('[tasks/refine] Inngest dispatch failed:', err);
    await supabaseAdmin.from('tasks').update({
      status: 'failed',
      output: { error: 'Task could not be queued. Please try again.' },
    }).eq('id', newTask.id);
    if (effectiveCreditCost > 0) {
      const refund = await refundCredits({
        userId: creditOwnerId,
        amount: effectiveCreditCost,
        referenceId: newTask.id,
        referenceType: 'task',
        workspaceId: workspace_id,
      });
      if (refund.ok || refund.errorCode === 'no_original_debit') {
        await supabaseAdmin.from('tasks').update({ refund_applied: true }).eq('id', newTask.id);
      }
    }
    if (lightTaskReserved) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId: workspace_id, amount: 1 });
    }
    return NextResponse.json({ error: 'Failed to queue task. Please try again.' }, { status: 503 });
  }

  return NextResponse.json({ taskId: newTask.id, credits_charged: effectiveCreditCost });
}
