'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const ERROR_MESSAGES: Record<string, { title: string; body: string; action: 'resend' | 'retry' | 'support' }> = {
  link_expired: {
    title: 'Your link has expired',
    body: 'Verification links expire after 24 hours. Request a new one and try again.',
    action: 'resend',
  },
  link_used: {
    title: 'This link has already been used',
    body: 'Each verification link can only be used once. Request a new one or go to login.',
    action: 'resend',
  },
  exchange_failed: {
    title: 'Sign-in failed',
    body: "We couldn't verify your session. This can happen with an old browser tab or an invalid link. Try signing in again.",
    action: 'retry',
  },
  workspace_creation_failed: {
    title: 'Account setup incomplete',
    body: 'Your account was created but we ran into an issue setting up your workspace. Please contact support — we can fix this quickly.',
    action: 'support',
  },
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') ?? 'exchange_failed'
  const info = ERROR_MESSAGES[reason] ?? ERROR_MESSAGES['exchange_failed']

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-zinc-950">{info.title}</h1>
        <p className="mt-3 text-zinc-500">{info.body}</p>

        <div className="mt-8 flex flex-col gap-3">
          {info.action === 'resend' && (
            <Link
              href="/signup?resend=1"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors text-center block"
            >
              Resend verification email
            </Link>
          )}

          {info.action === 'retry' && (
            <Link
              href="/login"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors text-center block"
            >
              Try signing in again
            </Link>
          )}

          {info.action === 'support' && (
            <a
              href="mailto:support@3rdshift.ai?subject=Account setup issue"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors text-center block"
            >
              Contact support
            </a>
          )}

          <Link
            href="/login"
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors text-center block"
          >
            Go to login
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          Still stuck?{' '}
          <a href="mailto:support@3rdshift.ai" className="text-zinc-500 underline">
            support@3rdshift.ai
          </a>
        </p>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
