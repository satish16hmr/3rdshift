import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { decryptToken } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  const { data: tokenRow } = await supabaseAdmin
    .from('buffer_tokens')
    .select('access_token')
    .eq('workspace_id', workspaceId)
    .single();

  const stored = tokenRow?.access_token;
  const connected = !!stored && !stored.startsWith('pending:');

  if (!connected) {
    return NextResponse.json({ connected: false, channels: [], masked: null });
  }

  // Decrypt the stored key — if this succeeds, we're connected (key is saved)
  let apiKey: string;
  let masked: string;
  try {
    apiKey = await decryptToken(stored);
    masked = `••••${apiKey.slice(-4)}`;
  } catch {
    // Key couldn't be decrypted — treat as not connected
    return NextResponse.json({ connected: false, channels: [], masked: null });
  }

  // Fetch channels from Buffer GraphQL API (non-critical — failures don't mean disconnected)
  let channels: { id: string; name: string; service: string }[] = [];
  try {
    const accountRes = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ account { id organizations { id } } }' }),
      signal: AbortSignal.timeout(8000),
    });
    const accountData = accountRes.ok ? await accountRes.json() : null;
    const orgId = accountData?.data?.account?.organizations?.[0]?.id;

    if (orgId) {
      const channelsRes = await fetch('https://api.buffer.com/graphql', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{ channels(input: { organizationId: "${orgId}" }) { id name service } }` }),
        signal: AbortSignal.timeout(8000),
      });
      if (channelsRes.ok) {
        const data = await channelsRes.json();
        channels = (data.data?.channels || []).map((ch: { id: string; name: string; service: string }) => ({
          id: ch.id, name: ch.name, service: ch.service?.toLowerCase() || 'unknown',
        }));
      }
    }
  } catch {
    // Buffer API unreachable or timed out — still connected, just no channel data
    console.warn('Buffer API fetch failed during status check — key is still saved');
  }

  return NextResponse.json({ connected: true, channels, masked });
}
