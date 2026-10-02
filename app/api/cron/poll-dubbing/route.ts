/**
 * /api/cron/poll-dubbing
 * Polls ElevenLabs for pending dubbing jobs and completes them.
 * Called by Vercel Cron every 30 seconds (or triggered after task creation).
 * Also callable directly via POST for immediate polling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { elevenLabsPollDubbing, elevenLabsDownloadDubbing } from '@/lib/elevenlabs';
import { verifyCronRequest } from '@/lib/cron-auth';

function getSupabase() {
  return supabaseAdmin;
}

export async function POST(req: NextRequest) {
    const cronAuth = verifyCronRequest(req);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const supabase = getSupabase();

  // Find all tasks in 'processing' with dubbing_id in output
  const { data: pendingTasks, error } = await supabase
    .from('tasks')
    .select('id, user_id, workspace_id, output')
    .eq('worker_slug', 'content-translator')
    .eq('status', 'processing')
    .not('output->dubbing_id', 'is', null)
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pendingTasks || pendingTasks.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let completed = 0;
  let failed = 0;
  let pending = 0;

  for (const task of pendingTasks) {
    const dubbingId = task.output?.dubbing_id;
    const targetLanguage = task.output?.target_language || 'Spanish';

    if (!dubbingId) continue;

    try {
      const pollResult = await elevenLabsPollDubbing(dubbingId);

      if (pollResult.status === 'dubbed') {
        // Download the dubbed audio
        const dubbedBuffer = await elevenLabsDownloadDubbing(dubbingId, targetLanguage);

        // Store in Supabase Storage
        const audioFileName = `${task.workspace_id || task.user_id}/content-translator/${task.id}.mp3`;
        const { error: storageError } = await supabase.storage
          .from('audio-outputs')
          .upload(audioFileName, dubbedBuffer, { contentType: 'audio/mpeg', upsert: true });

        if (storageError) {
          throw new Error('Storage upload failed: ' + storageError.message);
        }

        await supabase.from('tasks').update({
          status: 'completed',
          output: {
            text: `**Translation complete.** Your dubbed audio is ready.\n\n---\n**Source language:** ${task.output?.source_language || 'English'}  \n**Target language:** ${targetLanguage}`,
            format: 'audio',
            audio_url: '',
            audio_path: audioFileName,
            audio_filename: `tala-dubbed-${task.id}.mp3`,
            source_language: task.output?.source_language,
            target_language: targetLanguage,
          },
          output_format: 'markdown',
          model_used: 'elevenlabs-dubbing-v1',
          completed_at: new Date().toISOString(),
        }).eq('id', task.id);

        completed++;

      } else if (pollResult.status === 'failed' || (pollResult as Record<string, unknown>).error) {
        await supabase.from('tasks').update({
          status: 'failed',
          output: { error: `Dubbing failed: ${(pollResult as Record<string, unknown>).error || 'Unknown error'}` },
          error_message: 'Dubbing failed',
        }).eq('id', task.id);
        failed++;

      } else {
        // Still processing
        pending++;

        // Check if task is too old (>10 minutes) — timeout
        // output has no created_at but task does
        const { data: taskRecord } = await supabase
          .from('tasks')
          .select('created_at')
          .eq('id', task.id)
          .single();

        if (taskRecord?.created_at) {
          const ageMs = Date.now() - new Date(taskRecord.created_at).getTime();
          if (ageMs > 10 * 60 * 1000) {
            await supabase.from('tasks').update({
              status: 'failed',
              output: { error: 'Dubbing timed out. The file may be too long or the service is slow. Please try again.' },
              error_message: 'Dubbing timed out',
            }).eq('id', task.id);
            failed++;
            pending--;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await supabase.from('tasks').update({
        status: 'failed',
        output: { ...(task.output || {}), error: msg },
        error_message: msg,
      }).eq('id', task.id);
      failed++;
    }
  }

  return NextResponse.json({ processed: pendingTasks.length, completed, failed, pending });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
