export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getChatIntro } from '@/lib/chat-intros';

// POST /api/chat/intro
// Body: { member_id: string }
//
// Checks if this user has ZERO messages with this member.
// If so, inserts the intro as the member's first message and returns it.
// If messages already exist, returns { intro: null } — client skips.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let body: { member_id: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { member_id } = body;
  if (!member_id) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 });
  }

  // Get intro text for this slug
  const introText = getChatIntro(member_id);
  if (!introText) {
    // No intro defined for this member — return null silently
    return NextResponse.json({ intro: null });
  }

  // Check existing message count for this workspace + member
  const { count } = await supabaseAdmin
    .from('team_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('member_id', member_id);

  if ((count ?? 0) > 0) {
    // Already has messages — don't fire intro again
    return NextResponse.json({ intro: null });
  }

  // Insert intro as the member's first message
  const { data: inserted, error } = await supabaseAdmin
    .from('team_chat_messages')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      member_id,
      role: 'member',
      content: introText,
    })
    .select('id, role, content, created_at')
    .single();

  if (error) {
    console.error('chat/intro insert error:', error);
    return NextResponse.json({ error: 'Failed to insert intro' }, { status: 500 });
  }

  return NextResponse.json({ intro: inserted });
}
