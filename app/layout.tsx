// 3rdShift Layout — layout.tsx
import './globals.css'
import ConditionalShell from './components/ConditionalShell'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'
import PostHogProvider from '@/components/PostHogProvider'
import { Suspense } from 'react'
import { ToastProvider } from '@/components/toast-provider'
import { Analytics as DubAnalytics } from '@dub/analytics/react'
import MetaPixel from '@/components/meta/MetaPixel'

const pageTitle = '3rdShift — Your AI Workforce On Demand'
const pageDescription = '70+ AI team members ready to work. Your entire AI workforce for $29/mo. No interviews. No managing. No waiting.'

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    images: ['/logo-og.png'],
  },
  twitter: {
    title: pageTitle,
    description: pageDescription,
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" data-theme="light" style={{ colorScheme: 'light' }}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="3rdShift" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="light bg-white" suppressHydrationWarning>
        <MetaPixel />
        <ToastProvider>
          <ServiceWorkerRegister />

          <Suspense fallback={null}>
            <PostHogProvider>
              <ConditionalShell>
                {children}
              </ConditionalShell>
            </PostHogProvider>
          </Suspense>
          <DubAnalytics />
        </ToastProvider>
      </body>
    </html>
  )
}
