#!/usr/bin/env node
/**
 * Dump all active worker form schemas to stdout.
 * Runs against the compiled source via ts-node or via the built .next server.
 * Since we can't easily import TS in CJS, we use the local dev server's
 * test-harness endpoint — OR we parse the registry + configs directly.
 *
 * This version: starts a minimal Next.js server via `next build` output or
 * calls the local dev server if BASE_URL is set to localhost.
 *
 * Actually: simplest approach — call the test-harness endpoint on prod with a
 * known CRON_SECRET placeholder. But CRON_SECRET isn't set, so we can't.
 *
 * ACTUAL approach: use tsx to import the TS modules directly.
 */

// We'll spawn a tsx process to extract from the TS source
const { execSync } = require('child_process');
const path = require('path');

const repoDir = path.join(__dirname, '..');

// Write a temporary TS extraction script
const extractScript = `
import { getWorkerFormConfig } from './lib/workers/configs';
import { getWorkerBySlug, getAllWorkers } from './lib/workers/registry';

const workers = getAllWorkers().filter(w => w.active && !w.deprecated);

for (const worker of workers) {
  const form = getWorkerFormConfig(worker.slug);
  const fields = form ? form.sections.flatMap(s => s.fields.map(f => ({
    name: f.name,
    type: f.type,
    required: f.required ?? false,
    showWhen: (f as any).showWhen ?? null,
  }))) : [];
  
  const out = {
    slug: worker.slug,
    personaName: worker.personaName,
    name: worker.name,
    workerModeField: worker.workerModeField ?? null,
    workerModesDefault: worker.workerModesDefault ?? null,
    modeCredits: worker.modeCredits ?? null,
    fields,
  };
  process.stdout.write(JSON.stringify(out) + '\\n');
}
`;

require('fs').writeFileSync('/tmp/extract-schemas.ts', extractScript);

try {
  const output = execSync(
    `cd ${repoDir} && npx tsx /tmp/extract-schemas.ts 2>/dev/null`,
    { maxBuffer: 10 * 1024 * 1024 }
  ).toString();
  
  // Parse and format nicely
  const lines = output.trim().split('\n').filter(Boolean);
  const workers = lines.map(l => JSON.parse(l));
  
  console.log(`Total active workers: ${workers.length}\n`);
  
  for (const w of workers) {
    console.log(`━━━ ${w.personaName} · ${w.name} (${w.slug})`);
    if (w.workerModeField) {
      console.log(`    workerModeField: ${w.workerModeField}${w.workerModesDefault ? ` (default: ${w.workerModesDefault})` : ''}`);
    }
    if (w.modeCredits) {
      console.log(`    modeCredits: ${JSON.stringify(w.modeCredits)}`);
    }
    if (w.fields.length === 0) {
      console.log(`    (no form config)`);
    } else {
      for (const f of w.fields) {
        const req = f.required ? '[REQUIRED]' : '[optional]';
        const sw = f.showWhen ? ` showWhen: ${f.showWhen.field}=${JSON.stringify(f.showWhen.value)}` : '';
        console.log(`    ${req} ${f.name} (${f.type})${sw}`);
      }
    }
    console.log('');
  }
} catch (err) {
  console.error('Failed to extract:', err.message);
  process.exit(1);
}
