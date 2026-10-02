import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function importAgentModeTypesModule() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), `agent-mode-types-test-${Date.now()}`);
  await mkdir(join(tempDir, 'lib', 'workers'), { recursive: true });
  await mkdir(join(tempDir, 'lib', 'agent-mode'), { recursive: true });

  const registrySource = await readFile(join(root, 'lib', 'workers', 'registry.ts'), 'utf8');
  await writeFile(join(tempDir, 'lib', 'workers', 'registry.ts'), registrySource);

  const typesSource = (await readFile(join(root, 'lib', 'agent-mode', 'types.ts'), 'utf8'))
    .replace("from '@/lib/workers/registry'", "from '../workers/registry.ts'");
  const typesPath = join(tempDir, 'lib', 'agent-mode', 'types.ts');
  await writeFile(typesPath, typesSource);

  return import(pathToFileURL(typesPath).href);
}

test('mode-aware chain costs use saved worker mode instead of slug-only chain cost', async () => {
  const { calcChainCostPerRun, getWorkerCreditCost } = await importAgentModeTypesModule();
  const cost = calcChainCostPerRun([
    { worker_id: 'landing-page-copywriter', position: 1, form_settings: { page_type: 'product_launch' } },
    { worker_id: 'email-copywriter', position: 2, form_settings: { email_type: 'thank_you' } },
  ], { requireMode: true });

  assert.deepEqual(cost, { light: 1, heavy: 1 });
  assert.deepEqual(getWorkerCreditCost('email-copywriter', { email_type: 'promotional' }, { requireMode: true }), { light: 0, heavy: 1 });
});

test('kpi dashboard writer bills as one heavy credit in chains', async () => {
  const { calcChainCostPerRun, getWorkerCreditCost } = await importAgentModeTypesModule();

  assert.deepEqual(getWorkerCreditCost('kpi-dashboard-writer'), { light: 0, heavy: 1 });
  assert.deepEqual(
    calcChainCostPerRun([
      { worker_id: 'report-writer', position: 1, form_settings: {} },
      { worker_id: 'kpi-dashboard-writer', position: 2, form_settings: {} },
      { worker_id: 'case-study-writer', position: 3, form_settings: {} },
    ]),
    { light: 2, heavy: 1 }
  );
});

test('mode-aware chain validation reports missing mode fields instead of silently defaulting', async () => {
  const { calcChainCostPerRun, getMissingWorkerModeFields } = await importAgentModeTypesModule();
  assert.deepEqual(
    getMissingWorkerModeFields([
      { worker_id: 'content-strategist', position: 1, form_settings: { goal: 'Content strategy' } },
      { worker_id: 'content-writer', position: 2, form_settings: { article_card: 'Blog post' } },
    ]),
    [
      { position: 1, worker_id: 'content-strategist', field: 'strategy_mode' },
      { position: 2, worker_id: 'content-writer', field: 'article_card' },
    ]
  );

  assert.throws(
    () => calcChainCostPerRun([{ worker_id: 'content-strategist', position: 1, form_settings: {} }], { requireMode: true }),
    /Choose a mode\./
  );
});

test('WorkerModeCards renders selected state from selectedId', async () => {
  const source = await readFile(join(process.cwd(), 'components/workers/WorkerModeCards.tsx'), 'utf8');

  assert.match(source, /aria-pressed=\{isSelected\}/);
  assert.match(source, /isSelected \?/);
  assert.doesNotMatch(source, /const defaultId = selectedId \|\| modes\[0\]\?\.id/);
});

test('seeded preset migration has explicit modes and card costs match strict execution costs', async () => {
  const { calcChainCostPerRun, getMissingWorkerModeFields } = await importAgentModeTypesModule();
  const migration = await readFile(
    join(process.cwd(), 'supabase/migrations/20260702_agent_mode_seeded_preset_modes.sql'),
    'utf8'
  );
  const blocks = migration.split(/\n(?=-- )/).filter(block => block.includes('UPDATE agent_mode_presets'));

  assert.equal(blocks.length, 21);

  for (const block of blocks) {
    const presetName = block.match(/^-- (.*?) \(/)?.[1] ?? 'Unknown preset';
    const workersJson = block
      .match(/workers = '([\s\S]*?)'::jsonb,\n  heavy_credits_per_run/)?.[1]
      ?.replace(/''/g, "'");
    const expectedHeavy = Number(block.match(/heavy_credits_per_run = (\d+)/)?.[1]);
    const expectedLight = Number(block.match(/light_tasks_per_run = (\d+)/)?.[1]);

    assert.ok(workersJson, `${presetName} has workers JSON`);

    const workers = JSON.parse(workersJson);
    assert.deepEqual(getMissingWorkerModeFields(workers), [], `${presetName} has no missing/invalid modes`);
    assert.deepEqual(
      calcChainCostPerRun(workers, { requireMode: true }),
      { light: expectedLight, heavy: expectedHeavy },
      `${presetName} card metadata matches strict mode-aware execution cost`
    );
  }
});
