import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { member_id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const before = searchParams.get('before'); // cursor: created_at timestamp

  let query = supabaseAdmin
    .from('team_chat_messages')
    .select('id, role, content, deliverable_id, created_at')
    .eq('workspace_id', workspaceId)
    .eq('member_id', member_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  return NextResponse.json({
    messages: (data ?? []).reverse(), // return chronological order
    has_more: (data ?? []).length === limit,
  });
}
