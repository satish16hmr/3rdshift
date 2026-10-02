import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { encryptToken } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';
  const finishUrl = (params: Record<string, string>) => {
    const url = new URL('/auth/notion-success', siteUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  };

  if (error || !code || !state) {
    return NextResponse.redirect(finishUrl({ notion_error: error || 'access_denied' }));
  }

  // Find user by pending state token
  const { data: tokenRow } = await supabaseAdmin
    .from('notion_tokens')
    .select('user_id')
    .eq('access_token', `pending:${state}`)
    .single();

  if (!tokenRow) {
    return NextResponse.redirect(finishUrl({ notion_error: 'invalid_state' }));
  }

  const { userId } = { userId: tokenRow.user_id };

  // Exchange code for access token
  const redirectUri = `${siteUrl}/api/notion/auth/callback`;
  const credentials = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
  ).toString('base64');

  const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errData = await tokenRes.json().catch(() => ({}));
    console.error('Notion token exchange error:', errData);
    return NextResponse.redirect(finishUrl({ notion_error: 'token_exchange_failed' }));
  }

  const tokenData = await tokenRes.json();

  // Phase 5: encrypt token before storage
  const encryptedToken = await encryptToken(tokenData.access_token);

  await supabaseAdmin.from('notion_tokens').upsert({
    user_id: userId,
    access_token: encryptedToken,
    workspace_id: tokenData.workspace_id || null,
    workspace_name: tokenData.workspace_name || null,
    bot_id: tokenData.bot_id || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return NextResponse.redirect(finishUrl({ notion_connected: '1' }));
}
