import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

const ALLOWED = new Set(['linkedin', 'facebook', 'instagram']);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider || '');
  if (!ALLOWED.has(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  await supabaseAdmin
    .from('user_integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  return NextResponse.json({ success: true });
}
