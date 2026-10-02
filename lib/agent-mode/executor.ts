/**
 * Agent Mode Chain Executor
 *
 * Handles the full execution of a chain run:
 * - Worker-by-worker sequential execution via callAI()
 * - Output passing between workers
 * - 3-attempt retry with 30s + 2m backoff per worker
 * - Option C failure handling: refund failed + downstream, keep completed
 * - Credit deduction and refund via Supabase
 * - Run record updates throughout
 */

import { callAI } from '@/lib/ai/callAI';
import { getModelForWorker } from '@/lib/ai/router';
import { getWorkerPromptConfig, getWorkerFormConfig } from '@/lib/workers/configs';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { validateRequiredFields } from '@/lib/workers/validate-input';
import { applyDefaultWorkerMode } from '@/lib/workers/required-fields';
import { getWorkerCreditCost, type WorkerInChain, type WorkerRunResult } from './types';
import { debitCredits, refundCredits } from '@/lib/credits/ledger';
import { getPlanLightTaskLimit } from '@/lib/billing/catalog';
import { refundLightTasks } from '@/lib/billing/light-tasks';
import { formatChainIncompatibleWorkerError, getChainIncompatibleWorkers } from './chain-validation';
import { ensureHumanReviewDisclaimer } from '@/lib/workers/disclaimers';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function toStringRecord(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')])
  );
}

function extractFirstImageUrlFromPreviousResults(previousResults: WorkerRunResult[]): string | null {
  for (const result of previousResults) {
    if (result.status !== 'completed' || !result.output) continue;
    const markdownImageLink = result.output.match(/\[Download image \d+\]\((https?:\/\/[^)\s]+)\)/i);
    if (markdownImageLink?.[1]) return markdownImageLink[1];
    const anyImageUrl = result.output.match(/https?:\/\/[^\s)]+\.(?:png|jpe?g|webp)(?:\?[^\s)]*)?/i);
    if (anyImageUrl?.[0]) return anyImageUrl[0];
  }
  return null;
}

function getWorkerSettings(worker: WorkerInChain, previousResults: WorkerRunResult[] = []): Record<string, string> {
  const rawSettings = worker.form_settings ?? worker.config ?? {};
  const defaulted = applyDefaultWorkerMode(worker.worker_id, rawSettings) as Record<string, unknown>;

  if (worker.worker_id === 'logo-concept-generator') {
    const shayMode = String(defaulted.shay_mode || 'base_logo_concepts');
    const hasSelectedConcept = Boolean(
      defaulted.selected_concept_url ||
      defaulted.reference_image_url ||
      defaulted.concept_number ||
      defaulted.concept_to_refine ||
      extractFirstImageUrlFromPreviousResults(previousResults)
    );

    if (shayMode.startsWith('refine_') && !hasSelectedConcept) {
      return toStringRecord({ ...defaulted, shay_mode: 'base_logo_concepts' });
    }
  }

  return toStringRecord(defaulted);
}

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

