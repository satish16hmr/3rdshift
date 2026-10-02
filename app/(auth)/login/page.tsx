'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LogoPng from '@/public/logo-hq.png'
import Link from 'next/link'
import Image from 'next/image'
import AuthBgPng from '@/public/images/auth/authBg.png'

import { Input } from '@/components/input'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/loader'
import AuthFooter from '@/components/auth/AuthFooter'
import RightPanel from '@/components/auth/RightPanel'
import { useToast } from '@/components/toast-provider'

import { loginSchema } from '../../../src/schema/auth.schema'
import { createClient } from '@/lib/supabase/client'

function safeAuthRedirect(value: any) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  const blockedRoutes = ['/auth', '/login', '/signup', '/forgot-password', '/reset-password', '/onboarding/plan']
  return blockedRoutes.some((route) => value === route || value.startsWith(`${route}/`))
    ? null
    : value
}

function friendlyLoginError(message?: string) {
  const normalized = (message || '').toLowerCase()
  if (normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) {
    return 'Wrong email or password'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Too many attempts — try again in a minute'
  }
  return message || 'Login failed. Please try again.'
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

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  })
  const hasFields = email.trim().length > 0 && password.length > 0
  const searchParams = useSearchParams()
  const foundingSession = searchParams.get('founding_session')
  const redirectTo = searchParams.get('redirect')
  const safeRedirectTo = safeAuthRedirect(redirectTo)
  const router = useRouter()

  const { showToast } = useToast()

  const linkFoundingMember = async () => {
    if (!foundingSession) return
    try {
      await fetch('/api/founding-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: foundingSession }),
      })
    } catch { /* Non-fatal */ }
  }

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    setErrors({
      email: '',
      password: '',
    })

    const result = loginSchema.safeParse({
      email,
      password,
    })

    if (!result.success) {
      const fieldErrors = {
        email: '',
        password: '',
      }

      result.error.issues.forEach((issue) => {
        const field = issue.path[0]

        if (
          (field === 'email' || field === 'password') &&
          !fieldErrors[field]
        ) {
          fieldErrors[field] = issue.message
        }
      })

      setErrors(fieldErrors)
      setLoading(false)
      return
    }

    const supabase = createClient()

    const { error: authError } =
      await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      })

    if (authError) {
      showToast({
        title: friendlyLoginError(authError.message),
        variant: 'error',
      })
      setLoading(false)
      return
    }

    await linkFoundingMember()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Failed to load user profile')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed, plan, billing_status')
      .eq('id', user.id)
      .single()

    if (profileError) {
      setError('Failed to load profile')
      setLoading(false)
      return
    }

    const blockedBillingStatuses = ['canceled', 'cancelled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid']
    const hasPlan = profile?.plan && profile.plan !== 'none'
    const billingActive = !blockedBillingStatuses.includes(profile?.billing_status || 'active')

    router.refresh()

    if (!hasPlan || !billingActive) {
      router.push('/onboarding/plan')
      return
    }

    if (!profile?.onboarding_completed) {
      router.push('/onboarding/personalDetails')
      return
    }

    router.push(
      safeRedirectTo || '/dashboard'
    )
  }

  const handleGoogleLogin = async () => {
    setError('')
    setGoogleLoading(true)
    const supabase = createClient()
    let callbackUrl = `${window.location.origin}/auth/callback`
    const params = new URLSearchParams()
    if (foundingSession) params.set('founding_session', foundingSession)
    if (safeRedirectTo) params.set('redirect', safeRedirectTo)
    if (params.toString()) callbackUrl += '?' + params.toString()
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
      return
    }
    if (data?.url) window.location.href = data.url
    else setGoogleLoading(false)
  }

  return (
    <div className='min-h-screen overflow-auto'>

      <div className="flex min-h-[calc(100vh-61px)] flex-col lg:flex-row">
        {/* ── Left column: form ── */}
        <div className="flex flex-1 flex-col md:justify-center p-3 sm:p-6 2xl:px-20 2xl:max-w-[50%] relative">
          <Image src={AuthBgPng} alt="Auth Background" className={`w-full h-full absolute top-0 left-0 z-0 lg:hidden`} width={1000} height={1000} />
          <div className="mx-auto w-full md:max-w-[600px] lg:max-w-90 bg-white max-lg:h-fit relative z-10 max-lg:rounded-lg max-lg:py-8 max-lg:px-4">
            <Image src={LogoPng} alt='logo' height={60} width={139} className='h-11 w-28 md:h-[60px] md:w-[139px] cursor-pointer' onClick={() => { router.push("/") }} />

            <h1 className="text-2xl md:text-3xl xl:text-4xl font-semibold tracking-tight text-zinc-800 mt-10 sm:mt-20">
              Log in
            </h1>
            <p className='text-neutral-500 mt-2 md:mt-3 text-sm md:text-base'>Welcome back! Please enter your details.</p>

            {/* Email */}
            <div className="mt-8 flex flex-col gap-5">
              <div>
                <label className='text-sm text-zinc-700'>Email</label>
                <Input
                  type="email"
                  value={email}
                  error={errors.email}
                  placeholder="name@email.com"
                  autoComplete="email"
                  onChange={(e) => {
                    setEmail(e.target.value)

                    setErrors((prev) => ({
                      ...prev,
                      email: '',
                    }))
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className='text-sm text-zinc-700'>Password</label>
                <Input
                  type="password"
                  value={password}
                  error={errors.password}
                  showPasswordToggle
                  placeholder="password"
                  autoComplete="current-password"
                  onChange={(e) => {
                    setPassword(e.target.value)

                    setErrors((prev) => ({
                      ...prev,
                      password: '',
                    }))
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className='my-6'>
              <Link href="/forgot-password" className="text-sm text-blue-500 font-medium hover:text-zinc-600">Forgot password</Link>
            </div>
            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            <div className='flex flex-col gap-4'>
              <Button variant="primary" className="w-full h-11 flex items-center justify-center" onClick={handleLogin} disabled={loading || googleLoading}>
                {loading ? <Loader size={5} /> : 'Sign in'}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-zinc-400">OR CONTINUE WITH</span>
                </div>
              </div>
              <Button variant="outline"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full h-11 flex items-center justify-center gap-2"
              >
                {googleLoading ? <Loader className="text-zinc-500" size={5} /> : <><GoogleIcon /> Continue with Google</>}
              </Button>
            </div>
            {/* Sign up link */}
            <p className="mt-8 text-center text-sm text-neutral-500 flex items-center justify-center gap-1 w-full">
              Don’t have an account?
              <Link href="/signup" className="font-semibold text-blue-500 hover:text-zinc-700">
                Sign up
              </Link>
            </p>
          </div>
        </div>
        {/* ── Right column: branded visual ── */}
        <RightPanel />
      </div>
      <AuthFooter />
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
