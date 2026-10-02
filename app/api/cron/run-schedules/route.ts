export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { callAI } from '@/lib/ai/callAI';
import { executeChain } from '@/lib/agent-mode/executor';
import { verifyCronRequest } from '@/lib/cron-auth';
import { enforceBillingAccess } from '@/lib/billing/billing-access';
import { enforceResolutionGate } from '@/lib/billing/resolution-gate';

function createAdminClient() {
  return supabaseAdmin;
}

// ── Health check — single lightweight callAI() ping ──────────────────────────
async function healthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const result = await callAI({
      model_tier: 'haiku',
      messages: [{ role: 'user', content: 'Respond with the word OK.' }],
      max_tokens: 5,
    });
    clearTimeout(timeout);
    return !!result.content;
  } catch {
    return false;
  }
}

// ── Get local hour and day of week for a given timezone ─────────────────────
function getLocalInfo(timezone: string): { hour: number; dayName: string } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      weekday: 'long',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
    const dayName = (parts.find(p => p.type === 'weekday')?.value ?? 'monday').toLowerCase();
    return { hour, dayName };
  } catch {
    // Default to Chicago time
    return getLocalInfo('America/Chicago');
  }
}

// ── Check if a run already exists for this chain today ───────────────────────

async function enforceScheduledChainEntitlements(
  supabase: ReturnType<typeof createAdminClient>,
  chain: { id: string; workspace_id: string | null; user_id: string }
): Promise<{ ok: true; creditOwnerId: string } | { ok: false; reason: string }> {
  let creditOwnerId = chain.user_id;
  let plan = 'none';

  if (chain.workspace_id) {
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id, plan')
      .eq('id', chain.workspace_id)
      .single();
    if (workspaceError || !workspace?.owner_id) {
      return { ok: false, reason: 'workspace_missing' };
    }
    creditOwnerId = workspace.owner_id;
    plan = workspace.plan ?? 'none';
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, is_founding_member, founding_tier')
    .eq('id', creditOwnerId)
    .single();
  if (profileError || !profile) {
    return { ok: false, reason: 'owner_profile_missing' };
  }

  plan = profile.is_founding_member && profile.founding_tier
    ? profile.founding_tier
    : (profile.plan || plan || 'none');

  if (plan !== 'operator') {
    await supabase.from('agent_mode_chains').update({ status: 'inactive' }).eq('id', chain.id);
    return { ok: false, reason: 'operator_plan_required' };
  }

  const resolution = await enforceResolutionGate(supabase as never, creditOwnerId);
  if (resolution.blocked) {
    await supabase.from('agent_mode_chains').update({ status: 'paused' }).eq('id', chain.id);
    return { ok: false, reason: 'workspace_resolution_required' };
  }

  const billingAccess = await enforceBillingAccess(supabase as never, creditOwnerId);
  if (billingAccess.blocked) {
    await supabase.from('agent_mode_chains').update({ status: 'paused' }).eq('id', chain.id);
    return { ok: false, reason: billingAccess.code ?? 'billing_access_blocked' };
  }

  return { ok: true, creditOwnerId };
}

async function runExistsToday(supabase: ReturnType<typeof createAdminClient>, chainId: string, timezone: string): Promise<boolean> {
  // "Today" in user's timezone — get start of day UTC
  const now = new Date();
  const tzDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  const startOfDay = new Date(tzDate + 'T00:00:00.000Z').toISOString();

  const { count, error } = await supabase
    .from('agent_mode_runs')
    .select('*', { count: 'exact', head: true })
    .eq('chain_id', chainId)
    .in('status', ['running','completed','partial','failed','pending_rescue'])
    .gte('started_at', startOfDay);

  if (error) {
    console.error(`[AgentMode][Cron] Failed to check run idempotency for chain ${chainId}:`, error);
    throw new Error(`Failed to check scheduled run idempotency: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

export async function GET(request: NextRequest) {
  const cronAuth = verifyCronRequest(request);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Task timeout/refund handling lives in cleanup-stale-tasks. Keeping it there
  // avoids duplicate stale-task paths that can fail tasks without refunding usage.
  const timedOut = 0;

  // ── Phase 2: Rescue window — retry pending_rescue runs ──────────────────────
  const { data: rescueRuns, error: rescueRunsError } = await supabase
    .from('agent_mode_runs')
    .select(`*, agent_mode_chains(*)`)
    .eq('status', 'pending_rescue')
    .lt('rescue_attempts', 2)
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (rescueRunsError) {
    console.error('[AgentMode][Cron] Failed to load pending rescue runs:', rescueRunsError);
    return NextResponse.json({
      error: 'pending_rescue_runs_query_failed',
      message: rescueRunsError.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }

  let rescueAttempted = 0;
  let rescueFailed = 0;

  for (const run of rescueRuns ?? []) {
    const chain = run.agent_mode_chains;
    if (!chain) continue;

    const healthy = await healthCheck();
    if (!healthy) {
      // Still down — increment rescue_attempts; if maxed, mark failed + refund all
      const newAttempts = run.rescue_attempts + 1;
      if (newAttempts >= 2) {
        await supabase.from('agent_mode_runs').update({
          status: 'failed',
          rescue_attempts: newAttempts,
          completed_at: new Date().toISOString(),
        }).eq('id', run.id);

        await supabase.from('agent_mode_notifications').insert({
          user_id: run.user_id,
          chain_id: chain.id,
          run_id: run.id,
          type: 'failed',
          title: `❌ ${chain.name} couldn't run today`,
          message: `Our AI providers experienced an outage. All credits have been refunded. Your chain will run normally on its next scheduled day.`,
        });
        rescueFailed++;
      } else {
        await supabase.from('agent_mode_runs').update({ rescue_attempts: newAttempts }).eq('id', run.id);
      }
      continue;
    }

    // Healthy — update run to 'running' and re-execute
    await supabase.from('agent_mode_runs').update({
      status: 'running',
      rescue_attempts: run.rescue_attempts + 1,
    }).eq('id', run.id);

    try {
      await executeChain({
        runId: run.id,
        chainId: chain.id,
        userId: run.user_id,
        workspaceId: chain.workspace_id,
        workers: chain.workers,
        triggerType: 'scheduled',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: supabase as any,
      });
      rescueAttempted++;
    } catch (err) {
      console.error('[AgentMode][Rescue] Chain execution failed:', err);
      await supabase.from('agent_mode_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      }).eq('id', run.id);
    }
  }

  // ── Phase 3: Scheduled chains — fire at 6 AM user local time ────────────────
  // agent_mode_settings is keyed by user_id and does not have a direct FK to
  // agent_mode_chains, so fetch settings separately instead of relying on a
  // PostgREST embedded relationship that does not exist.
  const { data: activeChains, error: activeChainsError } = await supabase
    .from('agent_mode_chains')
    .select('*')
    .eq('status', 'active')
    .neq('schedule_days', '{}');

  if (activeChainsError) {
    console.error('[AgentMode][Cron] Failed to load active scheduled chains:', activeChainsError);
    return NextResponse.json({
      error: 'scheduled_chains_query_failed',
      message: activeChainsError.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }

  const scheduledUserIds = [...new Set((activeChains ?? []).map(chain => chain.user_id).filter(Boolean))];
  let timezoneByUserId = new Map<string, string>();

  if (scheduledUserIds.length > 0) {
    const { data: settingsRows, error: settingsError } = await supabase
      .from('agent_mode_settings')
      .select('user_id, timezone')
      .in('user_id', scheduledUserIds);

    if (settingsError) {
      console.error('[AgentMode][Cron] Failed to load scheduled chain timezones:', settingsError);
      return NextResponse.json({
        error: 'scheduled_chain_timezones_query_failed',
        message: settingsError.message,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    timezoneByUserId = new Map(
      (settingsRows ?? [])
        .filter(row => row.user_id && row.timezone)
        .map(row => [row.user_id, row.timezone])
    );
  }

  let chainsFired = 0;
  let chainsSkipped = 0;

  for (const chain of activeChains ?? []) {
    const timezone = timezoneByUserId.get(chain.user_id) ?? 'America/Chicago';
    const { hour, dayName } = getLocalInfo(timezone);

    // Only fire at 6 AM
    if (hour !== 6) { chainsSkipped++; continue; }

    // Check if today is a scheduled day
    if (!chain.schedule_days.includes(dayName)) { chainsSkipped++; continue; }

    // Re-check Operator entitlement, workspace-resolution state, and billing health
    // immediately before every scheduled execution. Downgrade/cancel webhooks should
    // deactivate chains, but cron must fail safe if a stale active row survives.
    const entitlement = await enforceScheduledChainEntitlements(supabase, chain);
    if (!entitlement.ok) {
      console.warn(`[AgentMode][Cron] Skipping chain ${chain.id}: ${entitlement.reason}`);
      chainsSkipped++;
      continue;
    }

    // Idempotency — don't re-fire if run already exists today
    const alreadyRan = await runExistsToday(supabase, chain.id, timezone);
    if (alreadyRan) { chainsSkipped++; continue; }

    // Health check before executing
    const healthy = await healthCheck();
    if (!healthy) {
      // Create pending_rescue run
      const { error: rescueRunError } = await supabase
        .from('agent_mode_runs')
        .insert({
          chain_id: chain.id,
          user_id: chain.user_id,
          trigger_type: 'scheduled',
          status: 'pending_rescue',
          rescue_attempts: 0,
        })
        .select()
        .single();

      if (rescueRunError) {
        console.error(`[AgentMode][Cron] Failed to create rescue run for chain ${chain.id}:`, rescueRunError);
        return NextResponse.json({
          error: 'scheduled_rescue_run_insert_failed',
          message: rescueRunError.message,
          chainId: chain.id,
          timestamp: new Date().toISOString(),
        }, { status: 500 });
      }

      console.warn(`[AgentMode][Cron] Health check failed for chain ${chain.id} — queued for rescue window`);
      chainsFired++;
      continue;
    }

    // Create run record
    const { data: run, error: runInsertError } = await supabase
      .from('agent_mode_runs')
      .insert({
        chain_id: chain.id,
        user_id: chain.user_id,
        trigger_type: 'scheduled',
        status: 'running',
      })
      .select()
      .single();

    if (runInsertError || !run) {
      console.error(`[AgentMode][Cron] Failed to create scheduled run for chain ${chain.id}:`, runInsertError);
      return NextResponse.json({
        error: 'scheduled_run_insert_failed',
        message: runInsertError?.message ?? 'No run returned after insert',
        chainId: chain.id,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    try {
      await executeChain({
        runId: run.id,
        chainId: chain.id,
        userId: chain.user_id,
        workspaceId: chain.workspace_id,
        workers: chain.workers,
        triggerType: 'scheduled',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase: supabase as any,
      });
      chainsFired++;
    } catch (err) {
      console.error(`[AgentMode][Cron] Chain ${chain.id} failed:`, err);
      await supabase.from('agent_mode_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      }).eq('id', run.id);
    }
  }

  return NextResponse.json({
    timedOut,
    chainsFired,
    chainsSkipped,
    rescueAttempted,
    rescueFailed,
    timestamp: new Date().toISOString(),
  });
}
