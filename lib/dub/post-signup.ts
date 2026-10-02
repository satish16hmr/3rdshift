import { NextRequest } from 'next/server';
import { getDubClickId } from '@/lib/dub/stripe';
import { trackDubLead } from '@/lib/dub/server';

type PostSignupLeadParams = {
  request: NextRequest;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  source: string;
};

export async function trackPostSignupLead({
  request,
  userId,
  email,
  name,
  source,
}: PostSignupLeadParams) {
  const clickId = getDubClickId(request);

  return trackDubLead({
    clickId,
    customerExternalId: userId,
    customerEmail: email || undefined,
    customerName: name || undefined,
    source,
  });
}

export function isRecentlyCreatedAuthUser(createdAt?: string | null, windowMs = 10 * 60 * 1000) {
  if (!createdAt) return false;

  const createdTime = Date.parse(createdAt);
  if (!Number.isFinite(createdTime)) return false;

  const ageMs = Date.now() - createdTime;
  return ageMs >= 0 && ageMs <= windowMs;
}
