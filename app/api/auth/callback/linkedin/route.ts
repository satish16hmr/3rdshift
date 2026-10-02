import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { buildOAuthPopupHtml } from '@/lib/oauth-popup-response';
import { addMonths, encryptNullable, siteUrl } from '@/lib/social-publishing';

function popupComplete(status: 'success' | 'error', error?: string) {
  return new NextResponse(buildOAuthPopupHtml({
    provider: 'linkedin',
    title: 'LinkedIn connection',
    successMessage: 'LinkedIn connected. You can close this window.',
    errorMessage: 'LinkedIn connection failed. You can close this window.',
    successQuery: 'linkedin_connected=1',
    errorQueryParam: 'linkedin_error',
    siteUrl: siteUrl(),
    status,
    error,
  }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
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
    .eq('provider', 'linkedin')
    .single();

  if (pending?.access_token !== `pending:${stateToken}`) {
    return popupComplete('error', 'invalid_state');
  }

  const clientId = (process.env.LINKEDIN_CLIENT_ID || '').trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    console.error('[auth/callback/linkedin] LinkedIn OAuth env vars are not configured');
    return popupComplete('error', 'setup_required');
  }

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${siteUrl()}/api/auth/callback/linkedin`,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    return popupComplete('error', 'token_exchange_failed');
  }

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json().catch(() => ({}));
  const encryptedAccess = await encryptNullable(tokenData.access_token);
  const encryptedRefresh = await encryptNullable(tokenData.refresh_token);

  await supabaseAdmin.from('user_integrations').upsert({
    user_id: userId,
    provider: 'linkedin',
    access_token: encryptedAccess,
    refresh_token: encryptedRefresh,
    provider_user_id: profile.sub || null,
    provider_name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || null,
    expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : addMonths(new Date(), 2).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });

  return popupComplete('success');
}