async function loadBrandContext(params: { userId: string; workspaceId: string | null; supabase: AnySupabase }): Promise<string> {
  const { userId, workspaceId, supabase } = params;
  if (workspaceId) {
    const { data: brandProfile } = await supabase
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
      if (parts) {
        return `

## YOUR BRAND VOICE (Style & Tone Guidance)

The following describes the brand voice of the operator using 3rdShift. Apply these voice, tone, and style guidelines to the output.

IMPORTANT: This context describes the OPERATOR's brand. It does NOT override the subject of this specific task. If the task input specifies a different company, product, client, or subject, that takes precedence for all identity, naming, and subject-matter decisions. Use this brand context ONLY for voice, tone, taboo words, and audience style.

Operator's brand:
${parts}

When the task input specifies a different subject (product name, client name, company, or other subject distinct from the operator), apply the voice and style guidelines above while keeping ALL identity, naming, and subject-matter focused on what the task specifies.`;
      }
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('brand_context')
    .eq('id', userId)
    .single();
  return profile?.brand_context?.trim() ? `

## YOUR BRAND VOICE (Style & Tone Guidance)

${profile.brand_context.trim()}` : '';
}

const HUMAN_REVIEW_WORKERS = new Set(['legal-document-drafter', 'resume-screener']);

const MEDIA_TASK_WORKERS = new Set([
  // fal.ai image workers
  'thumbnail-designer',
  'social-media-graphics-designer',
  'logo-concept-generator',
  'image-cleanup',
  // Atlas Cloud video workers
  'product-video-creator',
  'b-roll-generator',
  'scene-director',
  'ad-creative-generator',
  // ElevenLabs audio/speech workers
  'voiceover-artist',
  'sound-effects-designer',
  'transcription-specialist',
  'meeting-notes-writer',
  'content-translator',
]);

function isMediaTaskWorker(workerId: string): boolean {
  return MEDIA_TASK_WORKERS.has(workerId);
}

async function refundHeavyStep(params: {
  cost: { light: number; heavy: number };
  billing: { creditOwnerId: string; workspaceId: string | null };
  stepReferenceId: string;
  supabase: AnySupabase;
}): Promise<number> {
  const { cost, billing, stepReferenceId, supabase } = params;

  if (cost.heavy <= 0) return 0;

  const refundResult = await refundCredits({
    userId: billing.creditOwnerId,
    amount: cost.heavy,
    referenceId: stepReferenceId,
    referenceType: 'chain_step',
    workspaceId: billing.workspaceId,
    supabase,
  });

  if (!refundResult.ok) {
    console.error(`[AgentMode] Heavy credit refund failed for ${stepReferenceId}:`, refundResult.errorCode);
    return 0;
  }

  return cost.heavy;
}

async function refundLightStep(params: {
  cost: { light: number; heavy: number };
  workspaceId: string | null;
  supabase: AnySupabase;
}): Promise<number> {
  const { cost, workspaceId, supabase } = params;
  return refundLightTasks({ supabase, workspaceId, amount: cost.light });
}

// ── Output passing context builder ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildOutputContext(previousResults: WorkerRunResult[], workerRegistryArr: any[]): string {
  const completedOutputs = previousResults.filter(r => r.status === 'completed' && r.output);
  if (completedOutputs.length === 0) return '';

  const blocks = completedOutputs.map(r => {
    const reg = workerRegistryArr[r.position - 1];
    const label = reg ? `${reg.personaName ?? reg.name} · ${reg.name}` : r.worker_id;
    return `Previous worker output from ${label}:\n\n${r.output}`;
  });

  return blocks.join('\n\n---\n\n') + '\n\n---\n\nNow complete your task with the above context.';
}

// ── Single worker execution with 3-attempt Agent Mode retry ─────────────────

