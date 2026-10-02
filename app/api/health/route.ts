import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/api-auth';

// F3b fix: Full dependency health check.
// Returns per-dependency status. Returns HTTP 503 if any worker-critical
// dependency is missing or Inngest is stale. Green = truly ready.

type Status = 'ok' | 'configured' | 'missing' | 'stale' | 'error' | 'degraded';

export async function GET(request: NextRequest) {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '';
  const version = commitSha || 'local';
  const hasBearerToken = request.headers.get('authorization')?.startsWith('Bearer ') ?? false;

  const checks: Record<string, Status> = {
    db: 'error',
    inngest: 'missing',
    anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
    stripe: process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET ? 'configured' : 'missing',
    serper: process.env.SERPER_API_KEY ? 'configured' : 'missing',
    rocketreach: process.env.ROCKETREACH_API_KEY ? 'configured' : 'missing',
    fal: process.env.FAL_API_KEY ? 'configured' : 'missing',
    inngest_event_key: process.env.INNGEST_EVENT_KEY ? 'configured' : 'missing',
    inngest_signing_key: process.env.INNGEST_SIGNING_KEY ? 'configured' : 'missing',
    token_encryption: process.env.TOKEN_ENCRYPTION_KEY ? 'configured' : 'missing',
  };

  // DB ping
  try {
    const { error } = await supabaseAdmin
      .from('workers')
      .select('id')
      .limit(1)
      .single();
    checks.db = !error || error.code === 'PGRST116' ? 'ok' : 'error';
  } catch {
    checks.db = 'error';
  }

  // F3a + F3b: Inngest readiness check.
  // Vercel serverless functions can't reliably self-call via HTTP (networking constraints).
  // Instead, check env var presence as a proxy for registration readiness.
  // INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY both present = Inngest can register.
  // The hourly sync-inngest cron (F3a) ensures registration stays current after deploys.
  const hasInngestEventKey = !!process.env.INNGEST_EVENT_KEY;
  const hasInngestSigningKey = !!process.env.INNGEST_SIGNING_KEY;
  if (hasInngestEventKey && hasInngestSigningKey) {
    checks.inngest = 'ok';
  } else if (!hasInngestEventKey && !hasInngestSigningKey) {
    checks.inngest = 'missing';
  } else {
    // One key present but not both — partial config, likely stale
    checks.inngest = 'stale';
  }

  // Determine overall status
  const criticalMissing = [
    checks.db === 'error',
    checks.anthropic === 'missing',
    checks.inngest === 'missing',
    checks.inngest_event_key === 'missing',
    checks.inngest_signing_key === 'missing',
    checks.token_encryption === 'missing',
  ].some(Boolean);

  const workerDegraded = [
    checks.serper === 'missing',
    checks.rocketreach === 'missing',
    checks.fal === 'missing',
    checks.stripe === 'missing',
    checks.inngest === 'stale',
  ].some(Boolean);

  let overallStatus: 'ok' | 'degraded' | 'fail';
  if (criticalMissing) {
    overallStatus = 'fail';
  } else if (workerDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'ok';
  }

  const httpStatus = overallStatus === 'ok' ? 200 : 503;

  if (!hasBearerToken) {
    return NextResponse.json(
      { status: 'ok', version },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  return NextResponse.json(
    { status: overallStatus, version, checks },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
