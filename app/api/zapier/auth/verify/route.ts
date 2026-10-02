import { NextRequest, NextResponse } from 'next/server';
import { requireZapierAuth, supabaseAdmin } from '@/lib/zapier/helpers';

async function getEmail(userId: string): Promise<string> {
  const { data } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).single();
  return data?.email || userId;
}

export async function POST(req: NextRequest) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;
  const email = await getEmail(auth.userId);
  return NextResponse.json({ valid: true, plan: auth.plan, user_id: auth.userId, email });
}

export async function GET(req: NextRequest) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;
  const email = await getEmail(auth.userId);
  return NextResponse.json({ valid: true, plan: auth.plan, user_id: auth.userId, email });
}
