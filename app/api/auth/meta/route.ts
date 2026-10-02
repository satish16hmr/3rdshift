import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { appScopedState, siteUrl } from '@/lib/social-publishing';
import crypto from 'crypto';

async function createMetaUrl(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const state = crypto.randomUUID();
  await supabaseAdmin.from('user_integrations').upsert({
    user_id: userId,
    provider: 'facebook',
    access_token: `pending:${state}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', (process.env.META_APP_ID || '').trim());
  url.searchParams.set('config_id', '2704675376600328');
  url.searchParams.set('redirect_uri', `${siteUrl()}/api/auth/callback/meta`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', appScopedState(userId, state));

  return url.toString();
}

export async function POST(req: NextRequest) {
  const url = await createMetaUrl(req);
  if (url instanceof NextResponse) return url;
  return NextResponse.json({ url });
}

export async function GET(req: NextRequest) {
  const url = await createMetaUrl(req);
  if (url instanceof NextResponse) return url;
  return NextResponse.redirect(url);
}
