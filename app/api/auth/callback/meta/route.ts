import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { buildOAuthPopupHtml } from '@/lib/oauth-popup-response';
import { encryptNullable, META_GRAPH_VERSION, siteUrl } from '@/lib/social-publishing';

function popupComplete(status: 'success' | 'error', error?: string) {
  return new NextResponse(buildOAuthPopupHtml({
    provider: 'meta',
    title: 'Meta connection',
    successMessage: 'Meta connected. You can close this window.',
    errorMessage: 'Meta connection failed. You can close this window.',
    successQuery: 'meta_connected=1',
    errorQueryParam: 'meta_error',
    siteUrl: siteUrl(),
    status,
    error,
  }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error');

  if (error || !code || !state.includes(':')) {
    return popupComplete('error', error || 'missing_code');
  }

  const [userId, stateToken] = state.split(':');
  const { data: pending } = await supabaseAdmin
    .from('user_integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'facebook')
    .single();

  if (pending?.access_token !== `pending:${stateToken}`) {
    return popupComplete('error', 'invalid_state');
  }

  const appId = (process.env.META_APP_ID || '').trim();
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  const redirectUri = `${siteUrl()}/api/auth/callback/meta`;
  const shortUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  shortUrl.searchParams.set('client_id', appId);
  shortUrl.searchParams.set('redirect_uri', redirectUri);
  shortUrl.searchParams.set('client_secret', appSecret);
  shortUrl.searchParams.set('code', code);

  const short = await fetchJson(shortUrl.toString());
  if (!short.res.ok || !short.data.access_token) {
    return popupComplete('error', 'token_exchange_failed');
  }

  const longUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  longUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longUrl.searchParams.set('client_id', appId);
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('fb_exchange_token', short.data.access_token);
  const long = await fetchJson(longUrl.toString());
  const accessToken = long.data.access_token || short.data.access_token;
  const expiresAt = long.data.expires_in ? new Date(Date.now() + long.data.expires_in * 1000).toISOString() : null;

  const me = await fetchJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
  const pages = await fetchJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`);
  const pageList = Array.isArray(pages.data?.data) ? pages.data.data : [];
  const selectedPage = pageList.length === 1 ? pageList[0] : null;
  const selectedIg = selectedPage?.instagram_business_account || null;
  const encrypted = await encryptNullable(accessToken);

  await supabaseAdmin.from('user_integrations').upsert({
    user_id: userId,
    provider: 'facebook',
    access_token: encrypted,
    provider_user_id: me.data?.id || null,
    provider_name: selectedPage?.name || me.data?.name || null,
    provider_page_id: selectedPage?.id || null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  if (selectedIg) {
    await supabaseAdmin.from('user_integrations').upsert({
      user_id: userId,
      provider: 'instagram',
      access_token: encrypted,
      provider_user_id: me.data?.id || null,
      provider_name: selectedIg.username || selectedPage?.name || 'Instagram',
      provider_page_id: selectedPage?.id || null,
      provider_ig_user_id: selectedIg.id,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
  }

  return popupComplete('success');
}
