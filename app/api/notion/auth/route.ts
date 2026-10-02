// DELETE /api/notion/auth — disconnect Notion
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await supabaseAdmin.from('notion_tokens').delete().eq('user_id', userId);

  return NextResponse.json({ success: true });
}
