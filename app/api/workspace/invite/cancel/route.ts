import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

// DELETE /api/workspace/invite/cancel?id=<invite_id>
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const inviteId = searchParams.get('id');

  if (!inviteId) {
    return NextResponse.json({ error: 'invite id required' }, { status: 400 });
  }

  // Verify the invite belongs to this workspace and user is owner
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('workspace_invites')
    .delete()
    .eq('id', inviteId)
    .eq('workspace_id', workspaceId);

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel invite' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
