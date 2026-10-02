import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { workerSlug, action } = await request.json();
  if (!workerSlug || !['pin', 'unpin'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (action === 'pin') {
    // Enforce max 5 pins
    const { data: existing } = await supabaseAdmin
      .from('pinned_workers')
      .select('id')
      .eq('workspace_id', workspaceId)
      .order('pinned_at', { ascending: true });

    if (existing && existing.length >= 5) {
      return NextResponse.json({ error: 'Max 5 pinned workers allowed' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('pinned_workers')
      .upsert({ user_id: userId, workspace_id: workspaceId, worker_slug: workerSlug, pinned_at: new Date().toISOString() }, { onConflict: 'user_id,worker_slug' });

    if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    return NextResponse.json({ success: true, action: 'pinned' });
  } else {
    const { error } = await supabaseAdmin
      .from('pinned_workers')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('worker_slug', workerSlug);

    if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    return NextResponse.json({ success: true, action: 'unpinned' });
  }
}
