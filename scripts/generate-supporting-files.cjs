'use strict';
/**
 * generate-supporting-files.cjs
 * Deliverable 3: Three supporting analysis files
 * - worker-category-map.md
 * - worker-form-patterns.md  
 * - worker-credit-audit.md
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = '/Users/3rdshift/.openclaw/workspace/3rdshift-frontend';
const OUT = '/Users/3rdshift/.openclaw/workspace/outputs';

// ── Load worker data ──────────────────────────────────────────────────────────
function extractWorkers() {
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/registry.ts'), 'utf8');
  const workers = [];
  const seen = new Set();
  
  // Match full worker objects by slug
  const workerBlocks = src.split(/(?=\s*\{[\s\n]*slug:)/);
  
  for (const block of workerBlocks) {
    const slugM = block.match(/slug:\s*'([^']+)'/);
    const nameM = block.match(/name:\s*'([^']+)'/);
    const personaM = block.match(/personaName:\s*'([^']+)'/);
    const categoryM = block.match(/category:\s*'([^']+)'/);
    const taskTypeM = block.match(/taskType:\s*'([^']+)'/);
    const creditM = block.match(/creditCost:\s*(\d+)/);
    const minPlanM = block.match(/minPlan:\s*'([^']+)'/);
    const outputFmtM = block.match(/outputFormat:\s*'([^']+)'/);
    const humanizeM = block.match(/humanizeLevel:\s*'([^']+)'/);
    const hasTemplatesM = block.includes('hasTemplates: true');
    const upworkM = block.match(/upworkPrice:\s*'([^']+)'/);
    const descM = block.match(/description:\s*'([^']+)'/);
    
    const mcMatch = block.match(/modeCredits:\s*\{([^}]+)\}/);
    let modeCredits = null;
    if (mcMatch) {
      modeCredits = {};
      const entries = [...mcMatch[1].matchAll(/(\w+):\s*(\d+)/g)];
      for (const e of entries) modeCredits[e[1]] = parseInt(e[2]);
    }
    
    if (!slugM || !nameM || seen.has(slugM[1])) continue;
    seen.add(slugM[1]);
    
    workers.push({
      slug: slugM[1],
      name: nameM[1],
      personaName: personaM ? personaM[1] : '',
      category: categoryM ? categoryM[1] : 'Unknown',
      taskType: taskTypeM ? taskTypeM[1] : 'light',
      creditCost: creditM ? parseInt(creditM[1]) : (taskTypeM && taskTypeM[1] === 'heavy' ? 1 : 0),
      minPlan: minPlanM ? minPlanM[1] : 'starter',
      outputFormat: outputFmtM ? outputFmtM[1] : 'markdown',
      humanizeLevel: humanizeM ? humanizeM[1] : 'full',
      hasTemplates: hasTemplatesM,
      upworkPrice: upworkM ? upworkM[1] : '',
      description: descM ? descM[1] : '',
      modeCredits,
    });
  }
  
  return workers.filter(w => w.slug && w.name).sort((a, b) => a.slug.localeCompare(b.slug));
}

function extractFormFeatures(slug) {
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/configs.ts'), 'utf8');
  const marker = `'${slug}':`;
  const idx = src.indexOf(marker);
  if (idx === -1) return { hasVoiceMatch: false, hasMoreOptions: false, fieldCount: 0, hasFileUpload: false };
  
  const block = src.slice(idx, idx + 20000);
  const endIdx = Math.min(block.indexOf('\n  \'', 1000), block.length);
  const localBlock = block.slice(0, endIdx > 0 ? endIdx : 10000);
  
  return {
    hasVoiceMatch: localBlock.includes("name: 'voice_match'") || localBlock.includes('voice_match'),
    hasMoreOptions: localBlock.includes('collapsed: true'),
    fieldCount: (localBlock.match(/name:\s*'[^']+'/g) || []).length,
    hasFileUpload: localBlock.includes("type: 'file-upload'") || localBlock.includes("type: 'audio-upload'"),
    hasModeCards: slug === 'course-outline-builder', // currently just Charlie
    hasHandoffs: false, // checked separately
  };
}

function getSystemPromptFeatures(slug) {
  const configsSrc = fs.readFileSync(path.join(FRONTEND, 'lib/workers/configs.ts'), 'utf8');
  
  let prompt = '';
  
  // Check worker-specific file
  const workerDir = path.join(FRONTEND, 'lib/workers', slug);
  const promptFile = path.join(workerDir, 'prompt.ts');
  if (fs.existsSync(promptFile)) {
    prompt = fs.readFileSync(promptFile, 'utf8');
  } else {
    const idx = configsSrc.indexOf(`'${slug}':`);
    if (idx !== -1) {
      const block = configsSrc.slice(idx, idx + 30000);
      const m = block.match(/systemPrompt:\s*`([\s\S]{0,8000})`/);
      if (m) prompt = m[1];
    }
  }
  
  return {
    hasVoiceMatch: /voice\s*match/i.test(prompt),
    hasHandoffs: prompt.includes('⚡') || prompt.includes('3rdShift Team'),
    hasBrandContext: /brand.context/i.test(prompt),
    promptLength: Math.round(prompt.length / 4),
  };
}

// ── External API detection ────────────────────────────────────────────────────
function getExternalAPI(slug) {
  const src = fs.readFileSync(path.join(FRONTEND, 'lib/workers/configs.ts'), 'utf8');
  const idx = src.indexOf(`'${slug}':`);
  const block = idx !== -1 ? src.slice(idx, idx + 5000) : '';
  
  if (/fal\.ai|nano-banana|flux-pro|flux_pro/i.test(block)) return 'fal.ai';
  if (/elevenlabs|eleven_multilingual/i.test(block)) return 'ElevenLabs';
  if (/rocketreach/i.test(block)) return 'RocketReach';
  if (/serper|web_search/i.test(block)) return 'Serper';
  if (/apollo/i.test(block)) return 'Apollo';
  if (/wan|atlas.*cloud/i.test(block)) return 'Atlas/Wan';
  
  // Check route-level files
  const routeFiles = [
    path.join(FRONTEND, 'app/api/execute-task/route.ts'),
  ];
  for (const f of routeFiles) {
    if (!fs.existsSync(f)) continue;
    const rsrc = fs.readFileSync(f, 'utf8');
    const ridx = rsrc.indexOf(`'${slug}'`);
    if (ridx === -1) continue;
    const rblock = rsrc.slice(ridx, ridx + 5000);
    if (/fal\.ai|nano-banana/i.test(rblock)) return 'fal.ai';
    if (/elevenlabs/i.test(rblock)) return 'ElevenLabs';
    if (/rocketreach/i.test(rblock)) return 'RocketReach';
  }
  
  return 'None';
}

// Estimated Claude API cost per task (input ~3K tokens, output varies by max_tokens)
// Claude Sonnet 4.6: $3/M input, $15/M output
function estimateClaudeCost(maxTokensOut) {
  const inputCost = (3000 / 1_000_000) * 3;
  const outputCost = (maxTokensOut / 1_000_000) * 15;
  return inputCost + outputCost;
}

const EXTERNAL_API_COSTS = {
  'fal.ai': 0.15, // avg per task
  'ElevenLabs': 0.10,
  'RocketReach': 0.40, // per lead lookup
  'Serper': 0.01,
  'Apollo': 0.05,
  'Atlas/Wan': 2.50,
  'None': 0,
};

const CREDIT_REVENUE = { pro: 1.58, operator: 1.33 }; // per credit on annual plans

console.log('Extracting workers...');
const workers = extractWorkers();
console.log(`Found ${workers.length} workers`);

// ── DELIVERABLE 3a: Category Map ──────────────────────────────────────────────
console.log('\nGenerating category map...');

const byCategory = {};
for (const w of workers) {
  if (!byCategory[w.category]) byCategory[w.category] = [];
  byCategory[w.category].push(w);
}

const catLines = [
  '# Worker Category Map',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  `**Total workers:** ${workers.length}`,
  `**Categories:** ${Object.keys(byCategory).length}`,
  '',
  '---',
  '',
];

for (const [cat, catWorkers] of Object.entries(byCategory).sort()) {
  catLines.push(`## ${cat} (${catWorkers.length} workers)`);
  catLines.push('');
  for (const w of catWorkers.sort((a,b) => a.slug.localeCompare(b.slug))) {
    const tier = w.taskType === 'heavy' ? ` [${w.modeCredits ? 'mode-based credits' : `${w.creditCost}cr`}]` : ' [free]';
    catLines.push(`- **${w.slug}** — ${w.personaName} · ${w.name}${tier}`);
    catLines.push(`  > ${w.description.slice(0, 100)}...`);
  }
  catLines.push('');
}

fs.writeFileSync(`${OUT}/worker-category-map.md`, catLines.join('\n'));
console.log('✅ worker-category-map.md');

// ── DELIVERABLE 3b: Form Patterns ─────────────────────────────────────────────
console.log('\nAnalyzing form patterns...');

const patterns = {
  withVoiceMatch: [],
  withoutVoiceMatch: [],
  withBrandContext: [],
  withModeCards: [],
  withMoreOptions: [],
  withoutMoreOptions: [],
  sparse: [], // < 3 fields
  dense: [], // > 10 fields
  withFileUpload: [],
  withHandoffs: [],
  withTemplates: [],
  byOutputFormat: {},
};

for (const w of workers) {
  const form = extractFormFeatures(w.slug);
  const sys = getSystemPromptFeatures(w.slug);
  
  if (sys.hasVoiceMatch || form.hasVoiceMatch) patterns.withVoiceMatch.push(w.slug);
  else patterns.withoutVoiceMatch.push(w.slug);
  
  if (sys.hasBrandContext) patterns.withBrandContext.push(w.slug);
  if (form.hasModeCards) patterns.withModeCards.push(w.slug);
  if (form.hasMoreOptions) patterns.withMoreOptions.push(w.slug);
  else patterns.withoutMoreOptions.push(w.slug);
  if (form.fieldCount < 3 && form.fieldCount > 0) patterns.sparse.push(w.slug);
  if (form.fieldCount > 10) patterns.dense.push(w.slug);
  if (form.hasFileUpload) patterns.withFileUpload.push(w.slug);
  if (sys.hasHandoffs) patterns.withHandoffs.push(w.slug);
  if (w.hasTemplates) patterns.withTemplates.push(w.slug);
  
  const fmt = w.outputFormat || 'markdown';
  if (!patterns.byOutputFormat[fmt]) patterns.byOutputFormat[fmt] = [];
  patterns.byOutputFormat[fmt].push(w.slug);
}

// Workers that arguably should have voice match but don't
const shouldHaveVoiceMatch = patterns.withoutVoiceMatch.filter(slug => {
  const w = workers.find(x => x.slug === slug);
  return w && ['content-writer', 'newsletter-writer', 'email-copywriter', 'ad-copywriter',
    'landing-page-copywriter', 'script-writer', 'grant-writer', 'long-form-article-writer',
    'blog-post-writer', 'linkedin-ghostwriter', 'personal-brand-strategist',
    'sales-outreach-writer', 'proposal-writer', 'whitepaper-writer', 'press-release-writer',
    'podcast-show-notes-writer'].includes(slug);
});

const formPatternLines = [
  '# Worker Form Patterns',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '---',
  '',
  `## Workers WITH voice match (${patterns.withVoiceMatch.length})`,
  patterns.withVoiceMatch.join(', '),
  '',
  `## Workers WITHOUT voice match (${patterns.withoutVoiceMatch.length})`,
  patterns.withoutVoiceMatch.join(', '),
  '',
  `## Workers that arguably SHOULD have voice match but don't`,
  shouldHaveVoiceMatch.join(', '),
  '',
  `## Workers WITH brand context integration (${patterns.withBrandContext.length})`,
  patterns.withBrandContext.join(', '),
  '',
  `## Workers WITH mode cards at entry — Charlie pattern (${patterns.withModeCards.length})`,
  patterns.withModeCards.join(', ') || 'None — Charlie is currently the only one',
  '',
  `## Workers WITH "More Options" collapsible section (${patterns.withMoreOptions.length})`,
  patterns.withMoreOptions.join(', '),
  '',
  `## Workers WITHOUT "More Options" (${patterns.withoutMoreOptions.length})`,
  patterns.withoutMoreOptions.join(', '),
  '',
  `## Unusually sparse forms — fewer than 3 fields (${patterns.sparse.length})`,
  patterns.sparse.join(', ') || 'None',
  '',
  `## Unusually dense forms — more than 10 fields (${patterns.dense.length})`,
  patterns.dense.join(', '),
  '',
  `## Workers with file upload capability (${patterns.withFileUpload.length})`,
  patterns.withFileUpload.join(', '),
  '',
  `## Workers with inline handoff CTAs — Charlie pattern (${patterns.withHandoffs.length})`,
  patterns.withHandoffs.join(', ') || 'None — Charlie is currently the only one',
  '',
  `## Workers with templates (${patterns.withTemplates.length})`,
  patterns.withTemplates.join(', '),
  '',
  '## Output formats breakdown',
  ...Object.entries(patterns.byOutputFormat).sort().map(([fmt, slugs]) =>
    `- **${fmt}** (${slugs.length}): ${slugs.join(', ')}`
  ),
  '',
];

fs.writeFileSync(`${OUT}/worker-form-patterns.md`, formPatternLines.join('\n'));
console.log('✅ worker-form-patterns.md');

// ── DELIVERABLE 3c: Credit Audit ──────────────────────────────────────────────
console.log('\nGenerating credit audit...');

const MAX_TOKENS_OVERRIDE = {
  'course-outline-builder': 20000, // premium mode
  'resume-writer': 1200,
  'kpi-dashboard-writer': 8000,
  'thumbnail-designer': 0, // image, no Claude output tokens
  'logo-concept-generator': 0,
  'social-media-graphics-designer': 0,
  'voiceover-artist': 0,
  'transcription-specialist': 0,
  'meeting-notes-writer': 0,
  'sound-effects-designer': 0,
  'content-translator': 0,
  'scene-director': 0,
  'b-roll-generator': 0,
  'ad-creative-generator': 0,
  'product-video-creator': 0,
};

const rows = [];
for (const w of workers) {
  const extAPI = getExternalAPI(w.slug);
  const extCost = EXTERNAL_API_COSTS[extAPI] || 0;
  
  const maxTok = MAX_TOKENS_OVERRIDE[w.slug] !== undefined ? MAX_TOKENS_OVERRIDE[w.slug] : (w.taskType === 'heavy' ? 4096 : 4096);
  const claudeCost = estimateClaudeCost(maxTok);
  const totalCost = claudeCost + extCost;
  
  let credits = 0;
  let revenue = 0;
  let flag = '';
  
  if (w.taskType === 'light') {
    credits = 0;
    revenue = 0;
    // Light workers need to be cheap — flag if API cost is high
    if (totalCost > 0.10) flag = '⚠️ HIGH COST FREE WORKER';
    else if (totalCost > 0.05) flag = '⚡ monitor';
  } else if (w.modeCredits) {
    credits = Math.max(...Object.values(w.modeCredits));
    revenue = credits * CREDIT_REVENUE.operator;
    const margin = revenue > 0 ? ((revenue - totalCost) / revenue * 100) : 100;
    if (margin < 60) flag = '🚨 <60% MARGIN';
    else if (margin < 80) flag = '⚠️ <80% margin';
  } else {
    credits = w.creditCost || (w.taskType === 'heavy' ? 1 : 0);
    revenue = credits * CREDIT_REVENUE.operator;
    const margin = revenue > 0 ? ((revenue - totalCost) / revenue * 100) : 100;
    if (margin < 60) flag = '🚨 <60% MARGIN';
    else if (margin < 80) flag = '⚠️ <80% margin';
  }
  
  const margin = revenue > 0 ? ((revenue - totalCost) / revenue * 100).toFixed(0) + '%' : (credits === 0 ? 'N/A (free)' : '—');
  
  rows.push({
    slug: w.slug,
    category: w.category,
    credits,
    extAPI,
    extCost: extCost.toFixed(3),
    claudeCost: claudeCost.toFixed(3),
    totalCost: totalCost.toFixed(3),
    revenue: revenue.toFixed(3),
    margin,
    flag,
  });
}

const lowMarginWorkers = rows.filter(r => r.flag.includes('<80%') || r.flag.includes('<60%'));
const highCostFree = rows.filter(r => r.flag.includes('HIGH COST') || r.flag.includes('monitor'));

const creditLines = [
  '# Credit Cost and Margin Audit',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  `**Pricing:** Claude Sonnet 4.6 — $3/M input, $15/M output | Pro Annual: $1.58/credit | Operator Annual: $1.33/credit`,
  '',
  '---',
  '',
  '| Slug | Category | Credits | Ext API | Ext cost | Claude cost | Total cost | Revenue (Op) | Margin | Flag |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.slug} | ${r.category} | ${r.credits} | ${r.extAPI} | $${r.extCost} | $${r.claudeCost} | $${r.totalCost} | $${r.revenue} | ${r.margin} | ${r.flag} |`),
  '',
  '---',
  '',
  '## Summary',
  '',
  `**Total workers:** ${workers.length}`,
  `**Heavy workers:** ${workers.filter(w => w.taskType === 'heavy').length}`,
  `**Light workers (free):** ${workers.filter(w => w.taskType === 'light').length}`,
  '',
  `### Workers with margin <80% (${lowMarginWorkers.length})`,
  lowMarginWorkers.map(r => `- **${r.slug}** — ${r.margin} margin, ${r.credits}cr, $${r.totalCost} total cost`).join('\n') || 'None',
  '',
  `### High-cost free workers to monitor (${highCostFree.length})`,
  highCostFree.map(r => `- **${r.slug}** — $${r.totalCost} per task, currently free (light worker)`).join('\n') || 'None',
  '',
  '### Free tier abuse surface',
  'Light workers with meaningful API cost that Starter users can hammer without credit gates:',
  rows.filter(r => r.credits === 0 && parseFloat(r.totalCost) > 0.04).map(r => `- ${r.slug} ($${r.totalCost}/task)`).join('\n') || 'None flagged',
  '',
];

fs.writeFileSync(`${OUT}/worker-credit-audit.md`, creditLines.join('\n'));
console.log('✅ worker-credit-audit.md');

console.log('\n✅ All three supporting files generated:');
console.log(`   ${OUT}/worker-category-map.md`);
console.log(`   ${OUT}/worker-form-patterns.md`);
console.log(`   ${OUT}/worker-credit-audit.md`);
