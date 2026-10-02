#!/usr/bin/env node
/**
 * worker-data-pull.cjs
 * Generates a full markdown data dump of all 84 workers.
 * Uses source-file parsing (same approach as full-slug-audit.cjs).
 * Usage: node scripts/worker-data-pull.cjs > worker-audit.md
 */

'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '../lib/workers');
const REGISTRY = fs.readFileSync(path.join(BASE, 'registry.ts'), 'utf8');
const CONFIGS = fs.readFileSync(path.join(BASE, 'configs.ts'), 'utf8');

// ── REGISTRY PARSING ────────────────────────────────────────────────────────

function extractWorkerBlocks(src) {
  // Split on top-level worker object boundaries
  const blocks = [];
  // Find the workers array content
  const arrStart = src.indexOf('export const workers:');
  if (arrStart === -1) return blocks;

  let depth = 0;
  let inBlock = false;
  let blockStart = -1;
  let i = arrStart;

  while (i < src.length) {
    const c = src[i];
    if (!inBlock && c === '{') {
      // Check this is a top-level worker block (depth 1 in array)
      inBlock = true;
      blockStart = i;
      depth = 1;
    } else if (inBlock) {
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          blocks.push(src.substring(blockStart, i + 1));
          inBlock = false;
        }
      }
    }
    i++;
  }
  return blocks;
}

function extractStr(block, key) {
  const re = new RegExp(`${key}:\\s*'([^']*)'`);
  const m = block.match(re);
  return m ? m[1] : null;
}

function extractMultiStr(block, key) {
  // Gets value that may be in single or double quotes
  const re = new RegExp(`${key}:\\s*['"\`]([^'"\`]*)['"\`]`);
  const m = block.match(re);
  return m ? m[1] : null;
}

function extractNum(block, key) {
  const re = new RegExp(`${key}:\\s*(\\d+)`);
  const m = block.match(re);
  return m ? parseInt(m[1]) : null;
}

function extractBool(block, key) {
  const re = new RegExp(`${key}:\\s*(true|false)`);
  const m = block.match(re);
  return m ? m[1] === 'true' : null;
}

function extractModeCredits(block) {
  const re = /modeCredits:\s*\{([^}]+)\}/;
  const m = block.match(re);
  if (!m) return null;
  const entries = {};
  const inner = m[1];
  const pairs = inner.matchAll(/'([^']+)':\s*(\d+)/g);
  for (const p of pairs) {
    entries[p[1]] = parseInt(p[2]);
  }
  return Object.keys(entries).length > 0 ? entries : null;
}

function extractWorkerModes(block) {
  // Find workerModes array
  const start = block.indexOf('workerModes:');
  if (start === -1) return null;
  
  // Find the [ ... ] for this array
  const arrStart = block.indexOf('[', start);
  if (arrStart === -1) return null;
  
  let depth = 0;
  let i = arrStart;
  while (i < block.length) {
    if (block[i] === '[') depth++;
    else if (block[i] === ']') {
      depth--;
      if (depth === 0) {
        const arrContent = block.substring(arrStart, i + 1);
        return parseWorkerModesArray(arrContent);
      }
    }
    i++;
  }
  return null;
}

function parseWorkerModesArray(arrContent) {
  const modes = [];
  // Split into individual mode objects
  const objPattern = /\{[^{}]*\}/g;
  const matches = arrContent.match(objPattern);
  if (!matches) return modes;
  
  for (const obj of matches) {
    const id = extractStr(obj, 'id') || extractMultiStr(obj, 'id');
    const title = extractStr(obj, 'title') || extractMultiStr(obj, 'title');
    const badge = extractStr(obj, 'badge') || extractMultiStr(obj, 'badge');
    const credits = extractNum(obj, 'credits');
    const tierLine = extractStr(obj, 'tierLine') || extractMultiStr(obj, 'tierLine');
    const spec = extractStr(obj, 'spec') || extractMultiStr(obj, 'spec');
    const useCase = extractStr(obj, 'useCase') || extractMultiStr(obj, 'useCase');
    if (id) {
      modes.push({ id, title, badge, credits, tierLine, spec, useCase });
    }
  }
  return modes;
}

