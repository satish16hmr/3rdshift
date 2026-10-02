import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MEDIA_WORKERS = [
  'thumbnail-designer',
  'social-media-graphics-designer',
  'logo-concept-generator',
  'image-cleanup',
  'product-video-creator',
  'b-roll-generator',
  'scene-director',
  'ad-creative-generator',
  'voiceover-artist',
  'sound-effects-designer',
  'transcription-specialist',
  'meeting-notes-writer',
  'content-translator',
];

test('Agent Mode routes all media-capable workers through the real task execution pipeline', async () => {
  const executor = await readFile(join(process.cwd(), 'lib/agent-mode/executor.ts'), 'utf8');

  assert.match(executor, /const MEDIA_TASK_WORKERS = new Set/);
  for (const worker of MEDIA_WORKERS) {
    assert.match(executor, new RegExp(`['"]${worker}['"]`), `${worker} must be in the media-task worker allowlist`);
  }

  const mediaBranchIndex = executor.indexOf('executeMediaWorkerViaTaskPipeline');
  const textBranchIndex = executor.indexOf('executeWorkerWithRetry({');
  assert.ok(mediaBranchIndex > -1, 'chain executor must call the shared media task pipeline');
  assert.ok(mediaBranchIndex < textBranchIndex, 'media workers must be intercepted before generic text callAI execution');
});

test('Agent Mode media results preserve real asset URLs in Final Deliverables instead of prompt text only', async () => {
  const executor = await readFile(join(process.cwd(), 'lib/agent-mode/executor.ts'), 'utf8');

  assert.match(executor, /formatMediaTaskOutputForChain/);
  assert.match(executor, /Download image/);
  assert.match(executor, /Download video/);
  assert.match(executor, /Download audio/);
  assert.match(executor, /waitForMediaTaskCompletion/);
  assert.match(executor, /triggerVideoPoll/);
  assert.match(executor, /normalizeMediaTaskOutputForChain/);
  assert.match(executor, /audio-outputs/);
  assert.match(executor, /video-outputs/);
  assert.match(executor, /select\('status, output, output_format, model_used, error_message'\)/);
  assert.match(executor, /media_task_id/);
});

test('Agent Mode media subtasks apply worker-mode defaults and surface execute-task error bodies', async () => {
  const executor = await readFile(join(process.cwd(), 'lib/agent-mode/executor.ts'), 'utf8');
  const chainsRoute = await readFile(join(process.cwd(), 'app/api/agent-mode/chains/route.ts'), 'utf8');
  const chainDetailRoute = await readFile(join(process.cwd(), 'app/api/agent-mode/chains/[id]/route.ts'), 'utf8');

  assert.match(executor, /applyDefaultWorkerMode/);
  assert.match(executor, /parsedError/);
  assert.match(executor, /Media generation failed \(\$\{res\.status\}\)/);
  assert.match(executor, /body\.slice\(0, 1000\)/);
  assert.match(chainsRoute, /applyDefaultWorkerMode/);
  assert.match(chainDetailRoute, /applyDefaultWorkerMode/);
});

test('Agent Mode media handoff keeps image URLs and context usable for downstream steps', async () => {
  const executor = await readFile(join(process.cwd(), 'lib/agent-mode/executor.ts'), 'utf8');

  assert.match(executor, /extractFirstImageUrlFromPreviousResults/);
  assert.match(executor, /selected_concept_url = previousImageUrl/);
  assert.match(executor, /### Asset Context/);
  assert.match(executor, /### Metadata/);
  assert.match(executor, /Download image/);
});
