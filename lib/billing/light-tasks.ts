import { getPlanLightTaskLimit } from './catalog';

// Supabase's rpc() return type varies across generated client flavors. This
// helper only needs the runtime RPC surface, so keep the client structural.
type RpcClient = any;

export type LightTaskResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function reserveLightTask(params: {
  supabase: RpcClient;
  workspaceId: string | null;
  billingPlan: string;
}): Promise<LightTaskResult> {
  const { supabase, workspaceId, billingPlan } = params;

  if (!workspaceId) {
    return { ok: false, status: 400, error: 'workspace_required' };
  }

  const lightLimit = getPlanLightTaskLimit(billingPlan);
  if (lightLimit <= 0) {
    return {
      ok: false,
      status: 403,
      error: 'Your plan does not include light tasks. Upgrade to access workers.',
    };
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'increment_light_task_count',
    { p_workspace_id: workspaceId, p_limit: lightLimit }
  );

  if (rpcError) {
    console.error('[light-tasks] increment_light_task_count RPC error:', rpcError.message);
    return { ok: false, status: 409, error: 'Light task reservation failed. Please try again.' };
  }

  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (result?.hit_limit) {
    return {
      ok: false,
      status: 402,
      error: `Monthly light task limit reached (${lightLimit} tasks/${billingPlan} plan). Resets at your next billing period.`,
    };
  }

  if (!result?.ok) {
    return { ok: false, status: 409, error: 'Light task reservation failed. Please try again.' };
  }

  return { ok: true };
}

export async function refundLightTasks(params: {
  supabase: RpcClient;
  workspaceId: string | null;
  amount?: number;
}): Promise<number> {
  const { supabase, workspaceId, amount = 1 } = params;
  if (!workspaceId || amount <= 0) return 0;

  const { data, error } = await supabase.rpc('decrement_light_task_count', {
    p_workspace_id: workspaceId,
    p_amount: amount,
  });

  if (error) {
    console.error('[light-tasks] decrement_light_task_count RPC error:', error.message);
    const { data: workspace, error: readError } = await supabase
      .from('workspaces')
      .select('light_task_count')
      .eq('id', workspaceId)
      .single();
    if (readError) return 0;

    const nextCount = Math.max((workspace?.light_task_count ?? 0) - amount, 0);
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ light_task_count: nextCount })
      .eq('id', workspaceId)
      .eq('light_task_count', workspace.light_task_count);
    return updateError ? 0 : amount;
  }

  const result = Array.isArray(data) ? data[0] : data;
  return result?.ok ? amount : 0;
}
