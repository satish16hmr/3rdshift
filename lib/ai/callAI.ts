/**
 * callAI — unified AI provider abstraction for 3rdShift
 *
 * Primary:  Anthropic (Claude Sonnet / Haiku)
 * Fallback: OpenAI   (GPT-4o / GPT-4o-mini)
 *
 * Flow per call:
 *   1. Try Anthropic → success → return
 *   2. Anthropic fails → wait 5s → retry once
 *   3. Retry fails → try OpenAI → success → return (tagged provider: "openai")
 *   4. OpenAI fails → wait 5s → retry once
 *   5. Both fail → throw clean user-facing error
 *
 * Every fallback event is logged to console (server logs / Vercel logs).
 * The "provider" field in the response is for internal logging only —
 * never expose it to customers.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Log external API calls (Serper, Apollo, fal.ai) to ai_call_log with full metadata
// This is the admin-visible record — never shown to customers
export function logExternalAPICall(entry: {
  user_id?: string;
  task_id?: string;
  worker_id?: string;
  provider: string; // 'serper' | 'apollo' | 'fal.ai'
  success: boolean;
  latency_ms: number;
  metadata: Record<string, unknown>; // query, result_count, urls, error, etc.
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  fetch(`${url}/rest/v1/ai_call_log`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      call_type: `external:${entry.provider}`,
      model_tier: 'external',
      provider_used: entry.provider,
      is_fallback: false,
      user_id: entry.user_id,
      task_id: entry.task_id,
      worker_id: entry.worker_id,
      latency_ms: entry.latency_ms,
      success: entry.success,
      metadata: entry.metadata,
    }),
  }).catch(() => {});
}

// Fire-and-forget logger — uses fetch directly to ensure it fires before function returns
function logAICall(entry: {
  user_id?: string;
  task_id?: string;
  call_type: string;
  model_tier: string;
  provider_used: string;
  is_fallback: boolean;
  worker_id?: string;
  chain_run_id?: string;
  latency_ms: number;
  success: boolean;
  input_tokens?: number;
  output_tokens?: number;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  // Use fetch directly — more reliable fire-and-forget in serverless than Supabase client
  fetch(`${url}/rest/v1/ai_call_log`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  }).catch(() => {}); // never throws
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelTier = 'sonnet' | 'haiku';

export interface CallAIParams {
  /** 'sonnet' for workers, 'haiku' for JARVIS / light orchestration */
  model_tier: ModelTier;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  /** Optional timeout in ms. Defaults to Anthropic SDK default (600s). Use to stay within Fluid Compute budget. */
  timeout?: number;
}

export interface CallAIResponse {
  /** The AI response text */
  content: string;
  /** Which provider actually answered — internal use only, never show to users */
  provider: 'anthropic' | 'openai';
  /** Model that answered */
  model: string;
  tokens_used: {
    input: number;
    output: number;
  };
}

// ── Model mappings ───────────────────────────────────────────────────────────

const MODEL_MAP = {
  anthropic: {
    sonnet: 'claude-sonnet-4-6',
    haiku: 'claude-haiku-4-5-20251001',
  },
  openai: {
    sonnet: 'gpt-4o',
    haiku: 'gpt-4o-mini',
  },
} as const;

// ── Clients (lazy — only instantiate when the key is present) ────────────────

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logFallback(context: {
  timestamp: string;
  worker_id?: string;
  model_tier: ModelTier;
  anthropic_error: string;
  fallback_result: 'success' | 'fail';
}): void {
  // Structured log — visible in Vercel function logs
  console.warn('[3rdShift][AI Fallback]', JSON.stringify(context));
}

// ── Anthropic call ───────────────────────────────────────────────────────────
// Stream threshold: use streaming for large outputs (>= 8K tokens) to avoid
// the SDK's blocking 600s timeout. Streaming has no response-body timeout —
// only a connection timeout — so 16K-20K token signature/premium outputs
// complete reliably even under Anthropic API load.
const STREAM_THRESHOLD_TOKENS = 8000;
const STREAM_WATCHDOG_MS = 5 * 60 * 1000;

