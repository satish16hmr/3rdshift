#!/usr/bin/env node
'use strict';

// Worker data pull — generates full markdown audit doc
// Usage: node scripts/data-pull-workers.cjs > worker-audit.md

const path = require('path');
const fs = require('fs');

// We need to load the registry and configs. Since they're TypeScript,
// use the compiled Next.js server or ts-node approach.
// Instead, parse the source files directly using regex for reliability.

const registryPath = path.join(__dirname, '../lib/workers/registry.ts');
const configsPath = path.join(__dirname, '../lib/workers/configs.ts');

// Load registry source
const registrySrc = fs.readFileSync(registryPath, 'utf8');
const configsSrc = fs.readFileSync(configsPath, 'utf8');

// We'll use ts-node to actually eval the modules
// But since we can't easily do that, let's just use require with ts-node/register
// Actually let's try a different approach - use the existing slug audit infrastructure

// Check if ts-node is available
try {
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs' }
  });
} catch (e) {
  console.error('ts-node not available:', e.message);
  process.exit(1);
}

// Set up path aliases
const tsconfig = require('../tsconfig.json');
const { pathsToModuleNameMapper } = require('ts-jest');
// Simple alias setup for @/ -> ../
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const resolved = path.join(__dirname, '..', request.replace('@/', ''));
    return originalResolve(resolved, parent, isMain, options);
  }
  return originalResolve(request, parent, isMain, options);
};

const { workers } = require('../lib/workers/registry.ts');
const { getWorkerFormConfig } = require('../lib/workers/configs.ts');

const lines = [];
lines.push('# 3rdShift Worker Registry — Full Data Pull');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Total workers:** ${workers.length}`);
lines.push('');
lines.push('---');
lines.push('');

// Group by category
const byCategory = {};
for (const w of workers) {
  if (!byCategory[w.category]) byCategory[w.category] = [];
  byCategory[w.category].push(w);
}

const categories = Object.keys(byCategory).sort();

for (const cat of categories) {
  lines.push(`## ${cat}`);
  lines.push('');
  
  for (const w of byCategory[cat]) {
    lines.push(`### ${w.slug}`);
    lines.push('');
    
    // Identity
    lines.push('**Identity**');
    lines.push(`- Slug: \`${w.slug}\``);
    lines.push(`- Name: ${w.name}`);
    lines.push(`- Persona: ${w.personaName || '(none)'}`);
    lines.push(`- Role/display: ${w.displayName || w.name}`);
    lines.push(`- Emoji: ${w.emoji || '(none)'}`);
    lines.push(`- Category: ${w.category} (\`${w.categorySlug}\`)`);
    lines.push(`- Task type: ${w.taskType}`);
    lines.push(`- Min plan: ${w.minPlan || 'starter'}`);
    lines.push(`- Credit cost: ${w.creditCost ?? '0 (free)'}`);
    lines.push(`- Subject field: \`${w.subjectField || '(none)'}\``);
    lines.push(`- Humanize level: ${w.humanizeLevel || '(omitted — NON_HUMANIZABLE)'}`);
    lines.push(`- Active: ${w.active !== false ? 'yes' : 'no'}`);
    lines.push('');
    
    // modeCredits
    if (w.modeCredits) {
      lines.push('**modeCredits**');
      for (const [mode, cr] of Object.entries(w.modeCredits)) {
        lines.push(`- \`${mode}\`: ${cr} credits`);
      }
      lines.push('');
    }
    
    // workerModes
    if (w.workerModes && w.workerModes.length > 0) {
      lines.push('**Worker Modes** (card picker)');
      lines.push(`- Mode field: \`${w.workerModeField || '(not set)'}\``);
      lines.push(`- Default: \`${w.workerModesDefault || '(not set)'}\``);
      for (const m of w.workerModes) {
        lines.push(`- **${m.id}**: "${m.title}" — ${m.credits ?? 0}cr — badge: ${m.badge || 'free'}`);
        if (m.spec) lines.push(`  - Spec: ${m.spec}`);
        if (m.useCase) lines.push(`  - Use case: ${m.useCase}`);
      }
      lines.push('');
    }
    
    // templates
    if (w.templates && w.templates.length > 0) {
      lines.push('**Templates**');
      for (const t of w.templates) {
        lines.push(`- \`${t.id}\`: ${t.title} — ${t.description || ''}`);
      }
      lines.push('');
    }
    
    // Form fields
    const formConfig = getWorkerFormConfig(w.slug);
    if (formConfig) {
      lines.push('**Form Fields**');
      const allFields = [];
      for (const section of formConfig.sections || []) {
        for (const field of section.fields || []) {
          allFields.push({ ...field, _section: section.label || 'Main' });
        }
      }
      for (const f of allFields) {
        const req = f.required ? 'required' : 'optional';
        const sw = f.showWhen ? ` [showWhen: ${f.showWhen.field}=${f.showWhen.value}]` : '';
        const opts = f.options ? ` [${Array.isArray(f.options) ? f.options.slice(0, 4).map(o => typeof o === 'object' ? o.value : o).join(' / ') + (f.options.length > 4 ? ` ... +${f.options.length - 4}` : '') : 'options'}]` : '';
        lines.push(`- \`${f.name}\` (${f.type}, ${req}${sw}${opts})`);
      }
      lines.push('');
    } else {
      lines.push('**Form Fields:** (form config not found)');
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }
}

console.log(lines.join('\n'));
