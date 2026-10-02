import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { appScopedState, siteUrl } from '@/lib/social-publishing';
import crypto from 'crypto';

const SCOPES = ['openid', 'profile', 'w_member_social'].join(' ');

function getLinkedInClientId() {
  return (process.env.LINKEDIN_CLIENT_ID || '').trim();
}

async function createLinkedInUrl(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const clientId = getLinkedInClientId();
  if (!clientId) {
    console.error('[auth/linkedin] LINKEDIN_CLIENT_ID is not configured');
    return NextResponse.json(
      { error: 'LinkedIn connection requires setup — contact support.' },
      { status: 503 }
    );
  }

  const state = crypto.randomUUID();
  await supabaseAdmin.from('user_integrations').upsert({
    user_id: userId,
    provider: 'linkedin',
    access_token: `pending:${state}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${siteUrl()}/api/auth/callback/linkedin`);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', appScopedState(userId, state));

  return url.toString();
}

export async function POST(req: NextRequest) {
  const url = await createLinkedInUrl(req);
  if (url instanceof NextResponse) return url;
  return NextResponse.json({ url });
}

export async function GET(req: NextRequest) {
  const url = await createLinkedInUrl(req);
  if (url instanceof NextResponse) return url;
  return NextResponse.redirect(url);
}
