// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/input'
import { useToast } from '@/components/toast-provider'

import { apiFetch } from '@/lib/api-fetch'
import { createClient } from '@/lib/supabase/client'


export default function NotionConnect({ plan }) {
  const { showToast } = useToast()
  
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [session, setSession] = useState(null)
  const [showInput, setShowInput] = useState(false)

  const isPro = plan === 'pro' || plan === 'operator'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('notion_connected')) {
      showToast({ title: 'Notion connected!', variant: 'success' })
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('notion_error')) {
      showToast({ title: `Connection failed: ${params.get('notion_error')}`, variant: 'error' })
      window.history.replaceState({}, '', window.location.pathname)
    }

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session || !isPro) { setLoading(false); return }

      fetch('/api/notion/status', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => { setConnected(data.connected); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [isPro])

  const handleConnect = async () => {
    if (!session) return
    setConnecting(true)
    const popup = window.open('', 'notion_oauth', 'width=600,height=700,left=' + (window.screen.width / 2 - 300) + ',top=' + (window.screen.height / 2 - 350))
    if (popup) {
      popup.document.write('<p style="font-family: system-ui; padding: 24px;">Opening Notion...</p>')
    }
    let res
    try {
      res = await apiFetch('/api/notion/auth/init', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
    } catch {
      popup?.close()
      setConnecting(false)
      showToast({ title: 'Could not initiate Notion connection. Try again.', variant: 'error' })
      return
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      popup?.close()
      setConnecting(false)
      showToast({ title: data.error || 'Could not initiate Notion connection. Try again.', variant: 'error' })
      return
    }
    const { url } = await res.json()
    if (popup) {
      popup.location.href = url
    } else {
      window.location.href = url
      return
    }
    let timer
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'NOTION_CONNECTED') {
        window.removeEventListener('message', onMessage)
        clearInterval(timer)
        setConnecting(false)
        setConnected(true)
        showToast({ title: 'Notion connected!', variant: 'success' })
        popup?.close()
      } else if (e.data?.type === 'NOTION_ERROR') {
        window.removeEventListener('message', onMessage)
        clearInterval(timer)
        setConnecting(false)
        showToast({ title: `Connection failed: ${e.data.reason || 'unknown_error'}`, variant: 'error' })
        popup?.close()
      }
    }
    window.addEventListener('message', onMessage)
    // Fallback: if popup closed without message, refresh status from server
    timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer)
        window.removeEventListener('message', onMessage)
        setConnecting(false)
        fetch('/api/notion/status', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
          .then(r => r.json())
          .then(data => {
            setConnected(data.connected)
            if (data.connected) showToast({ title: 'Notion connected!', variant: 'success' })
          })
          .catch(() => { })
      }
    }, 500)
    setTimeout(() => {
      clearInterval(timer)
      window.removeEventListener('message', onMessage)
      if (!popup?.closed) {
        setConnecting(false)
        showToast({ title: 'Notion connection timed out. Close the popup and try again.', variant: 'error' })
      }
    }, 5 * 60 * 1000)
  }

  const handleDisconnect = async () => {
    if (!session || !confirm('Disconnect Notion?')) return
    setDisconnecting(true)
    await fetch('/api/notion/auth', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    setConnected(false)
    setDisconnecting(false)
    showToast({ title: 'Notion disconnected.', variant: 'success' })
  }

  if (!isPro) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                <Image width={20} height={20} src="/icons/notion.png" alt="Notion Logo" className="h-5 w-5 object-contain" />
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
            <p className="text-lg font-semibold text-zinc-800 mb-1">Notion</p>
            <p className="text-sm text-neutral-500">Save deliverables directly to your Notion workspace</p>
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
          {/* <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
            <Image width={20} height={20} src="/icons/notion.png" alt="Notion Logo" className="h-5 w-5 object-contain" />
          </div> */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                <Image width={20} height={20} src="/icons/notion.png" alt="Notion Logo" className="h-5 w-5 object-contain" />
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
            <p className="text-lg font-semibold text-zinc-800 mb-1">Notion</p>
            <p className="text-sm text-neutral-500">
              {connected
                ? 'Connected — save deliverables to your Notion pages and databases.'
                : 'Save deliverables directly to your Notion workspace as pages.'}
            </p>
            {!connected && (
              <p className="text-sm text-neutral-500 mt-1">When connecting, select the Notion pages or databases where you want 3rdShift to save deliverables.</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <div className="animate-pulse h-8 w-24 rounded-lg bg-zinc-100" />
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
              <Image width={20} height={20} src="/icons/notion.png" alt="Notion Logo" className="h-5 w-5 object-contain" />
              {connecting ? 'Connecting…' : 'Connect Notion'}
            </Button>
          )}
        </div>
      </div>
      {showInput && !connected && (
        <div className="mt-4 sm:mt-6 rounded-xl border border-zinc-200 bg-[#F5F5F5] p-4 sm:p-6">
          <p className="text-base font-semibold text-zinc-800 mb-1">Enter you Notion API key</p>
          <p className="text-sm text-neutral-500 mb-5 sm:mb-6">
            Go to{' '}
            <a href="#" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              Notion Settings → API
            </a>
            {' '}→ generate a Personal Key, then paste it below.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
            <Input
              type="password"
              // value={apiKey}
              // onChange={e => setApiKey(e.target.value)}
              // onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Paste your Notion API key..."
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
            {/* {error && <p className="mt-2 text-xs text-red-500">{error}</p>} */}
          </div>
        </div>
      )}
    </div>
  )
}

function NotionLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#fff" />
      <path
        d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933l3.222-.187z"
        fill="#1a1a1a"
      />
    </svg>
  )
}
