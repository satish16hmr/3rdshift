import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { calculateAvailableCreditBalance, calculatePlanCreditBalance } from '../lib/billing/credit-balance.ts';
// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { isActiveSubscriptionStatus } from '../lib/billing/subscription-status.ts';

test('plan changes replace the plan allotment instead of stacking old and new grants', () => {
  const balance = calculatePlanCreditBalance({
    planCredits: 150,
    topupCreditsRemaining: 0,
  });

  assert.equal(balance, 150);
});

test('plan changes keep profile balance as plan bucket only while preserving top-ups at spend time', () => {
  const storedPlanBucket = calculatePlanCreditBalance({
    planCredits: 150,
    topupCreditsRemaining: 25,
  });
  const spendTimeAvailable = calculateAvailableCreditBalance({
    planCreditsRemaining: storedPlanBucket,
    topupCreditsRemaining: 25,
  });

  assert.equal(storedPlanBucket, 150);
  assert.equal(spendTimeAvailable, 175);
});

test('100-credit top-up grants 100 available credits, not 200', () => {
  const storedPlanBucket = calculatePlanCreditBalance({
    planCredits: 0,
    topupCreditsRemaining: 100,
  });
  const spendTimeAvailable = calculateAvailableCreditBalance({
    planCreditsRemaining: storedPlanBucket,
    topupCreditsRemaining: 100,
  });

  assert.equal(storedPlanBucket, 0);
  assert.equal(spendTimeAvailable, 100);
});

test('reset cycle refreshes only plan bucket and does not re-inflate top-ups', () => {
  const firstResetPlanBucket = calculatePlanCreditBalance({
    planCredits: 50,
    topupCreditsRemaining: 100,
  });
  const firstResetAvailable = calculateAvailableCreditBalance({
    planCreditsRemaining: firstResetPlanBucket,
    topupCreditsRemaining: 100,
  });

  const secondResetPlanBucket = calculatePlanCreditBalance({
    planCredits: 50,
    topupCreditsRemaining: 100,
  });
  const secondResetAvailable = calculateAvailableCreditBalance({
    planCreditsRemaining: secondResetPlanBucket,
    topupCreditsRemaining: 100,
  });

  assert.equal(firstResetPlanBucket, 50);
  assert.equal(firstResetAvailable, 150);
  assert.equal(secondResetPlanBucket, 50);
  assert.equal(secondResetAvailable, 150);
});

test('checkout guards treat active and trialing subscriptions as existing subscriptions', () => {
  assert.equal(isActiveSubscriptionStatus('active'), true);
  assert.equal(isActiveSubscriptionStatus('trialing'), true);
  assert.equal(isActiveSubscriptionStatus('canceled'), false);
  assert.equal(isActiveSubscriptionStatus('incomplete_expired'), false);
  assert.equal(isActiveSubscriptionStatus(null), false);
});
