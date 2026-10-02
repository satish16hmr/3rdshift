/**
 * generate-registry-export.mts
 * Generates Deliverable 1: Worker Registry Export
 * Run: npx tsx scripts/generate-registry-export.mts
 */

import { workers } from '../lib/workers/registry';
import { getWorkerFormConfig, getWorkerPromptConfig } from '../lib/workers/configs';
import * as fs from 'fs';
import * as path from 'path';

const OUT_PATH = '/Users/3rdshift/.openclaw/workspace/outputs/worker-registry-audit.md';

// Rough token estimate: ~0.75 tokens per word, ~5 chars per word → ~chars/6.67
function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

function formatField(f: any): string {
  let line = `- **${f.label || f.name}** | ${f.placeholder || '—'} | ${f.type} | ${f.required ? 'required' : 'optional'}`;
  if (f.options && Array.isArray(f.options)) {
    const opts = f.options.map((o: any) => (typeof o === 'object' ? o.label : o)).join(', ');
    line += ` | Options: ${opts}`;
  }
  if (f.defaultValue) line += ` | Default: ${f.defaultValue}`;
  if (f.showWhen) line += ` | Shows when: ${f.showWhen.field}=${f.showWhen.value}`;
  return line;
}

function getExternalAPIs(slug: string, systemPrompt: string): string {
  const apis: string[] = [];
  const combined = systemPrompt + slug;
  if (/fal\.ai|fal-ai|nano-banana|flux/i.test(combined)) apis.push('fal.ai');
  if (/elevenlabs|eleven_multilingual|eleven_turbo/i.test(combined)) apis.push('ElevenLabs');
  if (/rocketreach/i.test(combined)) apis.push('RocketReach');
  if (/serper|web.*search|live.*search/i.test(combined)) apis.push('Serper');
  if (/apollo/i.test(combined)) apis.push('Apollo');
  if (/stripe/i.test(combined)) apis.push('Stripe');
  if (/anthropic|claude/i.test(combined) && slug !== 'prompt-engineer') apis.push('Anthropic (Claude)');
  return apis.length ? apis.join(', ') : 'None (Claude only)';
}

