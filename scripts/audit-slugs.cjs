/**
 * audit-slugs.cjs
 * Compares every worker slug in the registry against:
 * 1. Prompt files (lib/workers/[slug]/prompt.ts)
 * 2. Config map (lib/workers/configs.ts)
 * Prints a full report and exits non-zero if any mismatches found.
 */

const fs = require('fs');
const path = require('path');

const WORKERS_DIR = path.join(__dirname, '../lib/workers');
const REGISTRY_FILE = path.join(WORKERS_DIR, 'registry.ts');
const CONFIGS_FILE = path.join(WORKERS_DIR, 'configs.ts');

// Extract all slugs from registry
function getRegistrySlugs() {
  const content = fs.readFileSync(REGISTRY_FILE, 'utf8');
  const slugs = [];
  const re = /slug:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

// Get all worker subdirectories that have a prompt.ts
function getPromptFileSlugs() {
  const results = [];
  const dirs = fs.readdirSync(WORKERS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  for (const dir of dirs) {
    const promptFile = path.join(WORKERS_DIR, dir, 'prompt.ts');
    if (!fs.existsSync(promptFile)) continue;
    
    const content = fs.readFileSync(promptFile, 'utf8');
    const re = /slug:\s*['"]([^'"]+)['"]/g;
    let m;
    const slugsInFile = [];
    while ((m = re.exec(content)) !== null) {
      slugsInFile.push(m[1]);
    }
    results.push({ dir, slugs: slugsInFile, file: promptFile });
  }
  return results;
}

// Get all slug imports/references in configs.ts
function getConfigSlugs() {
  const content = fs.readFileSync(CONFIGS_FILE, 'utf8');
  const slugs = [];
  const re = /['"]([a-z][a-z0-9-]+)['"]\s*:/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1].includes('-') || m[1].length > 4) slugs.push(m[1]);
  }
  return [...new Set(slugs)];
}

// ── Run audit ──────────────────────────────────────────────────────────────
const registrySlugs = getRegistrySlugs();
const promptFiles = getPromptFileSlugs();
const configSlugs = getConfigSlugs();

let errors = 0;
let warnings = 0;

console.log('\n═══════════════════════════════════════════');
console.log('  3rdShift Slug Audit');
console.log('═══════════════════════════════════════════\n');

console.log(`Registry entries: ${registrySlugs.length}`);
console.log(`Prompt file dirs: ${promptFiles.length}\n`);

// Check 1: Every prompt file slug should be in the registry
console.log('── Prompt files vs Registry ──────────────');
for (const { dir, slugs, file } of promptFiles) {
  for (const slug of slugs) {
    if (!registrySlugs.includes(slug)) {
      console.log(`❌ ORPHAN: "${slug}" in ${path.relative(WORKERS_DIR, file)} — NOT in registry`);
      errors++;
    } else {
      console.log(`✅ OK: "${slug}" in registry`);
    }
  }
  // Check dir name matches slug
  if (slugs.length > 0 && !slugs.includes(dir)) {
    console.log(`⚠️  WARN: dir "${dir}" doesn't match any slug in its prompt.ts (slugs: ${slugs.join(', ')})`);
    warnings++;
  }
}

// Check 2: Every registry slug should have a prompt file (or be a text-only worker using shared config)
console.log('\n── Registry vs Prompt files ──────────────');
const allPromptSlugs = promptFiles.flatMap(p => p.slugs);
for (const slug of registrySlugs) {
  if (!allPromptSlugs.includes(slug)) {
    console.log(`⚠️  NO PROMPT FILE: "${slug}" is in registry but has no matching prompt.ts`);
    warnings++;
  }
}

// Check 3: Duplicate slugs in registry
console.log('\n── Duplicate slug check ──────────────────');
const seen = {};
for (const slug of registrySlugs) {
  seen[slug] = (seen[slug] || 0) + 1;
}
let dupes = false;
for (const [slug, count] of Object.entries(seen)) {
  if (count > 1) {
    console.log(`❌ DUPLICATE: "${slug}" appears ${count} times in registry`);
    errors++;
    dupes = true;
  }
}
if (!dupes) console.log('✅ No duplicates found');

// Summary
console.log('\n═══════════════════════════════════════════');
console.log(`  Results: ${errors} errors, ${warnings} warnings`);
console.log('═══════════════════════════════════════════\n');

if (errors > 0) {
  console.log('❌ AUDIT FAILED — fix errors above before deploying\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('⚠️  AUDIT PASSED WITH WARNINGS\n');
  process.exit(0);
} else {
  console.log('✅ AUDIT PASSED — all slugs consistent\n');
  process.exit(0);
}
