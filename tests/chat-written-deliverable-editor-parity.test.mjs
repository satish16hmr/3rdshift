import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('chat deliverable cards route tasks to the canonical task result page', async () => {
  const source = await readFile(join(root, 'components/chat/TeamMemberChat.tsx'), 'utf8');

  assert.match(
    source,
    /<Link\s+href=\{`\/dashboard\/tasks\/result\?taskId=\$\{task\.id\}`\}/,
    'chat deliverable View & Download must route to the shared task result page'
  );
});

test('written task results render the TipTap editor instead of the read-only text viewer', async () => {
  const source = await readFile(join(root, 'app/dashboard/tasks/result/page.tsx'), 'utf8');

  assert.match(
    source,
    /const isWrittenTextTask = !isImageTask && !isPptxTask && !isClipsTask && !isCaptionsTask && !isAudioTask && !isVideoTask && !isLeadsTask && !isWebsiteTask && !!outputText/,
    'written/text tasks should be detected by output type, not by a narrow creation-path or worker whitelist'
  );
  assert.match(
    source,
    /const isEditorWorker = isWrittenTextTask/,
    'all written/text tasks should use the editor experience'
  );
  assert.match(
    source,
    /\{isEditorWorker \? \([\s\S]*?<TiptapEditor[\s\S]*?onUpdate=\{handleEditorUpdate\}[\s\S]*?\) : \([\s\S]*?<TextOutput text=\{viewMode === 'humanized'/,
    'the result body should render TipTap for written tasks and keep TextOutput only as the fallback'
  );
  assert.doesNotMatch(
    source,
    /\{\/\* \{isEditorWorker \? \(/,
    'the TipTap branch must not be commented out'
  );
});
