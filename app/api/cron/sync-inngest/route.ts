/**
 * F3a fix: Inngest auto-registration on deploy.
 *
 * Runs hourly via Vercel cron. Calls PUT /api/inngest to sync function
 * registrations with Inngest Cloud. Idempotent — safe to call repeatedly.
 * Ensures that after every Vercel deploy, Inngest picks up any new or
 * changed function definitions within at most 1 hour.
 *
 * Without this, prod Inngest registration goes stale after each deploy
 * until manually triggered, causing tasks to queue indefinitely.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const cronAuth = verifyCronRequest(request);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  // Use INNGEST_SYNC_BASE_URL (explicit canonical domain) first, then NEXT_PUBLIC_SITE_URL,
  // then hardcoded prod domain. VERCEL_URL is intentionally NOT used here — it resolves to
  // the deployment preview URL (e.g. 3rdshift-frontend-abc.vercel.app) which may return
  // an HTML Vercel interstitial instead of the JSON API response.
  const baseUrl =
    process.env.INNGEST_SYNC_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://3rdshift.ai';

  try {
    const res = await fetch(`${baseUrl}/api/inngest`, {
      method: 'PUT',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = res.headers.get('content-type') ?? '';
    const raw = await res.text();

    if (!contentType.includes('application/json')) {
      console.error(`[sync-inngest] Non-JSON response from ${baseUrl}/api/inngest — content-type: ${contentType.slice(0, 100)}`);
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: 'Inngest sync returned non-JSON response',
        contentTypePrefix: contentType.slice(0, 100),
        bodyPrefix: raw.slice(0, 200),
      }, { status: 502 });
    }

    const data = JSON.parse(raw) as Record<string, unknown>;
    const modified = data?.modified === true;

    console.log(`[sync-inngest] PUT /api/inngest → status=${res.status} modified=${modified}`);

    if (modified) {
      console.warn('[sync-inngest] ⚠️ Inngest registration was stale — functions re-synced. This is expected after a deploy.');
    }

    return NextResponse.json({
      ok: true,
      status: res.status,
      modified,
      message: (data?.message as string) ?? null,
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-inngest] Failed to sync Inngest:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
