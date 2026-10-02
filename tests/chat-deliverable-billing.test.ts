import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function importCreditCostModule() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), `chat-deliverable-billing-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(join(tempDir, 'lib', 'workers'), { recursive: true });
  const source = await readFile(join(root, 'lib', 'workers', 'credit-cost.ts'), 'utf8');
  await writeFile(join(tempDir, 'lib', 'workers', 'credit-cost.ts'), source);
  return import(pathToFileURL(join(tempDir, 'lib', 'workers', 'credit-cost.ts')).href);
}

test('chat deliverable billing derives cost from canonical worker mode', async () => {
  const { deriveEffectiveCreditCost } = await importCreditCostModule();
  const worker = {
    slug: 'email-copywriter',
    creditCost: 0,
    workerModeField: 'email_type',
    modeCredits: { promotional: 1, thank_you: 0 },
  };

  assert.equal(deriveEffectiveCreditCost(worker, { email_type: 'promotional' }), 1);
  assert.equal(deriveEffectiveCreditCost(worker, { email_type: 'thank_you' }), 0);
  assert.throws(
    () => deriveEffectiveCreditCost(worker, { email_type: 'fake_free_mode' }),
    /Invalid mode 'fake_free_mode'/
  );
});

test('chat generate-deliverable route uses the same billing gates as task creation', async () => {
  const source = await readFile(join(process.cwd(), 'app/api/chat/generate-deliverable/route.ts'), 'utf8');
  const extractionIndex = source.indexOf('Extract form field values from this conversation');
  const insertIndex = source.indexOf('// Create task record');

  for (const marker of [
    'deriveEffectiveCreditCost(worker, extractedInput)',
    'validateRequiredFields(member_id, extractedInput)',
    'enforceBillingAccess(supabaseAdmin, creditOwnerId)',
    'enforceResolutionGate(supabaseAdmin, creditOwnerId)',
    'reserveLightTask({',
    'ensureTaskCreditsDebited(supabaseAdmin',
  ]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }

  assert.ok(source.indexOf('enforceBillingAccess(supabaseAdmin, creditOwnerId)') > extractionIndex);
  assert.ok(source.indexOf('enforceBillingAccess(supabaseAdmin, creditOwnerId)') < insertIndex);
  assert.ok(source.indexOf('reserveLightTask({') < insertIndex, 'light-task limit must be reserved before task insert');
  assert.ok(source.indexOf('ensureTaskCreditsDebited(supabaseAdmin') > insertIndex, 'single idempotent debit remains after task insert');
});

test('chat generate-deliverable preserves 402 preflight before task insert and debit', async () => {
  const source = await readFile(join(process.cwd(), 'app/api/chat/generate-deliverable/route.ts'), 'utf8');
  const preflightIndex = source.indexOf('getAvailableCredits(supabaseAdmin, creditOwnerId)');
  const insertIndex = source.indexOf('// Create task record');
  const debitIndex = source.indexOf('ensureTaskCreditsDebited(supabaseAdmin');

  assert.ok(preflightIndex > 0, 'missing available-credit 402 preflight');
  assert.ok(preflightIndex < insertIndex, 'credit preflight must run before task insert');
  assert.ok(preflightIndex < debitIndex, 'credit preflight must run before idempotent debit');
});
