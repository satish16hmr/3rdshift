// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/toast-provider'

import { workspaceFetch } from '@/lib/workspace-client'
import { createClient } from '@/lib/supabase/client'


export default function ZapierConnect({ plan }) {
  const { showToast } = useToast()

  const [apiKey, setApiKey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [session, setSession] = useState(null)
  const [showKey, setShowKey] = useState(false)
  const [showZapier, setShowZapier] = useState(false)
  const [copied, setCopied] = useState(false)

  const isOperator = plan === 'operator'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session || !isOperator) { setLoading(false); return }

      workspaceFetch('/api/zapier/api-key', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          setApiKey(data.api_key || null)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [isOperator])

  const handleGenerate = async () => {
    if (!session || generating) return
    setGenerating(true)
    try {
      const res = await workspaceFetch('/api/zapier/api-key', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setApiKey(data.api_key)
        setShowKey(true)
        showToast({ title: apiKey ? 'API key regenerated.' : 'API key generated!', variant: 'success' })
      } else {
        showToast({ title: data.error || 'Failed to generate key', variant: 'error' })
      }
    } catch (err) {
      showToast({ title: err?.message || 'Something went wrong. Try again.', variant: 'error' })
    }
    setGenerating(false)
  }

  const handleCopy = async () => {
    if (!apiKey) return
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast({ title: 'API key copied!', variant: 'success' })
    } catch {
      showToast({ title: 'Failed to copy to clipboard', variant: 'error' })
    }
  }

  // Starter / Pro — locked state
  if (!isOperator) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="h-11 w-11 shrink-0 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
            <Image width={24} height={24} src="/icons/zapier.png" alt="Zapier Logo" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-800 mb-1">Zapier</p>
            <p className="text-sm text-neutral-500">Connect 3rdShift to 8,000+ apps — HubSpot, Slack, Shopify, WordPress, and more</p>
          </div>
        </div>
        <a
          href="/dashboard/settings/billing"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          🔒 Upgrade to Operator to connect →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 space-y-4">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="h-11 w-11 shrink-0 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
            <Image width={24} height={24} src="/icons/zapier.png" alt="Zapier Logo" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-800 mb-1">Zapier</p>
            <p className="text-sm text-neutral-500 mt-0.5">
              Connect 3rdShift to 8,000+ apps. When your team members complete tasks, automatically send output to HubSpot, Slack, Shopify, WordPress, Mailchimp, Airtable, and more.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {loading ? (
            <div className="animate-pulse h-9 w-full! rounded-lg bg-zinc-100" />
          ) : (
            <Button
              variant="outline"
              className='w-full!'
              onClick={() => setShowZapier(true)}
            >
              <Image
                width={20}
                height={20}
                src="/icons/zapier.png"
                alt="Zapier Logo"
                className="h-4 w-4 object-contain"
              />
              Connect Zapier
            </Button>
          )}
        </div>
      </div>

      {showZapier && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-zinc-600 mb-1.5">Your API Key</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 max-w-[calc(100%-60px)]">
                <code className="flex-1 text-xs text-zinc-700 font-mono truncate">
                  {showKey ? apiKey : '•'.repeat(36)}
                </code>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors shrink-0 cursor-pointer"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                onClick={handleCopy}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0 cursor-pointer"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Keep this secret. Use it as the <code className="font-mono">X-API-Key</code> header in all Zapier requests.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="https://zapier.com/apps"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="primary">
                Open Zapier →
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Regenerating…' : 'Regenerate Key'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowZapier(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">API Endpoints</p>
            <ul className="text-xs text-blue-700 space-y-0.5 font-mono">
              <li>POST /api/zapier/auth/verify</li>
              <li>POST /api/zapier/hooks/subscribe</li>
              <li>DELETE /api/zapier/hooks/unsubscribe</li>
              <li>POST /api/zapier/tasks/create</li>
              <li>GET /api/zapier/workers</li>
              <li>GET /api/zapier/workers/:slug/fields</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function ZapierLogo({ size = 20, white = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill={white ? 'transparent' : '#FF4A00'} />
      <path
        d="M39.4 32a7.4 7.4 0 01-.22 1.8l4.23 3.28a.63.63 0 01.14.84l-4 6.93a.63.63 0 01-.77.27l-4.99-2a13.4 13.4 0 01-3.1 1.8l-.75 5.3a.63.63 0 01-.62.54h-8a.63.63 0 01-.62-.54l-.75-5.3a13.4 13.4 0 01-3.1-1.8l-5 2a.63.63 0 01-.77-.27l-4-6.93a.62.62 0 01.14-.84l4.24-3.28A13.5 13.5 0 0112 32a7.4 7.4 0 01.22-1.8L7.99 26.92a.63.63 0 01-.14-.84l4-6.93a.63.63 0 01.77-.27l5 2a13.4 13.4 0 013.1-1.8l.75-5.3a.63.63 0 01.62-.54h8a.63.63 0 01.62.54l.75 5.3a13.4 13.4 0 013.1 1.8l5-2a.63.63 0 01.77.27l4 6.93a.62.62 0 01-.14.84L39.4 30.2A7.4 7.4 0 0139.4 32zm-13.9 5.5a5.5 5.5 0 100-11 5.5 5.5 0 000 11z"
        fill={white ? 'white' : 'white'}
      />
    </svg>
  )
}
