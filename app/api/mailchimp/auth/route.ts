import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await supabaseAdmin.from('mailchimp_tokens').delete().eq('user_id', userId);

  return NextResponse.json({ success: true });
}
