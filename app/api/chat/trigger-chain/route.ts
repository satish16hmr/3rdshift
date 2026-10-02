export const maxDuration = 300;
const TONE_ONLY_BRAND_SLUGS = new Set([
  'pitch-deck-writer',
  'presentation-builder',
  'business-plan-writer',
  'proposal-writer',
  'whitepaper-writer',
  'case-study-writer',
  'kpi-dashboard-writer',
  'data-cleaner',
]);

function applyToneOnlyBrandContext(workerId: string, brandContext: string): string {
  if (!brandContext || !TONE_ONLY_BRAND_SLUGS.has(workerId)) return brandContext;
  const toneMatch = brandContext.match(/Tone\/voice:\s*([^\n]+)/i);
  const toneOnly = toneMatch ? toneMatch[1].trim() : '';
  return toneOnly
    ? `

## WRITING STYLE
Tone/voice: ${toneOnly}. Apply this tone to how you write - word choice and sentence style only. Do NOT use any other brand profile details as facts in your output.`
    : '';
}

async function loadBrandContext(userId: string, workspaceId: string): Promise<string> {
  const { data: brandProfile } = await supabaseAdmin
    .from('brand_profile')
    .select('company_name, industry, audience, tone, competitors, additional_context')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (brandProfile) {
    const parts = [
      brandProfile.company_name ? `Company name (operator): ${brandProfile.company_name}` : '',
      brandProfile.industry ? `Industry (operator): ${brandProfile.industry}` : '',
      brandProfile.audience ? `Target audience: ${brandProfile.audience}` : '',
      brandProfile.tone ? `Tone/voice: ${brandProfile.tone}` : '',
      brandProfile.competitors ? `Competitors: ${brandProfile.competitors}` : '',
      brandProfile.additional_context ? brandProfile.additional_context : '',
    ].filter(Boolean).join('\n');
    if (parts) return `

## YOUR BRAND VOICE (Style & Tone Guidance)

The following describes the brand voice of the operator using 3rdShift. Apply these voice, tone, and style guidelines to the output.

IMPORTANT: This context describes the OPERATOR's brand. It does NOT override the subject of this specific task. If the task input specifies a different company, product, client, or subject, that takes precedence for all identity, naming, and subject-matter decisions. Use this brand context ONLY for voice, tone, taboo words, and audience style.

Operator's brand:
${parts}

When the task input specifies a different subject (product name, client name, company, or other subject distinct from the operator), apply the voice and style guidelines above while keeping ALL identity, naming, and subject-matter focused on what the task specifies.`;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('brand_context')
    .eq('id', userId)
    .single();
  return profile?.brand_context?.trim() ? `

## YOUR BRAND VOICE (Style & Tone Guidance)

The following describes the brand voice of the operator using 3rdShift. Apply these voice, tone, and style guidelines to the output.

IMPORTANT: This context describes the OPERATOR's brand. It does NOT override the subject of this specific task. If the task input specifies a different company, product, client, or subject, that takes precedence for all identity, naming, and subject-matter decisions. Use this brand context ONLY for voice, tone, taboo words, and audience style.

Operator's brand:
${profile.brand_context.trim()}

When the task input specifies a different subject (product name, client name, company, or other subject distinct from the operator), apply the voice and style guidelines above while keeping ALL identity, naming, and subject-matter focused on what the task specifies.` : '';
}


import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { callAI } from '@/lib/ai/callAI';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { getWorkerPromptConfig } from '@/lib/workers/configs';
import { buildChatChainStepPrompt } from '@/lib/agent-mode/chat-chain-prompt';
import { getWorkerCreditCost } from '@/lib/agent-mode/types';
import { debitCredits, refundCredits } from '@/lib/credits/ledger';

const MEDIA_TASK_WORKERS = new Set([
  'thumbnail-designer',
  'social-media-graphics-designer',
  'logo-concept-generator',
  'image-cleanup',
  'product-video-creator',
  'b-roll-generator',
  'scene-director',
  'ad-creative-generator',
  'voiceover-artist',
  'sound-effects-designer',
  'transcription-specialist',
  'meeting-notes-writer',
  'content-translator',
]);

/**
 * POST /api/chat/trigger-chain
 * Executes a multi-member chain triggered from chat.
 * Each member runs sequentially, output passes to the next,
 * results posted as deliverable cards in the chat stream.
 *
 * H02 fixes:
 * - Owner-only (Q7-a): members cannot trigger chains
 * - Registry validation: each worker_id in chain checked against registry
 * - member_id validated against registry
 * - Pre-reserve total credits upfront, refund unused on failure (Q7-b)
 * - Atomic credit reservation before any AI calls
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // H02 fix: owner-only — members cannot fire chains
  const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
  if (roleAuth instanceof NextResponse) return roleAuth;

  let body: { member_id: string; chain: Array<{ worker_id: string }>; context?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { member_id, chain, context } = body;
  if (!member_id || !chain?.length) {
    return NextResponse.json({ error: 'member_id and chain are required' }, { status: 400 });
  }

  // H02 fix: validate member_id against registry
  const initiatingWorker = getWorkerBySlug(member_id);
  if (!initiatingWorker || !initiatingWorker.active) {
    return NextResponse.json({ error: 'Invalid team member' }, { status: 400 });
  }

  // H02 fix: validate every worker_id in chain against registry and prompt config
  for (const step of chain) {
    const registryWorker = getWorkerBySlug(step.worker_id);
    if (!registryWorker || !registryWorker.active) {
      return NextResponse.json({
        error: `Invalid worker in chain: "${step.worker_id}". Must be an active team member.`
      }, { status: 400 });
    }

    if (registryWorker.chainCompatible === false) {
      return NextResponse.json({
        error: `Invalid worker in chain: "${step.worker_id}". This team member uses a specialized pipeline and is not available in chains yet.`
      }, { status: 400 });
    }

    if (MEDIA_TASK_WORKERS.has(step.worker_id)) {
      return NextResponse.json({
        error: `Invalid worker in chat-triggered chain: "${step.worker_id}" generates media and cannot be run through chat chains yet. Use Agent Mode Playbooks for real media output; no credits were charged.`
      }, { status: 400 });
    }

    if (!getWorkerPromptConfig(step.worker_id)) {
      return NextResponse.json({
        error: `Invalid worker in chain: "${step.worker_id}". This team member is not configured for chain runs.`
      }, { status: 400 });
    }
  }

  // Operator only — workspace owner's plan
  const wsPlan = await getWorkspaceOwnerPlan(workspaceId);
  if (wsPlan !== 'operator') {
    return NextResponse.json({ error: 'Chat-triggered chains require Operator plan.', upgrade_required: true }, { status: 403 });
  }

  // Fetch workspace brand context. Credit reservation below is authoritative and includes top-ups.

  // H02 fix (Q7-b): pre-reserve total credits upfront before any AI calls.
  // debitCredits() is the single authoritative gate and includes active top-ups.
  const totalCredits = chain.reduce((sum, w) => {
    const cost = getWorkerCreditCost(w.worker_id);
    return sum + cost.heavy;
  }, 0);

  // Stable chain run id for retry idempotency. Scheduled chains debit each step with
  // `${runId}:${position}:${worker_id}`; chat-triggered chains use the same reference
  // shape, with runId derived deterministically from the authenticated request body.
  const deterministicRunId = createHash('sha256')
    .update(JSON.stringify({
      workspaceId,
      userId,
      member_id,
      context: context ?? '',
      chain: chain.map((step, index) => ({ position: index + 1, worker_id: step.worker_id })),
    }))
    .digest('hex')
    .slice(0, 32);

  const debitedHeavySteps: Array<{ referenceId: string; amount: number }> = [];
  const completedHeavyRefs = new Set<string>();

  // D6 fix: use atomic ledger RPC for upfront credit reservation. Debit each heavy
  // step separately so ledger idempotency matches the scheduled executor path.
  for (let index = 0; index < chain.length; index += 1) {
    const worker_id = chain[index].worker_id;
    const amount = getWorkerCreditCost(worker_id).heavy;
    if (amount <= 0) continue;

    const referenceId = `${deterministicRunId}:${index + 1}:${worker_id}`;
    const debitResult = await debitCredits({
      userId,
      amount,
      referenceId,
      referenceType: 'chain_step',
      workspaceId,
    });

    if (!debitResult.ok) {
      for (const debited of debitedHeavySteps) {
        await refundCredits({
          userId,
          amount: debited.amount,
          referenceId: debited.referenceId,
          referenceType: 'trigger-chain-reservation-failure',
          workspaceId,
        });
      }

      const status = debitResult.errorCode === 'insufficient_credits' ? 402 : 409;
      const msg = debitResult.errorCode === 'insufficient_credits'
        ? `Not enough credits. Need ${totalCredits} heavy credits.`
        : 'Credit reservation failed. Please try again.';
      return NextResponse.json({ error: msg }, { status });
    }

    debitedHeavySteps.push({ referenceId, amount });
  }

  const brandContext = await loadBrandContext(userId, workspaceId);
  const results: Array<{ worker_id: string; task_id: string; output: string }> = [];
  let previousOutput = context || '';

  try {
    // Execute each member sequentially
    for (const step of chain) {
      const { worker_id } = step;
      const worker = getWorkerBySlug(worker_id); // already validated above
      const promptConfig = getWorkerPromptConfig(worker_id);
      if (!promptConfig) {
        throw new Error(`No prompt config for worker: ${worker_id}`);
      }

      const userPrompt = buildChatChainStepPrompt({
        workerId: worker_id,
        sourceText: previousOutput,
        isFirstStep: results.length === 0,
      });

      if (!userPrompt) {
        throw new Error(`No prompt config for worker: ${worker_id}`);
      }

      let systemPrompt = promptConfig?.systemPrompt || `You are ${worker?.personaName}, a ${worker?.name}.`;
      const effectiveBrandContext = applyToneOnlyBrandContext(worker_id, brandContext);
      if (effectiveBrandContext) systemPrompt += effectiveBrandContext;

      const creditCost = getWorkerCreditCost(worker_id).heavy;
      const stepReferenceId = `${deterministicRunId}:${results.length + 1}:${worker_id}`;

      // Insert task record
      const { data: taskRow } = await supabaseAdmin
        .from('tasks')
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          worker_slug: worker_id,
          category: worker?.category || worker_id,
          input: { task_input: userPrompt, _chain_triggered: true },
          status: 'processing',
          credits_charged: creditCost,
        })
        .select('id')
        .single();

      const taskId = taskRow?.id;

      // Run the AI — B3 fix: treat step failure as a real failure, not a placeholder
      let output = '';
      let stepFailed = false;
      let stepError = '';
      try {
        const aiResult = await callAI({
          model_tier: 'sonnet',
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        output = aiResult.content;
      } catch (e: unknown) {
        stepFailed = true;
        stepError = e instanceof Error ? e.message : 'AI call failed';
      }

      if (stepFailed) {
        // B3 fix: mark task failed, skip deliverable card, break chain
        if (taskId) {
          await supabaseAdmin.from('tasks').update({
            status: 'failed',
            output: { error: stepError },
            completed_at: new Date().toISOString(),
          }).eq('id', taskId);
        }
        // D6 fix: atomic refund for this step + all remaining steps
        const stepsToRefund = debitedHeavySteps.filter(debited => !completedHeavyRefs.has(debited.referenceId));
        for (const debited of stepsToRefund) {
          await refundCredits({
            userId,
            amount: debited.amount,
            referenceId: debited.referenceId,
            referenceType: 'trigger-chain-failure',
            workspaceId,
          });
        }
        // Post failure notice to chat
        await supabaseAdmin.from('team_chat_messages').insert({
          user_id: userId,
          workspace_id: workspaceId,
          member_id,
          role: 'system',
          content: `❌ ${worker?.personaName || worker_id} encountered an error at step ${chain.indexOf(step) + 1}. The chain has stopped. Any unused credits have been refunded.`,
        });
        return NextResponse.json({ success: false, error: stepError, partial_results: results }, { status: 500 });
      }

      // Update task as completed
      if (taskId) {
        await supabaseAdmin.from('tasks').update({
          status: 'completed',
          output: { text: output, format: 'text' },
          completed_at: new Date().toISOString(),
        }).eq('id', taskId);
      }

      // Post deliverable card to chat
      await supabaseAdmin
        .from('team_chat_messages')
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          member_id,
          role: 'member',
          content: `✅ ${worker?.personaName || worker_id} finished their part.`,
          deliverable_id: taskId || null,
        });

      results.push({ worker_id, task_id: taskId || '', output });
      previousOutput = output;
      if (creditCost > 0) completedHeavyRefs.add(stepReferenceId);
    }
  } catch (err) {
    // D6 fix: atomic refund for unused credits on unexpected failure
    const stepsToRefund = debitedHeavySteps.filter(debited => !completedHeavyRefs.has(debited.referenceId));
    for (const debited of stepsToRefund) {
      await refundCredits({
        userId,
        amount: debited.amount,
        referenceId: debited.referenceId,
        referenceType: 'trigger-chain-exception',
        workspaceId,
      });
    }
    console.error('[trigger-chain] error:', err);
    return NextResponse.json({ error: 'Chain execution failed' }, { status: 500 });
  }

  // Post summary system message
  const memberNames = chain.map(w => {
    const wk = getWorkerBySlug(w.worker_id);
    return wk?.personaName || w.worker_id;
  }).join(' → ');

  await supabaseAdmin.from('team_chat_messages').insert({
    user_id: userId,
    workspace_id: workspaceId,
    member_id,
    role: 'system',
    content: `Chain complete: ${memberNames}`,
  });

  return NextResponse.json({ success: true, results });
}
