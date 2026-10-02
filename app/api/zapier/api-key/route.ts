import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { randomBytes } from 'crypto';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { encryptToken, hashApiKey, maskApiKey } from '@/lib/crypto';

function generateApiKey(): string {
  return '3rdshift_' + randomBytes(24).toString('hex');
}

// GET — fetch current API key (or check if one exists)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { workspaceId } = auth;

  // R6: owner-only — role check before plan check
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  // Check plan — workspace owner's plan
  const plan = await getWorkspaceOwnerPlan(workspaceId);

  if (plan !== 'operator') {
    return NextResponse.json({ plan, is_operator: false, api_key: null });
  }

  const { data: keyRow } = await supabaseAdmin
    .from('zapier_api_keys')
    .select('api_key, api_key_hash, masked_key, created_at, active')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .single();

  // Phase 5: return masked_key for display (raw key is encrypted at rest)
  // masked_key is populated at generation time; null for pre-Phase-5 rows until backfill runs
  return NextResponse.json({
    plan,
    is_operator: true,
    api_key: keyRow?.masked_key || null,  // masked display value, not raw key
    created_at: keyRow?.created_at || null,
  });
}

// POST — generate or regenerate API key
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { workspaceId } = auth;

    // R6: owner-only — role check before plan check
    const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
    if (roleAuth instanceof NextResponse) return roleAuth;
    const { userId } = roleAuth;

    // Check plan — workspace owner's plan
    const plan = await getWorkspaceOwnerPlan(workspaceId);

    if (plan !== 'operator') {
      return NextResponse.json({ error: 'Zapier integration requires an Operator plan.' }, { status: 403 });
    }

    const { data: existingActive } = await supabaseAdmin
      .from('zapier_api_keys')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('active', true);

    // Generate new key
    const newKey = generateApiKey();

    // Phase 5: encrypt the key + compute hash for lookup + compute masked display
    const [encryptedKey, keyHash, maskedKey] = await Promise.all([
      encryptToken(newKey),
      Promise.resolve(hashApiKey(newKey)),
      Promise.resolve(maskApiKey(newKey)),
    ]);

    // Deactivate existing keys only after encryption succeeds. If insert fails,
    // restore previous active rows so a failed regeneration does not break Zapier.
    const { error: deactivateError } = await supabaseAdmin
      .from('zapier_api_keys')
      .update({ active: false })
      .eq('workspace_id', workspaceId);

    if (deactivateError) {
      console.error('Zapier API key deactivate error:', deactivateError);
      return NextResponse.json({ error: 'Failed to rotate existing API key.' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('zapier_api_keys')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        api_key: encryptedKey,      // encrypted at rest
        api_key_hash: keyHash,      // SHA-256 for lookup
        masked_key: maskedKey,      // display value
        active: true,
      })
      .select('masked_key, created_at')
      .single();

    if (error || !data) {
      if (existingActive?.length) {
        await supabaseAdmin
          .from('zapier_api_keys')
          .update({ active: true })
          .in('id', existingActive.map((row) => row.id));
      }
      console.error('Zapier API key generation error:', error);
      return NextResponse.json({ error: 'Failed to generate API key.' }, { status: 500 });
    }

    // Return the raw key ONCE (only time it's ever shown in plaintext)
    return NextResponse.json({ api_key: newKey, created_at: data.created_at });
  } catch (err) {
    console.error('Zapier API key generation exception:', err);
    return NextResponse.json({ error: 'Failed to generate API key.' }, { status: 500 });
  }
}
