// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { Layers } from 'lucide-react'

import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/input'

import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { getStoredWorkspaceId } from '@/lib/workspace-client'


export default function BufferConnect({ plan }) {
  const { showToast } = useToast()
  
  const [connected, setConnected] = useState(false)
  const [masked, setMasked] = useState(null)
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')

  const isPro = plan === 'pro' || plan === 'operator'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session || !isPro) { setLoading(false); return }

      const wsId = getStoredWorkspaceId()
      const headers = { 'Authorization': `Bearer ${session.access_token}` }
      if (wsId) headers['x-workspace-id'] = wsId

      fetch('/api/buffer/status', { headers })
        .then(async r => {
          if (!r.ok) {
            // Auth failure (stale token) or server error — don't flip to disconnected
            // Try once with a refreshed session
            if (r.status === 401) {
              const { data: refreshed } = await supabase.auth.refreshSession()
              if (refreshed.session) {
                const freshHeaders = { 'Authorization': `Bearer ${refreshed.session.access_token}` }
                if (wsId) freshHeaders['x-workspace-id'] = wsId
                const retry = await fetch('/api/buffer/status', { headers: freshHeaders })
                if (retry.ok) {
                  const data = await retry.json()
                  setConnected(data.connected)
                  setMasked(data.masked)
                  setChannels(data.channels || [])
                  setSession(refreshed.session)
                }
              }
            }
            setLoading(false)
            return
          }
          const data = await r.json()
          setConnected(data.connected)
          setMasked(data.masked)
          setChannels(data.channels || [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [isPro])

  const handleSave = async () => {
    if (!session || !apiKey.trim()) return
    setSaving(true)
    setError('')

    const wsId = getStoredWorkspaceId()
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }
    if (wsId) headers['x-workspace-id'] = wsId

    const res = await apiFetch('/api/buffer/connect', {
      method: 'POST',
      headers,
      body: JSON.stringify({ api_key: apiKey.trim() }),
    })
    const data = await res.json()

    if (res.ok && data.success) {
      setConnected(true)
      setMasked(data.masked)
      setChannels(data.channels || [])
      setShowInput(false)
      setApiKey('')
      showToast({ title: 'Buffer connected!', variant: 'success' })
    } else {
      setError(data.error || 'Failed to connect. Check your API key.')
    }
    setSaving(false)
  }

  const handleDisconnect = async () => {
    if (!session || !confirm('Disconnect Buffer?')) return
    setDisconnecting(true)

    const wsId = getStoredWorkspaceId()
    const headers = { 'Authorization': `Bearer ${session.access_token}` }
    if (wsId) headers['x-workspace-id'] = wsId

    await apiFetch('/api/buffer/connect', { method: 'DELETE', headers })
    setConnected(false)
    setMasked(null)
    setChannels([])
    setDisconnecting(false)
    showToast({ title: 'Buffer disconnected.', variant: 'success' })
  }

  if (!isPro) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                <Layers className="w-4 h-4 text-zinc-800" />
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
            <p className="text-lg font-semibold text-zinc-800 mb-1">Buffer</p>
            <p className="text-sm text-neutral-500">Schedule social posts across Instagram, X, LinkedIn, Facebook, and more</p>
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
                <Layers className="w-4 h-4 text-zinc-800" />
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
            <p className="text-lg font-semibold text-zinc-800 mb-1">Buffer</p>
            <p className="text-sm text-neutral-500">
              {connected
                ? `Connected${masked ? ` · Key: ${masked}` : ''}${channels.length ? ` · ${channels.length} channel${channels.length !== 1 ? 's' : ''}` : ''}`
                : 'Connect your Buffer account to schedule social posts from 3rdShift.'}
            </p>
            {connected && channels.length > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">{channels.slice(0, 3).map(c => c.name).join(', ')}{channels.length > 3 ? ` +${channels.length - 3} more` : ''}</p>
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
              onClick={() => { setShowInput(true); setError('') }}
            >
              <Layers className="w-4 h-4 text-zinc-800" />
              Connect Buffer
            </Button>
          )}
        </div>
      </div>

      {/* API key input section */}
      {showInput && !connected && (
        <div className="mt-4 sm:mt-6 rounded-xl border border-zinc-200 bg-[#F5F5F5] p-4 sm:p-6">
          <p className="text-base font-semibold text-zinc-800 mb-1">Enter your Buffer API key</p>
          <p className="text-sm text-neutral-500 mb-5 sm:mb-6">
            Go to{' '}
            <a href="https://buffer.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              Buffer Settings → API
            </a>
            {' '}→ generate a Personal Key, then paste it below.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Paste your Buffer API key…"
            />
            <div className="flex gap-3 sm:gap-4 md:gap-5 lg:gap-6">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !apiKey.trim()}
              >
                {saving ? 'Testing…' : 'Save & Test'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowInput(false); setApiKey(''); setError('') }}
              >
                Cancel
              </Button>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}

function BufferLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#2C4BFF" />
      <path d="M12.145 7.077a.402.402 0 00-.29 0L5.6 9.7a.307.307 0 000 .57l6.255 2.625a.402.402 0 00.29 0L18.4 10.27a.307.307 0 000-.57l-6.255-2.623zm0 5.486a.402.402 0 00-.29 0L5.6 15.186a.307.307 0 000 .57l6.255 2.625a.402.402 0 00.29 0l6.255-2.625a.307.307 0 000-.57l-6.255-2.623z" fill="white" />
    </svg>
  )
}
