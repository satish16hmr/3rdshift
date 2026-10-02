import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptToken } from '@/lib/crypto';

function getPlan(profile: { plan: string; is_founding_member: boolean; founding_tier: string | null } | null): string {
  if (!profile) return 'starter';
  return profile.is_founding_member ? (profile.founding_tier || 'starter') : profile.plan;
}

// Simple markdown → HTML for email (Mailchimp friendly)
function markdownToEmailHtml(markdown: string): string {
  let html = markdown;
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-family:sans-serif;color:#111113;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-family:sans-serif;color:#111113;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-family:sans-serif;color:#111113;">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />');
  html = html.replace(/((?:^[-*] .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[-*] /, '').trim()}</li>`).join('');
    return `<ul style="font-family:sans-serif;color:#111113;">${items}</ul>`;
  });
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.match(/^<(h[1-6]|ul|ol|hr)/)) return trimmed;
    return `<p style="font-family:sans-serif;color:#111113;line-height:1.6;">${trimmed.replace(/\n/g, '<br />')}</p>`;
  }).filter(Boolean).join('\n');
  return html;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, is_founding_member, founding_tier')
    .eq('id', userId)
    .single();

  if (getPlan(profile) === 'starter') {
    return NextResponse.json({ error: 'Mailchimp integration requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  const { data: tokenRow } = await supabaseAdmin
    .from('mailchimp_tokens')
    .select('access_token, dc')
    .eq('user_id', userId)
    .single();

  if (!tokenRow?.access_token || tokenRow.access_token.startsWith('pending:')) {
    return NextResponse.json({ error: 'Mailchimp not connected.', not_connected: true }, { status: 403 });
  }

  // Phase 5: decrypt token (handles enc: prefix and plaintext lazy-migration)
  const decryptedAccessToken = await decryptToken(tokenRow.access_token);

  let body: { taskId?: string; campaign_name?: string; subject_line?: string; from_name?: string; reply_to?: string; list_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { taskId, campaign_name, subject_line, from_name, reply_to, list_id } = body;
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('output, edited_output, status')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  // Prefer edited_output (already HTML from Tiptap); otherwise convert markdown
  const htmlContent = task.edited_output || markdownToEmailHtml(task.output?.text || '');
  const dc = tokenRow.dc || 'us1';
  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  const headers = {
    'Authorization': `Bearer ${decryptedAccessToken}`,
    'Content-Type': 'application/json',
  };

  // Build campaign payload
  const campaignPayload: Record<string, unknown> = {
    type: 'regular',
    settings: {
      subject_line: subject_line || campaign_name || 'New Campaign',
      title: campaign_name || 'New Campaign',
      from_name: from_name || '3rdShift',
      reply_to: reply_to || '',
    },
  };
  if (list_id) {
    campaignPayload.recipients = { list_id };
  }

  // Create campaign
  const campaignRes = await fetch(`${baseUrl}/campaigns`, {
    method: 'POST',
    headers,
    body: JSON.stringify(campaignPayload),
  });

  if (!campaignRes.ok) {
    const errData = await campaignRes.json().catch(() => ({}));
    console.error('Mailchimp campaign create error:', errData);
    return NextResponse.json({ error: 'Failed to create Mailchimp campaign. Check your Mailchimp connection.' }, { status: 500 });
  }

  const campaign = await campaignRes.json();
  const campaignId = campaign.id;

  // Set campaign content
  const contentRes = await fetch(`${baseUrl}/campaigns/${campaignId}/content`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ html: htmlContent }),
  });

  if (!contentRes.ok) {
    const errData = await contentRes.json().catch(() => ({}));
    console.error('Mailchimp campaign content error:', errData);
    return NextResponse.json({ error: errData.detail || errData.title || 'Campaign draft was created but Mailchimp rejected the content.' }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    campaign_id: campaignId,
    campaign_url: `https://${dc}.admin.mailchimp.com/campaigns/edit?id=${campaignId}`,
    status: 'draft',
    message: 'Campaign draft created in Mailchimp.',
  });
}

// GET — fetch Mailchimp audience lists
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data: tokenRow } = await supabaseAdmin
    .from('mailchimp_tokens')
    .select('access_token, dc')
    .eq('user_id', userId)
    .single();

  if (!tokenRow?.access_token || tokenRow.access_token.startsWith('pending:')) {
    return NextResponse.json({ lists: [] });
  }

  // Phase 5: decrypt token (handles enc: prefix and plaintext lazy-migration)
  const listAccessToken = await decryptToken(tokenRow.access_token);

  const dc = tokenRow.dc || 'us1';
  const listsRes = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists?count=100`, {
    headers: { 'Authorization': `Bearer ${listAccessToken}` },
  });

  if (!listsRes.ok) return NextResponse.json({ lists: [] });

  const listsData = await listsRes.json();
  return NextResponse.json({
    lists: (listsData.lists || []).map((l: { id: string; name: string; stats?: { member_count?: number } }) => ({
      id: l.id,
      name: l.name,
      member_count: l.stats?.member_count || 0,
    })),
  });
}
