import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { getMissingWorkerModeFields, type WorkerInChain } from '@/lib/agent-mode/types';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { getWorkerPromptConfig } from '@/lib/workers/configs';
import { applyDefaultWorkerMode } from '@/lib/workers/required-fields';
import { logDerivationRejection } from '@/lib/derivation-log';

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

// GET /api/agent-mode/chains — list user's chains
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R8: owner-only — role check before plan check
  const roleAuth = await requireWorkspaceRole(request, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  const supabase = createAdminClient();

  // Operator plan check — workspace owner's plan
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') {
    return NextResponse.json({ error: 'Agent Mode requires Operator plan' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data: chains, error } = await supabase
    .from('agent_mode_chains')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  return NextResponse.json({ chains: chains ?? [] });
}

// POST /api/agent-mode/chains — create new chain
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R8: owner-only — role check before plan check
  const roleAuth = await requireWorkspaceRole(request, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  const supabase = createAdminClient();

  // Operator plan check — workspace owner's plan
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') {
    return NextResponse.json({ error: 'Agent Mode requires Operator plan' }, { status: 403 });
  }

  const body = await request.json();
  const { name, workers, schedule_days, preset_id } = body as {
    name: string;
    workers: WorkerInChain[];
    schedule_days: string[];
    preset_id?: string;
  };

  const normalizedWorkers = normalizeWorkers(workers ?? []);

  // Validate chain length
  if (normalizedWorkers.length < 2 || normalizedWorkers.length > 5) {
    return NextResponse.json({ error: 'Workflows must have 2–5 team members' }, { status: 400 });
  }

  // Phase 4 — R3: validate each step's worker_id against registry
  for (const step of normalizedWorkers) {
    const registryWorker = getWorkerBySlug(step.worker_id);
    if (!registryWorker || !registryWorker.active) {
      await logDerivationRejection({
        userId,
        workspaceId,
        route: '/api/agent-mode/chains',
        rejectedFields: [`workers[].worker_id:${step.worker_id}`],
      });
      return NextResponse.json({
        error: `Invalid team member in workflow: "${step.worker_id}". Must be an active team member.`
      }, { status: 400 });
    }

    if (registryWorker.chainCompatible === false) {
      await logDerivationRejection({
        userId,
        workspaceId,
        route: '/api/agent-mode/chains',
        rejectedFields: [`workers[].worker_id:${step.worker_id}:chain_incompatible`],
      });
      return NextResponse.json({
        error: `Invalid team member in workflow: "${step.worker_id}". This team member cannot be used in Agent Mode chains.`
      }, { status: 400 });
    }

    if (!getWorkerPromptConfig(step.worker_id)) {
      await logDerivationRejection({
        userId,
        workspaceId,
        route: '/api/agent-mode/chains',
        rejectedFields: [`workers[].worker_id:${step.worker_id}:missing_prompt_config`],
      });
      return NextResponse.json({
        error: `Invalid team member in workflow: "${step.worker_id}". This team member is not configured for workflow runs.`
      }, { status: 400 });
    }
  }

  const missingModes = getMissingWorkerModeFields(normalizedWorkers);
  if (missingModes.length > 0) {
    return NextResponse.json({ error: 'Choose a mode.', missing_modes: missingModes }, { status: 400 });
  }

  // Validate no duplicates in workflow
  const seenWorkers = new Set<string>();
  for (const step of normalizedWorkers) {
    if (seenWorkers.has(step.worker_id)) {
      const registryWorker = getWorkerBySlug(step.worker_id);
      const name = registryWorker?.personaName ?? registryWorker?.name ?? step.worker_id;
      return NextResponse.json({
        error: `${name} is already in this workflow.`
      }, { status: 400 });
    }
    seenWorkers.add(step.worker_id);
  }

  // Check active chain limit (10 max)
  const { count: activeCount } = await supabase
    .from('agent_mode_chains')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'paused']);

  if ((activeCount ?? 0) >= 10) {
    return NextResponse.json({ error: '10/10 workflow slots used. Delete or deactivate a workflow first.' }, { status: 400 });
  }

  const { data: chain, error } = await supabase
    .from('agent_mode_chains')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      name: name || 'Untitled Workflow',
      workers: normalizedWorkers,
      schedule_days: schedule_days ?? [],
      status: 'inactive',
      preset_id: preset_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  return NextResponse.json({ chain });
}
