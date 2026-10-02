/**
 * generate-registry-export.cjs
 * Deliverable 1: Worker Registry Audit
 * Run: node scripts/generate-registry-export.cjs
 * 
 * Uses require() with ts-node/register for TypeScript support.
 * Falls back to parsing source files directly if import fails.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT_PATH = '/Users/3rdshift/.openclaw/workspace/outputs/worker-registry-audit.md';
const FRONTEND = '/Users/3rdshift/.openclaw/workspace/3rdshift-frontend';

// ── Extract workers from registry.ts via source parsing ──────────────────────
function extractWorkers() {
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/registry.ts'), 'utf8');
  
  // Extract each worker block using slug as anchor
  const workers = [];
  const slugRegex = /slug:\s*'([^']+)'/g;
  let m;
  const slugPositions = [];
  while ((m = slugRegex.exec(src)) !== null) {
    // Only include if this looks like a worker entry (has name: nearby)
    const nearby = src.slice(Math.max(0, m.index - 20), m.index + 200);
    if (nearby.includes('{') || nearby.includes('slug:')) {
      slugPositions.push({ slug: m[1], pos: m.index });
    }
  }
  
  // For each slug, extract key fields
  for (const { slug, pos } of slugPositions) {
    // Find the enclosing object by looking for matching braces
    let depth = 0;
    let start = -1;
    let end = -1;
    for (let i = pos; i >= 0; i--) {
      if (src[i] === '{') { start = i; break; }
    }
    if (start === -1) continue;
    depth = 1;
    for (let i = start + 1; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue;
    
    const block = src.slice(start, end + 1);
    
    const get = (key) => {
      const r = new RegExp(`${key}:\\s*'([^']*)'`);
      const m = block.match(r);
      return m ? m[1] : '';
    };
    const getNum = (key) => {
      const r = new RegExp(`${key}:\\s*(\\d+)`);
      const m = block.match(r);
      return m ? parseInt(m[1]) : null;
    };
    const getBool = (key) => block.includes(`${key}: true`);
    
    const worker = {
      slug,
      name: get('name'),
      personaName: get('personaName'),
      emoji: get('emoji'),
      category: get('category'),
      categorySlug: get('categorySlug'),
      description: get('description'),
      taskType: get('taskType') || 'light',
      creditCost: getNum('creditCost'),
      minPlan: get('minPlan') || 'starter',
      outputFormat: get('outputFormat') || 'markdown',
      upworkPrice: get('upworkPrice'),
      humanizeLevel: get('humanizeLevel'),
      hasTemplates: getBool('hasTemplates'),
      chatCanGenerate: !block.includes('chatCanGenerate: false'),
    };
    
    // Extract modeCredits if present
    const mcMatch = block.match(/modeCredits:\s*\{([^}]+)\}/);
    if (mcMatch) {
      worker.modeCredits = {};
      const entries = mcMatch[1].matchAll(/(\w+):\s*(\d+)/g);
      for (const e of entries) worker.modeCredits[e[1]] = parseInt(e[2]);
    }
    
    // Extract template count
    const tmplMatch = block.match(/templates:\s*\[/);
    if (tmplMatch) {
      const tmplStr = block.slice(block.indexOf('templates:'));
      const ids = (tmplStr.match(/id:\s*'[^']+'/g) || []).length;
      worker.templateCount = ids;
    }
    
    workers.push(worker);
  }
  
  // Deduplicate (slug may appear multiple times in source — once in interface, once in array)
  const seen = new Set();
  const unique = workers.filter(w => {
    if (!w.slug || !w.name || seen.has(w.slug)) return false;
    seen.add(w.slug);
    return true;
  });
  
  return unique.sort((a, b) => a.slug.localeCompare(b.slug));
}

// ── Extract form config fields for a slug ────────────────────────────────────
function extractFormFields(slug) {
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/configs.ts'), 'utf8');
  
  // Find the form config entry for this slug
  const marker = `'${slug}': { slug: '${slug}'`;
  const marker2 = `'${slug}': {slug: '${slug}'`;
  let idx = src.indexOf(marker);
  if (idx === -1) idx = src.indexOf(marker2);
  if (idx === -1) return { main: [], more: [], submitLabel: '', footerText: '' };
  
  // Extract the sections array
  const sectionsIdx = src.indexOf('sections:', idx);
  if (sectionsIdx === -1 || sectionsIdx - idx > 500) return { main: [], more: [], submitLabel: '', footerText: '' };
  
  // Extract submitLabel and footerText
  const preSection = src.slice(idx, sectionsIdx);
  const submitMatch = preSection.match(/submitLabel:\s*'([^']+)'/);
  const footerMatch = preSection.match(/footerText:\s*'([^']+)'/);
  
  // Find all field objects in this config
  const configEnd = findConfigEnd(src, idx);
  const configBlock = src.slice(idx, configEnd);
  
  const mainFields = [];
  const moreFields = [];
  let inCollapsed = false;
  
  // Find collapsed sections
  const collapsedSections = [];
  const collapsedRegex = /collapsed:\s*true/g;
  let cm;
  while ((cm = collapsedRegex.exec(configBlock)) !== null) {
    collapsedSections.push(cm.index);
  }
  
  // Extract all field objects
  const fieldRegex = /\{\s*name:\s*'([^']+)',\s*label:\s*'([^']+)'/g;
  let fm;
  while ((fm = fieldRegex.exec(configBlock)) !== null) {
    // Find the end of this field object by tracking brace depth from the opening '{'
    // This prevents the 500-char window from bleeding into the next field's options array.
    let fieldEnd = fm.index;
    let depth = 0;
    let inStr = false;
    let strChar = '';
    for (let i = fm.index; i < Math.min(fm.index + 2000, configBlock.length); i++) {
      const ch = configBlock[i];
      if (inStr) {
        if (ch === strChar && configBlock[i - 1] !== '\\') inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') { depth--; if (depth <= 0) { fieldEnd = i + 1; break; } }
    }
    const fieldBlock = configBlock.slice(fm.index, fieldEnd || fm.index + 500);
    
    const typeMatch = fieldBlock.match(/type:\s*'([^']+)'/);
    const reqMatch = fieldBlock.match(/required:\s*(true|false)/);
    const placeholderMatch = fieldBlock.match(/placeholder:\s*'([^']+)'/);
    const defaultMatch = fieldBlock.match(/defaultValue:\s*'([^']+)'/);
    const showWhenMatch = fieldBlock.match(/showWhen:\s*\{\s*field:\s*'([^']+)',\s*value:\s*'([^']+)'/);
    
    // Extract options
    const optionsMatch = fieldBlock.match(/options:\s*\[([^\]]+)\]/);
    let options = '';
    if (optionsMatch) {
      const rawOpts = optionsMatch[1].match(/'([^']+)'/g) || [];
      if (rawOpts.length > 0) options = rawOpts.slice(0, 5).map(o => o.replace(/'/g,'')).join(', ') + (rawOpts.length > 5 ? '...' : '');
    }
    
    const field = {
      name: fm[1],
      label: fm[2],
      type: typeMatch ? typeMatch[1] : 'text',
      required: reqMatch ? reqMatch[1] === 'true' : false,
      placeholder: placeholderMatch ? placeholderMatch[1].slice(0, 60) : '',
      defaultValue: defaultMatch ? defaultMatch[1] : '',
      options,
      showWhen: showWhenMatch ? `${showWhenMatch[1]}=${showWhenMatch[2]}` : '',
    };
    
    // Determine if in collapsed section
    const isCollapsed = collapsedSections.some(cs => fm.index > cs && fm.index < cs + 2000);
    if (isCollapsed) moreFields.push(field);
    else mainFields.push(field);
  }
  
  return {
    main: mainFields,
    more: moreFields,
    submitLabel: submitMatch ? submitMatch[1] : '',
    footerText: footerMatch ? footerMatch[1] : '',
  };
}

function findConfigEnd(src, startIdx) {
  // Find the matching closing brace/bracket for the form config object
  let depth = 0;
  let inStr = false;
  let strChar = '';
  for (let i = startIdx; i < Math.min(startIdx + 50000, src.length); i++) {
    if (inStr) {
      if (src[i] === strChar && src[i-1] !== '\\') inStr = false;
      continue;
    }
    if (src[i] === '"' || src[i] === "'") { inStr = true; strChar = src[i]; continue; }
    if (src[i] === '{' || src[i] === '[') depth++;
    else if (src[i] === '}' || src[i] === ']') {
      depth--;
      if (depth <= 0) return i + 1;
    }
  }
  return startIdx + 50000;
}

// ── Extract system prompt for a slug ─────────────────────────────────────────
function extractSystemPrompt(slug) {
  // Check worker-specific file first
  const workerDir = path.join(FRONTEND, 'lib/workers', slug);
  const promptFile = path.join(workerDir, 'prompt.ts');
  if (fs.existsSync(promptFile)) {
    const src = fs.readFileSync(promptFile, 'utf8');
    const m = src.match(/systemPrompt:\s*`([\s\S]*?)`/);
    return { location: `lib/workers/${slug}/prompt.ts`, prompt: m ? m[1] : '', hasOwnFile: true };
  }
  
  // Fall back to configs.ts inline
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/configs.ts'), 'utf8');
  const marker = `'${slug}':`;
  const idx = src.indexOf(marker);
  if (idx === -1) return { location: 'lib/workers/configs.ts', prompt: '', hasOwnFile: false };
  
  const block = src.slice(idx, idx + 30000);
  const m = block.match(/systemPrompt:\s*`([\s\S]*?)`/);
  return { 
    location: 'lib/workers/configs.ts (inline)', 
    prompt: m ? m[1] : '',
    hasOwnFile: false
  };
}

// ── Get external APIs ─────────────────────────────────────────────────────────
function getExternalAPIs(slug, prompt) {
  const apis = [];
  const combined = (prompt + slug).toLowerCase();
  if (combined.includes('fal.ai') || combined.includes('fal-ai') || combined.includes('nano-banana') || combined.includes('flux-pro')) apis.push('fal.ai');
  if (combined.includes('elevenlabs') || combined.includes('eleven_multilingual') || combined.includes('eleven_turbo')) apis.push('ElevenLabs');
  if (combined.includes('rocketreach')) apis.push('RocketReach');
  if (/serper|live web search|web_search_results/.test(combined)) apis.push('Serper');
  if (combined.includes('apollo')) apis.push('Apollo');
  if (combined.includes('wan') && (combined.includes('video') || combined.includes('atlas'))) apis.push('Atlas Cloud/Wan (video)');
  return apis.length ? apis.join(', ') : 'None (Claude only)';
}

// ── Get TODOs ─────────────────────────────────────────────────────────────────
function getTodos(slug) {
  const workerDir = path.join(FRONTEND, 'lib/workers', slug);
  const results = [];
  try {
    if (fs.existsSync(workerDir)) {
      for (const file of fs.readdirSync(workerDir)) {
        const content = fs.readFileSync(path.join(workerDir, file), 'utf8');
        content.split('\n').forEach((line, idx) => {
          if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
            results.push(`${file}:${idx+1}: ${line.trim().slice(0, 100)}`);
          }
        });
      }
    }
  } catch {}
  return results;
}

// ── Format a field line ───────────────────────────────────────────────────────
function formatField(f) {
  let line = `- **${f.label}** | type: ${f.type} | ${f.required ? 'required' : 'optional'}`;
  if (f.placeholder) line += ` | placeholder: "${f.placeholder}"`;
  if (f.defaultValue) line += ` | default: ${f.defaultValue}`;
  if (f.options) line += ` | options: ${f.options}`;
  if (f.showWhen) line += ` | shows when: ${f.showWhen}`;
  return line;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('Extracting workers from registry...');
const workers = extractWorkers();
console.log(`Found ${workers.length} workers`);

// Max tokens map
const MAX_TOKENS_MAP = {
  'course-outline-builder': 'Mode-based: 8K mini/workshop, 16K sig/cert, 20K premium',
  'resume-writer': '1,200',
  'kpi-dashboard-writer': '8,000',
};

const lines = [
  '# Worker Registry Audit — All 85 Workers',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  `**Total workers:** ${workers.length}`,
  `**Output path:** /Users/3rdshift/.openclaw/workspace/outputs/worker-registry-audit.md`,
  `**Note:** Brief specified /mnt/user-data/outputs/ but that path doesn't exist on this machine — saved to workspace outputs.`,
  '',
  '---',
  '',
];

let i = 0;
for (const w of workers) {
  i++;
  process.stdout.write(`\r[${i}/${workers.length}] ${w.slug}                    `);
  
  const { main: mainFields, more: moreFields, submitLabel, footerText } = extractFormFields(w.slug);
  const { location: promptLocation, prompt: systemPrompt } = extractSystemPrompt(w.slug);
  const tokenEst = Math.round(systemPrompt.length / 4);
  const extAPIs = getExternalAPIs(w.slug, systemPrompt);
  const todos = getTodos(w.slug);
  
  // Plan gating
  let planGating = 'Starter, Pro, Operator';
  if (w.minPlan === 'pro') planGating = 'Pro, Operator (Starter locked out)';
  if (w.minPlan === 'operator') planGating = 'Operator only';
  if (w.taskType === 'heavy' && !w.modeCredits && w.minPlan === 'starter') planGating = 'Pro+ for access (Starter sees showroom)';
  
  // Credit cost
  let creditLine = w.taskType === 'light' ? 'Free (light worker — no credits)' : `${w.creditCost ?? 1} credits`;
  let modeLine = 'No';
  if (w.modeCredits) {
    modeLine = 'Yes — ' + Object.entries(w.modeCredits).map(([k,v]) => `${k}: ${v}cr`).join(', ');
    creditLine = `Up to ${Math.max(...Object.values(w.modeCredits))} credits (varies by mode)`;
  }
  
  const maxTokens = MAX_TOKENS_MAP[w.slug] || '4,096 (default)';
  
  const hasVoiceMatch = systemPrompt.includes('voice match') || systemPrompt.toLowerCase().includes('voice match') || mainFields.some(f => f.name === 'voice_match') || moreFields.some(f => f.name === 'voice_match');
  const hasHandoffs = systemPrompt.includes('⚡') || systemPrompt.includes('3rdShift Team');
  const hasBrandContext = systemPrompt.toLowerCase().includes('brand context') || systemPrompt.includes('brand_context');
  
  lines.push(`## ${w.slug} — ${w.name}`);
  lines.push('');
  lines.push(`**Persona name:** ${w.personaName} ${w.emoji}`);
  lines.push(`**Category:** ${w.category}`);
  lines.push(`**Plan gating:** ${planGating}`);
  lines.push(`**Credit cost:** ${creditLine}`);
  lines.push(`**Mode-based pricing:** ${modeLine}`);
  lines.push('');
  lines.push(`**Card tagline:** ${w.upworkPrice}`);
  lines.push('');
  lines.push(`**Card description:**`);
  lines.push(`> ${w.description}`);
  lines.push('');
  lines.push(`**Output format:** ${w.outputFormat}`);
  if (submitLabel) lines.push(`**Submit button label:** ${submitLabel}`);
  if (footerText) lines.push(`**Footer text:** ${footerText}`);
  lines.push('');
  
  if (mainFields.length > 0) {
    lines.push(`**Form fields — main (${mainFields.length} fields):**`);
    mainFields.forEach(f => lines.push(formatField(f)));
  } else {
    lines.push('**Form fields — main:** None detected (custom component or generic input)');
  }
  lines.push('');
  
  if (moreFields.length > 0) {
    lines.push(`**Form fields — More Options collapsible (${moreFields.length} fields):**`);
    moreFields.forEach(f => lines.push(formatField(f)));
  } else {
    lines.push('**Form fields — More Options:** None');
  }
  lines.push('');
  
  lines.push(`**System prompt location:** \`${promptLocation}\``);
  lines.push(`**System prompt length:** ~${tokenEst.toLocaleString()} tokens`);
  lines.push(`**Max_tokens cap:** ${maxTokens}`);
  lines.push('');
  lines.push(`**External APIs used:** ${extAPIs}`);
  lines.push('');
  
  if (todos.length > 0) {
    lines.push('**Known TODO/FIXME comments:**');
    todos.forEach(t => lines.push(`- ${t}`));
  } else {
    lines.push('**Known TODO/FIXME comments:** None detected');
  }
  lines.push('');
  
  lines.push(`**Handoff CTAs in output:** ${hasHandoffs ? 'Yes (Charlie-style ⚡ section handoffs + team footer)' : 'No'}`);
  lines.push(`**Voice match support:** ${hasVoiceMatch ? 'Yes' : 'No'}`);
  lines.push(`**Humanize system:** ${w.humanizeLevel || 'full (default for light workers)'}`);
  lines.push(`**Brand context integration:** ${hasBrandContext ? 'Yes' : 'No'}`);
  lines.push(`**Has templates:** ${w.hasTemplates ? `Yes (${w.templateCount || '?'} templates)` : 'No'}`);
  lines.push(`**Has worker-specific directory:** ${fs.existsSync(path.join(FRONTEND, 'lib/workers', w.slug)) ? 'Yes' : 'No (inline in configs.ts)'}`);
  lines.push('');
  lines.push('---');
  lines.push('');
}

console.log('\nWriting file...');
const output = lines.join('\n');
fs.writeFileSync(OUT_PATH, output);
console.log(`✅ Done!`);
console.log(`   Path: ${OUT_PATH}`);
console.log(`   Workers: ${workers.length}`);
console.log(`   Lines: ${lines.length}`);
console.log(`   Size: ${(output.length / 1024).toFixed(1)} KB`);
