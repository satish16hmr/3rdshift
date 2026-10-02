import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../app/api/cron/poll-video/route.ts', import.meta.url), 'utf8');

test('poll-video limbo timeout is 15 minutes, not 2 hours', () => {
  assert.match(route, /const VIDEO_POLL_TIMEOUT_MS = 15 \* 60 \* 1000;/);
  assert.match(route, /Date\.now\(\) - new Date\(taskRecord\.created_at\)\.getTime\(\) > VIDEO_POLL_TIMEOUT_MS/);
  assert.doesNotMatch(route, /2 \* 60 \* 60 \* 1000/);
  assert.doesNotMatch(route, /timed out after 2 hours/i);
});

test('poll-video timeout branch refunds credits and marks refund_applied before failing task', () => {
  const timeoutStart = route.indexOf("pollResult.status === 'failed'");
  const stillProcessingStart = route.indexOf('// Still processing', timeoutStart);
  const catchStart = route.indexOf('} catch (err) {', stillProcessingStart);
  assert.ok(stillProcessingStart > -1, 'still-processing branch exists');
  assert.ok(catchStart > stillProcessingStart, 'catch branch follows still-processing branch');

  const stillProcessingBlock = route.slice(stillProcessingStart, catchStart);
  assert.match(stillProcessingBlock, /await refundTaskCredits\(supabase, task\);/);
  assert.match(stillProcessingBlock, /status: 'failed'/);
  assert.match(stillProcessingBlock, /Video generation timed out after 15 minutes\. Your credits have been refunded\. Please try again\./);
  assert.match(stillProcessingBlock, /error_message: 'Stuck prediction timeout'/);

  const refundHelperStart = route.indexOf('async function refundTaskCredits');
  const postStart = route.indexOf('export async function POST');
  const refundHelper = route.slice(refundHelperStart, postStart);
  assert.match(refundHelper, /ledgerRefund\(\{/);
  assert.match(refundHelper, /referenceType: 'task'/);
  assert.match(refundHelper, /workspaceId: task\.workspace_id \?\? null/);
  assert.match(refundHelper, /update\(\{ refund_applied: true \}\)/);
});
