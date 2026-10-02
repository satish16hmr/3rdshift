// B2 fix: workflow execution is queued via Inngest, not synchronous.
// Run route returns 202 { run_id } immediately.
// Inngest picks up the event and runs executeChain in the background with no timeout ceiling.
// UI polls /api/agent-mode/runs/[run_id] for status.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { inngest } from '@/lib/inngest/client';
import { enforceResolutionGate } from '@/lib/billing/resolution-gate';
import { enforceBillingAccess } from '@/lib/billing/billing-access';
import { getMissingWorkerModeFields } from '@/lib/agent-mode/types';
import { formatChainIncompatibleWorkerError, getChainIncompatibleWorkers } from '@/lib/agent-mode/chain-validation';
import type { ExecuteChainParams } from '@/lib/agent-mode/executor';

function createAdminClient() {
  return supabaseAdmin;
}

// POST /api/agent-mode/chains/[id]/run — queue a chain run
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // Owner-only — members cannot trigger chains (burns workspace owner's credits)
  const roleAuth = await requireWorkspaceRole(request, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  const supabase = createAdminClient();

  // Operator check
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') {
    return NextResponse.json({ error: 'Agent Mode requires Operator plan' }, { status: 403 });
  }

  // Resolution gate — INV-1 + INV-2 (Phase 21)
  // Explicitly resolve the workspace owner_id as creditOwnerId.
  // supabaseAdmin used for both lookups — entitlement checks are authoritative
  // infrastructure and must not depend on the caller's RLS scope.
  // Fail closed if wsRow is null: workspaceId came from auth so the workspace
  // must exist; null here is a genuine error, not a fallback path.
  {
    const { data: wsRow } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (!wsRow?.owner_id) {
      return NextResponse.json(
        { error: 'workspace_resolution_check_failed' },
        { status: 500 }
      );
    }

    const creditOwnerId = wsRow.owner_id;
    const gate = await enforceResolutionGate(supabaseAdmin, creditOwnerId);
    if (gate.blocked) {
      return NextResponse.json(
        {
          error: 'workspace_resolution_required',
          target_plan: gate.target_plan,
          excess_count: gate.excess_count,
        },
        { status: 403 }
      );
    }

    // Phase 23 Step 2 — billing delinquency gate
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

  // Load chain
  const { data: chain } = await supabase
    .from('agent_mode_chains')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single();

  if (!chain) return NextResponse.json({ error: 'Chain not found' }, { status: 404 });

  const incompatibleWorkers = getChainIncompatibleWorkers(chain.workers ?? []);
  if (incompatibleWorkers.length > 0) {
    return NextResponse.json({ error: formatChainIncompatibleWorkerError(incompatibleWorkers) }, { status: 400 });
  }

  const missingModes = getMissingWorkerModeFields(chain.workers ?? []);
  if (missingModes.length > 0) {
    return NextResponse.json({ error: 'Choose a mode.', missing_modes: missingModes }, { status: 400 });
  }

  // Insert run record as queued — Inngest will set it to running when it picks up
  const { data: run, error: runError } = await supabase
    .from('agent_mode_runs')
    .insert({
      chain_id: chain.id,
      user_id: userId,
      trigger_type: 'manual',
      status: 'queued',
    })
    .select()
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: 'Failed to create run record' }, { status: 500 });
  }

  // Dispatch to Inngest — non-blocking
  if (!process.env.INNGEST_EVENT_KEY) {
    // Inngest not configured: fall back to synchronous execution (dev/staging without Inngest)
    console.warn('[chain-run] INNGEST_EVENT_KEY not set — falling back to synchronous execution');
    const { executeChain } = await import('@/lib/agent-mode/executor');
    
    (async () => {
      try {
        await supabase.from('agent_mode_runs').update({ status: 'running' }).eq('id', run.id);
        await executeChain({
          runId: run.id,
          chainId: chain.id,
          userId,
          workspaceId,
          workers: chain.workers,
          triggerType: 'manual',
          supabase: supabase as ExecuteChainParams['supabase'],
        });
      } catch (err) {
        console.error('[chain-run] Synchronous fallback failed:', err);
        await supabase.from('agent_mode_runs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        }).eq('id', run.id);
      }
    })();

    return NextResponse.json({ success: true, runId: run.id, queued: false });
  }

  try {
    await inngest.send({
      name: 'agent-mode/chain.run',
      // F6: IDs only in event payload — chain-executor loads workers fresh from DB
      data: {
        runId: run.id,
        chainId: chain.id,
        userId,
        triggerType: 'manual' as const,
      },
    });
  } catch (err) {
    console.error('[chain-run] Inngest dispatch failed:', err);
    // Mark run failed immediately — don't leave it stuck in queued
    await supabase.from('agent_mode_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
    return NextResponse.json({ error: 'Failed to queue chain run' }, { status: 500 });
  }

  // 202: accepted and queued. UI polls /api/agent-mode/runs/[run_id] for status.
  return NextResponse.json({ success: true, runId: run.id, queued: true }, { status: 202 });
}
