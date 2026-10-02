/* eslint-disable @typescript-eslint/no-explicit-any */
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

async function copyTranspiled(sourcePath, destPath, replacements = []) {
  let source = await readFile(sourcePath, 'utf8');
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  await writeFile(destPath, transpile(source));
}

async function importTaskDebitModule() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), `task-credit-debit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const billingDir = join(tempDir, 'lib', 'billing');
  const tasksDir = join(tempDir, 'lib', 'tasks');
  const creditsDir = join(tempDir, 'lib', 'credits');
  await mkdir(billingDir, { recursive: true });
  await mkdir(tasksDir, { recursive: true });
  await mkdir(creditsDir, { recursive: true });

  await copyTranspiled(join(root, 'lib', 'billing', 'catalog.ts'), join(billingDir, 'catalog.mjs'));
  await copyTranspiled(join(root, 'lib', 'billing', 'credit-balance.ts'), join(billingDir, 'credit-balance.mjs'));
  await copyTranspiled(join(root, 'lib', 'billing', 'types.ts'), join(billingDir, 'types.mjs'));
  await copyTranspiled(join(root, 'lib', 'billing', 'available-credits.ts'), join(billingDir, 'available-credits.mjs'), [
    ["from './catalog'", "from './catalog.mjs'"],
    ["from './credit-balance'", "from './credit-balance.mjs'"],
    ["from './types'", "from './types.mjs'"],
  ]);

  await writeFile(join(creditsDir, 'ledger.mjs'), `
    export async function debitCredits(params) {
      return params.supabase.rpc('debit_credits', {
        p_user_id: params.userId,
        p_amount: params.amount,
        p_reference_id: params.referenceId,
        p_reference_type: params.referenceType,
        p_workspace_id: params.workspaceId ?? null,
      }).then((r) => {
        if (r.error) return { ok: false, debitedPlan: 0, debitedTopup: 0, errorCode: 'rpc_error' };
        const row = Array.isArray(r.data) ? r.data[0] : r.data;
        return { ok: row?.ok ?? false, debitedPlan: row?.debited_plan ?? 0, debitedTopup: row?.debited_topup ?? 0, errorCode: row?.error_code ?? null };
      });
    }
  `);

  await copyTranspiled(join(root, 'lib', 'tasks', 'credit-debit.ts'), join(tasksDir, 'credit-debit.mjs'), [
    ["from '@/lib/billing/available-credits'", "from '../billing/available-credits.mjs'"],
    ["from '@/lib/credits/ledger'", "from '../credits/ledger.mjs'"],
  ]);
  return import(join(tasksDir, 'credit-debit.mjs'));
}

class FakeQuery {
  constructor(db, table) {
    this.filters = [];
    this.limitCount = null;
    this.db = db;
    this.table = table;
  }
  select() { return this; }
  eq(column, value) { this.filters.push({ op: 'eq', column, value }); return this; }
  gt(column, value) { this.filters.push({ op: 'gt', column, value }); return this; }
  order() { return this; }
  limit(count) { this.limitCount = count; return this; }
  async single() {
    const row = this.filteredRows()[0] ?? null;
    return { data: row, error: row ? null : { message: 'not found' } };
  }
  async maybeSingle() { return { data: this.filteredRows()[0] ?? null, error: null }; }
  then(resolve) { resolve({ data: this.filteredRows(), error: null }); }
  filteredRows() {
    let rows = this.db.tableRows(this.table).filter(row => this.filters.every(filter => {
      if (filter.op === 'eq') return row[filter.column] === filter.value;
      if (filter.op === 'gt') return Number(row[filter.column] ?? 0) > Number(filter.value);
      return true;
    }));
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return rows;
  }
}

class FakeSupabase {
  constructor() {
    this.profiles = [{ id: 'owner_1', plan: 'operator', heavy_credits_remaining: 5 }];
    this.credit_topups = [];
    this.workspaces = [{ id: 'workspace_1', owner_id: 'owner_1' }];
    this.workspace_members = [{ workspace_id: 'workspace_1', user_id: 'member_1', joined_at: '2026-01-01' }];
    this.credit_transactions = [];
    this.rpcCalls = [];
  }
  from(table) { return new FakeQuery(this, table); }
  tableRows(table) {
    if (table === 'profiles') return this.profiles;
    if (table === 'credit_topups') return this.credit_topups;
    if (table === 'workspaces') return this.workspaces;
    if (table === 'workspace_members') return this.workspace_members;
    if (table === 'credit_transactions') return this.credit_transactions;
    throw new Error(`unexpected table ${table}`);
  }
  async rpc(name, args) {
    this.rpcCalls.push({ name, args });
    if (name !== 'debit_credits') throw new Error(`unexpected rpc ${name}`);
    if (this.profiles[0].heavy_credits_remaining < args.p_amount) {
      return { data: { ok: false, debited_plan: 0, debited_topup: 0, error_code: 'insufficient_credits' }, error: null };
    }
    this.profiles[0].heavy_credits_remaining -= args.p_amount;
    this.credit_transactions.push({
      id: `tx_${this.credit_transactions.length + 1}`,
      user_id: args.p_user_id,
      reference_id: args.p_reference_id,
      reference_type: args.p_reference_type,
      amount: args.p_amount,
    });
    return { data: { ok: true, debited_plan: args.p_amount, debited_topup: 0, error_code: null }, error: null };
  }
}

test('chat/generate-created task then execute-task debit guard charges exactly once', async () => {
  const { ensureTaskCreditsDebited } = await importTaskDebitModule();
  const db = new FakeSupabase();
  db.credit_transactions.push({ id: 'existing', user_id: 'owner_1', reference_id: 'task_chat_1', reference_type: 'task', amount: 2 });

  const result = await ensureTaskCreditsDebited(db, { creditOwnerId: 'owner_1', workspaceId: 'workspace_1', taskId: 'task_chat_1', amount: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.alreadyDebited, true);
  assert.equal(db.rpcCalls.length, 0);
  assert.equal(db.credit_transactions.filter(tx => tx.reference_id === 'task_chat_1' && tx.amount > 0).length, 1);
});

test('direct execute-task call with no prior debit reserves credits before execution', async () => {
  const { ensureTaskCreditsDebited } = await importTaskDebitModule();
  const db = new FakeSupabase();

  const result = await ensureTaskCreditsDebited(db, { creditOwnerId: 'owner_1', workspaceId: 'workspace_1', taskId: 'task_direct_1', amount: 3 });

  assert.equal(result.ok, true);
  assert.equal(result.alreadyDebited, false);
  assert.equal(db.rpcCalls.length, 1);
  assert.equal(db.profiles[0].heavy_credits_remaining, 2);
});

test('zero-credit account gets 402 before debit RPC/provider spend', async () => {
  const { ensureTaskCreditsDebited } = await importTaskDebitModule();
  const db = new FakeSupabase();
  db.profiles[0].heavy_credits_remaining = 0;

  const result = await ensureTaskCreditsDebited(db, { creditOwnerId: 'owner_1', workspaceId: 'workspace_1', taskId: 'task_zero_1', amount: 1 });

  assert.equal(result.ok, false);
  assert.equal(result.status, 402);
  assert.equal(db.rpcCalls.length, 0);
  assert.equal(db.credit_transactions.length, 0);
});

test('execute-task performs the debit guard before the first model/provider call', async () => {
  const source = await readFile(join(process.cwd(), 'app/api/execute-task/route.ts'), 'utf8');
  const debitIndex = source.indexOf('ensureTaskCreditsDebited(adminClient');
  const modelIndex = source.indexOf('callAI({');
  assert.ok(debitIndex > 0, 'missing execute-task debit guard');
  assert.ok(modelIndex > 0, 'missing model call marker');
  assert.ok(debitIndex < modelIndex, 'debit guard must run before any model call');
});