function getTodos(slug: string): string[] {
  // Search worker-specific files
  const workerDir = path.join('/Users/3rdshift/.openclaw/workspace/3rdshift-frontend/lib/workers', slug);
  const results: string[] = [];
  try {
    if (fs.existsSync(workerDir)) {
      const files = fs.readdirSync(workerDir);
      for (const file of files) {
        const content = fs.readFileSync(path.join(workerDir, file), 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (/TODO|FIXME|HACK|TEMP\b|XXX/i.test(line)) {
            results.push(`${file}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  } catch {}
  return results;
}

// Sort alphabetically by slug
const sorted = [...workers].sort((a, b) => a.slug.localeCompare(b.slug));

const lines: string[] = [
  '# Worker Registry Audit — All 85 Workers',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  `**Total workers:** ${sorted.length}`,
  `**Note:** File saved to workspace outputs (brief specified /mnt/user-data/outputs/ but that path doesn't exist on this machine)`,
  '',
  '---',
  '',
];

for (const w of sorted) {
  const formConfig = getWorkerFormConfig(w.slug);
  const promptConfig = getWorkerPromptConfig(w.slug);

  const systemPrompt = promptConfig?.systemPrompt || '';
  const tokenEst = estimateTokens(systemPrompt);

  // Plan gating
  let planGating = 'Starter, Pro, Operator';
  if (w.minPlan === 'pro') planGating = 'Pro, Operator (Starter locked)';
  if (w.minPlan === 'operator') planGating = 'Operator only';
  if (w.taskType === 'heavy' && w.minPlan === 'starter' && !w.modeCredits) planGating = 'Pro, Operator (Starter sees showroom)';

  // Credit cost
  let creditLine = w.taskType === 'light' ? 'Free (light worker)' : `${w.creditCost ?? 1} credits`;
  let modeLine = 'No';
  if (w.modeCredits) {
    modeLine = 'Yes — ' + Object.entries(w.modeCredits).map(([k, v]) => `${k}: ${v}cr`).join(', ');
    creditLine = `Up to ${Math.max(...Object.values(w.modeCredits))} credits (mode-based)`;
  }

  // Max tokens
  const CHARLIE_MODE_TOKENS: Record<string, number> = { mini_course: 8000, workshop: 8000, signature: 16000, premium: 20000, certification: 16000 };
  let maxTokens = '4,096 (default)';
  if (w.slug === 'course-outline-builder') maxTokens = 'Mode-based: 8K–20K';
  if (w.slug === 'resume-writer') maxTokens = '1,200';
  if (w.slug === 'kpi-dashboard-writer') maxTokens = '8,000';

  // All form fields
  const allSections = formConfig?.sections || [];
  const mainFields: any[] = [];
  const moreFields: any[] = [];
  for (const section of allSections) {
    if (section.collapsed) moreFields.push(...(section.fields || []));
    else mainFields.push(...(section.fields || []));
  }

  // External APIs
  const extAPIs = getExternalAPIs(w.slug, systemPrompt);

  // TODOs
  const todos = getTodos(w.slug);

  // Features
  const hasVoiceMatch = systemPrompt.includes('voice match') || systemPrompt.includes('VOICE MATCH') || mainFields.some((f: any) => f.name === 'voice_match') || moreFields.some((f: any) => f.name === 'voice_match');
  const hasHandoffs = systemPrompt.includes('⚡') || systemPrompt.includes('3rdShift Team');
  const humanizeLevel = w.humanizeLevel || (w.taskType === 'light' ? 'full (default)' : 'none');

  // System prompt location
  const workerDir = path.join('lib/workers', w.slug);
  const hasOwnDir = fs.existsSync(path.join('/Users/3rdshift/.openclaw/workspace/3rdshift-frontend', workerDir));
  const promptLocation = hasOwnDir ? `${workerDir}/prompt.ts` : 'lib/workers/configs.ts (inline)';

  lines.push(`## ${w.slug} — ${w.name}`);
  lines.push('');
  lines.push(`**Persona name:** ${w.personaName}`);
  lines.push(`**Category:** ${w.category}`);
  lines.push(`**Plan gating:** ${planGating}`);
  lines.push(`**Credit cost:** ${creditLine}`);
  lines.push(`**Mode-based pricing:** ${modeLine}`);
  lines.push('');
  lines.push(`**Card tagline (upwork price):** ${w.upworkPrice}`);
  lines.push('');
  lines.push(`**Card description:**`);
  lines.push(`> ${w.description}`);
  lines.push('');
  lines.push(`**Output format:** ${w.outputFormat}`);
  lines.push('');
  
  if (mainFields.length > 0) {
    lines.push('**Form fields (main):**');
    for (const f of mainFields) lines.push(formatField(f));
    lines.push('');
  } else {
    lines.push('**Form fields (main):** None (uses generic task input or custom component)');
    lines.push('');
  }

  if (moreFields.length > 0) {
    lines.push('**Form fields (More Options / collapsible):**');
    for (const f of moreFields) lines.push(formatField(f));
    lines.push('');
  } else {
    lines.push('**Form fields (More Options):** None');
    lines.push('');
  }

  lines.push(`**System prompt location:** \`${promptLocation}\``);
  lines.push(`**System prompt length:** ~${tokenEst.toLocaleString()} tokens`);
  lines.push('');
  lines.push(`**Max_tokens cap:** ${maxTokens}`);
  lines.push(`**Output structure:** ${promptConfig ? 'Custom prompt — see system prompt' : 'No prompt config found'}`);
  lines.push('');
  lines.push(`**External APIs used:** ${extAPIs}`);
  lines.push('');

  if (todos.length > 0) {
    lines.push('**Known TODO/FIXME comments in code:**');
    for (const t of todos) lines.push(`- ${t}`);
  } else {
    lines.push('**Known TODO/FIXME comments in code:** None detected');
  }
  lines.push('');

  lines.push(`**Handoff CTAs in output:** ${hasHandoffs ? 'Yes (Charlie-style ⚡ handoffs)' : 'No'}`);
  lines.push(`**Voice match support:** ${hasVoiceMatch ? 'Yes' : 'No'}`);
  lines.push(`**Humanize system:** ${humanizeLevel}`);
  lines.push(`**Brand context integration:** ${systemPrompt.includes('brand_context') || systemPrompt.includes('brand context') ? 'Yes' : 'No'}`);
  lines.push(`**Has templates:** ${w.hasTemplates ? `Yes (${w.templates?.length || 0} templates)` : 'No'}`);
  lines.push('');
  lines.push('---');
  lines.push('');
}

const output = lines.join('\n');
fs.writeFileSync(OUT_PATH, output);
console.log(`✅ Written to ${OUT_PATH}`);
console.log(`Total lines: ${lines.length}`);
console.log(`Total chars: ${output.length}`);
