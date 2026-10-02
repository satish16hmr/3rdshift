import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { encryptToken } from '@/lib/crypto';

// POST /api/buffer/connect — save and test a Buffer personal API key
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R10: owner-only — role check before plan check
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;
  const { userId } = roleAuth;

  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan === 'starter') {
    return NextResponse.json({ error: 'Buffer integration requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  let body: { api_key: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { api_key } = body;
  if (!api_key?.trim()) {
    return NextResponse.json({ error: 'api_key is required' }, { status: 400 });
  }

  // Step 1: verify key and get org ID
  const accountRes = await fetch('https://api.buffer.com/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${api_key.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ account { id organizations { id name } } }' }),
  });

  if (!accountRes.ok) {
    return NextResponse.json({ error: 'Invalid API key — could not connect to Buffer.' }, { status: 400 });
  }

  const accountData = await accountRes.json();
  if (accountData.errors || !accountData.data?.account) {
    return NextResponse.json({ error: 'Invalid API key — Buffer rejected it.' }, { status: 400 });
  }

  const orgId = accountData.data.account.organizations?.[0]?.id;

  // Step 2: get channels
  let channels: { id: string; name: string; service: string }[] = [];
  if (orgId) {
    const channelsRes = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${api_key.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ channels(input: { organizationId: "${orgId}" }) { id name service } }` }),
    });
    if (channelsRes.ok) {
      const channelsData = await channelsRes.json();
      channels = (channelsData.data?.channels || []).map((ch: { id: string; name: string; service: string }) => ({
        id: ch.id, name: ch.name, service: ch.service?.toLowerCase() || 'unknown',
      }));
    }
  }

  // Encrypt and store the key
  const encrypted = await encryptToken(api_key.trim());

  await supabaseAdmin.from('buffer_tokens').upsert({
    user_id: userId,
    workspace_id: workspaceId,
    access_token: encrypted,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }); // P8-6: match actual UNIQUE constraint (user_id, not workspace_id)

  return NextResponse.json({
    success: true,
    connected: true,
    channels,
    masked: `••••${api_key.trim().slice(-4)}`,
  });
}

// DELETE /api/buffer/connect — disconnect Buffer
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R10: owner-only
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  await supabaseAdmin.from('buffer_tokens').delete().eq('workspace_id', workspaceId);

  return NextResponse.json({ success: true });
}