function extractTemplates(block) {
  const start = block.indexOf('templates:');
  if (start === -1) return null;
  const arrStart = block.indexOf('[', start);
  if (arrStart === -1) return null;
  
  let depth = 0;
  let i = arrStart;
  while (i < block.length) {
    if (block[i] === '[') depth++;
    else if (block[i] === ']') {
      depth--;
      if (depth === 0) {
        const arrContent = block.substring(arrStart, i + 1);
        return parseTemplatesArray(arrContent);
      }
    }
    i++;
  }
  return null;
}

function parseTemplatesArray(arrContent) {
  const templates = [];
  const objMatches = [];
  let depth = 0;
  let objStart = -1;
  for (let i = 0; i < arrContent.length; i++) {
    if (arrContent[i] === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (arrContent[i] === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        objMatches.push(arrContent.substring(objStart, i + 1));
        objStart = -1;
      }
    }
  }
  for (const obj of objMatches) {
    const id = extractStr(obj, 'id') || extractMultiStr(obj, 'id');
    const title = extractStr(obj, 'title') || extractMultiStr(obj, 'title');
    const description = extractStr(obj, 'description') || extractMultiStr(obj, 'description');
    if (id) templates.push({ id, title, description });
  }
  return templates;
}

// ── FORM CONFIG PARSING ─────────────────────────────────────────────────────

function extractFormFields(slug) {
  // Find the form config for this slug in configs.ts
  // Look for both inlineForms and allForms entries
  
  // Try to find  'slug': { slug: 'slug', ... sections: ... }
  const slugPatterns = [
    new RegExp(`'${slug}':\\s*\\{\\s*slug:\\s*'${slug}'`),
    new RegExp(`slug:\\s*'${slug}'[^}]*sections:`),
  ];
  
  let formStart = -1;
  for (const re of slugPatterns) {
    const m = CONFIGS.search(re);
    if (m !== -1) {
      formStart = m;
      break;
    }
  }
  
  if (formStart === -1) return null;
  
  // Find sections array
  const sectionsStart = CONFIGS.indexOf('sections:', formStart);
  if (sectionsStart === -1 || sectionsStart > formStart + 5000) return null;
  
  const arrStart = CONFIGS.indexOf('[', sectionsStart);
  if (arrStart === -1) return null;
  
  // Extract the full sections array
  let depth = 0;
  let i = arrStart;
  while (i < CONFIGS.length) {
    if (CONFIGS[i] === '[') depth++;
    else if (CONFIGS[i] === ']') {
      depth--;
      if (depth === 0) {
        const sectionsContent = CONFIGS.substring(arrStart, i + 1);
        return parseFormFields(sectionsContent);
      }
    }
    i++;
  }
  return null;
}

function parseFormFields(sectionsContent) {
  const fields = [];
  
  // Find all field objects: { name: '...', type: '...', required: ..., ... }
  let depth = 0;
  let objStart = -1;
  
  for (let i = 0; i < sectionsContent.length; i++) {
    const c = sectionsContent[i];
    if (c === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const obj = sectionsContent.substring(objStart, i + 1);
        // Only grab field objects (have 'name:' and 'type:')
        if (obj.includes("name:") && obj.includes("type:") && !obj.includes("sections:") && !obj.includes("workerModes")) {
          const field = parseFieldObj(obj);
          if (field && field.name && field.type) {
            fields.push(field);
          }
        }
        objStart = -1;
      }
    }
  }
  
  return fields;
}

