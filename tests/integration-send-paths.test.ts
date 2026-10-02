import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');

test('Notion send path does not require an unprovided parent_page_id and verifies append failures', () => {
  const route = source('app/api/notion/save/route.ts');

  assert.match(route, /findDefaultNotionPage/);
  assert.doesNotMatch(route, /taskId and parent_page_id are required/);
  assert.match(route, /const appendRes = await fetch/);
  assert.match(route, /Notion page was created, but adding all content failed/);
});

test('Buffer and Mailchimp send paths require delivery confirmation before success', () => {
  const bufferRoute = source('app/api/buffer/send/route.ts');
  const mailchimpRoute = source('app/api/mailchimp/send/route.ts');

  assert.match(bufferRoute, /Buffer did not confirm post creation/);
  assert.match(bufferRoute, /posts: results\.map/);
  assert.match(mailchimpRoute, /const contentRes = await fetch/);
  assert.match(mailchimpRoute, /Campaign draft was created but Mailchimp rejected the content/);
  assert.match(mailchimpRoute, /https:\/\/\$\{dc\}\.admin\.mailchimp\.com/);
});

test('Google, WordPress, Facebook, LinkedIn, Instagram, and Zapier send paths expose provider failures instead of silent success', () => {
  const google = source('lib/google/workspace.ts');
  const wordpressStatus = source('app/api/wordpress/status/route.ts');
  const facebook = source('app/api/integrations/facebook/publish/route.ts');
  const linkedin = source('app/api/integrations/linkedin/publish/route.ts');
  const instagram = source('app/api/integrations/instagram/publish/route.ts');
  const zapier = source('lib/zapier/helpers.ts');

  assert.match(google, /Could not create Google Doc/);
  assert.match(google, /Google Drive upload failed/);
  assert.match(wordpressStatus, /\.eq\('user_id', userId\)/);
  assert.match(facebook, /Could not load Facebook Pages/);
  assert.match(linkedin, /x-restli-id/);
  assert.match(instagram, /Instagram did not confirm media publish/);
  assert.match(zapier, /Zapier webhook returned/);
  assert.match(zapier, /delivery failures/);
});
