import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { getMissingWorkerModeFields, type WorkerInChain } from '@/lib/agent-mode/types';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { getWorkerPromptConfig } from '@/lib/workers/configs';
import { applyDefaultWorkerMode } from '@/lib/workers/required-fields';
import { formatChainIncompatibleWorkerError, getChainIncompatibleWorkers } from '@/lib/agent-mode/chain-validation';

function createAdminClient() {
  return supabaseAdmin;
}

function normalizeWorkers(workers: WorkerInChain[]): WorkerInChain[] {
  return workers.map((worker, index) => ({
    worker_id: worker.worker_id,
    position: worker.position ?? index + 1,
    form_settings: applyDefaultWorkerMode(
      worker.worker_id,
      worker.form_settings ?? worker.config ?? {}
    ) as Record<string, string>,
  }));
}

async function getOperatorChain(userId: string, workspaceId: string, chainId: string) {
  const supabase = createAdminClient();

  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') return { error: 'operator_required', supabase, chain: null };

  const { data: chain } = await supabase
    .from('agent_mode_chains').select('*').eq('id', chainId).eq('workspace_id', workspaceId).single();
  if (!chain) return { error: 'not_found', supabase, chain: null };

  return { error: null, supabase, chain };
}

// GET /api/agent-mode/chains/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // R9: owner-only — role check before getOperatorChain
  const roleAuth = await requireWorkspaceRole(request, auth.workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  const { error, chain } = await getOperatorChain(auth.userId, auth.workspaceId, id);
  if (error === 'operator_required') return NextResponse.json({ error: 'Agent Mode requires Operator plan' }, { status: 403 });
  if (error === 'not_found' || !chain) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

  return NextResponse.json({ chain });
}

// PUT /api/agent-mode/chains/[id] — update chain
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // R9: owner-only
  const roleAuth = await requireWorkspaceRole(request, auth.workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  const { error, supabase, chain } = await getOperatorChain(auth.userId, auth.workspaceId, id);
  if (error === 'operator_required') return NextResponse.json({ error: 'Agent Mode requires Operator plan' }, { status: 403 });
  if (error === 'not_found' || !chain) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.schedule_days !== undefined) updates.schedule_days = body.schedule_days;
  if (body.status !== undefined) {
    if (!['active', 'paused', 'inactive'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (body.workers !== undefined) {
    const workers: WorkerInChain[] = normalizeWorkers(body.workers);
    if (workers.length < 2 || workers.length > 5) {
      return NextResponse.json({ error: 'Workflows must have 2–5 team members' }, { status: 400 });
    }
    for (const step of workers) {
      const registryWorker = getWorkerBySlug(step.worker_id);
      if (!registryWorker || !registryWorker.active) {
        return NextResponse.json({ error: `Invalid team member in workflow: "${step.worker_id}". Must be an active team member.` }, { status: 400 });
      }
      if (registryWorker.chainCompatible === false) {
        return NextResponse.json({ error: `Invalid team member in workflow: "${step.worker_id}". This team member cannot be used in Agent Mode chains.` }, { status: 400 });
      }
      if (!getWorkerPromptConfig(step.worker_id)) {
        return NextResponse.json({ error: `Invalid team member in workflow: "${step.worker_id}". This team member is not configured for workflow runs.` }, { status: 400 });
      }
    }
    const seenWorkers = new Set<string>();
    for (const step of workers) {
      if (seenWorkers.has(step.worker_id)) {
        const registryWorker = getWorkerBySlug(step.worker_id);
        const name = registryWorker?.personaName ?? registryWorker?.name ?? step.worker_id;
        return NextResponse.json({ error: `${name} is already in this workflow.` }, { status: 400 });
      }
      seenWorkers.add(step.worker_id);
    }
    const missingModes = getMissingWorkerModeFields(workers);
    if (missingModes.length > 0) {
      return NextResponse.json({ error: 'Choose a mode.', missing_modes: missingModes }, { status: 400 });
    }
    const incompatibleWorkers = getChainIncompatibleWorkers(workers);
    if (incompatibleWorkers.length > 0) {
      return NextResponse.json({ error: formatChainIncompatibleWorkerError(incompatibleWorkers) }, { status: 400 });
    }
    updates.workers = workers;
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('agent_mode_chains')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ chain: updated });
}

// DELETE /api/agent-mode/chains/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // R9: owner-only
  const roleAuth = await requireWorkspaceRole(request, auth.workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  const { error, supabase, chain } = await getOperatorChain(auth.userId, auth.workspaceId, id);
  if (error === 'operator_required') return NextResponse.json({ error: 'Agent Mode requires Operator plan' }, { status: 403 });
  if (error === 'not_found' || !chain) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

  await supabase.from('agent_mode_chains').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
