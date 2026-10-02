import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';

const DUB_REFERRAL_GROUP_ID = 'grp_1KXGGNB39DFY72HG3D3CCSS2Z';
const PAID_PLANS = new Set(['starter', 'pro', 'operator', 'enterprise']);

type DubEmbedTokenResponse = {
  publicToken?: string;
  error?: {
    message?: string;
  };
  message?: string;
};

function pickPartnerName(profileName: string | null | undefined, email: string | null) {
  const name = profileName?.trim();
  if (name) return name;
  return email?.split('@')[0] || '3rdShift customer';
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const { userId, userEmail } = auth;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, avatar_url, plan')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[referrals/embed-token] Profile lookup failed', {
      userId,
      message: profileError.message,
    });
    return NextResponse.json({ error: 'profile_lookup_failed' }, { status: 500 });
  }

  const plan = String(profile?.plan || 'none').toLowerCase();
  if (!PAID_PLANS.has(plan)) {
    return NextResponse.json({ error: 'paid_plan_required' }, { status: 403 });
  }

  const apiKey = process.env.DUB_API_KEY?.trim();
  if (!apiKey) {
    console.error('[referrals/embed-token] Missing DUB_API_KEY');
    return NextResponse.json({ error: 'referrals_not_configured' }, { status: 503 });
  }

  const email = profile?.email || userEmail;
  if (!email) {
    return NextResponse.json({ error: 'email_required' }, { status: 400 });
  }

  const res = await fetch('https://api.dub.co/tokens/embed/referrals', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tenantId: userId,
      partner: {
        name: pickPartnerName(profile?.full_name, email),
        email,
        image: profile?.avatar_url || undefined,
        tenantId: userId,
        groupId: DUB_REFERRAL_GROUP_ID,
      },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as DubEmbedTokenResponse;

  if (!res.ok || !data.publicToken) {
    console.error('[referrals/embed-token] Dub token request failed', {
      status: res.status,
      message: data.error?.message || data.message || 'Unknown Dub error',
    });
    return NextResponse.json({ error: 'embed_token_failed' }, { status: 502 });
  }

  return NextResponse.json({ publicToken: data.publicToken });
}
