import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { forgotPasswordSchema } from '@/src/schema/auth.schema';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function recoveryEmailHtml(actionLink: string) {
  return `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#ffffff;">
  <div style="margin-bottom:32px;">
    <img src="https://3rdshift.ai/logo-hq.png" alt="3rdShift" style="height:32px;width:auto;" />
  </div>
  <h1 style="font-size:28px;font-weight:800;color:#111113;margin:0 0 12px;letter-spacing:-0.02em;">Reset your 3rdShift password</h1>
  <p style="font-size:15px;color:#71717a;line-height:1.6;margin:0 0 28px;">Use the secure link below to create a new password. This link expires automatically.</p>
  <a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;">Reset password →</a>
  <p style="font-size:13px;color:#71717a;line-height:1.6;margin:28px 0 0;">If you didn't request this, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #f4f4f5;margin:32px 0;">
  <p style="font-size:12px;color:#a1a1aa;margin:0;">© 2026 Goat Labs LLC · <a href="https://3rdshift.ai" style="color:#a1a1aa;text-decoration:none;">3rdshift.ai</a> · <a href="https://3rdshift.ai/terms" style="color:#a1a1aa;text-decoration:none;">Terms</a></p>
</div>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse({ email: body?.email });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid email' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const resendApiKey = process.env.RESEND_API_KEY;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai').replace(/\/$/, '');
    const resetRedirectUrl = `${siteUrl}/reset-password`;

    if (!resendApiKey) {
      console.error('[password-reset] RESEND_API_KEY is missing');
      return NextResponse.json({ error: 'Email service unavailable' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: resetRedirectUrl,
      },
    });

    if (error) {
      const message = error.message || '';

      // Match Supabase's anti-enumeration behavior: do not reveal whether an
      // address exists. Log server-side for operators, but show success.
      if (/not\s+found|no\s+user|user.*exist/i.test(message)) {
        console.warn('[password-reset] Recovery requested for unknown email');
        return NextResponse.json({ ok: true });
      }

      console.error('[password-reset] Supabase generateLink failed:', message);
      return NextResponse.json({ error: 'Error sending recovery email' }, { status: 500 });
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      console.error('[password-reset] Supabase generateLink returned no action_link');
      return NextResponse.json({ error: 'Error sending recovery email' }, { status: 500 });
    }

    const resendResponse = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '3rdShift <hello@3rdshift.ai>',
        to: [email],
        subject: 'Reset your 3rdShift password',
        html: recoveryEmailHtml(actionLink),
      }),
    });

    const resendData = await resendResponse.json().catch(() => null);

    if (!resendResponse.ok) {
      console.error('[password-reset] Resend error:', resendData);
      return NextResponse.json({ error: 'Error sending recovery email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: resendData?.id });
  } catch (error) {
    console.error('[password-reset] Unexpected error:', error);
    return NextResponse.json({ error: 'Error sending recovery email' }, { status: 500 });
  }
}
