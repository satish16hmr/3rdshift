// @ts-nocheck
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function JoinPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('loading') // loading | accepting | success | error | login_required
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Invalid invite link.'); return }
    acceptInvite()
  }, [token])

  async function acceptInvite() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Store token so it survives the login redirect
      if (typeof window !== 'undefined') {
        localStorage.setItem('pending_invite_token', token)
      }
      setStatus('login_required')
      return
    }

    try {
      const res = await fetch('/api/workspace/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (res.ok) {
        // Clear stored token on success
        if (typeof window !== 'undefined') localStorage.removeItem('pending_invite_token')
        setStatus('success')
        setMessage(data.workspace_name || 'workspace')
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to accept invite.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <img src="/logo-hq.png" alt="3rdShift" style={{ height: 28, marginBottom: 24 }} />

        {status === 'loading' && (
          <>
            <div style={{ width: 32, height: 32, border: '3px solid #e4e4e7', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#71717a', fontSize: 14 }}>Accepting your invite…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111113', margin: '0 0 8px' }}>You're in!</h2>
            <p style={{ color: '#71717a', fontSize: 14 }}>Redirecting to your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111113', margin: '0 0 8px' }}>Invite failed</h2>
            <p style={{ color: '#71717a', fontSize: 14 }}>{message}</p>
            <a href="/dashboard" style={{ display: 'inline-block', marginTop: 16, color: '#2563eb', fontSize: 14 }}>Go to dashboard</a>
          </>
        )}

        {status === 'login_required' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111113', margin: '0 0 8px' }}>Sign in first</h2>
            <p style={{ color: '#71717a', fontSize: 14, marginBottom: 20 }}>You need a 3rdShift account to accept this invite.</p>
            <a
              href={`/login?redirect=${encodeURIComponent('/join?token=' + token)}`}
              style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, padding: '10px 24px', borderRadius: 8, textDecoration: 'none' }}
            >
              Sign in or create account
            </a>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e4e4e7', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  )
}
