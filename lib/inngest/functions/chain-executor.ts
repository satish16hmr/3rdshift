/**
 * Inngest function: Agent Mode Chain Executor
 *
 * F6 fix (Phase 15): Event payload now carries only IDs (runId, chainId, userId,
 * triggerType) — no workers array. Workers are loaded fresh from DB at execution
 * time, preventing stale/modified payloads from affecting execution.
 *
 * Flow:
 *   POST /api/agent-mode/chains/[id]/run
 *     → inserts agent_mode_runs row (status=queued)
 *     → dispatches inngest event "agent-mode/chain.run" with { runId, chainId, userId, triggerType }
 *     → returns 202 { run_id }
 *   Inngest picks it up here:
 *     → verifies run is still in 'queued' state (idempotent)
 *     → loads chain + workers fresh from DB
 *     → executeChain()
 *
 * Idempotent: if run is already running/completed/failed, skip.
 */

import { inngest } from '../client';
import { createClient } from '@supabase/supabase-js';
import { executeChain } from '@/lib/agent-mode/executor';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const chainExecutorFunction = inngest.createFunction(
  {
    id: 'agent-mode-chain-executor',
    name: 'Agent Mode Chain Executor',
    retries: 0,
    triggers: [{ event: 'agent-mode/chain.run' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    // F6: payload carries IDs only — no workers array
    const { runId, chainId, userId, triggerType } = event.data as {
      runId: string;
      chainId: string;
      userId: string;
      triggerType: 'manual' | 'scheduled';
    };

    const supabase = getSupabase();

    // Verify run is still in queued state (idempotency guard)
    const { data: run, error: runError } = await supabase
      .from('agent_mode_runs')
      .select('id, status, chain_id')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      console.error(`[chain-executor] Run ${runId} not found in DB`);
      return;
    }

    if (run.status !== 'queued') {
      console.log(`[chain-executor] Run ${runId} already in status '${run.status}' — skipping (idempotent)`);
      return;
    }

    // Verify chainId matches (replay safety)
    if (run.chain_id !== chainId) {
      console.error(`[chain-executor] Run ${runId} chain_id mismatch: event=${chainId} db=${run.chain_id}`);
      return;
    }

    // Load workers fresh from DB — never trust event payload workers array
    const { data: chain, error: chainError } = await supabase
      .from('agent_mode_chains')
      .select('id, workspace_id, workers')
      .eq('id', chainId)
      .single();

    if (chainError || !chain) {
      console.error(`[chain-executor] Chain ${chainId} not found`);
      await supabase.from('agent_mode_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
      return;
    }

    const workers = chain.workers as Array<{
      position: number;
      worker_id: string;
      form_settings: Record<string, string>;
      config?: Record<string, string>;
    }>;

    // Mark run as running
    await supabase
      .from('agent_mode_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', runId);

    try {
      await step.run('execute-chain', async () => {
        await executeChain({
          runId,
          chainId,
          userId,
          workspaceId: chain.workspace_id,
          workers,
          triggerType,
          supabase: supabase as any,
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[chain-executor] executeChain threw:', err);
      await supabase
        .from('agent_mode_runs')
        .update({
          status: 'failed',
          worker_results: [{
            worker_id: 'chain-executor',
            position: 0,
            status: 'failed',
            error: msg || 'Chain executor crashed',
            credits_consumed: { light: 0, heavy: 0 },
            credits_refunded: { light: 0, heavy: 0 },
            completed_at: new Date().toISOString(),
          }],
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
    }
  }
);
