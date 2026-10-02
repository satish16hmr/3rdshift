export const maxDuration = 300;

/**
 * POST /api/chat/generate-deliverable
 * 
 * Called from the frontend when a user confirms a deliverable in chat.
 * Extracts form inputs from conversation using Haiku, then calls the
 * same execute-task pipeline as forms — Reed calls fal.ai, Ava uses
 * the full prompt template, etc.
 * 
 * Returns: task_id so the frontend can show a deliverable card.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { callAI } from '@/lib/ai/callAI';
import { getAvailableCredits } from '@/lib/billing/available-credits';
import { enforceBillingAccess } from '@/lib/billing/billing-access';
import { enforceResolutionGate } from '@/lib/billing/resolution-gate';
import { refundLightTasks, reserveLightTask } from '@/lib/billing/light-tasks';
import { ensureTaskCreditsDebited } from '@/lib/tasks/credit-debit';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { getWorkerFormConfig } from '@/lib/workers/configs';
import { validateRequiredFields } from '@/lib/workers/validate-input';
import { applyDefaultWorkerMode } from '@/lib/workers/required-fields';
import { deriveEffectiveCreditCost } from '@/lib/workers/credit-cost';

type ChatImageAttachment = { path: string; field: 'face_photo' | 'reference_image'; reason: string; index: number };

function classifyReedChatImages(conversationContext: string, attachedImage?: string, priorReferenceImage?: string): ChatImageAttachment[] {
  const matches = [...conversationContext.matchAll(/\[STORAGE_PATH:\s*([^\]]+)\]/g)];
  const byPath = new Map<string, ChatImageAttachment>();

  matches.forEach((match, index) => {
    const path = match[1]?.trim();
    if (!path) return;
    const start = Math.max(0, (match.index ?? 0) - 260);
    const end = Math.min(conversationContext.length, (match.index ?? 0) + match[0].length + 260);
    const windowText = conversationContext.slice(start, end).toLowerCase();
    const styleRef = /\b(style reference|layout reference|reference image|paper sketch|sketch|thumbnail i like|inspiration|composition reference|use this style|like this layout)\b/i.test(windowText);
    const faceRef = /\b(my face|face photo|my photo|selfie|picture of me|photo of me|use me|with me in it|i want to be in it)\b/i.test(windowText);
    const field: 'face_photo' | 'reference_image' = styleRef && !faceRef ? 'reference_image' : 'face_photo';
    byPath.set(path, { path, field, reason: styleRef && !faceRef ? 'style/layout context' : 'default/latest face reference', index });
  });

  // Body fields are retained for older clients. The chat route now passes the latest upload,
  // but scanning the full conversation is the source of truth for chat-initiated Reed tasks.
  [attachedImage, priorReferenceImage].filter(Boolean).forEach((path, idx) => {
    const p = path!.trim();
    if (!byPath.has(p)) byPath.set(p, { path: p, field: 'face_photo', reason: idx === 0 ? 'current attached_image' : 'prior_reference_image', index: matches.length + idx });
  });

  return [...byPath.values()].sort((a, b) => a.index - b.index);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let body: { member_id: string; conversation_context: string; attached_image?: string; prior_reference_image?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { member_id, conversation_context, attached_image, prior_reference_image } = body;
  // Use current attached image if present; fall back to prior reference image from earlier in conversation
  const effectiveImage = attached_image || prior_reference_image;
  if (!member_id || !conversation_context) {
    return NextResponse.json({ error: 'member_id and conversation_context required' }, { status: 400 });
  }

  const worker = getWorkerBySlug(member_id);
  const formConfig = getWorkerFormConfig(member_id);

  if (!worker || !worker.active) return NextResponse.json({ error: 'Unknown member' }, { status: 400 });

  // Extract form field values from conversation using Haiku
  const formFields = (formConfig?.sections ?? []).flatMap(s => s.fields ?? []);
  const textFields = formFields.filter((f: { type: string }) => f.type !== 'file-upload');
  const fieldDescriptions = textFields
    .map((f: { name: string; label: string; required?: boolean }) => `"${f.name}": ${f.label}${f.required ? ' (required)' : ' (optional)'}`)
    .join('\n');

  let extractedInput: Record<string, string> = {};

  if (fieldDescriptions && textFields.length > 0) {
    try {
      const extractRes = await callAI({
        model_tier: 'haiku',
        system: 'You extract structured data from conversations. Return only valid JSON.',
        messages: [{
          role: 'user',
          content: `Extract form field values from this conversation. Be precise — capture exactly what the user said.

Conversation:
${conversation_context}

Fields to extract:
${fieldDescriptions}

Rules:
- Use the EXACT field name as the JSON key
- For "description": capture the complete accumulated visual concept from BOTH the user and Reed. If Reed proposed a detailed brief and the user accepted/continued, include Reed's brief instead of asking the user to paste it back.
- For "headline_text": capture the exact text they want on the thumbnail (e.g. "CASH WITH AI" not a description of it)
- For "style": pick the closest match from: cinematic, bright, dark, minimal, gaming, corporate, podcast, news, lifestyle, custom
- For "platform": pick the closest visible option: YouTube (16:9), YouTube Shorts (9:16), Podcast Cover (1:1), Square Social (1:1)
- For "color_preference": capture requested colors, accents, brand colors, or colors to avoid
- If a field wasn't mentioned, omit it
- Return ONLY the JSON object, no explanation

Example output: {"description": "Close-up face calling out a bloated freelancer invoice, hand pointing at camera, split background with a cluttered invoice on one side and clean $79/mo alternative on the other, red accent lighting", "headline_text": "THEY LIE!", "style": "cinematic", "platform": "YouTube (16:9)"}`
        }]
      });
      const jsonMatch = extractRes.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) extractedInput = JSON.parse(jsonMatch[0]);
    } catch { /* empty input fallback */ }
  }

  console.log('[generate-deliverable] extractedInput after Haiku:', JSON.stringify(extractedInput));

  if (member_id === 'thumbnail-designer') {
    try {
      const conceptRes = await callAI({
        model_tier: 'haiku',
        system: 'You extract YouTube thumbnail art direction from a conversation. Return only valid JSON.',
        messages: [{
          role: 'user',
          content: `Extract the final thumbnail concept from this conversation. Include details Reed proposed if the user accepted or continued from them.

Conversation:
${conversation_context}

Return JSON with exactly these keys when present:
{"scene":"...","subject_pose":"...","expression":"...","background_elements":["..."],"text_headline":"...","color_accents":["..."],"props":["..."]}

Rules:
- Preserve concrete visual details: invoice, $79/mo, split background, pointing/calling-out pose, face reference request, props.
- Do not reduce the concept to just style/platform.
- Return only JSON.`
        }],
        max_tokens: 500,
      }, { user_id: userId, call_type: 'reed-concept-extract', worker_id: member_id });
      const conceptMatch = conceptRes.content.match(/\{[\s\S]*\}/);
      if (conceptMatch) {
        const concept = JSON.parse(conceptMatch[0]);
        extractedInput.structured_concept = JSON.stringify(concept);
        if (!extractedInput.description) {
          extractedInput.description = [
            concept.scene,
            concept.subject_pose,
            concept.expression,
            Array.isArray(concept.background_elements) ? concept.background_elements.join(', ') : '',
            Array.isArray(concept.props) ? concept.props.join(', ') : '',
            Array.isArray(concept.color_accents) ? concept.color_accents.join(', ') : '',
          ].filter(Boolean).join('. ');
        }
        if (!extractedInput.headline_text && concept.text_headline) extractedInput.headline_text = String(concept.text_headline);
      }
    } catch { /* keep generic extraction */ }
  }

  // Shay (logo-concept-generator) — distinguish new request vs refinement
  if (member_id === 'logo-concept-generator') {
    // Detect if this is a refinement (customer picked a concept number) or a new request
    const conceptMatch = conversation_context.match(/(?:concept|option|number|#)\s*([1-4])/i);
    const isRefinementRequest = !!conceptMatch;

    if (isRefinementRequest) {
      // REFINEMENT: customer picked a concept from a previous grid
      extractedInput.concept_number = conceptMatch![1];
      const lastUserMsg = conversation_context.split('\n\n').filter((l: string) => l.startsWith('User:')).pop()?.replace(/^User:\s*/, '') || '';
      if (lastUserMsg) extractedInput.refinement_instruction = lastUserMsg;

      // Pull brand brief from the most recent completed Shay task (reliable source for refinements)
      const { data: recentShayTasks } = await supabaseAdmin
        .from('tasks')
        .select('id, input, output, created_at')
        .eq('worker_slug', 'logo-concept-generator')
        .eq('status', 'completed')
        .or(`user_id.eq.${userId},workspace_id.eq.${workspaceId || userId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      const originalTask = recentShayTasks?.find(t => {
        const out = t.output as Record<string, unknown>;
        return (out as Record<string, unknown>)?.isRefinement !== true;
      }) || recentShayTasks?.[0] || null;

      console.log('[Shay refinement] brand_name from task:', (originalTask?.input as Record<string, string>)?.brand_name || '(EMPTY)');

      if (originalTask?.input) {
        const orig = originalTask.input as Record<string, string>;
        // Only use DB values as fallback — Haiku's extracted values take priority
        if (!extractedInput.brand_name && orig.brand_name) extractedInput.brand_name = orig.brand_name;
        if (!extractedInput.industry && orig.industry) extractedInput.industry = orig.industry;
        if (!extractedInput.style && orig.style) extractedInput.style = orig.style;
        if (!extractedInput.colors && orig.colors) extractedInput.colors = orig.colors;
        if (!extractedInput.include_symbols && orig.include_symbols) extractedInput.include_symbols = orig.include_symbols;
      }
    } else {
      // NEW REQUEST: brand name comes from the conversation — Haiku already extracted it above
      // Flag as new request so execute-task generates 4 concepts
      extractedInput.is_new_logo_request = 'true';
      console.log('[Shay new request] brand_name from conversation:', extractedInput.brand_name || '(EMPTY)');
    }
    console.log('[Shay] final brand_name:', extractedInput.brand_name || '(EMPTY)', '| is_new_logo_request:', extractedInput.is_new_logo_request || 'no');
  }

  // If image attached (current, prior, or anywhere in chat history), format for execute-task.
  // Reed-specific handling maps chat paperclip uploads to face_photo by default, and to
  // reference_image when the surrounding conversation labels it as style/layout/sketch reference.
  if (member_id === 'thumbnail-designer') {
    const images = classifyReedChatImages(conversation_context, attached_image, prior_reference_image);
    const latestFace = [...images].reverse().find(i => i.field === 'face_photo');
    const latestReference = [...images].reverse().find(i => i.field === 'reference_image');
    if (latestFace) extractedInput.face_photo = `[STORAGE_PATH: ${latestFace.path}] [FIELD: face_photo]`;
    if (latestReference) extractedInput.reference_image = `[STORAGE_PATH: ${latestReference.path}] [FIELD: reference_image]`;
    if (images.length > 0) extractedInput.chat_attachment_routing = JSON.stringify(images.map(({ path, field, reason }) => ({ path, field, reason })));
  } else if (effectiveImage) {
    const imageFieldName = (formFields.find((f: { type: string }) => f.type === 'file-upload') as { name?: string } | undefined)?.name ?? 'face_photo';
    // execute-task reads: [STORAGE_PATH: path] [FIELD: fieldName]
    extractedInput[imageFieldName] = `[STORAGE_PATH: ${effectiveImage}] [FIELD: ${imageFieldName}]`;
  }

  extractedInput = applyDefaultWorkerMode(member_id, extractedInput) as Record<string, string>;

  const fieldValidation = validateRequiredFields(member_id, extractedInput);
  if (!fieldValidation.valid) {
    return NextResponse.json(
      { error: 'missing_required_fields', fields: fieldValidation.missing },
      { status: 400 }
    );
  }

  let effectiveCreditCost: number;
  try {
    effectiveCreditCost = deriveEffectiveCreditCost(worker, extractedInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to derive worker credit cost.';
    const status = message.includes('workerModeField is required') ? 500 : 400;
    if (status === 500) console.error(`[generate-deliverable] REGISTRY ERROR: worker '${member_id}' has modeCredits but no workerModeField. Task creation blocked.`);
    return NextResponse.json({ error: message }, { status });
  }

  const taskType: 'light' | 'heavy' = effectiveCreditCost > 0 ? 'heavy' : 'light';
  const PLAN_RANK: Record<string, number> = { none: 0, starter: 1, pro: 2, operator: 3 };
  let billingPlan = 'none';
  let creditOwnerId = userId;

  if (workspaceId) {
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id, plan')
      .eq('id', workspaceId)
      .single();

    if (ws?.owner_id) {
      creditOwnerId = ws.owner_id;
      const { data: ownerProfile } = await supabaseAdmin
        .from('profiles')
        .select('plan')
        .eq('id', ws.owner_id)
        .single();
      billingPlan = ownerProfile?.plan || ws.plan || 'none';
    } else {
      billingPlan = ws?.plan || 'none';
    }
  } else {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, is_founding_member, founding_tier')
      .eq('id', userId)
      .single();
    billingPlan = profile?.is_founding_member ? (profile.founding_tier || 'starter') : (profile?.plan || 'none');
  }

  const planRank = PLAN_RANK[billingPlan] ?? 0;
  const workerMinPlanRank = PLAN_RANK[worker.minPlan] ?? 1;
  if (planRank < workerMinPlanRank) {
    return NextResponse.json({
      error: 'plan_insufficient',
      message: `${worker.name ?? member_id} requires ${worker.minPlan} plan or higher. Your plan: ${billingPlan}.`,
      user_plan: billingPlan,
      required_plan: worker.minPlan,
    }, { status: 403 });
  }
  if (billingPlan === 'none') {
    return NextResponse.json({
      error: 'subscription_required',
      message: 'Your subscription has been cancelled. Reactivate to continue using workers.',
    }, { status: 403 });
  }
  if (effectiveCreditCost > 0 && billingPlan === 'starter') {
    return NextResponse.json(
      { error: 'Heavy tasks require Pro or Operator plan. Upgrade to access this worker.' },
      { status: 403 }
    );
  }

  const billingAccess = await enforceBillingAccess(supabaseAdmin, creditOwnerId);
  if (billingAccess.blocked) {
    return NextResponse.json(
      {
        error: billingAccess.code,
        message: billingAccess.code === 'billing_past_due'
          ? 'Your payment is past due. Please update your billing information to continue.'
          : 'No active subscription.',
      },
      { status: 402 }
    );
  }

  const resolutionGate = await enforceResolutionGate(supabaseAdmin, creditOwnerId);
  if (resolutionGate.blocked) {
    return NextResponse.json(
      {
        error: 'workspace_resolution_required',
        target_plan: resolutionGate.target_plan,
        excess_count: resolutionGate.excess_count,
      },
      { status: 403 }
    );
  }

  let lightTaskReserved = false;
  if (taskType === 'light') {
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_required', message: 'Tasks must be created inside a workspace.' }, { status: 400 });
    }
    const lightReservation = await reserveLightTask({
      supabase: supabaseAdmin,
      workspaceId,
      billingPlan,
    });
    if (!lightReservation.ok) {
      return NextResponse.json(
        { error: lightReservation.error, limit_reached: lightReservation.status === 402 },
        { status: lightReservation.status }
      );
    }
    lightTaskReserved = true;
  }

  if (effectiveCreditCost > 0) {
    const availableCredits = await getAvailableCredits(supabaseAdmin, creditOwnerId);
    if (availableCredits.availableCreditsRemaining < effectiveCreditCost) {
      return NextResponse.json(
        { error: 'Not enough credits. Upgrade your plan or purchase top-up credits.' },
        { status: 402 }
      );
    }
  }

  // Create task record

  const { data: task, error: insertError } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      worker_slug: member_id,
      worker_title_at_creation: worker.name || member_id,
      category: worker.category || member_id,
      input: extractedInput,
      status: 'pending',
      task_type: taskType,
      credits_charged: effectiveCreditCost,
    })
    .select('id')
    .single();

  if (insertError || !task) {
    if (lightTaskReserved && workspaceId) {
      await refundLightTasks({ supabase: supabaseAdmin, workspaceId, amount: 1 });
    }
    return NextResponse.json({ error: 'Failed to create task. Please try again.' }, { status: 500 });
  }

  if (effectiveCreditCost > 0) {
    const debitResult = await ensureTaskCreditsDebited(supabaseAdmin, {
      creditOwnerId,
      amount: effectiveCreditCost,
      taskId: task.id,
      workspaceId,
    });
    if (!debitResult.ok) {
      await supabaseAdmin.from('tasks').update({
        status: 'failed',
        output: { error: debitResult.error },
      }).eq('id', task.id);
      return NextResponse.json({ error: debitResult.error }, { status: debitResult.status });
    }
  }

  // NOTE: Do NOT insert a second chat message here.
  // send/route.ts already has the member message and will update it with deliverable_id.

  // Return task_id immediately — the FRONTEND will call execute-task with its own JWT.
  // This avoids Vercel self-call issues and ensures the user's auth context is used.
  return NextResponse.json({ task_id: task.id, status: 'ready_to_execute' });
}
