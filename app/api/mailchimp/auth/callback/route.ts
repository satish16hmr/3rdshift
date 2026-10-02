import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { encryptToken } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';

  if (error || !code || !state) {
    return NextResponse.redirect(`${siteUrl}/dashboard/settings?mailchimp_error=${encodeURIComponent(error || 'access_denied')}`);
  }

  const { data: tokenRow } = await supabaseAdmin
    .from('mailchimp_tokens')
    .select('user_id')
    .eq('access_token', `pending:${state}`)
    .single();

  if (!tokenRow) {
    return NextResponse.redirect(`${siteUrl}/dashboard/settings?mailchimp_error=invalid_state`);
  }

  const userId = tokenRow.user_id;
  const redirectUri = `${siteUrl}/api/mailchimp/auth/callback`;

  // Exchange code for token
  const tokenRes = await fetch('https://login.mailchimp.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.MAILCHIMP_CLIENT_ID!.trim(),
      client_secret: process.env.MAILCHIMP_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error('Mailchimp token exchange failed:', await tokenRes.text());
    return NextResponse.redirect(`${siteUrl}/dashboard/settings?mailchimp_error=token_exchange_failed`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Fetch metadata (server prefix / data center)
  const metaRes = await fetch('https://login.mailchimp.com/oauth2/metadata', {
    headers: { 'Authorization': `OAuth ${accessToken}` },
  });
  const meta = metaRes.ok ? await metaRes.json() : {};
  const dc = meta.dc || 'us1';

  // Phase 5: encrypt token before storage
  const encryptedToken = await encryptToken(accessToken);

  await supabaseAdmin.from('mailchimp_tokens').upsert({
    user_id: userId,
    access_token: encryptedToken,
    dc,
    login_email: meta.login?.email || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return NextResponse.redirect(`${siteUrl}/auth/mailchimp-success`);
}
