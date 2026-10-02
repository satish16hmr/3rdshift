import { NextRequest, NextResponse } from 'next/server';
import { requireUser, supabaseAdmin } from '@/lib/api-auth';
import { escapeHtml, stripHtml } from '@/lib/security';

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { subject: string; message: string; context?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { subject, message, context } = body;
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }

  // Get user email for notification purposes
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  const { data, error } = await supabaseAdmin
    .from('support_requests')
    .insert({
      user_id: userId,
      user_email: profile?.email || null,
      subject: subject.trim().slice(0, 200),
      message: message.trim().slice(0, 5000),
      context: context?.slice(0, 2000) || null,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Support request error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }

  // Send notification email to support@3rdshift.ai
  try {
    const userEmail = profile?.email || 'unknown';
    const safeUserEmail = escapeHtml(userEmail);
    const safeSubject = escapeHtml(subject.trim());
    const safeMessage = escapeHtml(message.trim());
    const safeContext = context ? escapeHtml(context) : '';
    const safeEmailSubject = stripHtml(subject).trim().slice(0, 80);
    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#ffffff;">
  <div style="margin-bottom:24px;">
    <img src="https://3rdshift.ai/logo-hq.png" alt="3rdShift" style="height:28px;width:auto;" />
  </div>
  <h2 style="font-size:20px;font-weight:700;color:#111113;margin:0 0 4px;">New Support Request</h2>
  <p style="font-size:13px;color:#71717a;margin:0 0 24px;">${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:8px 12px;background:#f4f4f5;font-size:12px;font-weight:600;color:#71717a;width:100px;border-radius:4px 0 0 4px;">FROM</td>
      <td style="padding:8px 12px;background:#fafafa;font-size:13px;color:#111113;">${safeUserEmail}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f4f4f5;font-size:12px;font-weight:600;color:#71717a;">SUBJECT</td>
      <td style="padding:8px 12px;background:#fafafa;font-size:13px;color:#111113;">${safeSubject}</td>
    </tr>
  </table>

  <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="font-size:12px;font-weight:600;color:#71717a;margin:0 0 8px;text-transform:uppercase;">Message</p>
    <p style="font-size:14px;color:#111113;line-height:1.6;margin:0;white-space:pre-wrap;">${safeMessage}</p>
  </div>

  ${context ? `<div style="background:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;padding:16px;">
    <p style="font-size:12px;font-weight:600;color:#71717a;margin:0 0 8px;text-transform:uppercase;">JARVIS Context</p>
    <p style="font-size:13px;color:#71717a;line-height:1.6;margin:0;white-space:pre-wrap;">${safeContext}</p>
  </div>` : ''}

  <hr style="border:none;border-top:1px solid #f4f4f5;margin:28px 0 16px;">
  <p style="font-size:12px;color:#a1a1aa;margin:0;">Reply directly to this email to respond to ${safeUserEmail}</p>
</div>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '3rdShift Support <hello@3rdshift.ai>',
        to: ['support@3rdshift.ai'],
        reply_to: userEmail !== 'unknown' ? userEmail : undefined,
        subject: `[Support] ${safeEmailSubject}`,
        html,
      }),
    });
  } catch (emailErr) {
    // Non-fatal — request is already saved, just log the email failure
    console.error('Support notification email failed:', emailErr);
  }

  return NextResponse.json({ success: true, id: data.id });
}
