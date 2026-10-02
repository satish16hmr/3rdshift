import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error Node 22's built-in type stripper needs the .ts extension here.
import { buildOAuthPopupHtml, safeJsonForInlineScript } from '../lib/oauth-popup-response.ts';

const MALICIOUS_ERROR = '</script><img src=x onerror=alert(1)>';

function extractPayloadError(html: string) {
  const match = html.match(/const payload = (\{[\s\S]*?\});/);
  assert.ok(match, 'expected inline payload assignment');
  const payload = JSON.parse(match[1]);
  return payload.error;
}

test('safeJsonForInlineScript escapes HTML/script-breaking and line-separator characters', () => {
  const encoded = safeJsonForInlineScript({ value: `<tag>\u2028\u2029` });

  assert.equal(encoded.includes('<'), false);
  assert.ok(encoded.includes('\\u003ctag>'));
  assert.ok(encoded.includes('\\u2028'));
  assert.ok(encoded.includes('\\u2029'));
  assert.deepEqual(JSON.parse(encoded), { value: `<tag>\u2028\u2029` });
});

test('LinkedIn callback error response escapes script-breaking error payload while preserving decoded value', () => {
  const html = buildOAuthPopupHtml({
    provider: 'linkedin',
    title: 'LinkedIn connection',
    successMessage: 'LinkedIn connected. You can close this window.',
    errorMessage: 'LinkedIn connection failed. You can close this window.',
    successQuery: 'linkedin_connected=1',
    errorQueryParam: 'linkedin_error',
    siteUrl: 'https://3rdshift.ai',
    status: 'error',
    error: MALICIOUS_ERROR,
  });

  assert.equal(html.includes('</script><img'), false);
  assert.ok(html.includes('\\u003c/script>\\u003cimg src=x onerror=alert(1)>'));
  assert.equal(extractPayloadError(html), MALICIOUS_ERROR);
});

test('Meta callback error response escapes script-breaking error payload while preserving decoded value', () => {
  const html = buildOAuthPopupHtml({
    provider: 'meta',
    title: 'Meta connection',
    successMessage: 'Meta connected. You can close this window.',
    errorMessage: 'Meta connection failed. You can close this window.',
    successQuery: 'meta_connected=1',
    errorQueryParam: 'meta_error',
    siteUrl: 'https://3rdshift.ai',
    status: 'error',
    error: MALICIOUS_ERROR,
  });

  assert.equal(html.includes('</script><img'), false);
  assert.ok(html.includes('\\u003c/script>\\u003cimg src=x onerror=alert(1)>'));
  assert.equal(extractPayloadError(html), MALICIOUS_ERROR);
});

test('OAuth popup success and error branches still post to opener and fall back to settings redirect', () => {
  const successHtml = buildOAuthPopupHtml({
    provider: 'linkedin',
    title: 'LinkedIn connection',
    successMessage: 'LinkedIn connected. You can close this window.',
    errorMessage: 'LinkedIn connection failed. You can close this window.',
    successQuery: 'linkedin_connected=1',
    errorQueryParam: 'linkedin_error',
    siteUrl: 'https://3rdshift.ai',
    status: 'success',
  });

  assert.match(successHtml, /window\.opener\.postMessage\(payload, window\.location\.origin\)/);
  assert.match(successHtml, /window\.close\(\)/);
  assert.ok(successHtml.includes('window.location.replace("https://3rdshift.ai/dashboard/settings?linkedin_connected=1")'));

  const errorHtml = buildOAuthPopupHtml({
    provider: 'meta',
    title: 'Meta connection',
    successMessage: 'Meta connected. You can close this window.',
    errorMessage: 'Meta connection failed. You can close this window.',
    successQuery: 'meta_connected=1',
    errorQueryParam: 'meta_error',
    siteUrl: 'https://3rdshift.ai',
    status: 'error',
    error: 'access_denied',
  });

  assert.match(errorHtml, /window\.opener\.postMessage\(payload, window\.location\.origin\)/);
  assert.match(errorHtml, /window\.close\(\)/);
  assert.ok(errorHtml.includes('window.location.replace("https://3rdshift.ai/dashboard/settings?meta_error=access_denied")'));
});
