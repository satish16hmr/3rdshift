import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { encryptToken } from '@/lib/crypto';

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback, exchanges code for tokens
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'}/dashboard/settings?google_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'}/dashboard/settings?google_error=missing_params`);
  }

  // Look up userId from the pending state token — must exist and be < 10 minutes old
  let userId: string;
  try {
    const { data: pendingRow } = await supabaseAdmin
      .from('google_workspace_tokens')
      .select('user_id, updated_at')
      .eq('refresh_token', `pending:${state}`)
      .single();
    if (!pendingRow?.user_id) throw new Error('state not found');
    // Expire state tokens after 10 minutes
    const age = Date.now() - new Date(pendingRow.updated_at).getTime();
    if (age > 10 * 60 * 1000) throw new Error('state token expired');
    userId = pendingRow.user_id;
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'}/dashboard/settings?google_error=invalid_state`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'}/dashboard/settings?google_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();

  // Encrypt tokens before storing
  const [encAccessToken, encRefreshToken] = await Promise.all([
    encryptToken(tokens.access_token),
    tokens.refresh_token ? encryptToken(tokens.refresh_token) : Promise.resolve(null),
  ]);

  // Store tokens in Supabase (upsert — user may be reconnecting)
  await supabaseAdmin.from('google_workspace_tokens').upsert({
    user_id: userId,
    access_token: encAccessToken,
    refresh_token: encRefreshToken ?? tokens.refresh_token,
    token_expiry: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  // Redirect to success page — detects popup and closes it, otherwise falls back to settings
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'}/auth/google-success`);
}
