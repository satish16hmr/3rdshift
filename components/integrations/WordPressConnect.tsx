// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/input'
import { useToast } from '@/components/toast-provider'

import { createClient } from '@/lib/supabase/client'


export default function WordPressConnect({ plan }) {
  const [connected, setConnected] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [session, setSession] = useState(null)
  const [connectedSite, setConnectedSite] = useState(null)
  const { showToast } = useToast()

  const isPro = plan === 'pro' || plan === 'operator'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session || !isPro) { setLoading(false); return }

      fetch('/api/wordpress/status', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          setConnected(data.connected)
          setConnectedSite(data.site_url || null)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [isPro])

  const handleSave = async () => {
    if (!session || saving) return
    if (!siteUrl || !username || !appPassword) {
      showToast({ title: 'All fields are required.', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/wordpress/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ site_url: siteUrl.trim(), username: username.trim(), app_password: appPassword.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setConnected(true)
        setConnectedSite(siteUrl.trim())
        setShowForm(false)
        setAppPassword('')
        showToast({ title: 'WordPress connected!', variant: 'success' })
      } else {
        showToast({ title: data.error || 'Connection failed. Check your credentials.', variant: 'error' })
      }
    } catch {
      showToast({ title: 'Something went wrong.', variant: 'error' })
    }
    setSaving(false)
  }

  const handleDisconnect = async () => {
    if (!session || !confirm('Disconnect WordPress?')) return
    setDisconnecting(true)
    await fetch('/api/wordpress/connect', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    setConnected(false)
    setConnectedSite(null)
    setDisconnecting(false)
    showToast({ title: 'WordPress disconnected.', variant: 'success' })
  }

  if (!isPro) {
    return (
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                <Image width={24} height={24} src="/icons/wordpress.png" alt="WordPress Logo" className="h-6 w-6 object-contain" />
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
            <p className="text-lg font-semibold text-zinc-800 mb-1">WordPress</p>
            <p className="text-sm text-neutral-500">Publish blog posts and articles directly from 3rdShift to your WordPress site</p>
          </div>
        </div>
        <Link href="/dashboard/settings/billing"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
          🔒 Upgrade to Pro to connect →
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 space-y-4">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                <Image width={24} height={24} src="/icons/wordpress.png" alt="WordPress Logo" className="h-6 w-6 object-contain" />
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
            <p className="text-lg font-semibold text-zinc-800 mb-1">WordPress</p>
            <p className="text-sm text-neutral-500">
              {connected && connectedSite
                ? `Connected to ${connectedSite}`
                : 'Connect your WordPress site to publish posts directly from 3rdShift.'}
            </p>
            {!connected && (
              <p className="text-xs text-zinc-400 mt-0.5">Works with self-hosted WordPress sites (WordPress.org). WordPress.com Business plan also supported.</p>
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
              onClick={() => setShowForm(!showForm)}
            >
              <Image width={24} height={24} src="/icons/wordpress.png" alt="WordPress Logo" className="h-6 w-6 object-contain" />
              Connect WordPress
            </Button>
          )}
        </div>
      </div>

      {!connected && showForm && (
        <div className="border-t border-zinc-100 pt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Site URL</label>
            <Input
              type="url"
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://mybusiness.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">WordPress Username</label>
            <Input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your-username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Application Password</label>
            <Input
              type="password"
              value={appPassword}
              onChange={e => setAppPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            />
            <p className="text-xs text-zinc-400 mt-1">
              Generate in WordPress Admin → Users → Profile → Application Passwords.{' '}
              <Link href="https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/#application-passwords" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Learn more →</Link>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !siteUrl || !username || !appPassword}
            >
              {saving ? 'Connecting…' : 'Connect'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function WordPressLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#21759B" />
      <path d="M2.232 12a9.768 9.768 0 0011.177 9.688L3.96 7.795A9.737 9.737 0 002.232 12zm16.98-.966c0-1.538-.553-2.601-.794-3.227-.629-1.02-.989-2.027-.989-2.92A9.768 9.768 0 0121.768 12c0 .073-.001.146-.003.218l-2.553-6.184zM12 2.232c5.392 0 9.768 4.376 9.768 9.768 0 5.393-4.376 9.768-9.768 9.768S2.232 17.393 2.232 12c0-5.392 4.376-9.768 9.768-9.768zm0 1.454a8.314 8.314 0 100 16.628 8.314 8.314 0 000-16.628zm-1.26 13.854l-3.24-8.88a5.58 5.58 0 001.056.108c.397 0 .794-.054 1.188-.108l3.078 8.43-.012.036-.012-.036-2.058-5.64-1.176 3.24 1.176 3.24v-.39zm3.24 0l-1.23-3.372 2.388-6.912 1.176 3.24-2.334 7.044z" fill="white" />
    </svg>
  )
}
