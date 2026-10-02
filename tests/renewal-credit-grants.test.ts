/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { grantRenewalPlanCredits, getInvoiceSubscriptionId, isRenewalInvoicePaymentEvent } from '../lib/billing/renewal-credit-grants.ts';

class FakeQuery {
  private filters: Array<{ op: 'eq' | 'gt'; column: string; value: unknown }> = [];
  private selected = '*';
  private db: FakeSupabase;
  private table: string;
  private op?: { type: 'insert' | 'update'; value: any };

  constructor(db: FakeSupabase, table: string, op?: { type: 'insert' | 'update'; value: any }) {
    this.db = db;
    this.table = table;
    this.op = op;
  }

  select(columns = '*') {
    this.selected = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ op: 'gt', column, value });
    return this;
  }

  async maybeSingle() {
    const rows = this.filteredRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const rows = this.filteredRows();
    return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } };
  }

  then(resolve: (value: { data: any[] | null; error: any }) => void) {
    if (this.op?.type === 'insert') {
      const rows = Array.isArray(this.op.value) ? this.op.value : [this.op.value];
      for (const row of rows) {
        if (
          this.table === 'plan_credit_grants'
          && this.db.plan_credit_grants.some(existing =>
            existing.user_id === row.user_id
            && existing.stripe_subscription_id === row.stripe_subscription_id
            && existing.stripe_period_start === row.stripe_period_start
          )
        ) {
          resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
          return;
        }
        this.db.tableRows(this.table).push({ ...row });
      }
      resolve({ data: rows, error: null });
      return;
    }

    if (this.op?.type === 'update') {
      const rows = this.filteredRows();
      for (const row of rows) Object.assign(row, this.op.value);
      resolve({ data: rows, error: null });
      return;
    }

    resolve({ data: this.filteredRows(), error: null });
  }

  private filteredRows() {
    return this.db.tableRows(this.table).filter(row =>
      this.filters.every(filter => {
        if (filter.op === 'eq') return row[filter.column] === filter.value;
        return Number(row[filter.column]) > Number(filter.value);
      })
    );
  }
}

class FakeSupabase {
  profiles = [{ id: 'user_1', plan: 'pro', heavy_credits_remaining: 7 }];
  credit_topups: any[] = [];
  plan_credit_grants: any[] = [];

  from(table: string) {
    return {
      select: (columns = '*') => new FakeQuery(this, table).select(columns),
      insert: (value: any) => new FakeQuery(this, table, { type: 'insert', value }),
      update: (value: any) => new FakeQuery(this, table, { type: 'update', value }),
    };
  }

  tableRows(table: string): any[] {
    if (table === 'profiles') return this.profiles;
    if (table === 'credit_topups') return this.credit_topups;
    if (table === 'plan_credit_grants') return this.plan_credit_grants;
    throw new Error(`unexpected table ${table}`);
  }
}

test('uses Stripe invoice.payment_succeeded as the renewal invoice event and skips invoice.paid duplicates by period grant', async () => {
  assert.equal(isRenewalInvoicePaymentEvent('invoice.payment_succeeded', 'subscription_cycle'), true);
  assert.equal(isRenewalInvoicePaymentEvent('invoice.paid', 'subscription_cycle'), true);
  assert.equal(isRenewalInvoicePaymentEvent('invoice.payment_failed', 'subscription_cycle'), false);
});

test('renewal invoice resets Pro plan heavy credits to 50 and writes a plan_credit_grants row once', async () => {
  const db = new FakeSupabase();

  const first = await grantRenewalPlanCredits(db as any, {
    userId: 'user_1',
    subscriptionId: 'sub_123',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-08-01T00:00:00.000Z',
    plan: 'pro',
    planCredits: 50,
  });

  assert.equal(first.granted, true);
  assert.equal(db.profiles[0].heavy_credits_remaining, 50);
  assert.deepEqual(db.plan_credit_grants, [{
    user_id: 'user_1',
    stripe_subscription_id: 'sub_123',
    stripe_period_start: '2026-07-01T00:00:00.000Z',
    stripe_period_end: '2026-08-01T00:00:00.000Z',
    plan: 'pro',
    granted_credits: 50,
  }]);

  db.profiles[0].heavy_credits_remaining = 12;
  const replay = await grantRenewalPlanCredits(db as any, {
    userId: 'user_1',
    subscriptionId: 'sub_123',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-08-01T00:00:00.000Z',
    plan: 'pro',
    planCredits: 50,
  });

  assert.equal(replay.granted, false);
  assert.equal(db.profiles[0].heavy_credits_remaining, 12);
  assert.equal(db.plan_credit_grants.length, 1);
});

test('first subscription invoice is not treated as a renewal grant', () => {
  assert.equal(isRenewalInvoicePaymentEvent('invoice.payment_succeeded', 'subscription_create'), false);
});

test('resolves subscription id from current and legacy invoice payload shapes', () => {
  assert.equal(getInvoiceSubscriptionId({ subscription: 'sub_legacy' }), 'sub_legacy');
  assert.equal(getInvoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_current' } } }), 'sub_current');
  assert.equal(getInvoiceSubscriptionId({}), null);
});
