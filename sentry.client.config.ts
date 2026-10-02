import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Performance monitoring at 10% sample rate (cost control)
  tracesSampleRate: 0.1,

  // Session replay only on errors (cost control)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Don't send PII by default
  sendDefaultPii: false,

  // Suppress noisy browser errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'AbortError',
    'NetworkError when attempting to fetch resource',
    'Failed to fetch',
    'Load failed',
    /^Script error/,
  ],

  beforeSend(event) {
    // Strip sensitive URL params
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url);
        ['token', 'access_token', 'refresh_token', 'code', 'state'].forEach(p => url.searchParams.delete(p));
        event.request.url = url.toString();
      } catch {}
    }
    return event;
  },
});
