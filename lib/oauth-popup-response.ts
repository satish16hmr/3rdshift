export type OAuthPopupStatus = 'success' | 'error';

export type OAuthPopupProvider = 'linkedin' | 'meta';

export interface OAuthPopupHtmlOptions {
  provider: OAuthPopupProvider;
  title: string;
  successMessage: string;
  errorMessage: string;
  successQuery: string;
  errorQueryParam: string;
  siteUrl: string;
  status: OAuthPopupStatus;
  error?: string;
}

export function safeJsonForInlineScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildOAuthPopupHtml({
  provider,
  title,
  successMessage,
  errorMessage,
  successQuery,
  errorQueryParam,
  siteUrl,
  status,
  error,
}: OAuthPopupHtmlOptions) {
  const fallback = `${siteUrl}/dashboard/settings${
    status === 'success'
      ? `?${successQuery}`
      : `?${errorQueryParam}=${encodeURIComponent(error || 'unknown')}`
  }`;
  const payload = safeJsonForInlineScript({ type: '3rdshift:oauth', provider, status, error });
  const safeFallback = safeJsonForInlineScript(fallback);

  return `<!doctype html>
<html>
  <head><title>${title}</title></head>
  <body style="font-family:system-ui,sans-serif;padding:24px">
    <p>${status === 'success' ? successMessage : errorMessage}</p>
    <script>
      const payload = ${payload};
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
        window.close();
      } else {
        window.location.replace(${safeFallback});
      }
    </script>
  </body>
</html>`;
}
