import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

const PAGE_SIZE = 1000;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { workspaceId } = auth;
  const counts: Record<string, number> = {};
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('worker_slug')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .not('worker_slug', 'is', null)
      .range(from, to);

    if (error) {
      console.error('[worker-task-counts] Failed to load counts', error);
      return NextResponse.json({ error: 'Failed to fetch worker task counts' }, { status: 500 });
    }

    for (const row of data ?? []) {
      const slug = row.worker_slug;
      if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
    }

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return NextResponse.json({ counts });
}
