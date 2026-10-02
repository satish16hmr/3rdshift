import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data } = await supabaseAdmin
    .from('notion_tokens')
    .select('access_token, workspace_name, updated_at')
    .eq('user_id', userId)
    .single();

  const connected = !!data?.access_token && !data.access_token.startsWith('pending:');

  return NextResponse.json({
    connected,
    workspace_name: connected ? (data?.workspace_name || null) : null,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  await supabaseAdmin.from('notion_tokens').delete().eq('user_id', userId);

  return NextResponse.json({ success: true });
}
