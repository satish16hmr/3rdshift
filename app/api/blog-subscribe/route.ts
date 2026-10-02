import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { createHash } from 'crypto';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, source } = body;
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const ipHash = createHash('sha256')
    .update(`${getClientIp(req)}:${process.env.CRON_SECRET || 'rate-limit'}`)
    .digest('hex');
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);

  const { data: rateResult, error: rateError } = await (supabaseAdmin as any).rpc(
    'increment_blog_subscribe_rate_limit',
    {
      p_ip_hash: ipHash,
      p_window_start: windowStart.toISOString(),
      p_limit: 10,
    }
  );

  if (rateError) {
    console.error('blog_subscribe rate limit error:', rateError);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  } else {
    const rateRow = Array.isArray(rateResult) ? rateResult[0] : rateResult;
    if (rateRow?.hit_limit) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }
  }

  const { error } = await supabaseAdmin
    .from('blog_subscribers')
    .upsert({ email: email.toLowerCase().trim(), source: source || 'blog', subscribed_at: new Date().toISOString() }, { onConflict: 'email', ignoreDuplicates: true });

  if (error) {
    console.error('blog_subscribe error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