async function executeWorkerWithRetry(params: {
  worker_id: string;
  position: number;
  form_settings: Record<string, string>;
  previousResults: WorkerRunResult[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workerRegistry: any[];
  brandContext: string;
  runId: string;
}): Promise<{ success: boolean; output?: string; provider?: 'anthropic' | 'openai'; error?: string }> {
  const { worker_id, form_settings, previousResults, workerRegistry, brandContext, runId } = params;

  const workerConfig = getWorkerPromptConfig(worker_id);
  if (!workerConfig) {
    return { success: false, error: `No prompt config for worker: ${worker_id}` };
  }

  // Phase 20 Step 6: runtime form_settings key validation — THROW MODE.
  // Rejects step execution before burning AI credits if form_settings contains
  // keys that don't exist in the worker's formSchema.
  // Catches slug/rename drift immediately rather than silently passing garbage to prompts.
  // CI validator (lib/agent-mode/validate-presets.ts) must pass before any preset ships.
  const formConfig = getWorkerFormConfig(worker_id);
  if (formConfig) {
    const validFieldNames = new Set(
      formConfig.sections.flatMap((s: { fields: Array<{ name: string }> }) => s.fields.map((f) => f.name))
    );
    // Also allow the workerModeField (card-picker field injected by UI, not in form sections)
    const workerReg = getWorkerBySlug(worker_id) as { workerModeField?: string } | null;
    if (workerReg?.workerModeField) validFieldNames.add(workerReg.workerModeField);

    const unknownKeys = Object.keys(form_settings).filter((k) => !validFieldNames.has(k));
    if (unknownKeys.length > 0) {
      console.error(
        `[AgentMode][${runId}] validatePlaybookStep BLOCKED ${worker_id}: ` +
        `unknown form_settings keys [${unknownKeys.join(', ')}]. ` +
        `Valid fields: [${[...validFieldNames].join(', ')}]. ` +
        `Fix preset form_settings or run: npx tsx lib/agent-mode/validate-presets.ts`
      );
      return {
        success: false,
        error:
          `Playbook step configuration error: field(s) [${unknownKeys.join(', ')}] do not exist ` +
          `for worker "${worker_id}". Run the preset validator to find all affected steps.`,
      };
    }
  }

  // Validate required fields before calling AI — fail loudly if a Playbook step
  // has missing required fields rather than burning credits on undefined values.
  const fieldValidation = validateRequiredFields(worker_id, form_settings as Record<string, unknown>);
  if (!fieldValidation.valid) {
    return {
      success: false,
      error: `Missing required fields for ${worker_id}: ${fieldValidation.missing.join(', ')}. Update the Playbook step settings.`,
    };
  }

  // Strip placeholder values — "[User fills in]" means the user didn't configure the step
  // Pass them through so the worker can ask for what it needs, but clean up the placeholder text
  const cleanedFormSettings = Object.fromEntries(
    Object.entries(form_settings).map(([k, v]) => [
      k,
      typeof v === 'string' && v.includes('[User fills in]') ? '' : v,
    ])
  );

  // Build user prompt from form settings
  let userPrompt = workerConfig.buildUserPrompt(cleanedFormSettings);
  if (!userPrompt || userPrompt.replace(/\s/g, '').length < 50) {
    userPrompt = Object.entries(form_settings)
      .filter(([, v]) => v && v !== '')
      .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`)
      .join('\n');
  }

  // Prepend output context from previous workers
  const outputContext = buildOutputContext(previousResults, workerRegistry);
  if (outputContext) {
    userPrompt = outputContext + '\n\n' + userPrompt;
  }

  // Append brand context
  let systemPrompt = workerConfig.systemPrompt;
  const effectiveBrandContext = applyToneOnlyBrandContext(worker_id, brandContext);
  if (effectiveBrandContext) {
    systemPrompt += effectiveBrandContext;
  }

  const DELAYS = [0, 30000, 120000]; // immediate, 30s, 2m

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      console.log(`[AgentMode][${runId}] Worker ${worker_id} retry attempt ${attempt} after ${DELAYS[attempt]}ms`);
      await sleep(DELAYS[attempt]);
    }

    try {
      const modelConfig = getModelForWorker(worker_id, 'data');
      const result = await callAI({
        model_tier: 'sonnet',
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: modelConfig.maxTokens,
      }, { worker_id });

      return {
        success: true,
        output: HUMAN_REVIEW_WORKERS.has(worker_id) ? ensureHumanReviewDisclaimer(result.content) : result.content,
        provider: result.provider,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AgentMode][${runId}] Worker ${worker_id} attempt ${attempt + 1} failed:`, msg);
      if (attempt === 2) {
        return { success: false, error: msg };
      }
    }
  }

  return { success: false, error: 'All retry attempts exhausted' };
}

// ── Main chain executor ───────────────────────────────────────────────────────

export interface ExecuteChainParams {
  runId: string;
  chainId: string;
  userId: string;
  workspaceId?: string | null;
  workers: WorkerInChain[];
  triggerType: 'scheduled' | 'manual';
  supabase: AnySupabase;
}

