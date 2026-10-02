import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { BILLING_CATALOG } from '@/lib/billing/catalog';

/**
 * POST /api/send-welcome
 *
 * H11 fix: requires authentication, and the recipient email must match
 * the authenticated user's own email — prevents use as an open spam relay.
 *
 * Previously: unauthenticated, accepted any email, no rate limit.
 */
export async function POST(request: NextRequest) {
  try {
    // H11 fix: require authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, firstName, plan } = await request.json();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    // H11 fix: recipient must be the authenticated user's own email
    if (email.toLowerCase().trim() !== (user.email || '').toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'Email address does not match your account.' },
        { status: 403 }
      );
    }

    const name = firstName || 'there';
    const planEntry = (BILLING_CATALOG as Record<string, typeof BILLING_CATALOG.starter>)[plan] || null;
    const planLabel = planEntry?.name || 'Starter';
    const monthlyLightTasks = planEntry?.light_task_limit ?? BILLING_CATALOG.starter.light_task_limit;
    const monthlyHeavyCredits = planEntry?.heavy_credits ?? BILLING_CATALOG.starter.heavy_credits;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai').replace(/\/$/, '');
    const dashboardUrl = `${siteUrl}/dashboard`;
    const teamUrl = `${siteUrl}/dashboard/team`;
    const planLine = `That's ${monthlyLightTasks.toLocaleString('en-US')} light tasks and ${monthlyHeavyCredits.toLocaleString('en-US')} heavy credits every month.`;

    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#ffffff;">
  <div style="margin-bottom:32px;">
    <img src="https://3rdshift.ai/logo-hq.png" alt="3rdShift" style="height:32px;width:auto;" />
  </div>
  <h1 style="font-size:28px;font-weight:800;color:#111113;margin:0 0 12px;letter-spacing:-0.02em;">You're officially in, ${name}.</h1>
  <p style="font-size:15px;color:#71717a;line-height:1.6;margin:0 0 8px;">Your AI workforce is standing by. 70+ team members, ready the second you are.</p>
  ${plan ? `<p style="font-size:15px;color:#71717a;line-height:1.6;margin:0 0 8px;">You're on the <strong style="color:#111113;">${planLabel}</strong> plan. ${planLine}</p>` : ''}
  <p style="font-size:15px;color:#71717a;line-height:1.6;margin:0 0 28px;">Content, sales, research, design, admin, and more. No interviews. No managing. No waiting.</p>
  <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;">Go to your dashboard →</a>
  <div style="margin-top:40px;padding-top:32px;border-top:1px solid #f4f4f5;">
    <p style="font-size:14px;font-weight:600;color:#111113;margin:0 0 12px;">Get started in 3 steps:</p>
    <p style="font-size:14px;color:#71717a;margin:0 0 8px;line-height:1.6;">1. Browse your team at <a href="${teamUrl}" style="color:#2563eb;text-decoration:none;">Dashboard → Team Members</a></p>
    <p style="font-size:14px;color:#71717a;margin:0 0 8px;line-height:1.6;">2. Pick one and describe your task</p>
    <p style="font-size:14px;color:#71717a;margin:0;line-height:1.6;">3. Get your output in 60 seconds</p>
  </div>
  <hr style="border:none;border-top:1px solid #f4f4f5;margin:32px 0;">
  <p style="font-size:12px;color:#a1a1aa;margin:0;">© 2026 Goat Labs LLC · <a href="https://3rdshift.ai" style="color:#a1a1aa;text-decoration:none;">3rdshift.ai</a> · <a href="https://3rdshift.ai/terms" style="color:#a1a1aa;text-decoration:none;">Terms</a></p>
</div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '3rdShift <hello@3rdshift.ai>',
        to: [email],
        subject: 'Welcome to 3rdShift 🎉',
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error:', data);
      return NextResponse.json({ error: 'Email failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error: unknown) {
    console.error('Welcome email error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
