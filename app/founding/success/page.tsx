// @ts-nocheck
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [loading, setLoading] = useState(true)
  const [sessionData, setSessionData] = useState(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadSessionDetails() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.access_token) {
          if (!cancelled) setLoading(false)
          return
        }

        const res = await fetch(`/api/founding/session?session_id=${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!cancelled) {
          if (res.ok) setSessionData(data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    loadSessionDetails()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', operator: 'Operator' }
  const isFoundingMember = sessionData?.is_founding_member ?? true // default true for founding flow
  const plan = sessionData?.plan || 'starter'
  const planLabel = PLAN_LABELS[plan] || 'Starter'
  // Use actual price from Stripe — never hardcode a fallback
  const price = isFoundingMember
    ? (sessionData?.locked_price ?? null)
    : (sessionData?.regular_price ?? null)
  const billingCycle = sessionData?.billing_cycle || 'annual'

  return (
    <div className="min-h-screen bg-white font-sans" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="text-xl font-bold tracking-tight">
            <span className="text-blue-600">3rd</span>
            <span className="text-zinc-950">Shift</span>
          </a>
          <a
            href="/login"
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950"
          >
            Log in
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <main className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center px-6 py-20 text-center">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
            <p className="text-sm text-zinc-400">Loading your details...</p>
          </div>
        ) : (
          <div className="mx-auto max-w-lg">
            {/* Green checkmark */}
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
              <svg
                className="h-10 w-10 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-extrabold tracking-tight text-zinc-950 sm:text-6xl">
              You're in.
            </h1>

            {/* Subtext */}
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-zinc-500">
              {isFoundingMember ? (
                <>
                  Welcome to 3rdShift as a founding member. Your{' '}
                  <span className="font-semibold text-zinc-950">{planLabel}</span> plan is locked at{' '}
                  <span className="font-semibold text-zinc-950">
                    {price !== null ? `$${price}/month` : 'your founding rate'}
                  </span>{' '}
                  forever.
                </>
              ) : (
                <>
                  Welcome to 3rdShift. Your{' '}
                  <span className="font-semibold text-zinc-950">{planLabel}</span> plan is active at{' '}
                  <span className="font-semibold text-zinc-950">
                    {price !== null ? `$${price}/month` : 'your selected rate'}
                  </span>
                  {billingCycle === 'monthly' ? ' (billed monthly)' : ' (billed annually)'}.
                </>
              )}
            </p>

            {sessionData?.customer_email && (
              <p className="mt-3 text-sm text-zinc-400">
                Confirmation sent to {sessionData.customer_email}
              </p>
            )}

            {/* CTA */}
            <div className="mt-10">
              <a
                href={sessionId ? `/signup?founding_session=${sessionId}` : '/signup'}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
              >
                Set up your account →
              </a>
            </div>

            {/* Already have account */}
            <p className="mt-5 text-sm text-zinc-400">
              Already have an account?{' '}
              <a href={sessionId ? `/login?founding_session=${sessionId}` : '/login'} className="font-medium text-zinc-600 underline hover:text-zinc-950">
                Log in →
              </a>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function FoundingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
