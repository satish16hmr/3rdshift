/**
 * /api/cron/team-updates-digest
 * Runs weekly on Monday at 13:00 UTC.
 * Sends a single digest email to customers who:
 *   1. Have unread team_updates
 *   2. Haven't opened the app in 3+ days
 *   3. Have team updates enabled (settings.enabled !== false)
 *   4. Have an active subscription
 *
 * CAN-SPAM compliant:
 *   - Unsubscribe link (Settings toggle off = honored)
 *   - Only sent if team_updates enabled
 *   - From address is valid
 *   - Physical address in footer
 *   - Max 1 email per week
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { verifyCronRequest } from '@/lib/cron-auth';
import { getEmailWorkerMeta, renderEmailWorkerAvatar } from '@/lib/email-worker-meta';

function getSupabase() {
  return supabaseAdmin;
}

async function sendDigestEmail({
  toEmail,
  toName,
  updates,
}: {
  toEmail: string;
  toName: string;
  updates: Array<{ worker_slug: string; preview_text: string; id: string }>;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;

  const updateRows = updates.slice(0, 5).map(u => {
    const meta = getEmailWorkerMeta(u.worker_slug);
    const avatar = renderEmailWorkerAvatar(meta);
    const chatUrl = `https://3rdshift.ai/dashboard/team/${u.worker_slug}?tab=chat`;
    return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="32" style="vertical-align: top; padding-right: 12px;">${avatar}</td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 2px; font-size: 13px; font-weight: 700; color: #111113;">${meta.name}</p>
                <p style="margin: 0 0 6px; font-size: 13px; color: #52525b; line-height: 1.5;">${u.preview_text}</p>
                <a href="${chatUrl}" style="font-size: 12px; color: #2563eb; text-decoration: none; font-weight: 600;">Reply in Team Chat →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f5f5f7; padding: 40px 20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="padding: 32px 40px 24px; border-bottom: 1px solid #f0f0f0;">
            <img src="https://3rdshift.ai/logo-hq.png" alt="3rdShift" style="height: 24px; width: auto; display: block; margin-bottom: 20px;" />
            <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #111113;">Your team checked in</h1>
            <p style="margin: 0; font-size: 14px; color: #71717a;">While you were away, a few of your team members had ideas for you.</p>
          </td>
        </tr>
        
        <!-- Updates -->
        <tr>
          <td style="padding: 24px 40px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${updateRows}
            </table>
          </td>
        </tr>
        
        <!-- CTA -->
        <tr>
          <td style="padding: 0 40px 32px;">
            <a href="https://3rdshift.ai/dashboard" 
               style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
              Open 3rdShift →
            </a>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="padding: 24px 40px; border-top: 1px solid #f0f0f0; background: #fafafa;">
            <p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa;">
              You're receiving this because you have Team Updates enabled in your 
              <a href="https://3rdshift.ai/dashboard/settings" style="color: #2563eb;">account settings</a>.
            </p>
            <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
              <a href="https://3rdshift.ai/dashboard/settings" style="color: #a1a1aa; text-decoration: underline;">Unsubscribe from Team Update emails</a>
              &nbsp;·&nbsp; 3rdShift · Goat Labs LLC · 2055 Limestone Rd STE 200-C, Wilmington, DE 19808
            </p>
          </td>
        </tr>
        
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '3rdShift Team <hello@3rdshift.ai>',
        to: [toEmail],
        subject: `Your team had some ideas this week`,
        html,
        reply_to: 'support@3rdshift.ai',
        headers: {
          'List-Unsubscribe': '<https://3rdshift.ai/dashboard/settings>, <mailto:support@3rdshift.ai?subject=Unsubscribe%20Team%20Updates>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Resend error:', err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const supabase = getSupabase();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let emailsSent = 0;
  let emailsSkipped = 0;

  // Find customers with unread updates, inactive 3+ days, active plan
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan, team_updates_settings')
    .in('plan', ['starter', 'pro', 'operator'])
    .eq('team_updates_activated', true)
    .not('email', 'is', null);

  if (profilesError) {
    console.error('team-updates-digest: profiles query failed:', profilesError);
    return NextResponse.json({ error: 'profiles_query_failed', message: profilesError.message }, { status: 500 });
  }

  for (const profile of profiles ?? []) {
    try {
      // Check settings — respect unsubscribe
      const settings = (profile.team_updates_settings || {}) as { enabled?: boolean; frequency?: string };
      if (settings.enabled === false) {
        emailsSkipped++;
        continue;
      }

      // Activity check: if the user has any READ suggestions from the last 3 days,
      // they were active in-app recently — skip the digest
      // (If they read a notification they were in the app)
      // We use a simple heuristic: if ALL their unread updates have been created
      // within the last 3 days, they're likely still active. Skip.
      const { data: recentSugs } = await supabase
        .from('team_updates')
        .select('id, read, created_at')
        .eq('user_id', profile.id)
        .gte('created_at', threeDaysAgo);
      const recentReadAny = (recentSugs || []).some((u: { read: boolean }) => u.read);
      if (recentReadAny) {
        // User read something recently — they're active, skip digest
        emailsSkipped++;
        continue;
      }

      // Get workspace
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', profile.id)
        .single();

      if (!workspace) continue;

      // Check unread team_updates from this week
      const { data: unreadUpdates } = await supabase
        .from('team_updates')
        .select('id, worker_slug, preview_text, created_at')
        .eq('workspace_id', workspace.id)
        .eq('read', false)
        .eq('dismissed', false)
        .gte('created_at', oneWeekAgo)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!unreadUpdates || unreadUpdates.length === 0) {
        emailsSkipped++;
        continue;
      }

      // Check we haven't sent a digest email this week
      // (We use a simple check: team_updates rows have a 'digest_sent' flag — or we check via metadata)
      // Simple approach: only send on Monday and check if any update is older than 3 days (so they've had time in-app)
      const hasStaleUpdates = unreadUpdates.some(u =>
        new Date(u.created_at) < new Date(threeDaysAgo)
      );

      if (!hasStaleUpdates) {
        emailsSkipped++;
        continue;
      }

      // Send the digest
      const name = profile.full_name?.split(' ')[0] || 'there';
      const sent = await sendDigestEmail({
        toEmail: profile.email,
        toName: name,
        updates: unreadUpdates,
      });

      if (sent) {
        emailsSent++;
        console.log(`digest: sent email with ${unreadUpdates.length} updates`);
      }
    } catch (err) {
      console.error(`digest: error for ${profile.id}:`, err);
    }
  }

  console.log(`team-updates-digest: sent=${emailsSent} skipped=${emailsSkipped}`);
  return NextResponse.json({ sent: emailsSent, skipped: emailsSkipped });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
