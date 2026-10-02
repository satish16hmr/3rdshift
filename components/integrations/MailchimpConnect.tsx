// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/input'
import { useToast } from '@/components/toast-provider'

import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api-fetch'


export default function MailchimpConnect({ plan }) {
  const { showToast } = useToast()
  
  const [connected, setConnected] = useState(false)
  const [loginEmail, setLoginEmail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [session, setSession] = useState(null)
  const [showInput, setShowInput] = useState(false)

  const isPro = plan === 'pro' || plan === 'operator'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('mailchimp_connected')) {
      showToast({ title: 'Mailchimp connected!', variant: 'success' })
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('mailchimp_error')) {
      showToast({ title: `Connection failed: ${params.get('mailchimp_error')}`, variant: 'error' })
      window.history.replaceState({}, '', window.location.pathname)
    }

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session || !isPro) { setLoading(false); return }

      fetch('/api/mailchimp/status', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          setConnected(data.connected)
          setLoginEmail(data.login_email || null)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [isPro])

  const handleConnect = async () => {
    if (!session) return
    setConnecting(true)
    const popup = window.open('', 'mailchimp_oauth', 'width=600,height=700,left=' + (window.screen.width / 2 - 300) + ',top=' + (window.screen.height / 2 - 350))
    if (popup) {
      popup.document.write('<p style="font-family: system-ui; padding: 24px;">Opening Mailchimp...</p>')
    }
    const res = await apiFetch('/api/mailchimp/auth/init', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      popup?.close()
      setConnecting(false)
      showToast({ title: 'Could not initiate Mailchimp connection. Try again.', variant: 'error' })
      return
    }
    const { url } = await res.json()
    if (popup) {
      popup.location.href = url
    } else {
      window.location.href = url
      return
    }
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'MAILCHIMP_CONNECTED') {
        window.removeEventListener('message', onMessage)
        setConnecting(false)
        setConnected(true)
        showToast({ title: 'Mailchimp connected!', variant: 'success' })
        popup?.close()
        // Refresh to get login email
        fetch('/api/mailchimp/status', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
          .then(r => r.json()).then(data => { if (data.login_email) setLoginEmail(data.login_email) })
      }
    }
    window.addEventListener('message', onMessage)
    // Fallback: if popup closed without message, refresh status from server
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer)
        window.removeEventListener('message', onMessage)
        setConnecting(false)
        fetch('/api/mailchimp/status', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
          .then(r => r.json())
          .then(data => {
            setConnected(data.connected)
            if (data.login_email) setLoginEmail(data.login_email)
            if (data.connected) showToast({ title: 'Mailchimp connected!', variant: 'success' })
          })
          .catch(() => { })
      }
    }, 500)
  }

  const handleDisconnect = async () => {
    if (!session || !confirm('Disconnect Mailchimp?')) return
    setDisconnecting(true)
    await fetch('/api/mailchimp/auth', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    setConnected(false)
    setLoginEmail(null)
    setDisconnecting(false)
    showToast({ title: 'Mailchimp disconnected.', variant: 'success' })
  }

  if (!isPro) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                <Image width={24} height={24} src="/icons/mailchimp.png" alt="Mailchimp Logo" className="h-6 w-6 object-contain" />
              </div>
              <span className={`items-center gap-2 text-sm sm:text-base font-semibold text-[#17B26A] ${connected ? "flex sm:hidden" : "hidden"}`}>
                <span className="size-2 rounded-full bg-[#17B26A]" />
                Connected
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={`text-sm sm:text-base font-semibold text-neutral-500 hover:text-red-500 transition duration-300 cursor-pointer ${connected ? "flex sm:hidden" : "hidden"}`}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-800 mb-1">Mailchimp</p>
            <p className="text-sm text-neutral-500">Send email copy and newsletters directly to Mailchimp as campaign drafts</p>
          </div>
        </div>
        <a href="/dashboard/settings/billing"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
          🔒 Upgrade to Pro to connect →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                <Image width={24} height={24} src="/icons/mailchimp.png" alt="Mailchimp Logo" className="h-6 w-6 object-contain" />
              </div>
              <span className={`items-center gap-2 text-sm sm:text-base font-semibold text-[#17B26A] ${connected ? "flex sm:hidden" : "hidden"}`}>
                <span className="size-2 rounded-full bg-[#17B26A]" />
                Connected
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={`text-sm sm:text-base font-semibold text-neutral-500 hover:text-red-500 transition duration-300 cursor-pointer ${connected ? "flex sm:hidden" : "hidden"}`}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-800 mb-1">Mailchimp</p>
            <p className="text-sm text-neutral-500">
              {connected
                ? `Connected${loginEmail ? ` · ${loginEmail}` : ''} — send email copy directly as campaign drafts.`
                : 'Send email copy and newsletters directly to Mailchimp as campaign drafts.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <div className="animate-pulse h-8 w-28 rounded-lg bg-zinc-100" />
          ) : connected ? (
            <div className="hidden sm:flex items-center gap-3 sm:gap-5">
              <span className="flex items-center gap-2 text-sm sm:text-base font-semibold text-[#17B26A]">
                <span className="size-2 rounded-full bg-[#17B26A]" />
                Connected
              </span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-sm sm:text-base font-semibold text-neutral-500 hover:text-red-500 transition duration-300 cursor-pointer"
              >

                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={() => { setShowInput(true); }}
              disabled={connecting}
            >
              <Image width={24} height={24} src="/icons/mailchimp.png" alt="Mailchimp Logo" className="h-6 w-6 object-contain" />
              {connecting ? 'Connecting…' : 'Connect Mailchimp'}
            </Button>
          )}
        </div>
      </div>
      {showInput && !connected && (
        <div className="mt-4 sm:mt-6 rounded-xl border border-zinc-200 bg-[#F5F5F5] p-4 sm:p-6">
          <p className="text-base font-semibold text-zinc-800 mb-1">Enter you Mailchimp API key</p>
          <p className="text-sm text-neutral-500 mb-5 sm:mb-6">
            Go to{' '}
            <a href="#" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              Mailchimp Settings → API
            </a>
            {' '}→ generate a Personal Key, then paste it below.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
            <Input
              type="password"
              // value={apiKey}
              // onChange={e => setApiKey(e.target.value)}
              // onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Paste your Mailchimp API key..."
            />
            <div className="flex gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              <Button
                variant="primary"
                onClick={handleConnect}
              // disabled={saving || !apiKey.trim()}
              >
                {/* {saving ? 'Testing…' : 'Save & Test'} */}
                Save & Test
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowInput(false) }}
              >
                Cancel
              </Button>
            </div>
          </div>
          {/* {error && <p className="mt-2 text-xs text-red-500">{error}</p>} */}
        </div>
      )}
    </div>
  )
}

function MailchimpLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#FFE01B" />
      <path d="M17.1 10.5c-.1-.3-.4-.5-.7-.4l-.8.2c.1-.4.1-.8 0-1.2-.2-.8-.9-1.3-1.7-1.3-.5 0-1 .2-1.3.5-.3-.2-.6-.3-1-.3-.9 0-1.6.6-1.8 1.4l-.1.5-.8-.2c-.3-.1-.6.1-.7.4-.1.3.1.6.4.7l.7.2c-.1.3-.1.6 0 .9l-.8.2c-.3.1-.5.4-.4.7.1.3.4.5.7.4l.9-.2c.3.5.7.9 1.3 1.1v.9c0 .3.3.6.6.6s.6-.3.6-.6v-.8c.2 0 .4 0 .6-.1v.9c0 .3.3.6.6.6s.6-.3.6-.6v-1c.5-.3.9-.7 1.1-1.2l.9.2c.3.1.6-.1.7-.4.1-.3-.1-.6-.4-.7l-.8-.2c0-.3 0-.6-.1-.9l.8-.2c.3-.1.5-.4.4-.7zm-4.5 2.9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="#241c15" />
      <circle cx="11.5" cy="11.4" r=".6" fill="#241c15" />
      <circle cx="13.5" cy="11.4" r=".6" fill="#241c15" />
    </svg>
  )
}