function parseFieldObj(obj) {
  const name = extractStr(obj, 'name');
  const type = extractStr(obj, 'type');
  const label = extractStr(obj, 'label');
  const reqMatch = obj.match(/required:\s*(true|false)/);
  const required = reqMatch ? reqMatch[1] === 'true' : null;
  
  // showWhen
  let showWhen = null;
  const swMatch = obj.match(/showWhen:\s*\{[^}]*field:\s*'([^']+)'[^}]*value:\s*'([^']+)'[^}]*\}/);
  if (swMatch) {
    showWhen = `${swMatch[1]}=${swMatch[2]}`;
  } else {
    // value might be an array or complex
    const swMatchField = obj.match(/showWhen:\s*\{[^}]*field:\s*'([^']+)'/);
    if (swMatchField) {
      showWhen = `${swMatchField[1]}=(conditional)`;
    }
  }
  
  // Options — just count them
  let optionCount = null;
  const optMatch = obj.match(/options:\s*\[/);
  if (optMatch) {
    // Count string entries
    const optStart = obj.indexOf('options:');
    const bracketStart = obj.indexOf('[', optStart);
    let d = 0, j = bracketStart;
    while (j < obj.length) {
      if (obj[j] === '[') d++;
      else if (obj[j] === ']') { d--; if (d === 0) break; }
      j++;
    }
    const optContent = obj.substring(bracketStart, j + 1);
    const strOptions = optContent.match(/'[^']+'/g) || [];
    const valOptions = optContent.match(/value:\s*'[^']+'/g) || [];
    optionCount = Math.max(strOptions.length, valOptions.length);
    // Don't count 'value'/'label' strings themselves
    if (valOptions.length > 0) optionCount = valOptions.length;
  }
  
  const defaultValue = extractStr(obj, 'defaultValue');
  
  return { name, type, label, required, showWhen, optionCount, defaultValue };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

const workerBlocks = extractWorkerBlocks(REGISTRY);

// Parse each block
const parsedWorkers = [];
for (const block of workerBlocks) {
  const slug = extractStr(block, 'slug');
  if (!slug) continue;
  // Skip DEPRECATED_SLUGS block and non-worker blocks
  if (!block.includes('category:') && !block.includes('personaName:')) continue;
  
  const worker = {
    slug,
    name: extractStr(block, 'name'),
    personaName: extractStr(block, 'personaName'),
    emoji: extractStr(block, 'emoji'),
    category: extractStr(block, 'category'),
    categorySlug: extractStr(block, 'categorySlug'),
    taskType: extractStr(block, 'taskType'),
    creditCost: extractNum(block, 'creditCost'),
    minPlan: extractStr(block, 'minPlan'),
    subjectField: extractStr(block, 'subjectField'),
    humanizeLevel: extractStr(block, 'humanizeLevel'),
    active: extractBool(block, 'active'),
    modeCredits: extractModeCredits(block),
    workerModes: extractWorkerModes(block),
    workerModeField: extractStr(block, 'workerModeField'),
    workerModesDefault: extractStr(block, 'workerModesDefault'),
    templates: extractTemplates(block),
    formFields: extractFormFields(slug),
  };
  
  parsedWorkers.push(worker);
}

// ── OUTPUT ───────────────────────────────────────────────────────────────────

const lines = [];
const ts = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

lines.push('# 3rdShift Worker Registry — Full Data Pull');
lines.push('');
lines.push(`**Generated:** ${ts}`);
lines.push(`**Total workers:** ${parsedWorkers.length}`);
lines.push('');
lines.push('---');
lines.push('');

// Group by category
const byCategory = {};
for (const w of parsedWorkers) {
  const cat = w.category || 'Uncategorized';
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(w);
}

const catOrder = [
  'Admin & Ops',
  'AI Services',
  'Audio & Voice',
  'Content Writing',
  'Copywriting',
  'Data & Analytics',
  'Design & Creative',
  'Documents & Reports',
  'Marketing',
  'Recruiting & HR',
  'Research & Data',
  'Research & Strategy',
  'Sales & Lead Gen',
  'Social Media',
];

const sortedCats = catOrder.filter(c => byCategory[c]).concat(
  Object.keys(byCategory).filter(c => !catOrder.includes(c)).sort()
);

for (const cat of sortedCats) {
  const catWorkers = byCategory[cat] || [];
  lines.push(`## ${cat} (${catWorkers.length} workers)`);
  lines.push('');

  for (const w of catWorkers) {
    lines.push(`### ${w.slug}`);
    lines.push('');
    
    // Identity row
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Persona | ${w.personaName || '—'} |`);
    lines.push(`| Name | ${w.name || '—'} |`);
    lines.push(`| Emoji | ${w.emoji || '—'} |`);
    lines.push(`| Task type | ${w.taskType || '—'} |`);
    lines.push(`| Min plan | ${w.minPlan || 'starter'} |`);
    lines.push(`| Credit cost | ${w.creditCost !== null ? w.creditCost : '0 (free)'} |`);
    lines.push(`| Subject field | \`${w.subjectField || '(none)'}\` |`);
    lines.push(`| Humanize level | ${w.humanizeLevel || '(omitted — NON_HUMANIZABLE)'} |`);
    lines.push(`| Active | ${w.active !== false ? 'yes' : 'no'} |`);
    lines.push('');

    // modeCredits
    if (w.modeCredits && Object.keys(w.modeCredits).length > 0) {
      lines.push('**modeCredits**');
      for (const [mode, cr] of Object.entries(w.modeCredits)) {
        lines.push(`- \`${mode}\`: ${cr}cr`);
      }
      lines.push('');
    }

    // workerModes (card picker)
    if (w.workerModes && w.workerModes.length > 0) {
      lines.push('**Worker Modes (card picker)**');
      lines.push(`- Mode field: \`${w.workerModeField || '(not set)'}\``);
      lines.push(`- Default: \`${w.workerModesDefault || '(not set)'}\``);
      lines.push('');
      lines.push('| Mode ID | Title | Credits | Badge | Tier Line |');
      lines.push('|---------|-------|---------|-------|-----------|');
      for (const m of w.workerModes) {
        lines.push(`| \`${m.id}\` | ${m.title || '—'} | ${m.credits ?? 0} | ${m.badge || '—'} | ${m.tierLine || '—'} |`);
      }
      lines.push('');
      // Specs / use cases
      for (const m of w.workerModes) {
        if (m.spec || m.useCase) {
          lines.push(`*${m.id}:* ${m.spec || ''} ${m.useCase ? '— ' + m.useCase : ''}`);
        }
      }
      lines.push('');
    }

    // Templates
    if (w.templates && w.templates.length > 0) {
      lines.push('**Templates**');
      for (const t of w.templates) {
        lines.push(`- \`${t.id}\`: ${t.title || '—'}${t.description ? ' — ' + t.description : ''}`);
      }
      lines.push('');
    }

    // Form fields
    if (w.formFields && w.formFields.length > 0) {
      lines.push('**Form Fields**');
      lines.push('');
      lines.push('| Field name | Type | Required | showWhen | Options | Default |');
      lines.push('|------------|------|----------|----------|---------|---------|');
      for (const f of w.formFields) {
        const req = f.required ? '✅ required' : 'optional';
        const sw = f.showWhen || '—';
        const opts = f.optionCount ? `${f.optionCount} options` : '—';
        const def = f.defaultValue ? `\`${f.defaultValue}\`` : '—';
        lines.push(`| \`${f.name}\` | ${f.type} | ${req} | ${sw} | ${opts} | ${def} |`);
      }
      lines.push('');
    } else {
      lines.push('**Form Fields:** _(not parsed or using dedicated form file)_');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }
}

// Summary stats
lines.push('## Summary Stats');
lines.push('');
lines.push(`- Total workers: **${parsedWorkers.length}**`);
lines.push(`- Heavy workers (paid): **${parsedWorkers.filter(w => w.taskType === 'heavy').length}**`);
lines.push(`- Light workers (free): **${parsedWorkers.filter(w => w.taskType === 'light').length}**`);
lines.push(`- Workers with card picker: **${parsedWorkers.filter(w => w.workerModes && w.workerModes.length > 0).length}**`);
lines.push(`- Workers with templates: **${parsedWorkers.filter(w => w.templates && w.templates.length > 0).length}**`);
lines.push(`- NON_HUMANIZABLE (no humanizeLevel): **${parsedWorkers.filter(w => !w.humanizeLevel).length}**`);
lines.push(`- humanizeLevel=full: **${parsedWorkers.filter(w => w.humanizeLevel === 'full').length}**`);
lines.push(`- humanizeLevel=light: **${parsedWorkers.filter(w => w.humanizeLevel === 'light').length}**`);

console.log(lines.join('\n'));
