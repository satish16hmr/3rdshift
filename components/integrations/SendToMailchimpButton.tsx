// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

export default function SendToMailchimpButton({ taskId, workerSlug, title }) {
  const { plan, loading: planLoading } = useWorkspacePlan()
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [lists, setLists] = useState([])
  const [listsLoading, setListsLoading] = useState(false)
  const [campaignName, setCampaignName] = useState(title || '')
  const [subjectLine, setSubjectLine] = useState(title || '')
  const [fromName, setFromName] = useState('')
  const [listId, setListId] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState('')

  // Only show on text workers, skip image/data workers
  const skipWorkers = ['thumbnail-designer', 'logo-concept-generator', 'social-media-graphics-designer', 'lead-generator', 'data-cleaner', 'bookkeeping-summarizer', 'spreadsheet-builder']
  const shouldSkip = skipWorkers.includes(workerSlug)

  useEffect(() => {
    if (shouldSkip) {
      setLoading(false)
      return
    }
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)
      const wsId = getStoredWorkspaceId()
      const headers = { 'Authorization': `Bearer ${session.access_token}` }
      if (wsId) headers['x-workspace-id'] = wsId
      fetch('/api/mailchimp/status', { headers })
        .then(r => r.json())
        .then(data => { setConnected(data.connected || false); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [shouldSkip])

  const handleClick = async () => {
    if (!connected) {
      window.location.href = '/dashboard/settings/integration'
      return
    }
    setShowModal(true)
    setListsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mailchimp/send', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setLists(data.lists || [])
    } catch {
      setLists([])
    }
    setListsLoading(false)
  }

  const handleSend = async () => {
    if (sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/mailchimp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          taskId,
          campaign_name: campaignName,
          subject_line: subjectLine,
          from_name: fromName,
          list_id: listId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSent({ url: data.campaign_url })
        setShowModal(false)
      } else {
        setError(data.error || 'Failed to send to Mailchimp')
      }
    } catch {
      setError('Something went wrong')
    }
    setSending(false)
  }

  if (shouldSkip || loading || planLoading || plan === 'starter') return null
  if (!connected) return null

  if (sent) {
    return (
      <a
        href={sent.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
      >
        <span>✓</span> Draft created in Mailchimp →
      </a>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
      >
        <MailchimpIcon />
        Send to Mailchimp
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-zinc-950 mb-1">Send to Mailchimp</h3>
            <p className="text-xs text-zinc-500 mb-4">Creates a campaign draft — you review and send from Mailchimp.</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={subjectLine}
                  onChange={e => setSubjectLine(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">From Name (optional)</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={e => setFromName(e.target.value)}
                  placeholder="Your Name or Brand"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Audience (optional)</label>
                {listsLoading ? (
                  <div className="animate-pulse h-9 rounded-lg bg-zinc-100" />
                ) : (
                  <select
                    value={listId}
                    onChange={e => setListId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select an audience…</option>
                    {lists.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.member_count} contacts)</option>
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
                disabled={!campaignName || !subjectLine || sending}
                className="flex-1 rounded-lg bg-[#FFE01B] py-2 text-sm font-semibold text-[#241c15] hover:bg-[#f5d800] disabled:opacity-50"
              >
                {sending ? 'Creating…' : 'Create Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MailchimpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#FFE01B"/>
      <path d="M17.1 10.5c-.1-.3-.4-.5-.7-.4l-.8.2c.1-.4.1-.8 0-1.2-.2-.8-.9-1.3-1.7-1.3-.5 0-1 .2-1.3.5-.3-.2-.6-.3-1-.3-.9 0-1.6.6-1.8 1.4l-.1.5-.8-.2c-.3-.1-.6.1-.7.4-.1.3.1.6.4.7l.7.2c-.1.3-.1.6 0 .9l-.8.2c-.3.1-.5.4-.4.7.1.3.4.5.7.4l.9-.2c.3.5.7.9 1.3 1.1v.9c0 .3.3.6.6.6s.6-.3.6-.6v-.8c.2 0 .4 0 .6-.1v.9c0 .3.3.6.6.6s.6-.3.6-.6v-1c.5-.3.9-.7 1.1-1.2l.9.2c.3.1.6-.1.7-.4.1-.3-.1-.6-.4-.7l-.8-.2c0-.3 0-.6-.1-.9l.8-.2c.3-.1.5-.4.4-.7z" fill="#241c15"/>
    </svg>
  )
}
