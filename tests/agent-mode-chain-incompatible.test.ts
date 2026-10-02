import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function importChainValidationModule() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), `agent-mode-chain-validation-test-${Date.now()}`);
  await mkdir(join(tempDir, 'lib', 'workers'), { recursive: true });
  await mkdir(join(tempDir, 'lib', 'agent-mode'), { recursive: true });

  const registrySource = await readFile(join(root, 'lib', 'workers', 'registry.ts'), 'utf8');
  await writeFile(join(tempDir, 'lib', 'workers', 'registry.ts'), registrySource);

  const validationSource = (await readFile(join(root, 'lib', 'agent-mode', 'chain-validation.ts'), 'utf8'))
    .replace("from '@/lib/workers/registry'", "from '../workers/registry.ts'");
  const validationPath = join(tempDir, 'lib', 'agent-mode', 'chain-validation.ts');
  await writeFile(validationPath, validationSource);

  return import(pathToFileURL(validationPath).href);
}

test('chain-incompatible workers are detected and get a clean API error message', async () => {
  const { getChainIncompatibleWorkers, formatChainIncompatibleWorkerError } = await importChainValidationModule();

  const incompatible = getChainIncompatibleWorkers([
    { worker_id: 'data-analyst', position: 1, form_settings: {} },
    { worker_id: 'report-writer', position: 2, form_settings: {} },
  ]);

  assert.deepEqual(incompatible.map((worker: { worker_id: string; position: number }) => ({
    worker_id: worker.worker_id,
    position: worker.position,
  })), [{ worker_id: 'data-analyst', position: 1 }]);
  assert.match(formatChainIncompatibleWorkerError(incompatible), /cannot be used in Agent Mode chains/);
});

test('direct chain update API rejects injected chain-incompatible workers server-side', async () => {
  const updateRoute = await readFile(join(process.cwd(), 'app/api/agent-mode/chains/[id]/route.ts'), 'utf8');
  const putStart = updateRoute.indexOf('export async function PUT');
  const deleteStart = updateRoute.indexOf('export async function DELETE');
  const putSource = updateRoute.slice(putStart, deleteStart);

  assert.match(putSource, /registryWorker\.chainCompatible === false/);
  assert.match(putSource, /This team member cannot be used in Agent Mode chains/);
  assert.match(putSource, /getChainIncompatibleWorkers\(workers\)/);
});

test('chain run API and executor block incompatible workers before run queueing, charging, or execution', async () => {
  const runRoute = await readFile(join(process.cwd(), 'app/api/agent-mode/chains/[id]/run/route.ts'), 'utf8');
  const runBlockIndex = runRoute.indexOf('const incompatibleWorkers = getChainIncompatibleWorkers(chain.workers ?? [])');
  const runInsertIndex = runRoute.indexOf(".from('agent_mode_runs')");
  const inngestIndex = runRoute.indexOf('await inngest.send');
  assert.ok(runBlockIndex > -1, 'run route validates chain-compatible workers');
  assert.ok(runBlockIndex < runInsertIndex, 'run route rejects before creating a run record');
  assert.ok(runBlockIndex < inngestIndex, 'run route rejects before dispatching execution');

  const executor = await readFile(join(process.cwd(), 'lib/agent-mode/executor.ts'), 'utf8');
  const executorBlockIndex = executor.indexOf('const incompatibleWorkers = getChainIncompatibleWorkers(normalizedWorkers)');
  const billingIndex = executor.indexOf('const billing = await resolveBillingContext');
  const reserveLightIndex = executor.indexOf('const lightReservation = await reserveLightTask');
  const debitIndex = executor.indexOf('const debitResult = await debitCredits');
  const executeWorkerIndex = executor.indexOf('result = await executeWorkerWithRetry');

  assert.ok(executorBlockIndex > -1, 'executor validates chain-compatible workers');
  assert.ok(executorBlockIndex < billingIndex, 'executor rejects before billing context resolution');
  assert.ok(executorBlockIndex < reserveLightIndex, 'executor rejects before light-task reservation');
  assert.ok(executorBlockIndex < debitIndex, 'executor rejects before heavy-credit debit');
  assert.ok(executorBlockIndex < executeWorkerIndex, 'executor rejects before AI worker execution');
  assert.match(executor, /total_light_consumed:\s*0/);
  assert.match(executor, /total_heavy_consumed:\s*0/);
});

test('chain routes reject duplicate workers in a workflow', async () => {
  const chainsRoute = await readFile(join(process.cwd(), 'app/api/agent-mode/chains/route.ts'), 'utf8');
  const chainDetailRoute = await readFile(join(process.cwd(), 'app/api/agent-mode/chains/[id]/route.ts'), 'utf8');

  assert.match(chainsRoute, /is already in this workflow/);
  assert.match(chainDetailRoute, /is already in this workflow/);
});
