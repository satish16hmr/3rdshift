import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDisposableEmail, SIGNUP_EMAIL_ERROR } from '@/lib/auth/disposable-email'
import { trackPostSignupLead } from '@/lib/dub/post-signup'

const ALLOWED_BILLING = new Set(['monthly', 'annual'])
const ALLOWED_PLANS = new Set(['starter', 'pro', 'operator', 'founding-starter', 'founding-pro'])

function buildPlanQuery(plan: unknown, billing: unknown, foundingSession?: unknown) {
  const params = new URLSearchParams()
  const foundingValue = typeof foundingSession === 'string' ? foundingSession.trim() : ''
  if (foundingValue) params.set('founding_session', foundingValue)

  const planValue = typeof plan === 'string' ? plan.trim().toLowerCase() : ''
  const billingValue = typeof billing === 'string' ? billing.trim().toLowerCase() : 'monthly'

  if (ALLOWED_PLANS.has(planValue)) {
    const safeBilling = ALLOWED_BILLING.has(billingValue) ? billingValue : 'monthly'
    params.set('plan', planValue)
    params.set('billing', safeBilling)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid signup request.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''

  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: SIGNUP_EMAIL_ERROR }, { status: 400 })
  }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'
  const planQuery = buildPlanQuery(body.plan, body.billing, body.foundingSession)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${origin}/auth/callback${planQuery}`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await trackPostSignupLead({
    request,
    userId: data.user?.id,
    email,
    name: fullName || undefined,
    source: 'auth-signup',
  })

  return NextResponse.json({ ok: true })
}
