import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

// Using drive.file only — non-sensitive scope, no Google verification required.
// This grants access only to files created by this app (not all user files).
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

/**
 * POST /api/auth/google/init
 * Registers a pending OAuth state and returns the Google consent URL.
 * The client then redirects the browser to that URL.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const stateToken = crypto.randomUUID();

  // Store pending state — callback will look this up to find userId
  await supabaseAdmin.from('google_workspace_tokens').upsert({
    user_id: userId,
    refresh_token: `pending:${stateToken}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: stateToken,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return NextResponse.json({ url });
}
