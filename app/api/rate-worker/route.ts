import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { workerSlug, taskId, rating, feedback } = await request.json();

  if (!workerSlug || rating === undefined || rating === null) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Normalize: boolean true=5 (good), false=1 (bad) — keeps within existing 1-5 check constraint
  const ratingInt = typeof rating === 'boolean' ? (rating ? 5 : 1) : rating;

  // M07 / Item 10 fix: if taskId provided, verify task ownership before inserting rating
  if (taskId) {
    const { data: taskRow } = await supabaseAdmin
      .from('tasks')
      .select('user_id, workspace_id')
      .eq('id', taskId)
      .single();
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const ownsTask = taskRow.user_id === userId ||
      (taskRow.workspace_id && taskRow.workspace_id === workspaceId);
    if (!ownsTask) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  // Save rating
  const { error } = await supabaseAdmin
    .from('worker_ratings')
    .insert({ user_id: userId, workspace_id: workspaceId, worker_slug: workerSlug, task_id: taskId || null, rating: ratingInt, feedback: feedback || null });

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  // Fire-and-forget: generate preference summary from all ratings for this user+worker
  try {
    const { data: allRatings } = await supabaseAdmin
      .from('worker_ratings')
      .select('rating, feedback, created_at')
      .eq('workspace_id', workspaceId)
      .eq('worker_slug', workerSlug)
      .order('created_at', { ascending: false })
      .limit(20);

    if (allRatings && allRatings.length >= 2) {
      const ratingSummary = allRatings
        .map(r => `Rating: ${r.rating >= 4 ? 'Good 👍' : 'Needs work 👎'}${r.feedback ? `. Feedback: "${r.feedback}"` : ''}`)
        .join('\n');

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: 'You extract concise preference summaries from worker ratings. Be specific and actionable. Return only 1-2 sentences.',
        messages: [{
          role: 'user',
          content: `Based on these ratings for worker "${workerSlug}", summarize what this user likes and dislikes:\n\n${ratingSummary}`
        }],
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

      if (summary) {
        // Upsert into worker_memory as preferences type
        const { data: existing } = await supabaseAdmin
          .from('worker_memory')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('worker_slug', workerSlug)
          .eq('memory_type', 'preferences')
          .single();

        if (existing) {
          await supabaseAdmin
            .from('worker_memory')
            .update({ content: summary, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabaseAdmin
            .from('worker_memory')
            .insert({ user_id: userId, workspace_id: workspaceId, worker_slug: workerSlug, memory_type: 'preferences', content: summary });
        }
      }
    }
  } catch (err) {
    console.error('Rating preference summary failed (non-critical):', err);
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { searchParams } = new URL(request.url);
  const workerSlug = searchParams.get('workerSlug');
  const taskId = searchParams.get('taskId');

  if (!workerSlug || !taskId) {
    return NextResponse.json({ error: 'workerSlug and taskId required' }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from('worker_ratings')
    .select('rating, feedback')
    .eq('workspace_id', workspaceId)
    .eq('worker_slug', workerSlug)
    .eq('task_id', taskId)
    .single();

  return NextResponse.json({ existing: data || null });
}
