/**
 * Inngest function: Task Executor
 *
 * F6 fix (Phase 15): Event payload now carries only taskId — no user JWT.
 * User JWT in event payload expires and causes failures for queued tasks.
 *
 * Flow:
 *   POST /api/tasks/create or /api/tasks/refine
 *     → inserts task row (status=pending)
 *     → dispatches inngest event "tasks/execute" with { taskId } only
 *     → returns { taskId } immediately
 *   Inngest picks it up here:
 *     → loads task from DB to verify it's still pending
 *     → calls /api/execute-task with x-internal-secret (service-level auth)
 *     → execute-task handles all auth/ownership from task record itself
 *
 * Idempotent: if task is already completed/failed when Inngest fires (e.g. retry),
 * we skip execution.
 */

import { inngest } from '../client';
import { createClient } from '@supabase/supabase-js';
import { claimPendingTaskForExecution } from '@/lib/tasks/claim';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const taskExecutorFunction = inngest.createFunction(
  {
    id: 'task-executor',
    name: 'Task Executor',
    retries: 1,
    triggers: [{ event: 'tasks/execute' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    // F6: payload carries taskId only — no JWT
    const { taskId } = event.data as { taskId: string };

    const supabase = getSupabase();

    await step.run('execute-task', async () => {
      // Atomically claim the task before calling execute-task. The UPDATE includes
      // status='pending', so Inngest retries/duplicates and direct/cron callers
      // cannot all execute the same row.
      const claim = await claimPendingTaskForExecution(supabase, taskId);

      if (!claim.claimed) {
        console.log(`[task-executor] Task ${taskId} was already claimed or is not pending — skipping (idempotent)`);
        return;
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';

      // F6: use x-internal-secret instead of user JWT
      // execute-task loads auth context from the task record itself for internal calls
      const res = await fetch(`${siteUrl}/api/execute-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
        },
        body: JSON.stringify({ taskId, alreadyClaimed: true }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[task-executor] execute-task failed for ${taskId}: ${res.status} ${body.slice(0, 200)}`);
        await supabase.from('tasks').update({
          status: 'failed',
          output: { error: `Task execution failed (${res.status}). Your credits have been refunded if applicable.` },
        }).eq('id', taskId).eq('status', 'processing');
        throw new Error(`execute-task returned ${res.status}`);
      }
    });
  }
);
