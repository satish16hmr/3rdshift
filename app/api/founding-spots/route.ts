import { NextResponse } from 'next/server';
import { FOUNDING_CONFIG } from '../../../lib/founding-config';

export const runtime = 'nodejs';

export async function GET() {
  const { current_wave, wave_cap, is_open } = FOUNDING_CONFIG;

  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/founding_members?wave=eq.${current_wave}&is_test=eq.false&select=id`;
    const res = await fetch(url, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Prefer': 'count=exact',
      },
    });

    const countHeader = res.headers.get('content-range');
    const currentCount = countHeader ? parseInt(countHeader.split('/')[1] || '0') : 0;
    const remaining = Math.max(0, wave_cap - currentCount);

    return NextResponse.json({
      remaining,
      total: wave_cap,
      wave: current_wave,
      is_open: is_open && remaining > 0,
    });
  } catch (err) {
    console.error('Founding spots error:', err);
    return NextResponse.json({
      remaining: wave_cap,
      total: wave_cap,
      wave: current_wave,
      is_open,
    });
  }
}
