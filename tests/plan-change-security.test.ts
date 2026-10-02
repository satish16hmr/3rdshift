import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { buildPlanDowngradeScheduleParams, buildPlanUpgradeParams, resolvePlanChangeTarget } from '../lib/billing/plan-change.ts';

const STRIPE_PLANS = {
  starter: {
    monthly: { priceId: 'price_starter_monthly' },
    annual: { priceId: 'price_starter_annual' },
  },
  pro: {
    monthly: { priceId: 'price_pro_monthly' },
    annual: { priceId: 'price_pro_annual' },
  },
  operator: {
    monthly: { priceId: 'price_operator_monthly' },
    annual: { priceId: 'price_operator_annual' },
  },
};

test('plan-change rejects invalid target plan', () => {
  const result = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: 'pro',
    targetPlan: 'enterprise',
    targetCycle: 'annual',
  });

  assert.deepEqual(result, { ok: false, error: 'Invalid plan', status: 400 });
});

test('plan-change rejects invalid billing cycle', () => {
  const result = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: 'pro',
    targetPlan: 'operator',
    targetCycle: 'weekly',
  });

  assert.deepEqual(result, { ok: false, error: 'Invalid billing cycle', status: 400 });
});

test('plan-change resolves price only from catalog target plan/cycle and ignores arbitrary client price values', () => {
  const body = {
    targetPlan: 'operator',
    targetCycle: 'monthly',
    newPriceId: 'price_attacker_legacy_cheaper',
    isUpgrade: false,
    subscriptionItemId: 'si_attacker_supplied',
  };

  const result = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: 'pro',
    targetPlan: body.targetPlan,
    targetCycle: body.targetCycle,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.newPriceId, 'price_operator_monthly');
  assert.notEqual(result.newPriceId, body.newPriceId);
});

test('client cannot force downgrade path for a legitimate upgrade', () => {
  const body = { targetPlan: 'operator', targetCycle: 'annual', isUpgrade: false };

  const result = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: 'pro',
    targetPlan: body.targetPlan,
    targetCycle: body.targetCycle,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.isUpgrade, true);
  assert.equal(result.isDowngrade, false);
});

test('client cannot force upgrade path for a legitimate downgrade', () => {
  const body = { targetPlan: 'starter', targetCycle: 'annual', isUpgrade: true };

  const result = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: 'operator',
    targetPlan: body.targetPlan,
    targetCycle: body.targetCycle,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.isUpgrade, false);
  assert.equal(result.isDowngrade, true);
});

test('legitimate upgrade uses immediate always_invoice proration with derived subscription item and catalog price', () => {
  const target = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: 'pro',
    targetPlan: 'operator',
    targetCycle: 'annual',
  });

  assert.equal(target.ok, true);
  if (!target.ok) return;
  const params = buildPlanUpgradeParams({
    subscriptionItemId: 'si_from_live_stripe_subscription',
    newPriceId: target.newPriceId,
  });

  assert.equal(params.get('items[0][id]'), 'si_from_live_stripe_subscription');
  assert.equal(params.get('items[0][price]'), 'price_operator_annual');
  assert.equal(params.get('proration_behavior'), 'always_invoice');
  assert.equal(params.get('payment_behavior'), 'error_if_incomplete');
});

test('legitimate downgrade schedules end-of-period phase with catalog price', () => {
  const target = resolvePlanChangeTarget({
    stripePlans: STRIPE_PLANS,
    currentPlan: 'operator',
    targetPlan: 'pro',
    targetCycle: 'monthly',
  });

  assert.equal(target.ok, true);
  if (!target.ok) return;
  const params = buildPlanDowngradeScheduleParams({
    currentPhase: {
      start_date: 1_800_000_000,
      end_date: 1_802_592_000,
      items: [{ price: 'price_operator_annual' }],
    },
    currentPeriodEnd: 1_802_592_000,
    newPriceId: target.newPriceId,
  });

  assert.equal(params['phases[0][items][0][price]'], 'price_operator_annual');
  assert.equal(params['phases[1][start_date]'], '1802592000');
  assert.equal(params['phases[1][items][0][price]'], 'price_pro_monthly');
  assert.equal(params['phases[1][iterations]'], '1');
  assert.equal(params.end_behavior, 'release');
});
