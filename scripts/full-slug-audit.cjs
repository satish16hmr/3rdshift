/**
 * full-slug-audit.cjs
 * Compares all 80 worker slugs across:
 *   1. Registry (registry.ts)
 *   2. Configs map (configs.ts)
 * Outputs a clean table and flags any mismatches.
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '../lib/workers');
const REGISTRY = fs.readFileSync(path.join(BASE, 'registry.ts'), 'utf8');
const CONFIGS  = fs.readFileSync(path.join(BASE, 'configs.ts'), 'utf8');

// --- Extract registry entries: slug + personaName ---
function getRegistryWorkers() {
  const workers = [];
  // Split on worker object boundaries
  const blocks = REGISTRY.split(/\n  \{/);
  for (const block of blocks) {
    const slugMatch = block.match(/slug:\s*'([^']+)'/);
    const nameMatch = block.match(/personaName:\s*'([^']+)'/);
    if (slugMatch && nameMatch) {
      workers.push({ slug: slugMatch[1], persona: nameMatch[1] });
    }
  }
  return workers;
}

// --- Extract slugs from configs prompt map ---
function getConfigPromptSlugs() {
  const slugs = new Set();
  // Match top-level keys in the workerPrompts map
  const re = /^\s{2}'([a-z][a-z0-9-]+)':\s*\{/gm;
  let m;
  while ((m = re.exec(CONFIGS)) !== null) {
    slugs.add(m[1]);
  }
  // Also match special entries like 'research-assistant': {
  const re2 = /^\s{2}'([a-z][a-z0-9-]+)':\s*(contentWriterPrompt|thumbnailDesignerPrompt|presentationBuilderPrompt|videoClipCreatorPrompt)/gm;
  while ((m = re2.exec(CONFIGS)) !== null) {
    slugs.add(m[1]);
  }
  return slugs;
}

// --- Extract slugs from configs form map ---
function getConfigFormSlugs() {
  const slugs = new Set();
  // Inline map keys: '  slug-name': { ... }
  const re = /^\s{2}'([a-z][a-z0-9-]+)':\s*\{/gm;
  let m;
  while ((m = re.exec(CONFIGS)) !== null) {
    slugs.add(m[1]);
  }
  // Named import keys: '  slug-name': someNamedVar
  const re2 = /^\s{2}'([a-z][a-z0-9-]+)':\s*[a-zA-Z]/gm;
  while ((m = re2.exec(CONFIGS)) !== null) {
    if (!m[0].includes('{')) slugs.add(m[1]);
  }
  // Inline slug fields
  const re3 = /slug:\s*'([^']+)'/g;
  while ((m = re3.exec(CONFIGS)) !== null) {
    slugs.add(m[1]);
  }
  return slugs;
}

const registryWorkers = getRegistryWorkers();
const configSlugs = getConfigFormSlugs(); // forms contain all slugs

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║              3rdShift Full Slug Audit — All 80 Workers           ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log(`║ ${'#'.padEnd(3)} ${'Persona'.padEnd(10)} ${'Registry Slug'.padEnd(40)} ${'In Configs?'.padEnd(12)}║`);
console.log('╠══════════════════════════════════════════════════════════════════╣');

let errors = 0;
for (let i = 0; i < registryWorkers.length; i++) {
  const { slug, persona } = registryWorkers[i];
  const inConfigs = configSlugs.has(slug);
  const status = inConfigs ? '✅' : '❌ MISSING';
  if (!inConfigs) errors++;
  const num = String(i + 1).padEnd(3);
  const p = persona.padEnd(10);
  const s = slug.padEnd(40);
  const c = status.padEnd(12);
  console.log(`║ ${num} ${p} ${s} ${c}║`);
}

console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\nTotal: ${registryWorkers.length} workers | Errors: ${errors}\n`);

// Check for slugs in configs not in registry (orphans)
const registrySlugsSet = new Set(registryWorkers.map(w => w.slug));
const orphans = [...configSlugs].filter(s => !registrySlugsSet.has(s) && s.length > 4 && s.includes('-'));
if (orphans.length > 0) {
  console.log('⚠️  Slugs in configs NOT in registry (orphans):');
  orphans.forEach(s => console.log(`   - ${s}`));
  console.log();
}

if (errors === 0 && orphans.length === 0) {
  console.log('✅ ALL SLUGS ALIGNED — registry and configs match perfectly.\n');
  process.exit(0);
} else {
  console.log('❌ MISMATCHES FOUND — see above.\n');
  process.exit(1);
}