async function resolveBillingContext(params: {
  userId: string;
  workspaceId?: string | null;
  supabase: AnySupabase;
}): Promise<{ creditOwnerId: string; billingPlan: string; workspaceId: string | null }> {
  const { userId, workspaceId, supabase } = params;

  if (!workspaceId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    return { creditOwnerId: userId, billingPlan: profile?.plan ?? 'none', workspaceId: null };
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id, plan')
    .eq('id', workspaceId)
    .single();

  const creditOwnerId = workspace?.owner_id ?? userId;
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', creditOwnerId)
    .single();

  return {
    creditOwnerId,
    billingPlan: ownerProfile?.plan || workspace?.plan || 'none',
    workspaceId,
  };
}

async function reserveLightTask(params: {
  workspaceId: string | null;
  billingPlan: string;
  supabase: AnySupabase;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { workspaceId, billingPlan, supabase } = params;

  if (!workspaceId) {
    return { ok: false, error: 'Workspace is required for light task usage tracking' };
  }

  const lightLimit = getPlanLightTaskLimit(billingPlan);
  if (lightLimit <= 0) {
    return { ok: false, error: 'Light tasks are not allowed on this plan' };
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'increment_light_task_count',
    { p_workspace_id: workspaceId, p_limit: lightLimit }
  );

  if (rpcError) {
    console.error('[AgentMode] increment_light_task_count RPC error:', rpcError.message);
    return { ok: false, error: 'Light task counter failed' };
  }

  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (result?.hit_limit) {
    return {
      ok: false,
      error: `Monthly light task limit reached (${lightLimit} tasks/${billingPlan} plan). Resets at your next billing period.`,
    };
  }

  if (!result?.ok) {
    return { ok: false, error: 'Light task counter failed' };
  }

  return { ok: true };
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

async function signStorageUrl(params: {
  supabase: AnySupabase;
  bucket: string;
  path: unknown;
  expiresInSeconds?: number;
}): Promise<string | null> {
  if (typeof params.path !== 'string' || !params.path.trim()) return null;
  const { data, error } = await params.supabase.storage
    .from(params.bucket)
    .createSignedUrl(params.path, params.expiresInSeconds ?? 60 * 60 * 24 * 30);
  if (error) return null;
  return data?.signedUrl ?? null;
}

async function normalizeMediaTaskOutputForChain(output: unknown, supabase: AnySupabase): Promise<Record<string, unknown>> {
  const data = (output && typeof output === 'object' ? { ...(output as Record<string, unknown>) } : {}) as Record<string, unknown>;

  if (!firstString(data.audio_url, data.audioUrl, data.downloadUrl, data.download_url, data.url, data.asset_url, data.assetUrl)) {
    const signedAudioUrl = await signStorageUrl({ supabase, bucket: 'audio-outputs', path: data.audio_path });
    if (signedAudioUrl) data.audio_url = signedAudioUrl;
  }

  if (!firstString(data.video_url, data.videoUrl, data.downloadUrl, data.download_url, data.url, data.asset_url, data.assetUrl)) {
    const signedVideoUrl = await signStorageUrl({ supabase, bucket: 'video-outputs', path: data.video_path });
    if (signedVideoUrl) data.video_url = signedVideoUrl;
  }

  return data;
}

function formatMediaTaskOutputForChain(output: unknown, mediaTaskId: string): string {
  const data = (output && typeof output === 'object' ? output : {}) as Record<string, unknown>;
  const lines: string[] = ['## Media Asset Generated', '', `media_task_id: ${mediaTaskId}`];

  const images = Array.isArray(data.images) ? data.images : [];
  const topLevelImageUrl = firstString(
    data.image_url,
    data.imageUrl,
    data.downloadUrl,
    data.download_url,
    data.signedUrl
  );
  const outputText = firstString(data.outputText, data.output_text, data.prompt_used, data.description, data.summary);
  const brandName = firstString(data.brandName, data.brand_name);
  const mode = firstString(data.shayMode, data.mode, data.cleanupMode, data.video_mode, data.sound_mode);
  const mediaKind = images.length > 0 || topLevelImageUrl ? 'image' : firstString(data.video_url, data.videoUrl) ? 'video' : firstString(data.audio_url, data.audioUrl) ? 'audio' : 'media';
  const assetContext = outputText ?? [
    `${images.length || topLevelImageUrl ? images.length + (topLevelImageUrl ? 1 : 0) : 1} ${mediaKind} asset${images.length + (topLevelImageUrl ? 1 : 0) === 1 ? '' : 's'} generated for this chain step.`,
    brandName ? `Brand: ${brandName}.` : '',
    mode ? `Mode: ${mode}.` : '',
  ].filter(Boolean).join(' ');
  if (assetContext) {
    lines.push('', '### Asset Context', assetContext.slice(0, 2000));
  }

  const metadata = [brandName ? `Brand: ${brandName}` : '', mode ? `Mode: ${mode}` : ''].filter(Boolean);
  if (metadata.length > 0) {
    lines.push('', '### Metadata', ...metadata.map((item) => `- ${item}`));
  }

  if (topLevelImageUrl || images.length > 0) {
    lines.push('', '### Images');
    if (topLevelImageUrl) lines.push(`- [Download image 1](${topLevelImageUrl})`);
    images.forEach((image: unknown, index: number) => {
      const imageData = (image && typeof image === 'object' ? image : {}) as Record<string, unknown>;
      const url = firstString(imageData.url, imageData.downloadUrl, imageData.download_url, imageData.signedUrl, imageData.image_url, imageData.imageUrl);
      if (url) lines.push(`- [Download image ${index + (topLevelImageUrl ? 2 : 1)}](${url})`);
    });
  }

  const videoUrl = firstString(
    data.video_url,
    data.videoUrl,
    data.downloadUrl,
    data.download_url,
    data.url,
    data.asset_url,
    data.assetUrl
  );
  if (videoUrl) {
    lines.push('', '### Video', `- [Download video](${videoUrl})`);
  }

  const audioUrl = firstString(
    data.audio_url,
    data.audioUrl,
    data.downloadUrl,
    data.download_url,
    data.url,
    data.asset_url,
    data.assetUrl
  );
  if (audioUrl && audioUrl !== videoUrl) {
    lines.push('', '### Audio', `- [Download audio](${audioUrl})`);
  }

  const files = Array.isArray(data.files) ? data.files : [];
  if (files.length > 0 || firstString(data.file_url, data.fileUrl)) {
    lines.push('', '### Files');
    const topLevelFileUrl = firstString(data.file_url, data.fileUrl);
    if (topLevelFileUrl) lines.push(`- [Download file](${topLevelFileUrl})`);
    files.forEach((file: unknown, index: number) => {
      const fileData = (file && typeof file === 'object' ? file : {}) as Record<string, unknown>;
      const url = firstString(fileData.url, fileData.downloadUrl, fileData.download_url, fileData.signedUrl, fileData.file_url, fileData.fileUrl);
      const label = firstString(fileData.label, fileData.name, fileData.fileName) ?? `File ${index + 1}`;
      if (url) lines.push(`- [Download ${label}](${url})`);
    });
  }

  if (lines.length <= 3) {
    lines.push('', '```json', JSON.stringify(data, null, 2), '```');
  }

  return lines.join('\n');
}

async function triggerVideoPoll(siteUrl: string, runId: string, mediaTaskId: string): Promise<void> {
  if (!process.env.CRON_SECRET) return;
  try {
    const res = await fetch(`${siteUrl}/api/cron/poll-video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
        'User-Agent': 'vercel-cron/agent-mode-chain',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[AgentMode][${runId}] Video poll trigger for ${mediaTaskId} returned ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[AgentMode][${runId}] Video poll trigger for ${mediaTaskId} failed:`, msg);
  }
}

async function waitForMediaTaskCompletion(params: {
  mediaTaskId: string;
  workerId: string;
  runId: string;
  siteUrl: string;
  supabase: AnySupabase;
}): Promise<{ data: Record<string, unknown> | null; error?: string }> {
  const { mediaTaskId, workerId, runId, siteUrl, supabase } = params;
  const deadline = Date.now() + 10 * 60 * 1000;
  const isVideoWorker = ['product-video-creator', 'b-roll-generator', 'scene-director', 'ad-creative-generator'].includes(workerId);
  let attempts = 0;

  while (Date.now() < deadline) {
    const { data: mediaTask, error: mediaTaskError } = await supabase
      .from('tasks')
      .select('status, output, output_format, model_used, error_message')
      .eq('id', mediaTaskId)
      .single();

    if (mediaTaskError || !mediaTask) {
      return { data: null, error: 'Media generation completed but the result could not be loaded.' };
    }

    if (mediaTask.status === 'completed') return { data: mediaTask as Record<string, unknown> };
    if (mediaTask.status === 'failed') return { data: null, error: mediaTask.error_message || 'Media generation failed.' };

    if (isVideoWorker && attempts % 2 === 0) {
      await triggerVideoPoll(siteUrl, runId, mediaTaskId);
    }

    attempts++;
    await sleep(isVideoWorker ? 15000 : 5000);
  }

  return { data: null, error: 'Media generation timed out while waiting for the generated asset.' };
}

async function executeMediaWorkerViaTaskPipeline(params: {
  worker_id: string;
  position: number;
  form_settings: Record<string, string>;
  previousResults: WorkerRunResult[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workerRegistry: any[];
  userId: string;
  workspaceId: string | null;
  runId: string;
  chainId: string;
  supabase: AnySupabase;
}): Promise<{ success: boolean; output?: string; provider?: 'anthropic' | 'openai'; error?: string }> {
  const { worker_id, form_settings, previousResults, workerRegistry, userId, workspaceId, runId, chainId, supabase } = params;

  const workerConfig = getWorkerPromptConfig(worker_id);
  if (!workerConfig) {
    return { success: false, error: `No prompt config for worker: ${worker_id}` };
  }

  const formConfig = getWorkerFormConfig(worker_id);
  if (formConfig) {
    const validFieldNames = new Set(
      formConfig.sections.flatMap((s: { fields: Array<{ name: string }> }) => s.fields.map((f) => f.name))
    );
    const workerReg = getWorkerBySlug(worker_id) as { workerModeField?: string } | null;
    if (workerReg?.workerModeField) validFieldNames.add(workerReg.workerModeField);
    const unknownKeys = Object.keys(form_settings).filter((k) => !validFieldNames.has(k));
    if (unknownKeys.length > 0) {
      return {
        success: false,
        error:
          `Playbook step configuration error: field(s) [${unknownKeys.join(', ')}] do not exist ` +
          `for worker "${worker_id}". Run the preset validator to find all affected steps.`,
      };
    }
  }

  const fieldValidation = validateRequiredFields(worker_id, form_settings as Record<string, unknown>);
  if (!fieldValidation.valid) {
    return {
      success: false,
      error: `Missing required fields for ${worker_id}: ${fieldValidation.missing.join(', ')}. Update the Playbook step settings.`,
    };
  }

  const outputContext = buildOutputContext(previousResults, workerRegistry);
  const mediaInput: Record<string, string> = {
    ...form_settings,
    ...(outputContext ? { chain_context: outputContext } : {}),
  };

  if (
    worker_id === 'logo-concept-generator' &&
    String(mediaInput.shay_mode || '').startsWith('refine_') &&
    !firstString(mediaInput.selected_concept_url, mediaInput.reference_image_url)
  ) {
    const previousImageUrl = extractFirstImageUrlFromPreviousResults(previousResults);
    if (previousImageUrl) mediaInput.selected_concept_url = previousImageUrl;
  }

  const workerReg = getWorkerBySlug(worker_id);
  const { data: insertedTask, error: insertError } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      worker_slug: worker_id,
      worker_title_at_creation: workerReg?.name ?? null,
      category: workerReg?.category ?? null,
      input: mediaInput,
      status: 'processing',
      task_type: workerReg?.taskType ?? 'light',
      credits_charged: 0,
      output: {
        chain_run_id: runId,
        chain_id: chainId,
        chain_position: params.position,
        note: 'Agent Mode media subtask. Credits are charged on the parent chain step only.',
      },
    })
    .select('id')
    .single();

  if (insertError || !insertedTask?.id) {
    console.error(`[AgentMode][${runId}] Failed to create media task for ${worker_id}:`, insertError);
    return { success: false, error: 'Could not create media generation task for this chain step.' };
  }

  const mediaTaskId = insertedTask.id as string;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';
  const res = await fetch(`${siteUrl}/api/execute-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({ taskId: mediaTaskId, alreadyClaimed: true }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let parsedError = '';
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      parsedError = firstString(parsed.error, parsed.message) ?? '';
    } catch {
      parsedError = body.trim();
    }
    console.error(`[AgentMode][${runId}] Media execute-task failed for ${mediaTaskId}: ${res.status} ${body.slice(0, 1000)}`);
    return { success: false, error: `Media generation failed (${res.status})${parsedError ? `: ${parsedError}` : ''}.` };
  }

  const mediaResult = await waitForMediaTaskCompletion({
    mediaTaskId,
    workerId: worker_id,
    runId,
    siteUrl,
    supabase,
  });

  if (!mediaResult.data) {
    return { success: false, error: mediaResult.error || 'Media generation did not complete.' };
  }

  const normalizedOutput = await normalizeMediaTaskOutputForChain(mediaResult.data.output, supabase);

  return {
    success: true,
    output: formatMediaTaskOutputForChain(normalizedOutput, mediaTaskId),
    provider: 'openai',
  };
}

export async function executeChain(params: ExecuteChainParams): Promise<void> {
  const { runId, userId, workspaceId, workers, supabase } = params;

  const normalizedWorkers = workers.map((worker, index) => ({
    ...worker,
    position: worker.position ?? index + 1,
    form_settings: getWorkerSettings(worker),
  }));

  const incompatibleWorkers = getChainIncompatibleWorkers(normalizedWorkers);
  if (incompatibleWorkers.length > 0) {
    const error = formatChainIncompatibleWorkerError(incompatibleWorkers);
    const workerResults: WorkerRunResult[] = incompatibleWorkers.map(worker => ({
      worker_id: worker.worker_id,
      position: worker.position,
      status: 'failed',
      error,
      credits_consumed: { light: 0, heavy: 0 },
      credits_refunded: { light: 0, heavy: 0 },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }));

    await supabase
      .from('agent_mode_runs')
      .update({
        status: 'failed',
        worker_results: workerResults,
        total_light_consumed: 0,
        total_heavy_consumed: 0,
        total_light_refunded: 0,
        total_heavy_refunded: 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    console.error(`[AgentMode][${runId}] Chain-compatible validation blocked run: ${error}`);
    return;
  }

  const billing = await resolveBillingContext({ userId, workspaceId, supabase });

  // Load user's workspace brand context with legacy profile fallback
  const brandContext = await loadBrandContext({ userId, workspaceId: workspaceId ?? null, supabase });

  // Load worker registry entries for output context labels
  const workerRegistry = workers.map(w => getWorkerBySlug(w.worker_id));

  const workerResults: WorkerRunResult[] = [];
  let totalLightConsumed = 0;
  let totalHeavyConsumed = 0;
  let totalLightRefunded = 0;
  let totalHeavyRefunded = 0;
  let chainFailed = false;
  let failedAtPosition = -1;
  const providers: string[] = [];

  // Execute workers sequentially
  for (const worker of normalizedWorkers.sort((a, b) => a.position - b.position)) {
    const startedAt = new Date().toISOString();
    const effectiveFormSettings = getWorkerSettings(worker, workerResults);
    const cost = getWorkerCreditCost(worker.worker_id, effectiveFormSettings, { requireMode: true });

    // If a previous worker failed, mark this one as skipped + refund
    if (chainFailed) {
      workerResults.push({
        worker_id: worker.worker_id,
        position: worker.position,
        status: 'skipped',
        credits_consumed: { light: 0, heavy: 0 },
        credits_refunded: { light: 0, heavy: 0 },
        started_at: startedAt,
      });
      continue;
    }

    const stepReferenceId = `${runId}:${worker.position}:${worker.worker_id}`;

    if (cost.light > 0) {
      const lightReservation = await reserveLightTask({
        workspaceId: billing.workspaceId,
        billingPlan: billing.billingPlan,
        supabase,
      });

      if (!lightReservation.ok) {
        chainFailed = true;
        failedAtPosition = worker.position;
        workerResults.push({
          worker_id: worker.worker_id,
          position: worker.position,
          status: 'failed',
          error: lightReservation.error,
          credits_consumed: { light: 0, heavy: 0 },
          credits_refunded: { light: 0, heavy: 0 },
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
        continue;
      }
    }

    // D6 fix: use atomic credit ledger RPC instead of non-atomic read+write
    if (cost.heavy > 0) {
      const debitResult = await debitCredits({
        userId: billing.creditOwnerId,
        amount: cost.heavy,
        referenceId: stepReferenceId,
        referenceType: 'chain_step',
        workspaceId: billing.workspaceId,
        supabase,
      });

      if (!debitResult.ok) {
        // Insufficient credits or RPC error — fail this worker + all downstream
        chainFailed = true;
        failedAtPosition = worker.position;
        workerResults.push({
          worker_id: worker.worker_id,
          position: worker.position,
          status: 'failed',
          error: debitResult.errorCode === 'insufficient_credits' ? 'Insufficient credits' : 'Credit debit failed',
          credits_consumed: { light: 0, heavy: 0 },
          credits_refunded: { light: 0, heavy: 0 },
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
        continue;
      }
    }
    totalLightConsumed += cost.light;
    totalHeavyConsumed += cost.heavy;

    // Execute the worker
    let result: Awaited<ReturnType<typeof executeWorkerWithRetry>>;
    try {
      if (isMediaTaskWorker(worker.worker_id)) {
        result = await executeMediaWorkerViaTaskPipeline({
          worker_id: worker.worker_id,
          position: worker.position,
          form_settings: effectiveFormSettings,
          previousResults: workerResults,
          workerRegistry,
          userId,
          workspaceId: billing.workspaceId,
          runId,
          chainId: params.chainId,
          supabase,
        });
      } else {
        result = await executeWorkerWithRetry({
          worker_id: worker.worker_id,
          position: worker.position,
          form_settings: effectiveFormSettings,
          previousResults: workerResults,
          workerRegistry,
          brandContext,
          runId,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AgentMode][${runId}] Worker ${worker.worker_id} crashed after billing:`, msg);

      chainFailed = true;
      failedAtPosition = worker.position;

      const heavyRefunded = await refundHeavyStep({
        cost,
        billing,
        stepReferenceId,
        supabase,
      });
      const lightRefunded = await refundLightStep({
        cost,
        workspaceId: billing.workspaceId,
        supabase,
      });

      totalLightConsumed -= lightRefunded;
      totalLightRefunded += lightRefunded;
      totalHeavyConsumed -= heavyRefunded;
      totalHeavyRefunded += heavyRefunded;

      workerResults.push({
        worker_id: worker.worker_id,
        position: worker.position,
        status: 'failed',
        error: msg || 'Worker execution crashed',
        credits_consumed: { light: cost.light - lightRefunded, heavy: cost.heavy - heavyRefunded },
        credits_refunded: { light: lightRefunded, heavy: heavyRefunded },
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });

      await supabase
        .from('agent_mode_runs')
        .update({ worker_results: workerResults })
        .eq('id', runId);

      continue;
    }

    const completedAt = new Date().toISOString();

    if (result.success && result.output) {
      if (result.provider) providers.push(result.provider);
      workerResults.push({
        worker_id: worker.worker_id,
        position: worker.position,
        status: 'completed',
        output: result.output,
        provider: result.provider,
        credits_consumed: cost,
        credits_refunded: { light: 0, heavy: 0 },
        started_at: startedAt,
        completed_at: completedAt,
      });
    } else {
      // Worker failed — refund this worker's credits, mark downstream as skipped
      chainFailed = true;
      failedAtPosition = worker.position;

      // D6 fix: atomic refund via ledger RPC
      const heavyRefunded = await refundHeavyStep({
        cost,
        billing,
        stepReferenceId,
        supabase,
      });
      const lightRefunded = await refundLightStep({
        cost,
        workspaceId: billing.workspaceId,
        supabase,
      });
      totalLightConsumed -= lightRefunded;
      totalLightRefunded += lightRefunded;
      totalHeavyConsumed -= heavyRefunded;
      totalHeavyRefunded += heavyRefunded;

      workerResults.push({
        worker_id: worker.worker_id,
        position: worker.position,
        status: 'failed',
        error: result.error ?? 'Worker execution failed',
        credits_consumed: { light: cost.light - lightRefunded, heavy: cost.heavy - heavyRefunded },
        credits_refunded: { light: lightRefunded, heavy: heavyRefunded },
        started_at: startedAt,
        completed_at: completedAt,
      });
    }

    // Save intermediate progress to run record
    await supabase
      .from('agent_mode_runs')
      .update({ worker_results: workerResults })
      .eq('id', runId);
  }

  // Determine final status
  const hasCompleted = workerResults.some(r => r.status === 'completed');
  const hasFailed = workerResults.some(r => r.status === 'failed');
  let finalStatus: 'completed' | 'partial' | 'failed';
  if (!hasFailed) {
    finalStatus = 'completed';
  } else if (hasCompleted) {
    finalStatus = 'partial';
  } else {
    finalStatus = 'failed';
  }

  // Determine provider_used
  const uniqueProviders = [...new Set(providers)];
  const providerUsed = uniqueProviders.length === 0 ? 'anthropic'
    : uniqueProviders.length > 1 ? 'mixed'
    : uniqueProviders[0] as 'anthropic' | 'openai';

  // Final run record update
  await supabase
    .from('agent_mode_runs')
    .update({
      status: finalStatus,
      worker_results: workerResults,
      provider_used: providerUsed,
      total_light_consumed: Math.max(0, totalLightConsumed),
      total_heavy_consumed: Math.max(0, totalHeavyConsumed),
      total_light_refunded: totalLightRefunded,
      total_heavy_refunded: totalHeavyRefunded,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  // Create in-app notification
  const chainData = await supabase
    .from('agent_mode_chains')
    .select('name')
    .eq('id', params.chainId)
    .single();
  const chainName = chainData.data?.name ?? 'Your chain';

  let notifType: string;
  let notifTitle: string;
  let notifMessage: string;

  if (finalStatus === 'completed') {
    notifType = 'completed';
    notifTitle = `✅ ${chainName} completed`;
    notifMessage = `All ${workerResults.filter(r => r.status === 'completed').length} workers finished successfully.`;
  } else if (finalStatus === 'partial') {
    const failedWorker = workerResults.find(r => r.status === 'failed');
    notifType = 'partial';
    notifTitle = `⚠️ ${chainName} partially completed`;
    notifMessage = `${failedWorker?.worker_id ?? 'A worker'} failed at step ${failedAtPosition}. Steps 1–${failedAtPosition - 1} completed. Credits for steps ${failedAtPosition}+ have been refunded.`;
  } else {
    notifType = 'failed';
    notifTitle = `❌ ${chainName} failed`;
    notifMessage = `The chain could not complete. All credits have been refunded.`;
  }

  await supabase.from('agent_mode_notifications').insert({
    user_id: userId,
    chain_id: params.chainId,
    run_id: runId,
    type: notifType,
    title: notifTitle,
    message: notifMessage,
  });
}
