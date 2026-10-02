import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function simulateCycleAwarePlanApplication(input: {
  balanceBefore: number;
  grantedDelta: number;
  planCredits: number;
  insertedNewPeriod: boolean;
}) {
  let balanceAfter = input.balanceBefore;
  if (input.grantedDelta > 0) {
    balanceAfter = input.insertedNewPeriod
      ? input.planCredits
      : input.balanceBefore + input.grantedDelta;
  }

  const profileUpdate: Record<string, unknown> = { plan: 'pro', stripe_subscription_id: 'sub_123' };
  if (input.grantedDelta > 0) profileUpdate.heavy_credits_remaining = balanceAfter;

  return { balanceAfter, profileUpdate };
}

test('C-2 trace: cancel→resume same-period no-op preserves spent Pro credits', () => {
  const trace = simulateCycleAwarePlanApplication({
    balanceBefore: 12,
    grantedDelta: 0,
    planCredits: 50,
    insertedNewPeriod: false,
  });

  assert.equal(trace.balanceAfter, 12);
  assert.equal(Object.hasOwn(trace.profileUpdate, 'heavy_credits_remaining'), false);

  const planTransitions = readFileSync(new URL('../lib/billing/plan-transitions.ts', import.meta.url), 'utf8');
  assert.match(planTransitions, /shouldWritePlanCredits = delta > 0/);
  assert.match(planTransitions, /if \(shouldWritePlanCredits\) \{\n\s*profileUpdate\.heavy_credits_remaining = newCreditsRemaining;/);
});

test('C-2 trace: real Pro→Operator same-period upgrade grants only missing delta', () => {
  const trace = simulateCycleAwarePlanApplication({
    balanceBefore: 10,
    grantedDelta: 100,
    planCredits: 150,
    insertedNewPeriod: false,
  });

  assert.equal(trace.balanceAfter, 110);
  assert.equal(trace.profileUpdate.heavy_credits_remaining, 110);

  const migration = readFileSync(new URL('../supabase/migrations/20260630_billing_refund_audio_security.sql', import.meta.url), 'utf8');
  assert.match(migration, /v_balance_after := GREATEST\(COALESCE\(v_balance_before, 0\) \+ v_delta, 0\)/);
  assert.match(migration, /v_balance_after := GREATEST\(COALESCE\(p_plan_credits, 0\), 0\)/);
});

test('H-1 top-up refund zeroes credit_topups via RPC and does not mutate profile plan bucket in webhook code', () => {
  const webhook = readFileSync(new URL('../app/api/webhooks/stripe/route.ts', import.meta.url), 'utf8');
  const start = webhook.indexOf("chargeMeta?.type === 'credit_topup'");
  const end = webhook.indexOf('// Phase 23 Step 6: subscription refund', start);
  const topupBlock = webhook.slice(start, end);

  assert.match(topupBlock, /zero_refunded_credit_topup/);
  assert.doesNotMatch(topupBlock, /heavy_credits_remaining/);
  assert.doesNotMatch(topupBlock, /profiles'\)\.update/);

  const migration = readFileSync(new URL('../supabase/migrations/20260630_billing_refund_audio_security.sql', import.meta.url), 'utf8');
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /SET credits_remaining = 0/);
  assert.match(migration, /refunded_at/);
});

test('H-2 migration removes blanket authenticated audio SELECT and app serves audio through authorized signed URL route', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260630_billing_refund_audio_security.sql', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../app/api/tasks/audio-output-url/route.ts', import.meta.url), 'utf8');
  const player = readFileSync(new URL('../components/AudioPlayer.tsx', import.meta.url), 'utf8');

  assert.match(migration, /DROP POLICY IF EXISTS "Authenticated users read audio-outputs"/);
  assert.match(route, /requireUser/);
  assert.match(route, /workspace_members/);
  assert.match(route, /createSignedUrl\(requestedPath, 60 \* 60\)/);
  assert.match(player, /\/api\/tasks\/audio-output-url/);

  const executeTask = readFileSync(new URL('../app/api/execute-task/route.ts', import.meta.url), 'utf8');
  const pollDubbing = readFileSync(new URL('../app/api/cron/poll-dubbing/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(executeTask, /from\('audio-outputs'\)\s*\.createSignedUrl/);
  assert.doesNotMatch(pollDubbing, /from\('audio-outputs'\)\s*\.createSignedUrl/);
});
