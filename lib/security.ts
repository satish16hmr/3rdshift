import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

const CANONICAL_ORIGIN = 'https://3rdshift.ai';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function getSafeSiteOrigin(request: Request): string {
  const rawOrigin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_ORIGIN;

  try {
    const url = new URL(rawOrigin);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && (host === '3rdshift.ai' || host.endsWith('.3rdshift.ai'))) {
      return url.origin;
    }
  } catch {
    // Fall through to canonical origin.
  }

  return CANONICAL_ORIGIN;
}

export function verifyInternalSecret(request: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  const provided = request.headers.get('x-internal-secret');
  if (!expected || !provided) return false;
  return safeCompare(sha256(provided), sha256(expected));
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtml(value: unknown): string {
  return String(value ?? '').replace(/<[^>]*>/g, '');
}
