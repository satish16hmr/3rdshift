import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { hashApiKey } from '@/lib/crypto';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Validate X-API-Key header, verify it exists and belongs to an Operator user.
 * Returns { userId, plan } on success, or a NextResponse error.
 */
export async function requireZapierAuth(
  req: NextRequest
): Promise<{ userId: string; workspaceId: string; plan: string } | NextResponse> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing X-API-Key header' }, { status: 401 });
  }

  // Phase 5: lookup by SHA-256 hash first (post-backfill path).
  // Fall back to raw api_key lookup for pre-backfill rows (lazy migration).
  // Safe in any deploy order — no Zapier outage window.
  const keyHash = hashApiKey(apiKey);

  let keyRow: { user_id: string; workspace_id: string; active: boolean } | null = null;

  // Try hash lookup first
  const { data: byHash } = await supabaseAdmin
    .from('zapier_api_keys')
    .select('user_id, workspace_id, active')
    .eq('api_key_hash', keyHash)
    .single();

  if (byHash) {
    keyRow = byHash;
  } else {
    // Fallback: raw plaintext lookup (pre-backfill rows only)
    // This path is removed after backfill confirms all rows have api_key_hash populated.
    const { data: byRaw } = await supabaseAdmin
      .from('zapier_api_keys')
      .select('user_id, workspace_id, active')
      .eq('api_key', apiKey)
      .single();
    keyRow = byRaw ?? null;
  }

  if (!keyRow || !keyRow.active) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 });
  }

  const userId = keyRow.user_id;

  // Resolve workspace — use key's workspace_id or fall back to user's default
  const { getActiveWorkspaceId, getWorkspaceOwnerPlan } = await import('../workspace');
  const workspaceId = keyRow.workspace_id || await getActiveWorkspaceId(userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 403 });
  }

  // Verify Operator plan — workspace owner's plan
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan !== 'operator') {
    return NextResponse.json(
      { error: 'Zapier integration requires an Operator plan.' },
      { status: 403 }
    );
  }

  return { userId, workspaceId, plan };
}

/**
 * Fire all registered Zapier webhooks for a given user when a task completes.
 */
export async function fireZapierWebhooks(payload: {
  event: string;
  task_id: string;
  worker_name: string;
  worker_title: string;
  worker_slug: string;
  deliverable_type: string;
  deliverable_content: string;
  deliverable_url: string | null;
  credits_used: number;
  credit_type: string;
  created_at: string;
  user_id: string;
  workspace_id?: string;
}) {
  // Query by workspace_id AND user_id — deduplicate by target_url
  // Customers' Zapier email often differs from their 3rdShift email.
  // The subscription is tied to whoever's API key was used, which may be
  // stored under a different user_id than the task owner. Always check both.
  const queryPromises = [];

  if (payload.workspace_id) {
    queryPromises.push(
      supabaseAdmin
        .from('zapier_webhook_subscriptions')
        .select('target_url')
        .eq('workspace_id', payload.workspace_id)
        .eq('event', 'task.completed')
        .eq('active', true)
        .then((r: { data: { target_url: string }[] | null }) => r)
    );
  }

  queryPromises.push(
    supabaseAdmin
      .from('zapier_webhook_subscriptions')
      .select('target_url')
      .eq('user_id', payload.user_id)
      .eq('event', 'task.completed')
      .eq('active', true)
      .then((r: { data: { target_url: string }[] | null }) => r)
  );

  const results = await Promise.all(queryPromises);
  const seen = new Set<string>();
  const hooks: { target_url: string }[] = [];
  for (const r of results) {
    if ((r as any).error) console.error('[fireZapierWebhooks] query error:', (r as any).error);
    for (const h of (r.data || [])) {
      if (!seen.has(h.target_url)) {
        seen.add(h.target_url);
        hooks.push(h);
      }
    }
  }

  console.log('[fireZapierWebhooks] found', hooks.length, 'hooks for workspace:', payload.workspace_id, 'user:', payload.user_id);
  if (hooks.length === 0) return { attempted: 0, delivered: 0, failed: 0, failures: [] };

  const deliveries = await Promise.allSettled(
    hooks.map(async (hook) => {
      const res = await fetch(hook.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Normalize field names to match polling endpoint (id, worker, output)
        // so Zapier's sample data validation passes
        body: JSON.stringify({
          id: payload.task_id,
          worker: payload.worker_slug,
          worker_name: payload.worker_name,
          worker_title: payload.worker_title,
          status: 'completed',
          output: payload.deliverable_content,
          deliverable_url: payload.deliverable_url,
          credits_used: payload.credits_used,
          credit_type: payload.credit_type,
          created_at: payload.created_at,
          completed_at: payload.created_at,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Zapier webhook returned ${res.status}: ${errorText.slice(0, 200)}`);
      }
      return { target_url: hook.target_url, status: res.status };
    })
  );

  const failures = deliveries.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [];
    return [{ target_url: hooks[index].target_url, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }];
  });
  if (failures.length > 0) {
    console.error('[fireZapierWebhooks] delivery failures:', failures.map((failure) => ({ error: failure.error })));
  }

  return {
    attempted: hooks.length,
    delivered: deliveries.length - failures.length,
    failed: failures.length,
    failures,
  };
}
