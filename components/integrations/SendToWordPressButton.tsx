// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

export default function SendToWordPressButton({ taskId, workerSlug, title }) {
  const { plan, loading: planLoading } = useWorkspacePlan()
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [categories, setCategories] = useState([])
  const [catsLoading, setCatsLoading] = useState(false)
  const [postTitle, setPostTitle] = useState(title || '')
  const [postStatus, setPostStatus] = useState('draft')
  const [categoryId, setCategoryId] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState('')

  // Only show on text-output workers
  const imageWorkers = ['thumbnail-designer', 'logo-concept-generator', 'social-media-graphics-designer']
  const isImageWorker = imageWorkers.includes(workerSlug)

  useEffect(() => {
    if (isImageWorker) return
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)
      const wsId = getStoredWorkspaceId()
      const headers = { 'Authorization': `Bearer ${session.access_token}` }
      if (wsId) headers['x-workspace-id'] = wsId
      fetch('/api/wordpress/status', { headers })
        .then(r => r.json())
        .then(data => { setConnected(data.connected || false); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [isImageWorker])

  const handleClick = async () => {
    if (!connected) {
      window.location.href = '/dashboard/settings/integration'
      return
    }
    setShowModal(true)
    setCatsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wordpress/send', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setCategories(data.categories || [])
    } catch {
      setCategories([])
    }
    setCatsLoading(false)
  }

  const handleSend = async () => {
    if (sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/wordpress/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          taskId,
          title: postTitle,
          status: postStatus,
          category_id: categoryId ? parseInt(categoryId) : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSent({ edit_url: data.edit_url, post_url: data.post_url })
        setShowModal(false)
      } else {
        setError(data.error || 'Failed to send to WordPress')
      }
    } catch {
      setError('Something went wrong')
    }
    setSending(false)
  }

  if (loading || planLoading || isImageWorker || plan === 'starter') return null
  if (!connected) return null

  if (sent) {
    return (
      <a
        href={sent.edit_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
      >
        <span>✓</span> Draft created in WordPress →
      </a>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
      >
        <WordPressIcon />
        Send to WordPress
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-zinc-950 mb-1">Send to WordPress</h3>
            <p className="text-xs text-zinc-500 mb-4">Will be saved as a draft — review and publish from your WordPress admin.</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Post Title</label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={e => setPostTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Status</label>
                <select
                  value={postStatus}
                  onChange={e => setPostStatus(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending Review</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Category (optional)</label>
                {catsLoading ? (
                  <div className="animate-pulse h-9 rounded-lg bg-zinc-100" />
                ) : (
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
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
                onClick={handleSend}
                disabled={!postTitle || sending}
                className="flex-1 rounded-lg bg-[#21759B] py-2 text-sm font-semibold text-white hover:bg-[#1a5e7a] disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send to WordPress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function WordPressIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#21759B"/>
      <path d="M2.232 12a9.768 9.768 0 0011.177 9.688L3.96 7.795A9.737 9.737 0 002.232 12zm16.98-.966c0-1.538-.553-2.601-.794-3.227-.629-1.02-.989-2.027-.989-2.92A9.768 9.768 0 0121.768 12c0 .073-.001.146-.003.218l-2.553-6.184zM12 2.232c5.392 0 9.768 4.376 9.768 9.768 0 5.393-4.376 9.768-9.768 9.768S2.232 17.393 2.232 12c0-5.392 4.376-9.768 9.768-9.768zm0 1.454a8.314 8.314 0 100 16.628 8.314 8.314 0 000-16.628zm-1.26 13.854l-3.24-8.88a5.58 5.58 0 001.056.108c.397 0 .794-.054 1.188-.108l3.078 8.43-.012.036-.012-.036-2.058-5.64-1.176 3.24 1.176 3.24v-.39zm3.24 0l-1.23-3.372 2.388-6.912 1.176 3.24-2.334 7.044z" fill="white"/>
    </svg>
  )
}
