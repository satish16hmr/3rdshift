'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

const META_PIXEL_ID = '798214883315340'
const REGISTRATION_PARAM = 'meta_registration'
const REGISTRATION_STORAGE_KEY = '3rdshift_meta_complete_registration_pending'

function isTrackingSuppressed(pathname: string | null) {
  const path = pathname || ''
  return path === '/dashboard'
    || path.startsWith('/dashboard/')
    || path === '/admin'
    || path.startsWith('/admin/')
}

function MetaPixelEvents({ pixelReady }: { pixelReady: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPageViewKey = useRef<string | null>(null)

  useEffect(() => {
    if (!pixelReady || isTrackingSuppressed(pathname)) return

    const query = searchParams?.toString() || ''
    const pageKey = `${pathname || '/'}?${query}`
    if (lastPageViewKey.current === pageKey) return
    lastPageViewKey.current = pageKey

    window.fbq?.('track', 'PageView')
  }, [pathname, searchParams, pixelReady])

  useEffect(() => {
    if (!pixelReady || isTrackingSuppressed(pathname)) return

    const hasRegistrationParam = searchParams?.get(REGISTRATION_PARAM) === '1'
    const hasPendingRegistration = (() => {
      try {
        return window.localStorage.getItem(REGISTRATION_STORAGE_KEY) === '1'
      } catch {
        return false
      }
    })()

    if (!hasRegistrationParam && !hasPendingRegistration) return

    window.fbq?.('track', 'CompleteRegistration')

    try {
      window.localStorage.removeItem(REGISTRATION_STORAGE_KEY)
    } catch {
      // Ignore storage failures.
    }

    if (hasRegistrationParam) {
      const url = new URL(window.location.href)
      url.searchParams.delete(REGISTRATION_PARAM)
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [pathname, searchParams, pixelReady])

  return null
}

export function queueMetaCompleteRegistration() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(REGISTRATION_STORAGE_KEY, '1')
  } catch {
    // Ignore storage failures; fall back to immediate fire if the pixel is available.
  }

  if (!isTrackingSuppressed(window.location.pathname)) {
    window.fbq?.('track', 'CompleteRegistration')
    try {
      window.localStorage.removeItem(REGISTRATION_STORAGE_KEY)
    } catch {
      // Ignore storage failures.
    }
  }
}

export default function MetaPixel() {
  const pathname = usePathname()
  const [pixelReady, setPixelReady] = useState(false)

  if (isTrackingSuppressed(pathname)) {
    return null
  }

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive" onReady={() => setPixelReady(true)}>
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
      <Suspense fallback={null}>
        <MetaPixelEvents pixelReady={pixelReady} />
      </Suspense>
    </>
  )
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}
