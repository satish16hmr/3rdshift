import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('workspace self-leave scopes member lookup to selected workspace without multi-row single', async () => {
  const source = await readFile(join(process.cwd(), 'app/api/workspace/invite/route.ts'), 'utf8');
  const selfLeaveBlock = source.slice(source.indexOf('if (isSelfLeave)'), source.indexOf('} else {', source.indexOf('if (isSelfLeave)')));

  assert.match(selfLeaveBlock, /req\.headers\.get\('x-workspace-id'\)/);
  assert.match(selfLeaveBlock, /\.eq\('workspace_id', headerWsId\)/);
  assert.match(selfLeaveBlock, /\.maybeSingle\(\)/);
  assert.doesNotMatch(selfLeaveBlock, /\.single\(\)/);
});

test('brand context PUT sends same selected workspace header as GET', async () => {
  const source = await readFile(join(process.cwd(), 'app/dashboard/settings/brand-context/page.tsx'), 'utf8');
  const saveBlock = source.slice(source.indexOf('const handleSave'), source.indexOf('const inputFields'));

  assert.match(saveBlock, /const storedWorkspaceId = getStoredWorkspaceId\(\)/);
  assert.match(saveBlock, /if \(storedWorkspaceId\) headers\['x-workspace-id'\] = storedWorkspaceId/);
  assert.match(saveBlock.replace(/\n/g, ' '), /fetch\('\/api\/brand-profile', \{\s*method: 'PUT',\s*headers,/);
});
