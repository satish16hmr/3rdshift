import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('memory settings page uses real chat memories API instead of hardcoded lorem data', async () => {
  const source = await readFile(join(process.cwd(), 'app/dashboard/settings/memory/page.tsx'), 'utf8');

  assert.doesNotMatch(source, /const savedMemories/);
  assert.doesNotMatch(source, /Lorem ipsum|Praesent viverra|Nulla venenatis/);
  assert.match(source, /fetch\(`\/api\/chat\/memories\/\$\{encodeURIComponent\(memberId\)\}`/);
  assert.match(source, /method: 'DELETE'/);
  assert.match(source, /member_memories/);
  assert.match(source, /brand_memories/);
});
