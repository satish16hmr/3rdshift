import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig & { experimental?: Record<string, unknown>; outputFileTracingIncludes?: Record<string, string[]> } = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-inline is still required by editor/legacy inline styles until those flows move to nonced scripts.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://us.i.posthog.com https://us-assets.i.posthog.com https://cdn.jsdelivr.net https://js.sentry-cdn.com https://www.dubcdn.com https://cdn.tailwindcss.com https://connect.facebook.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https://auth.3rdshift.ai https://*.supabase.co https://*.fal.media",
              "connect-src 'self' https://auth.3rdshift.ai wss://auth.3rdshift.ai https://api.anthropic.com https://api.openai.com https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://sentry.io https://o4509230776918016.ingest.us.sentry.io https://api.unsplash.com https://fal.run https://*.fal.media https://api.rocketreach.co https://api.serper.dev https://api.elevenlabs.io https://api.atlascloud.ai https://api.resend.com https://api.dub.co https://connect.facebook.net https://www.facebook.com https://facebook.com",
              "frame-src 'self' https://js.stripe.com https://app.dub.co",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard/workers/social-media-manager',
        destination: '/dashboard/team/social-media-creator',
        permanent: true,
      },
      {
        source: '/dashboard/workers/social-media-manager/:path*',
        destination: '/dashboard/team/social-media-creator/:path*',
        permanent: true,
      },
      // Macy → Dina: meeting-notes-summarizer → meeting-notes-writer
      {
        source: '/dashboard/workers/meeting-notes-summarizer',
        destination: '/dashboard/team/meeting-notes-writer',
        permanent: true,
      },
      {
        source: '/dashboard/workers/meeting-notes-summarizer/:path*',
        destination: '/dashboard/team/meeting-notes-writer/:path*',
        permanent: true,
      },
      // Remy slug rename: ghostwriter → creative-editor
      {
        source: '/dashboard/workers/ghostwriter',
        destination: '/dashboard/team/creative-editor',
        statusCode: 301,
      },
      {
        source: '/dashboard/workers/ghostwriter/:path*',
        destination: '/dashboard/team/creative-editor/:path*',
        statusCode: 301,
      },
      {
        source: '/workers/ghostwriter',
        destination: '/workers/creative-editor',
        statusCode: 301,
      },
      {
        source: '/workers/ghostwriter/:path*',
        destination: '/workers/creative-editor/:path*',
        statusCode: 301,
      },
      // /founding → /pricing (single-page pricing strategy, Phase 24c marketing sprint)
      { source: '/founding', destination: '/pricing', permanent: true },
      { source: '/founding/:path*', destination: '/pricing', permanent: true },

      // DEPRECATED_SLUGS — server-side 301s for all cut workers (T10A-2)
      { source: '/dashboard/workers/cover-letter-writer', destination: '/dashboard/team/resume-writer', permanent: true },
      { source: '/dashboard/workers/cover-letter-writer/:path*', destination: '/dashboard/team/resume-writer/:path*', permanent: true },
      { source: '/dashboard/workers/linkedin-profile-optimizer', destination: '/dashboard/team/linkedin-ghostwriter', permanent: true },
      { source: '/dashboard/workers/linkedin-profile-optimizer/:path*', destination: '/dashboard/team/linkedin-ghostwriter/:path*', permanent: true },
      { source: '/dashboard/workers/swot-analyst', destination: '/dashboard/team/market-research-analyst', permanent: true },
      { source: '/dashboard/workers/swot-analyst/:path*', destination: '/dashboard/team/market-research-analyst/:path*', permanent: true },
      { source: '/dashboard/workers/tagline-writer', destination: '/dashboard/team/brand-strategist', permanent: true },
      { source: '/dashboard/workers/tagline-writer/:path*', destination: '/dashboard/team/brand-strategist/:path*', permanent: true },
      { source: '/dashboard/workers/faq-writer', destination: '/dashboard/team/customer-support-writer', permanent: true },
      { source: '/dashboard/workers/faq-writer/:path*', destination: '/dashboard/team/customer-support-writer/:path*', permanent: true },
      { source: '/dashboard/workers/press-release-writer', destination: '/dashboard/team/whitepaper-writer', permanent: true },
      { source: '/dashboard/workers/press-release-writer/:path*', destination: '/dashboard/team/whitepaper-writer/:path*', permanent: true },
      { source: '/dashboard/workers/long-form-article-writer', destination: '/dashboard/team/hook-specialist', permanent: true },
      { source: '/dashboard/workers/long-form-article-writer/:path*', destination: '/dashboard/team/hook-specialist/:path*', permanent: true },
      { source: '/dashboard/workers/caption-writer', destination: '/dashboard/team/scene-director', permanent: true },
      { source: '/dashboard/workers/caption-writer/:path*', destination: '/dashboard/team/scene-director/:path*', permanent: true },
      { source: '/dashboard/workers/customer-review-responder', destination: '/dashboard/team/site-auditor', permanent: true },
      { source: '/dashboard/workers/customer-review-responder/:path*', destination: '/dashboard/team/site-auditor/:path*', permanent: true },
      { source: '/dashboard/workers/personal-brand-strategist', destination: '/dashboard/team/website-builder', permanent: true },
      { source: '/dashboard/workers/personal-brand-strategist/:path*', destination: '/dashboard/team/website-builder/:path*', permanent: true },
      { source: '/dashboard/workers/brand-voice-guide-writer', destination: '/dashboard/team/image-cleanup', permanent: true },
      { source: '/dashboard/workers/brand-voice-guide-writer/:path*', destination: '/dashboard/team/image-cleanup/:path*', permanent: true },

      // Dashboard Team route rename: /dashboard/workers → /dashboard/team
      { source: '/dashboard/workers', destination: '/dashboard/team', permanent: true },
      { source: '/dashboard/workers/:path*', destination: '/dashboard/team/:path*', permanent: true },

      // Legacy billing route redirect to Settings -> Billing
      { source: '/dashboard/billing', destination: '/dashboard/settings/billing', permanent: true },
      { source: '/dashboard/billing/:path*', destination: '/dashboard/settings/billing/:path*', permanent: true },
    ];
  },
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static'],
  // Disable source maps in production to avoid leaking source code
  productionBrowserSourceMaps: false,
  outputFileTracingIncludes: {
    '/blog': ['./content/blog/**/*.mdx'],
    '/blog/[slug]': ['./content/blog/**/*.mdx'],
  },
  experimental: {
    after: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.fal.media',
        pathname: '/files/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'auth.3rdshift.ai',
        pathname: '/storage/**',
      },
    ],
  },

};

export default withSentryConfig(nextConfig, {
  org: '3rdshift',
  project: '3rdshift-web',
  // Only upload source maps in CI (not local dev)
  silent: !process.env.CI,
  // Disable source map upload in dev to avoid leaking source
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production',
  },
  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
  // Use automatic instrumentation for Next.js
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
});