async function callAnthropic(
  params: CallAIParams,
): Promise<CallAIResponse> {
  const client = getAnthropicClient();
  const model = MODEL_MAP.anthropic[params.model_tier];
  const maxTokens = params.max_tokens ?? 4000;

  // Use streaming for large outputs to avoid blocking timeout.
  // stream().finalMessage() accumulates the full response and resolves only when complete.
  // No response-body timeout — keeps the connection alive for 16K-20K token outputs.
  if (maxTokens >= STREAM_THRESHOLD_TOKENS) {
    const streamStart = Date.now();
    let streamInputTokens = 0;
    let streamOutputTokens = 0;
    try {
      const runner = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: params.system,
        messages: params.messages,
      });

      const watchdog = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI generation timed out — please try again.')), STREAM_WATCHDOG_MS);
      });
      const finalMessage = await Promise.race([runner.finalMessage(), watchdog]);

      const content =
        finalMessage.content[0]?.type === 'text' ? finalMessage.content[0].text : '';
      streamInputTokens = finalMessage.usage.input_tokens;
      streamOutputTokens = finalMessage.usage.output_tokens;

      return {
        content,
        provider: 'anthropic',
        model,
        tokens_used: {
          input: streamInputTokens,
          output: streamOutputTokens,
        },
      };
    } catch (streamErr) {
      // Mid-stream errors: rate limit, overload, context window, network interruption
      // Re-throw with a clean user-facing message; callAI() outer catch handles refund + logging
      const rawMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      const latencyMs = Date.now() - streamStart;
      console.warn(`[3rdShift][AI] Anthropic streaming failed (${latencyMs}ms, ~${streamOutputTokens} output tokens collected):`, rawMsg);
      // Translate known Anthropic error types into user-friendly messages
      if (/overloaded|529|capacity/i.test(rawMsg)) {
        throw new Error('Claude is temporarily overloaded — please retry in a moment.');
      } else if (/rate.?limit|429/i.test(rawMsg)) {
        throw new Error('Rate limit reached — please retry in a few seconds.');
      } else if (/context.?window|too.?large|maximum.*tokens/i.test(rawMsg)) {
        throw new Error('Input is too long for this worker — please shorten your request.');
      } else if (/timeout|timed.?out/i.test(rawMsg)) {
        throw new Error('AI generation timed out — please try again.');
      }
      throw new Error(`AI generation failed — please try again. (${rawMsg.slice(0, 80)})`);
    }
  }

  // Non-streaming for lighter calls (< 8K tokens)
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: params.system,
    messages: params.messages,
  }, params.timeout ? { timeout: params.timeout } : undefined);

  const content =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content,
    provider: 'anthropic',
    model,
    tokens_used: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

// ── OpenAI call ──────────────────────────────────────────────────────────────

