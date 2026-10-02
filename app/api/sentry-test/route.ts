/**
 * Sentry test endpoint — triggers a deliberate error to verify capture.
 * Protected by CRON_SECRET. Remove after Sentry is verified.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { captureTaskError } from '@/lib/sentry';
import * as Sentry from '@sentry/nextjs';

export async function GET(req: NextRequest) {
  const auth = verifyCronRequest(req);
  if (!auth.valid) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const testError = new Error('Sentry activation test — deliberate error from /api/sentry-test');

  // Capture via our utility
  captureTaskError(testError, 'sentry-test', 'test-task-id', {
    source: 'manual activation test',
    timestamp: new Date().toISOString(),
  });

  // Also capture directly
  Sentry.captureException(testError);

  // Wait for Sentry to flush
  await Sentry.flush(2000);

  return NextResponse.json({
    ok: true,
    message: 'Test error captured — check sentry.io/issues',
    error: testError.message,
  });
}
