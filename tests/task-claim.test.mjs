import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
  }).outputText;
}

async function importTaskClaimModule() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), `task-claim-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const tasksDir = join(tempDir, 'lib', 'tasks');
  await mkdir(tasksDir, { recursive: true });
  const source = await readFile(join(root, 'lib', 'tasks', 'claim.ts'), 'utf8');
  await writeFile(join(tasksDir, 'claim.mjs'), transpile(source));
  return import(join(tasksDir, 'claim.mjs'));
}

class AtomicTaskUpdateQuery {
  constructor(db) {
    this.db = db;
    this.patch = null;
    this.filters = [];
    this.wantSingle = false;
  }
  update(patch) { this.patch = patch; return this; }
  eq(column, value) { this.filters.push({ column, value }); return this; }
  select() { return this; }
  single() { this.wantSingle = true; return this; }
  async then(resolve) {
    await this.db.updateGate;
    const task = this.db.task;
    const matches = this.filters.every(({ column, value }) => task[column] === value);
    if (matches) {
      Object.assign(task, this.patch);
      this.db.updatedRows += 1;
      resolve({ data: this.wantSingle ? { ...task } : [{ ...task }], error: null });
      return;
    }
    resolve({ data: this.wantSingle ? null : [], error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } });
  }
}

class FakeSupabase {
  constructor(task) {
    this.task = task;
    this.updatedRows = 0;
    let release;
    this.updateGate = new Promise((resolve) => { release = resolve; });
    this.releaseUpdates = release;
  }
  from(table) {
    assert.equal(table, 'tasks');
    return new AtomicTaskUpdateQuery(this);
  }
}

test('two concurrent execute-task claims on one pending task allow exactly one execution', async () => {
  const { claimPendingTaskForExecution } = await importTaskClaimModule();
  const db = new FakeSupabase({ id: 'task_1', status: 'pending', worker_slug: 'blog-writer' });

  const claims = Promise.all([
    claimPendingTaskForExecution(db, 'task_1'),
    claimPendingTaskForExecution(db, 'task_1'),
  ]);
  db.releaseUpdates();
  const results = await claims;

  assert.equal(results.filter((result) => result.claimed).length, 1);
  assert.equal(results.filter((result) => !result.claimed).length, 1);
  assert.equal(db.updatedRows, 1);
  assert.equal(db.task.status, 'processing');
});

test('execute-task route and inngest task-executor both use the atomic pending claim guard', async () => {
  const [executeTaskRoute, inngestTaskExecutor] = await Promise.all([
    readFile(join(process.cwd(), 'app/api/execute-task/route.ts'), 'utf8'),
    readFile(join(process.cwd(), 'lib/inngest/functions/task-executor.ts'), 'utf8'),
  ]);

  assert.match(executeTaskRoute, /claimPendingTaskForExecution\(supabase,\s*taskId\)/);
  assert.doesNotMatch(executeTaskRoute, /\.update\(\{ status: 'processing' \}\)\s*\.eq\('id', taskId\)/);
  assert.match(inngestTaskExecutor, /claimPendingTaskForExecution\(supabase,\s*taskId\)/);
});

test('execute-task skips its own claim for alreadyClaimed internal calls but continues execution', async () => {
  const executeTaskRoute = await readFile(join(process.cwd(), 'app/api/execute-task/route.ts'), 'utf8');

  assert.match(
    executeTaskRoute,
    /const alreadyClaimedByInternalExecutor = isInternalCall && body\.alreadyClaimed === true;/,
  );

  const alreadyClaimedBranchStart = executeTaskRoute.indexOf('if (alreadyClaimedByInternalExecutor) {');
  const normalClaimBranchStart = executeTaskRoute.indexOf('} else {', alreadyClaimedBranchStart);
  const workerConfigIndex = executeTaskRoute.indexOf('const workerConfig = getWorkerPromptConfig(task.worker_slug);');

  assert.ok(alreadyClaimedBranchStart > 0, 'missing alreadyClaimed branch');
  assert.ok(normalClaimBranchStart > alreadyClaimedBranchStart, 'missing normal claim branch after alreadyClaimed branch');
  assert.ok(workerConfigIndex > normalClaimBranchStart, 'execution must continue after alreadyClaimed/claim gate');

  const alreadyClaimedBranch = executeTaskRoute.slice(alreadyClaimedBranchStart, normalClaimBranchStart);
  assert.match(alreadyClaimedBranch, /taskForChecks\.status !== 'processing'/);
  assert.match(alreadyClaimedBranch, /return NextResponse\.json\(\{ error: 'Task was not claimed for execution' \}, \{ status: 409 \}\)/);
  assert.doesNotMatch(alreadyClaimedBranch, /claimPendingTaskForExecution/);

  const normalClaimBranch = executeTaskRoute.slice(normalClaimBranchStart, workerConfigIndex);
  assert.match(normalClaimBranch, /claimPendingTaskForExecution\(supabase,\s*taskId\)/);
  assert.match(normalClaimBranch, /return NextResponse\.json\(\{ error: 'Task is not pending or was already claimed' \}, \{ status: 409 \}\)/);
});

test('client direct-insert flows create pending tasks and call execute-task without alreadyClaimed', async () => {
  const flowFiles = [
    'components/chat/TeamMemberChat.tsx',
    'components/workers/RemyEditForm.tsx',
    'components/workers/BellaBookkeepingForm.tsx',
    'components/workers/BeckResumeForm.tsx',
  ];

  for (const file of flowFiles) {
    const source = await readFile(join(process.cwd(), file), 'utf8');
    const insertIndex = source.indexOf(".from('tasks')");
    const pendingIndex = source.indexOf("status: 'pending'", insertIndex);
    const executeIndex = source.indexOf("fetch('/api/execute-task'", pendingIndex);
    const bodyIndex = source.indexOf('JSON.stringify({ taskId:', executeIndex);

    assert.ok(insertIndex > 0, `${file} must insert a task row`);
    assert.ok(pendingIndex > insertIndex, `${file} must create the task as pending`);
    assert.ok(executeIndex > pendingIndex, `${file} must call execute-task after pending insert`);
    assert.ok(bodyIndex > executeIndex, `${file} must send only a normal taskId execute request`);
    assert.doesNotMatch(source, /alreadyClaimed/, `${file} must not bypass the execute-task claim`);
  }
});
