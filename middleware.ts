import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password']
const UNPAID_ALLOWED_ROUTES = [
  '/onboarding',
  '/onboarding/plan',
  '/dashboard/settings/billing',
  '/dashboard/settings',
]

const BLOCKED_BILLING_STATUSES = new Set([
  'canceled',
  'cancelled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
])

function isAllowedForUnpaid(pathname: string) {
  return (
    pathname.startsWith('/auth') ||
    AUTH_ROUTES.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    UNPAID_ALLOWED_ROUTES.some((path) => pathname === path)
  )
}

function isProtectedAppRoute(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/tasks/')
  )
}

function isProtectedOnboardingPath(pathname: string) {
  return pathname.startsWith('/onboarding/') && pathname !== '/onboarding'
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname, searchParams } = request.nextUrl
  const isCheckoutSuccessGracePath =
    searchParams.get('checkout') === 'success' &&
    (pathname === '/onboarding/personalDetails' || pathname === '/onboarding/multiselect' || pathname === '/dashboard')

  // API routes enforce auth/billing internally. Keep middleware focused on pages
  // so webhooks, checkout, and background routes cannot be blocked by redirects.
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  if (!user && (isProtectedAppRoute(pathname) || isProtectedOnboardingPath(pathname))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, billing_status, stripe_subscription_id, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    const hasPlan = !!profile?.plan && profile.plan !== 'none'
    const billingStatus = profile?.billing_status || 'active'
    const billingActive = !BLOCKED_BILLING_STATUSES.has(billingStatus)
    const hasActiveSubscription = hasPlan && billingActive
    const onboardingCompleted = profile?.onboarding_completed === true

    if (!hasActiveSubscription && !isAllowedForUnpaid(pathname)) {
      if (isCheckoutSuccessGracePath) {
        return supabaseResponse
      }

      const redirectPath = hasPlan && !billingActive ? '/dashboard/settings/billing' : '/onboarding/plan'
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    if (hasActiveSubscription && profile?.plan !== 'operator' && (
      pathname === '/dashboard/agent-mode' || pathname.startsWith('/dashboard/agent-mode/')
    )) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (hasActiveSubscription && !onboardingCompleted && isProtectedAppRoute(pathname)) {
      return NextResponse.redirect(new URL('/onboarding/personalDetails', request.url))
    }

    if (hasActiveSubscription && onboardingCompleted && pathname === '/onboarding') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (hasActiveSubscription && pathname === '/onboarding/plan') {
      return NextResponse.redirect(new URL(onboardingCompleted ? '/dashboard' : '/onboarding', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|blog|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
