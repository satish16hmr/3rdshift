import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { data } = await supabaseAdmin
    .from('user_integrations')
    .select('provider, access_token, provider_name, provider_user_id, provider_page_id, provider_ig_user_id, expires_at')
    .eq('user_id', userId)
    .in('provider', ['linkedin', 'facebook', 'instagram']);

  const status: Record<string, any> = {
    linkedin: { connected: false },
    facebook: { connected: false },
    instagram: { connected: false },
  };

  for (const row of data || []) {
    const connected = !!row.access_token && !row.access_token.startsWith('pending:');
    status[row.provider] = {
      connected,
      name: connected ? row.provider_name : null,
      provider_user_id: connected ? row.provider_user_id : null,
      provider_page_id: connected ? row.provider_page_id : null,
      provider_ig_user_id: connected ? row.provider_ig_user_id : null,
      expires_at: connected ? row.expires_at : null,
    };
  }

  return NextResponse.json(status);
}