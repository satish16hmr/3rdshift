/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateHeavyCreditNetOutCents,
  checkWeekOneHeavyCap,
  getGuaranteeEligibility,
  getWeekOneHeavyCap,
  isUnderCleanRefundThreshold,
  WEEK_ONE_HEAVY_CAP_MESSAGE,
} from '../lib/billing/guarantee';

type Filter = { op: 'eq' | 'gt' | 'gte' | 'lt' | 'in'; column: string; value: any };

class FakeQuery {
  private filters: Filter[] = [];
  private selected = '*';
  private maxRows: number | null = null;

  constructor(private db: FakeSupabase, private table: string) {}

  select(columns = '*') { this.selected = columns; return this; }
  eq(column: string, value: any) { this.filters.push({ op: 'eq', column, value }); return this; }
  gt(column: string, value: any) { this.filters.push({ op: 'gt', column, value }); return this; }
  gte(column: string, value: any) { this.filters.push({ op: 'gte', column, value }); return this; }
  lt(column: string, value: any) { this.filters.push({ op: 'lt', column, value }); return this; }
  in(column: string, value: any[]) { this.filters.push({ op: 'in', column, value }); return this; }
  limit(count: number) { this.maxRows = count; return this; }

  async single() {
    const row = this.filteredRows()[0] ?? null;
    return { data: row, error: row ? null : { message: 'not found' } };
  }

  async maybeSingle() {
    return { data: this.filteredRows()[0] ?? null, error: null };
  }

  then(resolve: (value: { data: any[]; error: null }) => void) {
    resolve({ data: this.filteredRows(), error: null });
  }

  private filteredRows() {
    let rows = this.db.tableRows(this.table).filter(row => this.filters.every(filter => {
      const value = row[filter.column];
      if (filter.op === 'eq') return value === filter.value;
      if (filter.op === 'gt') return Number(value ?? 0) > Number(filter.value);
      if (filter.op === 'gte') return String(value) >= String(filter.value);
      if (filter.op === 'lt') return String(value) < String(filter.value);
      if (filter.op === 'in') return filter.value.includes(value);
      return true;
    }));
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
    return rows;
  }
}

class FakeSupabase {
  profiles: any[] = [
    {
      id: 'user_1',
      plan: 'pro',
      first_purchase_at: '2026-07-17T10:00:00.000Z',
      guarantee_heavy_cap_lifted_at: null,
    },
  ];
  tasks: any[] = [];
  credit_transactions: any[] = [];

  from(table: string) {
    return new FakeQuery(this, table);
  }

  tableRows(table: string) {
    if (table === 'profiles') return this.profiles;
    if (table === 'tasks') return this.tasks;
    if (table === 'credit_transactions') return this.credit_transactions;
    throw new Error(`unexpected table ${table}`);
  }
}

test('clean refund threshold is 25 light tasks and 5 heavy credits inclusive', () => {
  assert.equal(isUnderCleanRefundThreshold({ lightTasksUsed: 25, heavyCreditsConsumed: 5 }), true);
  assert.equal(isUnderCleanRefundThreshold({ lightTasksUsed: 26, heavyCreditsConsumed: 5 }), false);
  assert.equal(isUnderCleanRefundThreshold({ lightTasksUsed: 25, heavyCreditsConsumed: 6 }), false);
});

test('week-one heavy caps match approved plan caps', () => {
  assert.equal(getWeekOneHeavyCap('operator'), 15);
  assert.equal(getWeekOneHeavyCap('pro'), 8);
  assert.equal(getWeekOneHeavyCap('starter'), 3);
  assert.equal(getWeekOneHeavyCap('none'), 0);
});

test('guarantee usage counts light tasks and heavy credit debits inside first purchase window', async () => {
  const db = new FakeSupabase();
  db.tasks = [
    { user_id: 'user_1', task_type: 'light', status: 'completed', created_at: '2026-07-17T11:00:00.000Z' },
    { user_id: 'user_1', task_type: 'light', status: 'failed', created_at: '2026-07-17T12:00:00.000Z' },
    { user_id: 'user_1', task_type: 'light', status: 'completed', created_at: '2026-07-25T11:00:00.000Z' },
  ];
  db.credit_transactions = [
    { user_id: 'user_1', amount: 4, created_at: '2026-07-17T12:00:00.000Z' },
    { user_id: 'user_1', amount: -4, created_at: '2026-07-17T13:00:00.000Z' },
    { user_id: 'user_1', amount: 9, created_at: '2026-07-25T12:00:00.000Z' },
  ];

  const eligibility = await getGuaranteeEligibility(db as any, {
    userId: 'user_1',
    now: new Date('2026-07-18T00:00:00.000Z'),
  });

  assert.equal(eligibility.lightTasksUsed, 1);
  assert.equal(eligibility.heavyCreditsConsumed, 4);
  assert.equal(eligibility.underCleanRefundThreshold, true);
  assert.equal(eligibility.isInWindow, true);
});

test('week-one heavy cap blocks over-cap consumption and lifts automatically after day 8', async () => {
  const db = new FakeSupabase();
  db.credit_transactions = [
    { user_id: 'user_1', amount: 7, created_at: '2026-07-17T12:00:00.000Z' },
  ];

  const blocked = await checkWeekOneHeavyCap(db as any, {
    userId: 'user_1',
    plan: 'pro',
    attemptedAmount: 2,
    now: new Date('2026-07-18T00:00:00.000Z'),
  });
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.error, WEEK_ONE_HEAVY_CAP_MESSAGE);
    assert.equal(blocked.cap, 8);
  }

  const dayEight = await checkWeekOneHeavyCap(db as any, {
    userId: 'user_1',
    plan: 'pro',
    attemptedAmount: 2,
    now: new Date('2026-07-25T10:00:00.000Z'),
  });
  assert.equal(dayEight.allowed, true);
});

test('manual cap lift bypasses week-one cap', async () => {
  const db = new FakeSupabase();
  db.profiles[0].guarantee_heavy_cap_lifted_at = '2026-07-18T00:00:00.000Z';
  db.credit_transactions = [{ user_id: 'user_1', amount: 8, created_at: '2026-07-17T12:00:00.000Z' }];

  const result = await checkWeekOneHeavyCap(db as any, {
    userId: 'user_1',
    plan: 'pro',
    attemptedAmount: 10,
    now: new Date('2026-07-18T00:00:00.000Z'),
  });
  assert.equal(result.allowed, true);
});

test('net-out amount uses $37 / 25 credits tier math rounded up', () => {
  assert.equal(calculateHeavyCreditNetOutCents(0), 0);
  assert.equal(calculateHeavyCreditNetOutCents(5), 740);
  assert.equal(calculateHeavyCreditNetOutCents(25), 3700);
});
