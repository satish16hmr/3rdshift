import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { verifyCronRequest } from '@/lib/cron-auth';

// Picks up pending tasks created by Zapier (or any source) and executes them
// Runs every minute via Vercel cron
export async function GET(req: NextRequest) {
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  // Find tasks stuck in pending for more than 10 seconds (Zapier-created tasks)
  const cutoff = new Date(Date.now() - 10 * 1000).toISOString();
  const { data: pendingTasks, error: pendingError } = await supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(5);

  if (pendingError) {
    console.error('[cron/process-pending] pending tasks query failed:', pendingError);
    return NextResponse.json({ error: 'pending_tasks_query_failed', message: pendingError.message }, { status: 500 });
  }

  if (!pendingTasks || pendingTasks.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';

  // Execute each pending task
  const results = await Promise.allSettled(
    pendingTasks.map(task =>
      fetch(`${baseUrl}/api/execute-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
        },
        body: JSON.stringify({ taskId: task.id }),
      })
    )
  );

  const processed = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[cron/process-pending] processed ${processed}/${pendingTasks.length} pending tasks`);

  return NextResponse.json({ processed, total: pendingTasks.length });
}
