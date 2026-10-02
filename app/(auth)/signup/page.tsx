'use client'

import { useState, Suspense } from 'react'
import signUpAuthBgPng from '@/public/images/auth/signupBg.png'
import AuthBgPng from '@/public/images/auth/authBg.png'
import LogoPng from '@/public/logo-hq.png'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import AuthFooter from '@/components/auth/AuthFooter'
import RightPanel from '@/components/auth/RightPanel'
import { Input } from '@/components/input'
import { Loader } from '@/components/loader'
import { Button } from '@/components/ui/button'
import { signupSchema } from '../../../src/schema/auth.schema'
import { createClient } from '@/lib/supabase/client'
import { queueMetaCompleteRegistration } from '@/components/meta/MetaPixel'

const PLAN_SLUGS = ['starter', 'pro', 'operator'] as const
const BILLING_CYCLES = ['monthly', 'annual'] as const

type PlanSlug = (typeof PLAN_SLUGS)[number]
type BillingCycle = (typeof BILLING_CYCLES)[number]

function getPlanChoice(searchParams: URLSearchParams): { plan: PlanSlug | null; billing: BillingCycle } {
  const planParam = searchParams.get('plan')?.toLowerCase()
  const billingParam = searchParams.get('billing')?.toLowerCase()

  const plan = PLAN_SLUGS.includes(planParam as PlanSlug) ? (planParam as PlanSlug) : null
  const billing = BILLING_CYCLES.includes(billingParam as BillingCycle) ? (billingParam as BillingCycle) : 'annual'

  return { plan, billing }
}

