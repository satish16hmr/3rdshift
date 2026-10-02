// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

export default function SaveToGoogleButton({ taskId, workerSlug, title }) {
  const [connected, setConnected] = useState(false)
  const { plan, loading: planLoading } = useWorkspacePlan()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null) // { url, type }
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)

      // Check connection status
      const wsId = getStoredWorkspaceId()
      const headers = { 'Authorization': `Bearer ${session.access_token}` }
      if (wsId) headers['x-workspace-id'] = wsId
      fetch('/api/save-to-google', { headers })
        .then(r => r.json())
        .then(data => { setConnected(data.connected); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [])

  const handleSave = async () => {
    if (!session) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/save-to-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ taskId, title }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.not_connected) {
          setError('Connect Google Workspace in Settings first.')
        } else if (data.upgrade_required) {
          setError('Requires Pro plan.')
        } else {
          setError(data.error || 'Failed to save')
        }
        setSaving(false)
        return
      }

      setSaved({ url: data.url, type: data.type })
    } catch {
      setError('Failed to save to Google')
    }
    setSaving(false)
  }

  // Don't render if loading, starter, or no connection
  if (loading || planLoading) return null
  if (plan === 'starter') return null
  if (!connected) return null

  if (saved) {
    return (
      <a
        href={saved.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
        </svg>
        Saved to Google {saved.type === 'doc' ? 'Docs' : saved.type === 'sheet' ? 'Sheets' : 'Drive'} →
      </a>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50 shadow-sm"
      >
        <GoogleDriveIcon />
        {saving ? 'Saving…' : 'Save to Google'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function GoogleDriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0A15.6 15.6 0 0 0 6.6 66.85z" fill="#0066da"/>
      <path d="M43.65 25 29.9 1.2A15.6 15.6 0 0 0 26.6 4.5L0 53a15.6 15.6 0 0 0 0 15.96h27.5l16.15-44z" fill="#00ac47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25A15.6 15.6 0 0 0 87.3 52H59.8l5.45 9.45L73.55 76.8z" fill="#ea4335"/>
      <path d="M43.65 25 57.4 1.2A15.6 15.6 0 0 0 43.65 0H43.6a15.6 15.6 0 0 0-13.7 1.2L43.65 25z" fill="#00832d"/>
      <path d="M59.8 52H27.5L13.75 75.8c1.35.8 2.9 1.2 4.5 1.2h50.9c1.6 0 3.15-.45 4.5-1.2L59.8 52z" fill="#2684fc"/>
      <path d="M73.4 26.5 60.05 4.5A15.6 15.6 0 0 0 57.4 1.2L43.65 25l16.15 27H87.3A15.6 15.6 0 0 0 73.4 26.5z" fill="#ffba00"/>
    </svg>
  )
}
