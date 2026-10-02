import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
for (const line of envLines) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const MODEL_MAP = {
  anthropic: { sonnet: 'claude-sonnet-4-6', haiku: 'claude-haiku-4-5-20251001' },
  openai:    { sonnet: 'gpt-4o',            haiku: 'gpt-4o-mini' },
};

const fallbackLog = [];
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function logFallback(ctx) { fallbackLog.push(ctx); console.log('  📋 FALLBACK LOG:', JSON.stringify(ctx)); }

async function callAnthropic(params, key) {
  const client = new Anthropic({ apiKey: key });
  const model = MODEL_MAP.anthropic[params.model_tier];
  const res = await client.messages.create({ model, max_tokens: params.max_tokens ?? 200, system: params.system, messages: params.messages });
  return { content: res.content[0].type === 'text' ? res.content[0].text : '', provider: 'anthropic', model, tokens_used: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
}

async function callOpenAI(params, key) {
  const client = new OpenAI({ apiKey: key });
  const model = MODEL_MAP.openai[params.model_tier];
  const msgs = [];
  if (params.system) msgs.push({ role: 'system', content: params.system });
  for (const m of params.messages) msgs.push({ role: m.role, content: m.content });
  const res = await client.chat.completions.create({ model, max_tokens: params.max_tokens ?? 200, messages: msgs });
  return { content: res.choices[0]?.message?.content ?? '', provider: 'openai', model, tokens_used: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 } };
}

async function callAI(params, options, { anthropicKey, openaiKey } = {}) {
  const aKey = anthropicKey ?? process.env.ANTHROPIC_API_KEY;
  const oKey = openaiKey ?? process.env.OPENAI_API_KEY;
  const timestamp = new Date().toISOString();
  const workerId = options?.worker_id;
  try {
    return await callAnthropic(params, aKey);
  } catch (e1) {
    console.log('  ⚠️  Anthropic #1 failed:', e1.message?.slice(0, 80));
    await sleep(2000);
    try {
      return await callAnthropic(params, aKey);
    } catch (e2) {
      const anErr = e2.message?.slice(0, 80);
      console.log('  ⚠️  Anthropic #2 failed:', anErr);
      try {
        const r = await callOpenAI(params, oKey);
        logFallback({ timestamp, worker_id: workerId, model_tier: params.model_tier, anthropic_error: anErr, fallback_result: 'success' });
        return r;
      } catch (e3) {
        console.log('  ⚠️  OpenAI #1 failed:', e3.message?.slice(0, 80));
        await sleep(2000);
        try {
          const r = await callOpenAI(params, oKey);
          logFallback({ timestamp, worker_id: workerId, model_tier: params.model_tier, anthropic_error: anErr, fallback_result: 'success' });
          return r;
        } catch (e4) {
          logFallback({ timestamp, worker_id: workerId, model_tier: params.model_tier, anthropic_error: anErr, fallback_result: 'fail' });
          throw new Error('Our AI workers are temporarily unavailable. Please try again in a few minutes.');
        }
      }
    }
  }
}

const PROMPT = {
  model_tier: 'sonnet',
  system: 'You are a helpful assistant. Keep answers to 1 sentence.',
  messages: [{ role: 'user', content: 'What is the capital of France?' }],
  max_tokens: 60,
};

let allPassed = true;
function pass(label) { console.log(`  ✅ PASS: ${label}`); }
function fail(label, r) { console.log(`  ❌ FAIL: ${label} — ${r}`); allPassed = false; }

// ── TEST 1 ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 1: Normal operation — Anthropic primary');
console.log('══════════════════════════════════════════════');
try {
  const r = await callAI(PROMPT, { worker_id: 'test-worker-1' });
  console.log(`  provider: ${r.provider} | model: ${r.model}`);
  console.log(`  tokens:   in=${r.tokens_used.input} out=${r.tokens_used.output}`);
  console.log(`  response: "${r.content.trim()}"`);
  if (r.provider === 'anthropic') pass('provider=anthropic'); else fail('provider=anthropic', r.provider);
  if (r.model === 'claude-sonnet-4-6') pass('model=claude-sonnet-4-6'); else fail('model=claude-sonnet-4-6', r.model);
  if (r.content.length > 5) pass('non-empty response'); else fail('non-empty response', 'empty');
} catch(e) { fail('Test 1 threw', e.message); }

// ── TEST 2 ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 2: Anthropic outage → OpenAI fallback');
console.log('══════════════════════════════════════════════');
const preFallbackCount = fallbackLog.length;
try {
  const r = await callAI(PROMPT, { worker_id: 'test-worker-2' }, { anthropicKey: 'REMOVED_SECRET_PLACEHOLDER', openaiKey: process.env.OPENAI_API_KEY });
  console.log(`  provider: ${r.provider} | model: ${r.model}`);
  console.log(`  tokens:   in=${r.tokens_used.input} out=${r.tokens_used.output}`);
  console.log(`  response: "${r.content.trim()}"`);
  if (r.provider === 'openai') pass('provider=openai (fallback)'); else fail('provider=openai', r.provider);
  if (r.model === 'gpt-4o') pass('model=gpt-4o'); else fail('model=gpt-4o', r.model);
  if (r.content.length > 5) pass('fallback response is real/usable'); else fail('fallback response usable', 'empty');
  if (fallbackLog.length > preFallbackCount && fallbackLog.at(-1).fallback_result === 'success') pass('fallback event logged (success)'); else fail('fallback logged', 'no log entry');
} catch(e) { fail('Test 2 threw', e.message); }

// ── TEST 3 ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 3: Both providers down → clean error');
console.log('══════════════════════════════════════════════');
try {
  await callAI(PROMPT, { worker_id: 'test-worker-3' }, { anthropicKey: 'sk-ant-invalid', openaiKey: 'sk-proj-invalid' });
  fail('should have thrown', 'no error thrown');
} catch(e) {
  console.log(`  error: "${e.message}"`);
  if (e.message.includes('temporarily unavailable')) pass('clean user-facing error'); else fail('clean error message', e.message);
  if (fallbackLog.some(l => l.fallback_result === 'fail')) pass('both-down event logged'); else fail('both-down logged', 'missing');
}

// ── TEST 4 ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 4: Restore — routes back to Anthropic');
console.log('══════════════════════════════════════════════');
try {
  const r = await callAI(PROMPT, { worker_id: 'test-worker-4' });
  console.log(`  provider: ${r.provider} | model: ${r.model}`);
  console.log(`  response: "${r.content.trim()}"`);
  if (r.provider === 'anthropic') pass('back to anthropic (not stuck on OpenAI)'); else fail('back to anthropic', r.provider);
  if (r.model === 'claude-sonnet-4-6') pass('model=claude-sonnet-4-6'); else fail('model=claude-sonnet-4-6', r.model);
} catch(e) { fail('Test 4 threw', e.message); }

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(allPassed ? '🎉 ALL 4 TESTS PASSED' : '⚠️  SOME TESTS FAILED');
console.log(`Fallback events logged: ${fallbackLog.length}`);
console.log('Model map confirmed:');
console.log('  sonnet → anthropic: claude-sonnet-4-6  |  openai: gpt-4o');
console.log('  haiku  → anthropic: claude-haiku-4-5-20251001  |  openai: gpt-4o-mini');
console.log('══════════════════════════════════════════════\n');
