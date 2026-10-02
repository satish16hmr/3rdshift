import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

// GET /api/chat/memories/[member_id] — get stored memories
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { member_id } = await params;

  const { data, error } = await supabaseAdmin
    .from('team_member_memories')
    .select('id, member_id, memory_type, content, created_at')
    .eq('workspace_id', workspaceId)
    .is('invalidated_at', null)
    .or(`member_id.eq.${member_id},member_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  // Separate per-member and brand memories
  const memberMemories = (data ?? []).filter((m) => m.member_id === member_id);
  const brandMemories = (data ?? []).filter((m) => m.member_id === null);

  return NextResponse.json({ member_memories: memberMemories, brand_memories: brandMemories });
}

// DELETE /api/chat/memories/[member_id] — delete a specific memory or all
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { member_id } = await params;
  const { searchParams } = new URL(req.url);
  const memoryId = searchParams.get('id');
  const deleteAll = searchParams.get('all') === 'true';

  if (memoryId) {
    // Delete specific memory by ID (soft delete via invalidated_at)
    const { error } = await supabaseAdmin
      .from('team_member_memories')
      .update({ invalidated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .eq('workspace_id', workspaceId);

    if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    return NextResponse.json({ deleted: memoryId });
  }

  if (deleteAll) {
    // Soft-delete all memories for this member
    const { error } = await supabaseAdmin
      .from('team_member_memories')
      .update({ invalidated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('member_id', member_id)
      .is('invalidated_at', null);

    if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    return NextResponse.json({ deleted: 'all', member_id });
  }

  return NextResponse.json({ error: 'Provide ?id=<uuid> or ?all=true' }, { status: 400 });
}
