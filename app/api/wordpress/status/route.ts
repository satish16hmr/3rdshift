import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data } = await supabaseAdmin
    .from('wordpress_connections')
    .select('site_url, site_name')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  return NextResponse.json({
    connected: !!data?.site_url,
    site_url: data?.site_url || null,
    site_name: data?.site_name || null,
  });
}
