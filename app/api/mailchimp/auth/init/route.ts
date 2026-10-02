import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R11: owner-only — role check before plan check
  // Token stored under owner's userId (correct since only owner can connect integrations)
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan === 'starter') {
    return NextResponse.json({ error: 'Mailchimp integration requires a Pro plan or higher.' }, { status: 403 });
  }

  const state = crypto.randomUUID();

  await supabaseAdmin.from('mailchimp_tokens').upsert({
    user_id: userId,
    access_token: `pending:${state}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  const clientId = process.env.MAILCHIMP_CLIENT_ID!.trim();
  const redirectUri = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai').trim()}/api/mailchimp/auth/callback`;

  const url = `https://login.mailchimp.com/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return NextResponse.json({ url });
}
