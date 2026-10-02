/**
 * /api/cron/poll-video
 * Polls Atlas Cloud for pending video generation jobs and completes them.
 * Called by Vercel Cron every 2 minutes + triggered immediately after task creation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { atlasPollVideo, atlasDownloadVideo } from '@/lib/atlascloud';
import { logExternalAPICall } from '@/lib/ai/callAI';
import { verifyCronRequest } from '@/lib/cron-auth';
import { refundCredits as ledgerRefund } from '@/lib/credits/ledger';

const VIDEO_POLL_TIMEOUT_MS = 15 * 60 * 1000;

function getSupabase() {
  return supabaseAdmin;
}

type PendingVideoTask = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  worker_slug: string;
  output: Record<string, unknown> | null;
  credits_charged: number | null;
};

async function refundTaskCredits(supabase: ReturnType<typeof getSupabase>, task: PendingVideoTask) {
  // Phase 23 Step 4: refund to credit OWNER (workspace owner), not caller.
  // referenceType: 'task' matches the original debit (INV-4).
  const workerRegistry = await import('@/lib/workers/registry').then(m => m.getWorkerBySlug(task.worker_slug));
  const creditCost = task.credits_charged ?? workerRegistry?.creditCost ?? 3;

  let creditOwnerId = task.user_id;
  if (task.workspace_id) {
    const { data: ws } = await supabase
      .from('workspaces').select('owner_id').eq('id', task.workspace_id).single();
    creditOwnerId = ws?.owner_id ?? task.user_id;
  }

  const refund = await ledgerRefund({
    userId: creditOwnerId,
    amount: creditCost,
    referenceId: task.id,
    referenceType: 'task',
    workspaceId: task.workspace_id ?? null,
  });
  if (refund.ok || refund.errorCode === 'no_original_debit') {
    await supabase.from('tasks').update({ refund_applied: true }).eq('id', task.id);
  }
}

export async function POST(req: NextRequest) {
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const supabase = getSupabase();

  // Find all pending video tasks
  const { data: pendingTasks, error } = await supabase
    .from('tasks')
    .select('id, user_id, workspace_id, worker_slug, output, credits_charged')
    .in('worker_slug', ['product-video-creator', 'b-roll-generator', 'scene-director', 'ad-creative-generator'])
    .eq('status', 'processing')
    .not('output->prediction_id', 'is', null)
    .limit(10);

  if (error) {
    console.error('poll-video: pending video query failed:', error);
    return NextResponse.json({ error: 'pending_video_query_failed', message: error.message }, { status: 500 });
  }

  if (!pendingTasks?.length) {
    return NextResponse.json({ processed: 0 });
  }

  let completed = 0, failed = 0, pending = 0;

  for (const task of pendingTasks) {
    const predictionId = task.output?.prediction_id;
    if (!predictionId) {
      // prediction_id not yet saved — task may still be starting up, skip
      pending++;
      continue;
    }

    try {
      const pollResult = await atlasPollVideo(predictionId);

      if (pollResult.status === 'completed' && pollResult.videoUrl) {
        // Download video
        const videoBuffer = await atlasDownloadVideo(pollResult.videoUrl);

        // Store in Supabase Storage
        const scope = task.workspace_id || task.user_id;
        const videoPath = `${scope}/${task.worker_slug}/${task.id}.mp4`;
        const { error: storageErr } = await supabase.storage
          .from('video-outputs')
          .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: true });

        if (storageErr) throw new Error('Storage upload failed: ' + storageErr.message);

        const { data: signedData } = await supabase.storage
          .from('video-outputs')
          .createSignedUrl(videoPath, 60 * 60 * 24 * 30); // 30 days

        const workerLabels: Record<string, string> = {
          'product-video-creator': 'Product Video',
          'b-roll-generator': 'B-Roll Clip',
          'scene-director': 'Directed Scene',
          'ad-creative-generator': 'Ad Creative',
        };

        await supabase.from('tasks').update({
          status: 'completed',
          output: {
            text: `**${workerLabels[task.worker_slug] || 'Video'} ready.** Your MP4 is below.`,
            format: 'video',
            video_url: signedData?.signedUrl || '',
            video_path: videoPath,
            video_filename: `${task.worker_slug}-${task.id}.mp4`,
            provider_response: pollResult.providerResponse,
          },
          output_format: 'video',
          model_used: 'kling-v3.0',
          completed_at: new Date().toISOString(),
        }).eq('id', task.id);

        completed++;

      } else if (pollResult.status === 'failed' || pollResult.error) {
        try {
          await refundTaskCredits(supabase, task);
        } catch { /* best effort */ }

        await supabase.from('tasks').update({
          status: 'failed',
          output: {
            error: `Video generation failed. Your credits have been refunded.`,
            provider_response: pollResult.providerResponse,
          },
          error_message: pollResult.error || 'Video generation failed',
        }).eq('id', task.id);
        failed++;

      } else {
        // Still processing — keep waiting briefly, then fail/refund limboed predictions.
        // Normal Atlas video completion is ~2 minutes; 15 minutes is a generous stuck safety net.
        const { data: taskRecord } = await supabase.from('tasks').select('created_at').eq('id', task.id).single();
        if (taskRecord?.created_at && Date.now() - new Date(taskRecord.created_at).getTime() > VIDEO_POLL_TIMEOUT_MS) {
          try {
            await refundTaskCredits(supabase, task);
          } catch { /* best effort */ }

          await supabase.from('tasks').update({
            status: 'failed',
            output: { ...(task.output || {}), error: 'Video generation timed out after 15 minutes. Your credits have been refunded. Please try again.' },
            error_message: 'Stuck prediction timeout',
          }).eq('id', task.id);
          failed++;
        } else {
          pending++;
        }
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Unknown error';
      const providerResponse = err && typeof err === 'object' && 'providerResponse' in err
        ? (err as { providerResponse?: unknown }).providerResponse
        : null;
      logExternalAPICall({
        user_id: task.user_id,
        task_id: task.id,
        worker_id: task.worker_slug,
        provider: 'atlascloud',
        success: false,
        latency_ms: 0,
        metadata: { error: rawMsg, provider_response: providerResponse },
      });
      // Phase 23 Step 4: refund to credit OWNER, referenceType: 'task' (INV-4)
      try {
        await refundTaskCredits(supabase, task);
      } catch { /* best effort */ }

      // Preserve existing output (including prediction_id) when writing error
      await supabase.from('tasks').update({
        status: 'failed',
        output: { ...(task.output || {}), error: `Video generation failed. Your credits have been refunded.`, provider_response: providerResponse },
        error_message: rawMsg,
      }).eq('id', task.id);
      failed++;
    }
  }

  return NextResponse.json({ processed: pendingTasks.length, completed, failed, pending });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
