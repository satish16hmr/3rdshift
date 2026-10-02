// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

export default function SaveToNotionButton({ taskId, title }) {
  const { plan, loading: planLoading } = useWorkspacePlan()
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [pages, setPages] = useState([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [selectedPage, setSelectedPage] = useState('')
  const [pageTitle, setPageTitle] = useState(title || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null) // { url }
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)
      const wsId = getStoredWorkspaceId()
      const headers = { 'Authorization': `Bearer ${session.access_token}` }
      if (wsId) headers['x-workspace-id'] = wsId
      fetch('/api/notion/status', { headers })
        .then(r => r.json())
        .then(data => { setConnected(data.connected || false); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [])

  const handleClick = async () => {
    if (!connected) {
      window.location.href = '/dashboard/settings/integration'
      return
    }
    setShowModal(true)
    setPagesLoading(true)
    setError('')
    try {
      const res = await fetch('/api/notion/save', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setPages(data.pages || [])
    } catch {
      setError('Could not load Notion pages.')
    }
    setPagesLoading(false)
  }

  const handleSave = async () => {
    if (!selectedPage || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/notion/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ taskId, parent_page_id: selectedPage, title: pageTitle }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaved({ url: data.page_url })
        setShowModal(false)
      } else {
        setError(data.error || 'Failed to save to Notion')
      }
    } catch {
      setError('Something went wrong')
    }
    setSaving(false)
  }

  if (loading || planLoading || plan === 'starter') return null
  if (!connected) return null

  if (saved) {
    return (
      <a
        href={saved.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
      >
        <span>✓</span> Saved to Notion →
      </a>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
      >
        <NotionIcon />
        Save to Notion
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-zinc-950 mb-4">Save to Notion</h3>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Title</label>
                <input
                  type="text"
                  value={pageTitle}
                  onChange={e => setPageTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Save under</label>
                {pagesLoading ? (
                  <div className="animate-pulse h-9 rounded-lg bg-zinc-100" />
                ) : (
                  <select
                    value={selectedPage}
                    onChange={e => setSelectedPage(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select a page…</option>
                    {pages.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                )}
                {pages.length === 0 && !pagesLoading && (
                  <p className="text-xs text-zinc-400 mt-1">No pages found. Make sure you've shared pages with the 3rdShift integration in Notion.</p>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedPage || saving}
                className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save to Notion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function NotionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933l3.222-.187z" fill="#1a1a1a"/>
    </svg>
  )
}
