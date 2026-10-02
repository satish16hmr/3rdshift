import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function importCreditBalanceModule() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), 'credit-display-test-module');
  const billingDir = join(tempDir, 'lib', 'billing');
  await mkdir(billingDir, { recursive: true });
  const source = await readFile(join(root, 'lib', 'billing', 'credit-balance.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const helperPath = join(billingDir, `credit-balance-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await writeFile(helperPath, compiled);
  return import(helperPath);
}

test('display summary uses top-up-only credits as primary available balance without depletion', async () => {
  const { getCreditDisplaySummary } = await importCreditBalanceModule();

  const summary = getCreditDisplaySummary({
    planCreditsRemaining: 0,
    topupCreditsRemaining: 25,
    includedCreditsLimit: 150,
  });

  assert.equal(summary.availableCreditsRemaining, 25);
  assert.equal(summary.isDepleted, false);
  assert.equal(summary.primaryText, '25 available');
  assert.equal(summary.breakdownText, '0/150 plan · 25 top-up');
});

test('display summary shows plan-only balance when no top-ups exist', async () => {
  const { getCreditDisplaySummary } = await importCreditBalanceModule();

  const summary = getCreditDisplaySummary({
    planCreditsRemaining: 47,
    topupCreditsRemaining: 0,
    includedCreditsLimit: 50,
  });

  assert.equal(summary.availableCreditsRemaining, 47);
  assert.equal(summary.isDepleted, false);
  assert.equal(summary.primaryText, '47 available');
  assert.equal(summary.breakdownText, '47/50 plan');
});

test('display summary sums plan and top-up credits and keeps breakdown secondary', async () => {
  const { getCreditDisplaySummary } = await importCreditBalanceModule();

  const summary = getCreditDisplaySummary({
    planCreditsRemaining: 147,
    topupCreditsRemaining: 24,
    includedCreditsLimit: 150,
  });

  assert.equal(summary.availableCreditsRemaining, 171);
  assert.equal(summary.isDepleted, false);
  assert.equal(summary.primaryText, '171 available');
  assert.equal(summary.breakdownText, '147/150 plan · 24 top-up');
});

test('display summary is depleted only when available credits are zero', async () => {
  const { getCreditDisplaySummary } = await importCreditBalanceModule();

  const summary = getCreditDisplaySummary({
    planCreditsRemaining: 0,
    topupCreditsRemaining: 0,
    includedCreditsLimit: 150,
  });

  assert.equal(summary.availableCreditsRemaining, 0);
  assert.equal(summary.isDepleted, true);
  assert.equal(summary.primaryText, '0 available');
  assert.equal(summary.breakdownText, '0/150 plan');
});
