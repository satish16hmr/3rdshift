import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveWorkspaceId } from './workspace';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAdminKey = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();

if (!supabaseUrl || !supabaseAdminKey) {
  console.error('[supabase-admin] Missing Supabase admin configuration', {
    hasUrl: Boolean(supabaseUrl),
    hasAdminKey: Boolean(supabaseAdminKey),
  });
}

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseAdminKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Verify the Supabase JWT without requiring a workspace.
 * Use this for account-scoped routes such as billing portal, cancellation,
 * JARVIS, and support where missing workspace state should not block access.
 */
export async function requireUser(
  req: NextRequest
): Promise<{ userId: string; userEmail: string | null } | NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return { userId: user.id, userEmail: user.email ?? null };
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ userId: string; userEmail: string | null } | NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!adminIds.includes(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { userId: user.id, userEmail: user.email ?? null };
}

/**
 * Verify the Supabase JWT from the Authorization header.
 * Returns { userId, workspaceId } on success, or a 401 NextResponse on failure.
 * workspaceId is resolved from x-workspace-id header or user's default workspace.
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ userId: string; workspaceId: string } | NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve workspace: prefer x-workspace-id header, fall back to user's default
  const preferredWorkspaceId = req.headers.get('x-workspace-id');
  const workspaceId = await getActiveWorkspaceId(user.id, preferredWorkspaceId);

  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 403 });
  }

  return { userId: user.id, workspaceId };
}

export { supabaseAdmin };
