'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

let initialized = false;

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (initialized) return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: false, // We handle this manually below
      capture_pageleave: true,
      // Session replay only on errors
      disable_session_recording: true,
      // PII protection
      sanitize_properties: (properties) => {
        // Remove sensitive search params from URLs
        if (properties.$current_url) {
          try {
            const url = new URL(properties.$current_url);
            ['token', 'access_token', 'code', 'state', 'reset_token'].forEach(p =>
              url.searchParams.delete(p)
            );
            properties.$current_url = url.toString();
          } catch {}
        }
        return properties;
      },
      loaded: (ph) => {
        // Enable session recording on errors only
        window.addEventListener('error', () => {
          ph.startSessionRecording();
        }, { once: false });
        window.addEventListener('unhandledrejection', () => {
          ph.startSessionRecording();
        }, { once: false });
      },
    });

    initialized = true;
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (!initialized) return;
    if (firstRender.current) {
      firstRender.current = false;
      posthog.capture('$pageview');
      return;
    }
    posthog.capture('$pageview');
  }, [pathname, searchParams]);

  return <>{children}</>;
}
