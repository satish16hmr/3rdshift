/**
 * Shared cron route authentication helper.
 *
 * H10 fix:
 * - Fail-closed when CRON_SECRET env var is missing
 *   (prevents 'Bearer undefined' bypass)
 * - Constant-time comparison to prevent timing attacks
 * - Vercel user-agent check retained as defense-in-depth
 */

import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  // Constant-time compare — returns false immediately if lengths differ
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function verifyCronRequest(request: Request): { valid: boolean; reason?: string } {
  // Fail-closed: if CRON_SECRET is not configured, reject all requests
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron-auth] CRON_SECRET is not set — rejecting all cron requests');
    return { valid: false, reason: 'CRON_SECRET not configured' };
  }

  // Check 1: CRON_SECRET bearer token (constant-time)
  const authHeader = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!safeCompare(authHeader, expected)) {
    return { valid: false, reason: 'Invalid bearer token' };
  }

  // Check 2: Vercel cron user-agent (defense-in-depth)
  const userAgent = request.headers.get('user-agent') || '';
  if (!userAgent.startsWith('vercel-cron/')) {
    return { valid: false, reason: `Unexpected user-agent: ${userAgent}` };
  }

  return { valid: true };
}
