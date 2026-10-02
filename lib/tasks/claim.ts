type TaskClaimResult<TTask = Record<string, unknown>> =
  | { claimed: true; task: TTask }
  | { claimed: false; task: null; error?: unknown };

/**
 * Atomically claims one pending task for execution.
 *
 * The critical invariant is the WHERE status='pending' predicate on the UPDATE:
 * concurrent callers can all try to execute the same task, but Postgres will only
 * update the first one that still sees pending. Everyone else gets 0 rows back and
 * must bail before making provider/model calls.
 */
export async function claimPendingTaskForExecution<TTask = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  taskId: string,
): Promise<TaskClaimResult<TTask>> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: 'processing' })
    .eq('id', taskId)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error || !data) {
    return { claimed: false, task: null, error };
  }

  return { claimed: true, task: data as TTask };
}
