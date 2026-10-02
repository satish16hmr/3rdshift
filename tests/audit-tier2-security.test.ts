import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { buildBrandProfileUpsertPayload } from '../lib/brand-profile.ts';
// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { markdownToReportHtml } from '../lib/report-pdf.ts';
// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { assertSafeUrl, SsrfError } from '../lib/ssrf.ts';

test('brand-profile upsert payload ignores attacker-supplied tenant identifiers', () => {
  const payload = buildBrandProfileUpsertPayload({
    userId: 'auth-user',
    workspaceId: 'auth-workspace',
    body: {
      user_id: 'victim-user',
      workspace_id: 'victim-workspace',
      company_name: 'Legit Co',
      industry: 'Services',
      audience: 'Operators',
      tone: 'Direct',
      competitors: 'Other Co',
      additional_context: 'Safe notes',
      compressed_profile: 'attacker prompt injection',
      role: 'owner',
    },
  });

  assert.equal(payload.user_id, 'auth-user');
  assert.equal(payload.workspace_id, 'auth-workspace');
  assert.equal(payload.company_name, 'Legit Co');
  assert.equal(payload.industry, 'Services');
  assert.equal(payload.audience, 'Operators');
  assert.equal(payload.tone, 'Direct');
  assert.equal(payload.competitors, 'Other Co');
  assert.equal(payload.additional_context, 'Safe notes');
  assert.equal(Object.hasOwn(payload, 'compressed_profile'), false);
  assert.equal(Object.hasOwn(payload, 'role'), false);
});

test('report-pdf sanitizes iframe metadata URL injection while preserving markdown formatting', async () => {
  const html = await markdownToReportHtml([
    '# Report Title',
    '## Metrics',
    'Normal **bold** text <iframe src="http://169.254.169.254/latest/meta-data/"></iframe>',
    'Styled <p style="background-image:url(http://169.254.169.254/latest/meta-data/)">resource</p> text',
    '- Bullet **item**',
    '| Name | Value |',
    '| --- | --- |',
    '| Total | **42** |',
  ].join('\n'), 'Download Title', 'Bella · Bookkeeping Summarizer');

  assert.match(html, /<h1>Report Title<\/h1>/);
  assert.match(html, /<h2>Metrics<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<li>Bullet item<\/li>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /iframe/i);
  assert.doesNotMatch(html, /169\.254\.169\.254/);
  assert.doesNotMatch(html, /src=/i);
  assert.doesNotMatch(html, /style=/i);
});

test('report-pdf sanitizes editor HTML allowlist and strips injected external resource URLs', async () => {
  const html = await markdownToReportHtml([
    '<h1>Editor Title</h1>',
    '<p class="bold-line" onclick="alert(1)">Safe <strong>formatted</strong> text &amp; 2 < 3</p>',
    '<iframe src="http://169.254.169.254/latest/meta-data/"></iframe>',
    '<img src="http://169.254.169.254/latest/meta-data/">',
    '<a href="http://169.254.169.254/latest/meta-data/">metadata</a>',
    '<p style="background-image:url(http://169.254.169.254/latest/meta-data/)">resource</p>',
    '<script src="http://169.254.169.254/latest/meta-data/"></script>',
    '<ul><li>Allowed item</li></ul>',
    '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>',
  ].join('\n'), 'Editor Download', 'Ava · Article Writer');

  assert.match(html, /<h1>Editor Title<\/h1>/);
  assert.match(html, /<p class="bold-line">Safe <strong>formatted<\/strong> text &amp; 2 &lt; 3<\/p>/);
  assert.match(html, /<ul><li>Allowed item<\/li><\/ul>/);
  assert.match(html, /<table><thead><tr><th>Name<\/th><\/tr><\/thead><tbody><tr><td>Value<\/td><\/tr><\/tbody><\/table>/);
  assert.doesNotMatch(html, /iframe|script|img|href=|src=|style=|onclick=/i);
  assert.doesNotMatch(html, /169\.254\.169\.254/);
});

test('ssrf guard blocks unspecified IPv4 and IPv4-mapped IPv6 addresses', () => {
  const blocked = [
    'https://0.0.0.0/',
    'https://[::ffff:169.254.169.254]/',
    'https://[::ffff:127.0.0.1]/',
    'https://[::ffff:a9fe:a9fe]/',
    'https://[::ffff:7f00:1]/',
  ];

  for (const url of blocked) {
    assert.throws(() => assertSafeUrl(url), SsrfError, `${url} should be blocked`);
  }
});