function nameFromEmail(email: string) {
  const prefix = email
    .split('@')[0]
    ?.replace(/[._-]+/g, ' ')
    .replace(/[^A-Za-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return prefix || 'Member'
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  )
}

function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string
    password?: string
  }>({})
  const [emailSent, setEmailSent] = useState(false)
  const [resendStatus, setResendStatus] = useState('')
  const [resending, setResending] = useState(false)
  const canSubmit = email.trim().length > 0 && password.trim().length >= 6
  const router = useRouter()
  const searchParams = useSearchParams()
  const foundingSession = searchParams.get('founding_session')
  const { plan: selectedPlan, billing: selectedBilling } = getPlanChoice(searchParams)

  const startCheckout = async () => {
    if (!selectedPlan) {
      router.replace('/onboarding/plan')
      return
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan, billing_cycle: selectedBilling }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.url) {
      throw new Error(data.message || data.error || 'Checkout failed. Please try again.')
    }

    window.location.href = data.url
  }

  const linkFoundingMember = async () => {
    if (!foundingSession) return
    try {
      await fetch('/api/founding-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: foundingSession }),
      })
    } catch {
      // Non-fatal — user can contact support
    }
  }

  const clearFieldError = (field: 'email' | 'password') => {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: '',
    }))
  }

  const handleSignup = async () => {
    setError('')
    setFieldErrors({})

    const result = signupSchema.safeParse({
      name: nameFromEmail(email.trim()),
      email,
      password,
    })

    if (!result.success) {
      const errors: typeof fieldErrors = {}

      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof typeof errors
        errors[field] = err.message
      })

      setFieldErrors(errors)
      return
    }

    // keep your original guard
    if (!canSubmit) return

    setEmailLoading(true)

    const signupResponse = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        fullName: nameFromEmail(email.trim()),
        plan: selectedPlan,
        billing: selectedBilling,
        foundingSession,
      }),
    })

    const signupPayload = await signupResponse.json().catch(() => ({}))

    if (!signupResponse.ok) {
      setError(signupPayload.error || 'Signup failed. Please try again.')
      setEmailLoading(false)
      return
    }

    // Check if email confirmation is required (session will be null if so)
    const supabase2 = createClient()
    const { data: { session } } = await supabase2.auth.getSession()

    if (session) {
      // Auto-confirmed — link founding and go straight to checkout when a pricing plan was selected
      queueMetaCompleteRegistration()
      await linkFoundingMember()
      try {
        await startCheckout()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.')
        setEmailLoading(false)
      }
    } else {
      // Email confirmation required — persist selection for after confirmation
      if (foundingSession) {
        localStorage.setItem('pending_founding_session', foundingSession)
      }
      if (selectedPlan) {
        localStorage.setItem('pending_signup_plan', selectedPlan)
        localStorage.setItem('pending_signup_billing', selectedBilling)
      }
      setEmailSent(true)
      setEmailLoading(false)
    }
  }

  const resendVerification = async () => {
    if (!email.trim()) return
    setResending(true)
    setResendStatus('')
    try {
      const supabase = createClient()
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      if (foundingSession) callbackUrl.searchParams.set('founding_session', foundingSession)
      if (selectedPlan) {
        callbackUrl.searchParams.set('plan', selectedPlan)
        callbackUrl.searchParams.set('billing', selectedBilling)
      }
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl.toString() },
      })
      setResendStatus(resendError ? 'Could not resend verification. Please try again.' : 'Verification email resent.')
    } catch {
      setResendStatus('Could not resend verification. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const handleGoogleSignup = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      if (foundingSession) callbackUrl.searchParams.set('founding_session', foundingSession)
      if (selectedPlan) {
        callbackUrl.searchParams.set('plan', selectedPlan)
        callbackUrl.searchParams.set('billing', selectedBilling)
      }
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: { prompt: 'select_account' },
        },
      })
      if (oauthError) {
        setError('Google sign-in failed. Please try again or use email below.')
        setGoogleLoading(false)
        return
      }
      if (data?.url) window.location.href = data.url
      // On success: browser redirects to Google — loading stays true until redirect
    } catch {
      setError('Something went wrong. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className='auth-signup-page min-h-screen overflow-auto'>
      <div className="auth-signup-main flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        {/* ── Left column: form ── */}
        <div className="auth-signup-left flex flex-1 flex-col md:justify-center p-3 sm:p-6 2xl:px-20 2xl:max-w-[50%] relative">
          <Image src={AuthBgPng} alt="Auth Background" className={`w-full h-full absolute top-0 left-0 z-0 lg:hidden`} width={1000} height={1000} />

          {
            emailSent ? (
              <div className="mx-auto w-full max-w-90">
                <Image src={LogoPng} alt='logo' height={60} width={139} className='h-11 w-28 md:h-15 md:w-34.75' />

                <h1 className="text-2xl md:text-3xl font-semibold text-zinc-950 mt-20">Verify your email address</h1>
                <p className="mt-3 mb-6 text-neutral-500">We sent an activation link to <strong>{email}</strong>.</p>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" className="w-full" onClick={resendVerification} disabled={resending}>
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </Button>
                  {resendStatus && <p className="text-sm text-neutral-500">{resendStatus}</p>}
                  <Link href="/login" className="font-semibold text-blue-500 hover:text-zinc-700 flex items-center gap-1">Back to log in <ArrowRight className='h-5' /></Link>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full md:max-w-[600px] lg:max-w-90 bg-white max-lg:h-fit relative z-10 max-lg:rounded-lg max-lg:py-8 max-lg:px-4">

                <Image src={LogoPng} alt='logo' height={60} width={139} className='h-11 w-28 md:h-15 md:w-34.75 cursor-pointer' onClick={() => { router.push("/") }} />

                <h1 className="text-2xl md:text-3xl xl:text-4xl font-semibold tracking-tight text-zinc-800 mt-10 lg:mt-20">
                  Sign up
                </h1>
                <p className='text-neutral-500 mt-2 md:mt-3 text-sm md:text-base'>Create your account to get started.</p>

                {/* Form fields */}
                <div className="mt-8 space-y-5">
                  <div>
                    <label className='text-sm text-zinc-700'>Email</label>
                    <Input
                      type="email"
                      value={email}
                      placeholder="Your Email"
                      autoComplete="email"
                      className="mt-1.5"
                      error={fieldErrors.email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        clearFieldError('email')
                      }}
                    />
                  </div>
                  <div>
                    <label className='text-sm text-zinc-700'>Password</label>
                    <Input
                      type="password"
                      value={password}
                      showPasswordToggle
                      placeholder="Create a password"
                      autoComplete="new-password"
                      className="mt-1.5"
                      error={fieldErrors.password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        clearFieldError('password')
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">8+ characters with an uppercase letter, number, and symbol</p>
                </div>

                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

                {/* Create account button */}
                <div className='flex flex-col gap-4 mt-6'>
                  <Button variant="primary" className="w-full h-11 flex items-center justify-center" onClick={handleSignup} disabled={!canSubmit || emailLoading || googleLoading}>
                    {emailLoading ? <Loader size={5} /> : 'Sign up'}
                  </Button>
                  {/* OR divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-zinc-400">OR CONTINUE WITH</span>
                    </div>
                  </div>
                  <Button variant="outline"
                    onClick={handleGoogleSignup}
                    disabled={googleLoading || emailLoading}
                    className="w-full h-11 flex items-center justify-center gap-2"
                  >
                    {googleLoading ? (
                      <Loader className="text-zinc-500" size={5} />
                    ) : (
                      <>
                        <GoogleIcon />
                        Continue with Google
                      </>
                    )}
                  </Button>
                </div>

                {/* Terms */}
                <p className="mt-4 sm:mt-8 text-center text-sm text-neutral-500 gap-1">
                  By creating an account, you agree to our
                  <Link href="/terms" className="text-neutral-500 hover:text-blue-500 mx-1 font-medium transition-all duration-200">Terms of Service</Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-neutral-500 hover:text-blue-500 mx-1 font-medium transition-all duration-200">Privacy Policy</Link>.
                </p>

                {/* Login link */}
                <p className="mt-4 sm:mt-6 md:mt-8 text-center text-sm text-zinc-500">
                  Already have an account?{' '}
                  <Link href="/login" className="font-semibold text-blue-500 hover:text-zinc-700">
                    Log in
                  </Link>
                </p>
              </div>
            )
          }
        </div>

        {/* ── Right column: branded visual ── */}
        <RightPanel
          signUp={true}
          textContainerClassName='max-w-151.75'
          bgImg={signUpAuthBgPng}
          title={`Your AI team starts working today.`}
          description={`70+ AI Team Members, ready when you are.`}
          bgImgClassName='max-2xl:object-cover'
        />
      </div>
      <AuthFooter />
    </div>
  )
}

export default function Signup() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" /></div>}>
      <SignupForm />
    </Suspense>
  )
}