async function callOpenAI(
  params: CallAIParams,
): Promise<CallAIResponse> {
  const client = getOpenAIClient();
  const model = MODEL_MAP.openai[params.model_tier];

  // Build messages array — OpenAI uses a system message object
  const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [];

  if (params.system) {
    oaiMessages.push({ role: 'system', content: params.system });
  }

  for (const m of params.messages) {
    oaiMessages.push({ role: m.role, content: m.content });
  }

  const response = await client.chat.completions.create({
    model,
    max_tokens: params.max_tokens ?? 4000,
    messages: oaiMessages,
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
  });

  const content = response.choices[0]?.message?.content ?? '';

  return {
    content,
    provider: 'openai',
    model,
    tokens_used: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}

// ── Main exported function ───────────────────────────────────────────────────

/**
 * Call the AI with automatic fallback.
 *
 * @param params  - Request parameters (model_tier, messages, system, max_tokens, temperature)
 * @param options - Optional metadata for logging (worker_id, user_id, chain_run_id, call_type)
 */
export async function callAI(
  params: CallAIParams,
  options?: { worker_id?: string; user_id?: string; task_id?: string; chain_run_id?: string; call_type?: string },
): Promise<CallAIResponse> {
  const timestamp = new Date().toISOString();
  const workerId = options?.worker_id;
  const callType = options?.call_type ?? (options?.chain_run_id ? 'orchestration' : options?.worker_id ? 'worker' : 'unknown');
  const startMs = Date.now();

  // ── Attempt 1: Anthropic ─────────────────────────────────────────────────
  try {
    const result = await callAnthropic(params);
    logAICall({ user_id: options?.user_id, task_id: options?.task_id, call_type: callType, model_tier: params.model_tier, provider_used: 'anthropic', is_fallback: false, worker_id: workerId, chain_run_id: options?.chain_run_id, latency_ms: Date.now() - startMs, success: true, input_tokens: result.tokens_used.input, output_tokens: result.tokens_used.output });
    return result;
  } catch (err1) {
    const anthropicError1 = err1 instanceof Error ? err1.message : String(err1);
    console.warn(
      `[3rdShift][AI] Anthropic attempt 1 failed (tier=${params.model_tier}):`,
      anthropicError1,
    );

    // Timeout, overload, rate-limit, context errors: don't retry Anthropic — throw immediately
    // (These errors come from callAnthropic's streaming error handler with clean messages)
    if (/timeout|timed.?out|overloaded|rate.?limit|context.?window|too.?large|input.?too.?long|temporarily/i.test(anthropicError1)) {
      logAICall({ user_id: options?.user_id, task_id: options?.task_id, call_type: callType, model_tier: params.model_tier, provider_used: 'anthropic', is_fallback: false, worker_id: workerId, chain_run_id: options?.chain_run_id, latency_ms: Date.now() - startMs, success: false });
      throw err1; // preserve the clean user-facing message from callAnthropic
    }

    // ── Attempt 2: Anthropic retry ───────────────────────────────────────
    await sleep(5000);
    try {
      const result = await callAnthropic(params);
      logAICall({ user_id: options?.user_id, task_id: options?.task_id, call_type: callType, model_tier: params.model_tier, provider_used: 'anthropic', is_fallback: false, worker_id: workerId, chain_run_id: options?.chain_run_id, latency_ms: Date.now() - startMs, success: true, input_tokens: result.tokens_used.input, output_tokens: result.tokens_used.output });
      return result;
    } catch (err2) {
      const anthropicError2 = err2 instanceof Error ? err2.message : String(err2);
      console.warn(
        `[3rdShift][AI] Anthropic attempt 2 failed (tier=${params.model_tier}):`,
        anthropicError2,
      );

      const anthropicErrorFinal = anthropicError2;

      // ── Attempt 3: OpenAI ──────────────────────────────────────────────
      try {
        const result = await callOpenAI(params);
        logFallback({ timestamp, worker_id: workerId, model_tier: params.model_tier, anthropic_error: anthropicErrorFinal, fallback_result: 'success' });
        logAICall({ user_id: options?.user_id, task_id: options?.task_id, call_type: callType, model_tier: params.model_tier, provider_used: 'openai', is_fallback: true, worker_id: workerId, chain_run_id: options?.chain_run_id, latency_ms: Date.now() - startMs, success: true, input_tokens: result.tokens_used.input, output_tokens: result.tokens_used.output });
        return result;
      } catch (err3) {
        const openaiError1 = err3 instanceof Error ? err3.message : String(err3);
        console.warn(`[3rdShift][AI] OpenAI attempt 1 failed (tier=${params.model_tier}):`, openaiError1);

        // ── Attempt 4: OpenAI retry ────────────────────────────────────
        await sleep(5000);
        try {
          const result = await callOpenAI(params);
          logFallback({ timestamp, worker_id: workerId, model_tier: params.model_tier, anthropic_error: anthropicErrorFinal, fallback_result: 'success' });
          logAICall({ user_id: options?.user_id, task_id: options?.task_id, call_type: callType, model_tier: params.model_tier, provider_used: 'openai', is_fallback: true, worker_id: workerId, chain_run_id: options?.chain_run_id, latency_ms: Date.now() - startMs, success: true, input_tokens: result.tokens_used.input, output_tokens: result.tokens_used.output });
          return result;
        } catch (err4) {
          const openaiError2 = err4 instanceof Error ? err4.message : String(err4);
          console.error(`[3rdShift][AI] Both providers failed (tier=${params.model_tier}):`, { anthropic: anthropicErrorFinal, openai: openaiError2 });
          logFallback({ timestamp, worker_id: workerId, model_tier: params.model_tier, anthropic_error: anthropicErrorFinal, fallback_result: 'fail' });
          logAICall({ user_id: options?.user_id, task_id: options?.task_id, call_type: callType, model_tier: params.model_tier, provider_used: 'anthropic', is_fallback: false, worker_id: workerId, chain_run_id: options?.chain_run_id, latency_ms: Date.now() - startMs, success: false });
          throw new Error('Our AI team members are temporarily unavailable. Please try again in a few minutes.');
        }
      }
    }
  }
}
