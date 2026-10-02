import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data } = await supabaseAdmin
    .from('mailchimp_tokens')
    .select('access_token, login_email, dc')
    .eq('user_id', userId)
    .single();

  const connected = !!data?.access_token && !data.access_token.startsWith('pending:');

  return NextResponse.json({
    connected,
    login_email: connected ? (data?.login_email || null) : null,
  });
}
