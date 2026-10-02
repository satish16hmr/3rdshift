import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R12: owner-only — role check before plan check
  // Token stored under owner's userId (correct since only owner can connect integrations)
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  // Check Pro+ plan — workspace owner's plan
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan === 'starter') {
    return NextResponse.json({ error: 'Notion integration requires a Pro plan or higher.' }, { status: 403 });
  }

  const state = crypto.randomUUID();

  // Store pending state in notion_tokens table
  await supabaseAdmin.from('notion_tokens').upsert({
    user_id: userId,
    access_token: `pending:${state}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  const clientId = process.env.NOTION_CLIENT_ID!.trim();
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL!.trim()}/api/notion/auth/callback`;

  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return NextResponse.json({ url });
}
