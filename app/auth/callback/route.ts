import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isRecentlyCreatedAuthUser, trackPostSignupLead } from '@/lib/dub/post-signup'

const supabaseAdmin = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BLOCKED_BILLING_STATUSES = new Set([
  'canceled',
  'cancelled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
])

const PLAN_SLUGS = new Set(['starter', 'pro', 'operator'])
const BILLING_CYCLES = new Set(['monthly', 'annual'])

function getSignupPlanRedirect(requestUrl: URL) {
  const plan = requestUrl.searchParams.get('plan')?.toLowerCase()
  const billingParam = requestUrl.searchParams.get('billing')?.toLowerCase()

  if (!plan || !PLAN_SLUGS.has(plan)) return null

  const billing = billingParam && BILLING_CYCLES.has(billingParam) ? billingParam : 'annual'
  return `/onboarding/plan?plan=${encodeURIComponent(plan)}&billing=${encodeURIComponent(billing)}&checkout=auto`
}

function hasActiveSubscription(profile?: {
  plan?: string | null
  billing_status?: string | null
  stripe_subscription_id?: string | null
} | null) {
  return Boolean(
    profile?.plan &&
    profile.plan !== 'none' &&
    !BLOCKED_BILLING_STATUSES.has(profile.billing_status || 'active')
  )
}

function safeAppRedirect(redirect: string | null) {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) return null

  const blockedRoutes = [
    '/auth',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/onboarding/plan',
  ]

  if (blockedRoutes.some((route) => redirect === route || redirect.startsWith(`${route}/`))) {
    return null
  }

  return redirect
}

function withMetaRegistrationParam(path: string, enabled: boolean) {
  if (!enabled) return path
  const [pathnameAndQuery, hash = ''] = path.split('#')
  const [pathname, query = ''] = pathnameAndQuery.split('?')
  const params = new URLSearchParams(query)
  params.set('meta_registration', '1')
  const nextQuery = params.toString()
  return `${pathname}${nextQuery ? `?${nextQuery}` : ''}${hash ? `#${hash}` : ''}`
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const errorCode = requestUrl.searchParams.get('error_code')
  const appOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'

  if (errorCode === 'otp_expired') {
    return NextResponse.redirect(`${appOrigin}/auth/error?reason=link_expired`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError || !sessionData?.user) {
      const reason = exchangeError?.message?.includes('expired')
        ? 'link_expired'
        : exchangeError?.message?.includes('already used')
          ? 'link_used'
          : 'exchange_failed'
      console.error('[auth/callback] Code exchange failed:', exchangeError?.message)
      return NextResponse.redirect(`${appOrigin}/auth/error?reason=${reason}`)
    }

    const user = sessionData.user
    const isNewSignup = isRecentlyCreatedAuthUser(user.created_at)

    const authProvider = typeof user.app_metadata?.provider === 'string'
      ? user.app_metadata.provider
      : null

    if (authProvider && authProvider !== 'email' && isNewSignup) {
      await trackPostSignupLead({
        request,
        userId: user.id,
        email: user.email,
        name: typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === 'string'
            ? user.user_metadata.name
            : undefined,
        source: `auth-callback:${authProvider}`,
      })
    }

    // Ensure the user has a workspace (A1: atomic workspace creation)
    try {
      const { data: existingMembership } = await supabaseAdmin
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!existingMembership) {
        const userName = user.user_metadata?.full_name
          || user.user_metadata?.name
          || user.email?.split('@')[0]
          || 'User'

        const { error: rpcError } = await supabaseAdmin.rpc('create_user_workspace', {
          p_user_id:    user.id,
          p_user_email: user.email ?? '',
          p_user_name:  userName,
        })

        if (rpcError) {
          console.error('[auth/callback] create_user_workspace RPC failed:', rpcError.message)
          return NextResponse.redirect(`${appOrigin}/auth/error?reason=workspace_creation_failed`)
        }
      }
    } catch (err) {
      console.error('[auth/callback] Workspace check/creation error:', err)
      return NextResponse.redirect(`${appOrigin}/auth/error?reason=workspace_creation_failed`)
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, billing_status, stripe_subscription_id, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    const redirect = safeAppRedirect(requestUrl.searchParams.get('redirect'))
    if (hasActiveSubscription(profile)) {
      if (redirect) {
        return NextResponse.redirect(`${appOrigin}${withMetaRegistrationParam(redirect, isNewSignup)}`)
      }
      return NextResponse.redirect(`${appOrigin}${withMetaRegistrationParam('/dashboard', isNewSignup)}`)
    }

    const signupPlanRedirect = getSignupPlanRedirect(requestUrl)
    if (signupPlanRedirect) {
      return NextResponse.redirect(`${appOrigin}${withMetaRegistrationParam(signupPlanRedirect, isNewSignup)}`)
    }

    // User doesn't have active subscription - ignore dashboard/tasks redirects
    return NextResponse.redirect(`${appOrigin}${withMetaRegistrationParam('/onboarding/plan', isNewSignup)}`)
  }

  // If a founding session was passed, redirect to plan selection with it
  const foundingSession = requestUrl.searchParams.get('founding_session')
  if (foundingSession) {
    return NextResponse.redirect(`${appOrigin}/onboarding/plan?founding_session=${foundingSession}`)
  }

  // If a redirect param was passed (e.g. /join?token=xxx), honor it
  const redirect = safeAppRedirect(requestUrl.searchParams.get('redirect'))
  if (redirect) {
    return NextResponse.redirect(`${appOrigin}${redirect}`)
  }

  return NextResponse.redirect(`${appOrigin}/onboarding/plan`)
}
