// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/input'
import { useToast } from '@/components/toast-provider'
import { createClient } from '@/lib/supabase/client'


export default function GoogleWorkspaceConnect({ plan }) {
  const { showToast } = useToast()

  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [session, setSession] = useState(null)
  const [showInput, setShowInput] = useState(false)

  useEffect(() => {
    // Check for redirect params
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected')) {
      showToast({ title: 'Google Workspace connected!', variant: 'success' })
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('google_error')) {
      showToast({ title: `Connection failed: ${params.get('google_error')}`, variant: 'error' })
      window.history.replaceState({}, '', window.location.pathname)
    }

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) { setLoading(false); return }

      fetch('/api/save-to-google', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => { setConnected(data.connected); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [])

  const handleConnect = async () => {
    if (!session) return
    setConnecting(true)
    const popup = window.open('', "google_oauth", "width=600,height=700,left=" + (window.screen.width / 2 - 300) + ",top=" + (window.screen.height / 2 - 350));
    if (popup) {
      popup.document.write('<p style="font-family: system-ui; padding: 24px;">Opening Google...</p>')
    }
    // Step 1: Register pending state on server (stores userId against a state token)
    const res = await fetch('/api/auth/google/init', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      popup?.close()
      setConnecting(false)
      showToast({ title: 'Could not initiate Google connection. Try again.', variant: 'error' })
      return
    }
    const { url } = await res.json()
    // Step 2: Redirect to Google consent screen
    if (popup) {
      popup.location.href = url
    } else {
      window.location.href = url
      return
    }
    // Listen for postMessage from the success page (popup closes itself)
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'GOOGLE_CONNECTED') {
        window.removeEventListener('message', onMessage);
        clearInterval(timer);
        setConnecting(false);
        setConnected(true);
        showToast({ title: 'Google Workspace connected!', variant: 'success' });
      }
    };
    window.addEventListener('message', onMessage);
    const timer = setInterval(() => { if (popup?.closed) { clearInterval(timer); window.removeEventListener('message', onMessage); setConnecting(false); } }, 500);
  }

  const handleDisconnect = async () => {
    if (!session || !confirm('Disconnect Google Workspace?')) return
    setDisconnecting(true)
    await fetch('/api/auth/google', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    setConnected(false)
    setDisconnecting(false)
    showToast({ title: 'Google Workspace disconnected.', variant: 'success' })
  }

  if (!plan) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="w-11 h-11 flex items-center justify-center border border-zinc-200 rounded-md">
            <GoogleIcon />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-800 mb-1">Google Workspace</p>
            <p className="text-sm text-neutral-500">Checking plan access...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="w-11 h-11 flex items-center justify-center border border-zinc-200 rounded-md">
                <GoogleIcon />
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
            <p className="text-lg font-semibold text-zinc-800 mb-1">Google Workspace</p>
            <p className="text-sm text-neutral-500">
              {loading ? 'Checking connection…' : connected ? 'Connected — deliverables save to your Google Drive' : 'Save deliverables to Google Drive, Docs, and Sheets'}
            </p>
          </div>
        </div>


        {loading ? (
          <div className="py-3">
            <div className="size-5 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-500 mx-auto" />
          </div>
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
            onClick={() => { setShowInput(true); }}
            disabled={connecting}
            className="w-full md:w-auto"
          >
            <GoogleIcon size={14} />
            {connecting ? 'Connecting…' : 'Connect Google'}
          </Button>
        )}
      </div>

      {showInput && !connected && (
        <div className="mt-4 sm:mt-6 rounded-xl border border-zinc-200 bg-[#F5F5F5] p-4 sm:p-6">
          <p className="text-base font-semibold text-zinc-800 mb-1">Enter you Google API key</p>
          <p className="text-sm text-neutral-500 mb-5 sm:mb-6">
            Go to{' '}
            <a href="#" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              Google Settings → API
            </a>
            {' '}→ generate a Personal Key, then paste it below.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
            <Input
              type="password"
              // value={apiKey}
              // onChange={e => setApiKey(e.target.value)}
              // onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Paste your Google API key..."
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

      {connected && (
        <div className="pt-6">
          <p className="text-sm text-neutral-500 mb-3">What gets saved where:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-1">
            {[
              ['Text & articles', '→ Google Docs'],
              ['Spreadsheet data', '→ Google Sheets'],
              ['Images & logos', '→ Google Drive'],
              ['Presentations', '→ Google Drive'],
            ].map(([label, dest]) => (
              <div key={label} className="flex flex-wrap items-center gap-2">
                <Image width={16} height={16} src="/icons/notion.png" alt="Notion Logo" className="h-4 w-4 object-contain" />
                <span className="text-neutral-500 text-sm text-nowrap">{label}</span>
                <span className="text-neutral-500 text-sm text-nowrap">{dest}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
