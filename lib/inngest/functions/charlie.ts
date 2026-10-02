/**
 * Inngest function: Charlie — Course Architect (all modes)
 *
 * Runs course generation as a background job with no timeout ceiling.
 * Replaces the synchronous Vercel execution path when USE_INNGEST_FOR_CHARLIE=true.
 *
 * Architecture:
 *   submit → DB: status=queued → Inngest event → return task_id (< 1s)
 *   Inngest worker → generate → DB: status=completed → email notification
 */
import { inngest } from '../client';
import { createClient } from '@supabase/supabase-js';
import { callAI } from '@/lib/ai/callAI';
import { getWorkerPromptConfig } from '@/lib/workers/configs';
import { captureTaskError } from '@/lib/sentry';
import { Resend } from 'resend';
import { getEmailWorkerMeta, renderEmailWorkerAvatar } from '@/lib/email-worker-meta';
import { refundCredits } from '@/lib/credits/ledger';

const CHARLIE_SLUG = 'course-outline-builder';

const CHARLIE_MODE_MAX_TOKENS: Record<string, number> = {
  mini_course: 8000,
  workshop: 8000,
  signature: 20000,
  premium: 20000,
  certification: 20000,
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const charlieGenerate = inngest.createFunction(
  {
    id: 'charlie-generate',
    name: 'Charlie — Course Generate',
    retries: 2,
    concurrency: { limit: 5 },
    triggers: [{ event: 'charlie/course.generate' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { task_id, user_id, workspace_id, input, course_mode, user_email, system_prompt, user_prompt, max_tokens } = event.data as {
      task_id: string;
      user_id: string;
      workspace_id: string | null;
      input: Record<string, string>;
      course_mode: string;
      user_email: string;
      system_prompt: string;
      user_prompt: string;
      max_tokens: number;
    };

    const supabase = getSupabase();

    // Step 1: Mark task as processing
    await step.run('mark-processing', async () => {
      await supabase
        .from('tasks')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', task_id);
    });

    // Step 2: Run AI generation (no timeout ceiling)
    const result = await step.run('generate', async () => {
      const aiResult = await callAI(
        {
          model_tier: 'sonnet',
          system: system_prompt,
          messages: [{ role: 'user', content: user_prompt }],
          max_tokens,
        },
        { worker_id: CHARLIE_SLUG, user_id, task_id }
      );
      return {
        text: aiResult.content,
        model: aiResult.model,
      };
    });

    // Step 3: Write output, mark complete
    await step.run('complete', async () => {
      // Check for truncation
      const text = result.text || '';
      const isTruncated =
        text.length < 5000 ||
        /\w$/.test(text.trim()) && !text.trim().match(/[.!?"""'\])}]$/) ||
        (text.match(/```/g) || []).length % 2 !== 0;

      await supabase
        .from('tasks')
        .update({
          status: 'completed',
          output: { text },
          output_status: isTruncated ? 'potentially_truncated' : 'complete',
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', task_id);
    });

    // Step 4: Email notification
    await step.run('notify', async () => {
      if (!user_email || !process.env.RESEND_API_KEY) return;
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const modeLabel: Record<string, string> = {
          mini_course: 'Mini Course',
          workshop: 'Workshop',
          signature: 'Signature Course',
          premium: 'Premium Course',
          certification: 'Certification Course',
        };
        const workerMeta = getEmailWorkerMeta(CHARLIE_SLUG);
        const workerAvatar = renderEmailWorkerAvatar(workerMeta, 40);
        await resend.emails.send({
          from: '3rdShift <hello@3rdshift.ai>',
          to: user_email,
          subject: `Your ${modeLabel[course_mode] || 'course'} is ready`,
          html: `
            <p>Hi there,</p>
            <p>Your <strong>${workerMeta.name} ${modeLabel[course_mode] || 'course'}</strong> is done.</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
              <tr>
                <td width="40" style="vertical-align:middle;padding-right:12px;">${workerAvatar}</td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#111113;">${workerMeta.name}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${workerMeta.role}</p>
                </td>
              </tr>
            </table>
            <p><a href="https://3rdshift.ai/dashboard/tasks/result?taskId=${task_id}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">View your course →</a></p>
            <p style="color:#6b7280;font-size:13px;">This task was built by ${workerMeta.name}, your ${workerMeta.role}.</p>
          `,
        });
      } catch (emailErr) {
        // Email failure is non-fatal — task is already complete
        console.error('[inngest/charlie] email notification failed:', emailErr);
      }
    });

    return { task_id, status: 'completed' };
  }
);

/**
 * Failure handler: mark task failed + trigger auto-refund
 */
export const charlieFailureHandler = inngest.createFunction(
  { id: 'charlie-failure-handler', name: 'Charlie — Handle Failure', triggers: [{ event: 'inngest/function.failed' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const failedEvent = event.data?.event;
    if (failedEvent?.name !== 'charlie/course.generate') return;

    const task_id = failedEvent?.data?.task_id;
    const workspace_id = failedEvent?.data?.workspace_id;
    if (!task_id) return;

    const supabase = getSupabase();

    await step.run('mark-failed', async () => {
      const errorMsg = event.data?.error?.message || 'Course generation failed';
      captureTaskError(new Error(errorMsg), CHARLIE_SLUG, task_id, { inngest_failure: true });

      // Mark failed
      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          error_message: errorMsg,
          output: { error: errorMsg },
        })
        .eq('id', task_id);

      // Refund credits through the canonical ledger. The canonical balance reads
      // profiles.heavy_credits_remaining + credit_topups; workspaces.* is legacy
      // display state and must not receive refunds. Only set refund_applied after
      // the ledger confirms the refund (or reports the original debit was already
      // consumed/refunded), otherwise cleanup-stale-tasks cannot repair it.
      const { data: task } = await supabase
        .from('tasks')
        .select('credits_charged, user_id, workspace_id, refund_applied')
        .eq('id', task_id)
        .single();
      if (task?.credits_charged && task.credits_charged > 0 && !(task as Record<string, unknown>).refund_applied) {
        let creditOwnerId = task.user_id as string;
        if (task.workspace_id) {
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('owner_id')
            .eq('id', task.workspace_id)
            .single();
          if (workspace?.owner_id) creditOwnerId = workspace.owner_id;
        }

        const refund = await refundCredits({
          userId: creditOwnerId,
          amount: task.credits_charged,
          referenceId: task_id,
          referenceType: 'task',
          workspaceId: task.workspace_id,
          supabase: supabase as any,
        });

        if (refund.ok || refund.errorCode === 'no_original_debit') {
          await supabase.from('tasks').update({ refund_applied: true }).eq('id', task_id);
        } else {
          console.error(`[inngest/charlie] canonical refund failed for ${task_id}:`, refund.errorCode);
        }
      }

      // Email failure notification
      const user_email = failedEvent?.data?.user_email;
      if (user_email && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: '3rdShift <hello@3rdshift.ai>',
          to: user_email,
          subject: 'Course generation failed — credits refunded',
          html: `<p>Sorry, your course generation failed. Your credits have been refunded. Please try again.</p>`,
        }).catch(() => {});
      }
    });
  }
);
