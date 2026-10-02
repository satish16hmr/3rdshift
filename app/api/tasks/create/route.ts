import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { validateRequiredFields } from '@/lib/workers/validate-input';
import { inngest } from '@/lib/inngest/client';
import { refundCredits } from '@/lib/credits/ledger';
import { enforceResolutionGate } from '@/lib/billing/resolution-gate';
import { ensureTaskCreditsDebited } from '@/lib/tasks/credit-debit';
import { enforceBillingAccess } from '@/lib/billing/billing-access';
import { refundLightTasks, reserveLightTask } from '@/lib/billing/light-tasks';
import { deriveEffectiveCreditCost } from '@/lib/workers/credit-cost';
import { applyDefaultWorkerMode } from '@/lib/workers/required-fields';

/**
 * POST /api/tasks/create
 *
 * Server-side task creation. Derives ALL billing and display fields from the
 * authoritative worker registry — never trusts client-supplied values.
 *
 * Request body:
 *   worker_slug  string                required
 *   input        Record<string, any>   required  — form field values
 *   workspace_id string | null         optional  — workspace-scoped task
 *
 * Fields NOT accepted from client (server-derived):
 *   task_type              — derived from registry + canonical input mode
 *   category               — derived from registry
 *   worker_title_at_creation — snapshot from registry
 *   credits_charged        — derived from registry + canonical input mode
 *
 * NI-C02 fix: modeId param dropped. Mode is derived exclusively from task.input
 * using the same canonical registry scan execute-task uses — prevents modeId/input
 * divergence that allowed undercharging.
 *
 * O-M03 fix: plan gate uses workspace billing authority when workspace_id present.
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate via JWT
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

  // 2. Parse body — modeId intentionally NOT accepted
  let body: {
    worker_slug?: string;
    input?: Record<string, unknown>;
    workspace_id?: string | null;
    retry_task_id?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { worker_slug, input, workspace_id, retry_task_id } = body;

  // Phase 23 Step 1 — INV-1: workspace_id required on all tasks.
  // Personal/no-workspace task path removed. Every task must be account-scoped
  // via a workspace so the light counter and credit owner are always tracked.
  if (!workspace_id || typeof workspace_id !== 'string') {
    return NextResponse.json(
      {
        error: 'workspace_required',
        message: 'Tasks must be created inside a workspace.',
      },
      { status: 400 }
    );
  }

  if (!worker_slug || typeof worker_slug !== 'string') {
    return NextResponse.json({ error: 'worker_slug is required' }, { status: 400 });
  }
  if (!input || typeof input !== 'object') {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }

  // 3. Resolve worker from registry
  const worker = getWorkerBySlug(worker_slug);
  if (!worker || !worker.active) {
    return NextResponse.json({ error: 'Worker not found' }, { status: 400 });
  }

  // 3b. Quick plan rank pre-check (before field validation, before workspace lookup).
  // Reads caller's own profile plan first — gives clean 403 before asking user to fix fields.
  // Full workspace-authoritative plan check happens later in step 5.
  const PLAN_RANK: Record<string, number> = { none: 0, starter: 1, pro: 2, operator: 3 };
  {
    let quickPlan = 'none';
    const { data: quickProfile } = await supabaseAdmin
      .from('profiles').select('plan').eq('id', userId).single();
    quickPlan = quickProfile?.plan ?? 'none';

    const quickPlanRank = PLAN_RANK[quickPlan] ?? 0;
    const workerMinRank = PLAN_RANK[worker.minPlan] ?? 1;
    if (quickPlanRank < workerMinRank) {
      return NextResponse.json({
        error: 'plan_insufficient',
        message: `${worker.name ?? worker_slug} requires ${worker.minPlan} plan or higher. Your plan: ${quickPlan}.`,
        user_plan: quickPlan,
        required_plan: worker.minPlan,
      }, { status: 403 });
    }
    if (quickPlan === 'none') {
      return NextResponse.json({
        error: 'subscription_required',
        message: 'Your subscription has been cancelled. Reactivate to continue using workers.',
      }, { status: 403 });
    }
  }

  const effectiveInput = applyDefaultWorkerMode(worker_slug, input as Record<string, unknown>);

  // 3c. Server-side required-field validation
  // Validates all required fields that are currently visible (respects showWhen conditionals).
  // Prevents empty-form AI calls that burn credits and return garbage output.
  const fieldValidation = validateRequiredFields(worker_slug, effectiveInput);
  if (!fieldValidation.valid) {
    return NextResponse.json(
      { error: 'missing_required_fields', fields: fieldValidation.missing },
      { status: 400 }
    );
  }

  // 4. Derive effective credit cost using canonical workerModeField (Item 2 / P9-C01 fix)
  // Use worker.workerModeField to find the exact mode value — never scan all input values.
  // Scanning all values allowed poisoning: { "fake": "mini_course", "course_mode": "premium" }
  // would charge mini_course while execution uses course_mode=premium.
  let effectiveCreditCost: number;
  try {
    effectiveCreditCost = deriveEffectiveCreditCost(worker, effectiveInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to derive worker credit cost.';
    if (message.includes('workerModeField is required')) {
      console.error(`[tasks/create] REGISTRY ERROR: worker '${worker_slug}' has modeCredits but no workerModeField. Task creation blocked.`);
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Free retry verification: if retrying an incomplete task (output_status === 'potentially_truncated'), do not charge credits
  if (retry_task_id && typeof retry_task_id === 'string') {
    const { data: origTask } = await supabaseAdmin
      .from('tasks')
      .select('id, user_id, workspace_id, output_status')
      .eq('id', retry_task_id)
      .maybeSingle();

    if (origTask && origTask.output_status === 'potentially_truncated') {
      if (origTask.workspace_id === workspace_id || origTask.user_id === userId) {
        effectiveCreditCost = 0;
      }
    }
  }

  const task_type: 'light' | 'heavy' = effectiveCreditCost > 0 ? 'heavy' : 'light';
  const category = worker.category;
  const worker_title_at_creation = worker.name ?? null;

  // 5. Resolve billing plan + credit owner — runs for ALL tasks (NS-CRIT-1 fix)
  // Consolidates workspace lookup: one query covers plan gate, credit owner, and light limit.
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
    // workspace_id is now required (Phase 23 Step 1) — this branch is unreachable.
    // Kept as a defensive fallback; the guard above guarantees workspace_id is present.
    return NextResponse.json({ error: 'workspace_required', message: 'Tasks must be created inside a workspace.' }, { status: 400 });
  }

  // 5a. Plan rank enforcement — ALL tasks (not just heavy).
  // Cancelled accounts (none=0) are below every worker's minPlan (starter=1+).
  // Note: PLAN_RANK declared in step 3b (quick pre-check above).
  const planRank = PLAN_RANK[billingPlan] ?? 0;
  const workerMinPlanRank = PLAN_RANK[worker.minPlan] ?? 1;

  if (planRank < workerMinPlanRank) {
    return NextResponse.json({
      error: 'plan_insufficient',
      message: `${worker.name ?? worker_slug} requires ${worker.minPlan} plan or higher. Your plan: ${billingPlan}.`,
      user_plan: billingPlan,
      required_plan: worker.minPlan,
    }, { status: 403 });
  }

  // 5b. Cancelled account block (defensive belt-and-suspenders after rank check)
  if (billingPlan === 'none') {
    return NextResponse.json({
      error: 'subscription_required',
      message: 'Your subscription has been cancelled. Reactivate to continue using workers.',
    }, { status: 403 });
  }

  // 5c. Heavy task pro/operator gate (existing — starter can't run heavy workers)
  if (effectiveCreditCost > 0) {
    if (billingPlan === 'starter') {
      return NextResponse.json(
        { error: 'Heavy tasks require Pro or Operator plan. Upgrade to access this worker.' },
        { status: 403 }
      );
    }
  }

  // 6. Workspace membership validation
  if (workspace_id) {
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of that workspace' }, { status: 403 });
    }
  }

  // 6a-billing. Phase 23 Step 2 — Billing delinquency gate (INV-2)
  // Check against creditOwnerId (workspace owner) — same pattern as resolution gate.
  {
    const billingAccess = await enforceBillingAccess(supabaseAdmin, creditOwnerId);
    if (billingAccess.blocked) {
      return NextResponse.json(
        {
          error: billingAccess.code,
          message: billingAccess.code === 'billing_past_due'
            ? 'Your payment is past due. Please update your billing information to continue.'
            : 'No active subscription.',
        },
        { status: 402 }
      );
    }
  }

  // 6b. Resolution gate — INV-1 + INV-2 (Phase 21)
  // Gate is checked against creditOwnerId, not userId.
  // For workspace-scoped tasks, creditOwnerId is the workspace owner (resolved in step 5).
  // This enforces the owner's resolution state even when a member submits the task.
  {
    const gate = await enforceResolutionGate(supabaseAdmin, creditOwnerId);
    if (gate.blocked) {
      return NextResponse.json(
        {
          error: 'workspace_resolution_required',
          message: 'Your plan changed — you’re over your workspace limit. Pick which to keep or upgrade.',
          target_plan: gate.target_plan,
          excess_count: gate.excess_count,
        },
        { status: 403 }
      );
    }
  }

  let lightTaskReserved = false;

  // 6c. Light task limit enforcement
  if (task_type === 'light') {
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

  // 7. INSERT — all billing fields server-derived, never trusted from client
  // F2 fix (Phase 13): insert task FIRST, then debit using task.id as referenceId.
  // This ensures refundCredits can always find the matching debit by referenceId.
  // Previously: refund paths existed before any debit was recorded → minted credits.
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: userId,
      workspace_id: workspace_id || null,
      worker_slug,
      worker_title_at_creation,   // server-derived from registry
      category,                   // server-derived from registry
      input: effectiveInput,
      status: 'pending',
      task_type,                  // server-derived from registry + canonical input mode
      credits_charged: effectiveCreditCost, // server-derived — persisted at creation for refund safety
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[tasks/create] insert error:', error);
    if (lightTaskReserved) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId: workspace_id, amount: 1 });
    }
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }

  // F2 fix: debit AFTER insert, using task.id as referenceId so refunds always match
  // creditOwnerId already resolved in step 5 (workspace owner or self)
  // 7. Debit credits through the shared gate.
  // Preflights available credits before any model/dispatch spend, then calls the
  // atomic debit_credits RPC with this task id as the idempotency reference.
  if (effectiveCreditCost > 0) {
    const debitResult = await ensureTaskCreditsDebited(supabaseAdmin, {
      creditOwnerId,
      amount: effectiveCreditCost,
      taskId: data.id,
      workspaceId: workspace_id || null,
    });
    if (!debitResult.ok) {
      // Debit failed — mark task failed, no dispatch/model call.
      await supabaseAdmin.from('tasks').update({
        status: 'failed',
        output: { error: debitResult.error },
      }).eq('id', data.id);
      return NextResponse.json({ error: debitResult.error }, { status: debitResult.status });
    }
  }

  // Dispatch strategy driven by registry executionMode flag:
  // 'direct'  — fire-and-forget fetch to execute-task, no queue delay, starts immediately
  // 'inngest' — queued via Inngest for durable/long-running/external-API workers (default)
  // worker is already resolved above via getWorkerBySlug

  const executionMode = worker?.executionMode ?? 'inngest';

  if (executionMode === 'inngest') {
    // Inngest path — durable queue for long-running, external API, and multi-step workers
    if (!process.env.INNGEST_EVENT_KEY) {
      console.error('[tasks/create] INNGEST_EVENT_KEY not configured — cannot dispatch Charlie task');
      await supabaseAdmin.from('tasks').update({
        status: 'failed',
        output: { error: 'Task execution service unavailable. Please try again.' },
      }).eq('id', data.id);
      if (effectiveCreditCost > 0) {
        const refund = await refundCredits({
          userId: creditOwnerId,
          amount: effectiveCreditCost,
          referenceId: data.id,
          referenceType: 'task',
          workspaceId: workspace_id || null,
        });
        if (refund.ok || refund.errorCode === 'no_original_debit') {
          await supabaseAdmin.from('tasks').update({ refund_applied: true }).eq('id', data.id);
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
        data: { taskId: data.id },
      });
    } catch (err) {
      console.error('[tasks/create] Inngest dispatch failed:', err);
      await supabaseAdmin.from('tasks').update({
        status: 'failed',
        output: { error: 'Task could not be queued. Please try again.' },
      }).eq('id', data.id);
      if (effectiveCreditCost > 0) {
        const refund = await refundCredits({
          userId: creditOwnerId,
          amount: effectiveCreditCost,
          referenceId: data.id,
          referenceType: 'task',
          workspaceId: workspace_id || null,
        });
        if (refund.ok || refund.errorCode === 'no_original_debit') {
          await supabaseAdmin.from('tasks').update({ refund_applied: true }).eq('id', data.id);
        }
      }
      if (lightTaskReserved) {
        await refundLightTasks({ supabase: supabaseAdmin, workspaceId: workspace_id, amount: 1 });
      }
      return NextResponse.json({ error: 'Failed to queue task. Please try again.' }, { status: 503 });
    }
  } else {
    // All other workers — direct dispatch, fire-and-forget
    // No await: response returns immediately, execute-task runs in background
    // Use the current request origin so Vercel preview deployments dispatch back into the same preview build.
    // Falling back to NEXT_PUBLIC_SITE_URL here sends preview tasks to production and masks branch changes.
    const siteUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';
    fetch(`${siteUrl}/api/execute-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ taskId: data.id }),
    }).catch((err) => {
      console.error('[tasks/create] Direct execute-task dispatch failed:', err);
    });
  }

  return NextResponse.json({ taskId: data.id, task_id: data.id, credits_charged: effectiveCreditCost });
}
