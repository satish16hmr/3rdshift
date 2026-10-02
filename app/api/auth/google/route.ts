import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptToken } from '@/lib/crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow.
 * The frontend calls this with the user's JWT in Authorization header,
 * which stores the userId in Supabase as a pending state, then redirects to Google.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Store pending state in Supabase so callback can retrieve userId
  const stateToken = crypto.randomUUID();
  await supabaseAdmin.from('google_workspace_tokens').upsert({
    user_id: userId,
    refresh_token: `pending:${stateToken}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  // State is just the stateToken — no user data in the URL
  const state = stateToken;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * DELETE /api/auth/google
 * Disconnects Google Workspace for this user
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { data } = await supabaseAdmin
    .from('google_workspace_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  // Decrypt and revoke the token with Google
  if (data?.access_token) {
    try {
      const plainToken = await decryptToken(data.access_token);
      fetch(`https://oauth2.googleapis.com/revoke?token=${plainToken}`, { method: 'POST' }).catch(() => {});
    } catch { /* ignore revocation errors */ }
  }

  await supabaseAdmin.from('google_workspace_tokens').delete().eq('user_id', userId);

  return NextResponse.json({ disconnected: true });
}
