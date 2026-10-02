/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Filter = { op: 'eq' | 'gt'; column: string; value: unknown };

async function importAvailableCreditsModule() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), 'available-credits-test-module');
  const billingDir = join(tempDir, 'lib', 'billing');
  await mkdir(billingDir, { recursive: true });

  for (const file of ['catalog.ts', 'credit-balance.ts', 'types.ts']) {
    const source = await readFile(join(root, 'lib', 'billing', file), 'utf8');
    await writeFile(join(billingDir, file), source);
  }

  const helperSource = (await readFile(join(root, 'lib', 'billing', 'available-credits.ts'), 'utf8'))
    .replace("from './catalog'", "from './catalog.ts'")
    .replace("from './credit-balance'", "from './credit-balance.ts'")
    .replace("from './types'", "from './types.ts'");
  const helperPath = join(billingDir, `available-credits-${Date.now()}.ts`);
  await writeFile(helperPath, helperSource);

  return import(helperPath);
}

class FakeQuery {
  private filters: Filter[] = [];
  private limitCount: number | null = null;
  private db: FakeSupabase;
  private table: string;

  constructor(db: FakeSupabase, table: string) {
    this.db = db;
    this.table = table;
  }

  select() { return this; }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ op: 'gt', column, value });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async single() {
    const row = this.filteredRows()[0] ?? null;
    return { data: row, error: row ? null : { message: 'not found' } };
  }

  async maybeSingle() {
    return { data: this.filteredRows()[0] ?? null, error: null };
  }

  then(resolve: (value: { data: any[] | null; error: any }) => void) {
    resolve({ data: this.filteredRows(), error: null });
  }

  private filteredRows() {
    let rows = this.db.tableRows(this.table).filter(row =>
      this.filters.every(filter => {
        if (filter.op === 'eq') return row[filter.column] === filter.value;
        if (filter.op === 'gt') return Number(row[filter.column] ?? 0) > Number(filter.value);
        return true;
      })
    );
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return rows;
  }
}

class FakeSupabase {
  profiles = [
    { id: 'user_1', plan: 'operator', heavy_credits_remaining: 0 },
    { id: 'user_2', plan: 'pro', heavy_credits_remaining: 7 },
  ];
  credit_topups = [
    { user_id: 'user_1', credits_remaining: 25, expires_at: null },
    { user_id: 'user_1', credits_remaining: 8, expires_at: '2999-01-01T00:00:00.000Z' },
    { user_id: 'user_1', credits_remaining: 4, expires_at: '2000-01-01T00:00:00.000Z' },
    { user_id: 'user_1', credits_remaining: 0, expires_at: null },
    { user_id: 'user_2', credits_remaining: 11, expires_at: null },
  ];
  workspaces = [
    { id: 'workspace_1', owner_id: 'user_1' },
  ];

  from(table: string) {
    return { select: () => new FakeQuery(this, table).select() };
  }

  tableRows(table: string): any[] {
    if (table === 'profiles') return this.profiles;
    if (table === 'credit_topups') return this.credit_topups;
    if (table === 'workspaces') return this.workspaces;
    throw new Error(`unexpected table ${table}`);
  }
}

test('getActiveTopupCredits matches debit filter: positive credits and unexpired/null expiry only', async () => {
  const { getActiveTopupCredits } = await importAvailableCreditsModule();
  const db = new FakeSupabase();

  const credits = await getActiveTopupCredits(db as any, 'user_1');

  assert.equal(credits, 33);
});

test('getAvailableCredits returns plan bucket, topup bucket, available total, plan, and included plan limit separately', async () => {
  const { getAvailableCredits } = await importAvailableCreditsModule();
  const db = new FakeSupabase();

  const balance = await getAvailableCredits(db as any, 'user_1');

  assert.deepEqual(balance, {
    planCreditsRemaining: 0,
    topupCreditsRemaining: 33,
    availableCreditsRemaining: 33,
    plan: 'operator',
    includedCreditsLimit: 150,
  });
});

test('getWorkspaceOwnerAvailableCredits resolves workspace owner before reading available credits', async () => {
  const { getWorkspaceOwnerAvailableCredits } = await importAvailableCreditsModule();
  const db = new FakeSupabase();

  const balance = await getWorkspaceOwnerAvailableCredits(db as any, 'workspace_1');

  assert.equal(balance.planCreditsRemaining, 0);
  assert.equal(balance.topupCreditsRemaining, 33);
  assert.equal(balance.availableCreditsRemaining, 33);
  assert.equal(balance.plan, 'operator');
});
