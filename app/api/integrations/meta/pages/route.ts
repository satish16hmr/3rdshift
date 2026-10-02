import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptStoredToken, META_GRAPH_VERSION } from '@/lib/social-publishing';

async function getFacebookToken(userId: string) {
  const { data } = await supabaseAdmin
    .from('user_integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'facebook')
    .single();
  if (!data?.access_token || data.access_token.startsWith('pending:')) return null;
  return decryptStoredToken(data.access_token);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const token = await getFacebookToken(userId);
  if (!token) return NextResponse.json({ connected: false, pages: [] });

  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error?.message || 'Could not load pages' }, { status: 500 });
  return NextResponse.json({ connected: true, pages: data.data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { page_id } = await req.json().catch(() => ({}));
  if (!page_id) return NextResponse.json({ error: 'page_id is required' }, { status: 400 });
  const token = await getFacebookToken(userId);
  if (!token) return NextResponse.json({ error: 'Facebook not connected' }, { status: 403 });

  const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  const page = data.data?.find((p: any) => p.id === page_id);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  await supabaseAdmin.from('user_integrations').update({
    provider_page_id: page.id,
    provider_name: page.name,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('provider', 'facebook');

  if (page.instagram_business_account) {
    const { data: fb } = await supabaseAdmin.from('user_integrations').select('access_token, expires_at, provider_user_id').eq('user_id', userId).eq('provider', 'facebook').single();
    await supabaseAdmin.from('user_integrations').upsert({
      user_id: userId,
      provider: 'instagram',
      access_token: fb?.access_token,
      provider_user_id: fb?.provider_user_id,
      provider_name: page.instagram_business_account.username || page.name,
      provider_page_id: page.id,
      provider_ig_user_id: page.instagram_business_account.id,
      expires_at: fb?.expires_at,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
  } else {
    await supabaseAdmin
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'instagram');
  }

  return NextResponse.json({ success: true });
}
