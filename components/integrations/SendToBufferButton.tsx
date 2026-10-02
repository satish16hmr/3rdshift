// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

export default function SendToBufferButton({ taskId, workerSlug }) {
  const { plan, loading: planLoading } = useWorkspacePlan()
  const [connected, setConnected] = useState(false)
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState([])
  const [scheduleType, setScheduleType] = useState('queue')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)
      const wsId = getStoredWorkspaceId()
      const headers = { 'Authorization': `Bearer ${session.access_token}` }
      if (wsId) headers['x-workspace-id'] = wsId
      fetch('/api/buffer/status', { headers })
        .then(r => r.json())
        .then(data => { setConnected(data.connected || false); setChannels(data.channels || []); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [])

  const handleClick = () => {
    if (!connected) {
      window.location.href = '/dashboard/settings/integration'
      return
    }
    setShowModal(true)
    setError('')
  }

  const toggleChannel = (id) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const handleSend = async () => {
    if (sending || selectedChannels.length === 0) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/buffer/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          taskId,
          channel_ids: selectedChannels,
          schedule_type: scheduleType,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSent(true)
        setShowModal(false)
        // Toast message handled by sent state UI
      } else {
        setError(data.error || 'Failed to send to Buffer')
      }
    } catch {
      setError('Something went wrong')
    }
    setSending(false)
  }

  if (loading || planLoading || plan === 'starter') return null

  if (sent) {
    return (
      <span className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
        ✓ Sent to Buffer
      </span>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
      >
        <BufferIcon />
        Send to Buffer
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-zinc-950 mb-4">Send to Buffer</h3>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-2">Select channels</label>
                {channels.length === 0 ? (
                  <p className="text-xs text-zinc-400">No channels found. Make sure Buffer is connected with at least one social channel.</p>
                ) : (
                  <div className="space-y-2">
                    {channels.map(ch => (
                      <label key={ch.id} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedChannels.includes(ch.id)}
                          onChange={() => toggleChannel(ch.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-zinc-800">
                          {ch.service === 'twitter' ? '𝕏' : ch.service === 'instagram' ? '📷' : ch.service === 'linkedin' ? 'in' : ch.service === 'facebook' ? 'f' : ''}
                          {' '}{ch.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Schedule</label>
                <select
                  value={scheduleType}
                  onChange={e => setScheduleType(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="queue">Add to Queue</option>
                  <option value="now">Share Now</option>
                </select>
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
                disabled={selectedChannels.length === 0 || sending}
                className="flex-1 rounded-lg bg-[#2C4BFF] py-2 text-sm font-semibold text-white hover:bg-[#2240e0] disabled:opacity-50"
              >
                {sending ? 'Sending…' : scheduleType === 'now' ? 'Post Now' : 'Add to Queue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BufferIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#2C4BFF"/>
      <path d="M12.145 7.077a.402.402 0 00-.29 0L5.6 9.7a.307.307 0 000 .57l6.255 2.625a.402.402 0 00.29 0L18.4 10.27a.307.307 0 000-.57l-6.255-2.623zm0 5.486a.402.402 0 00-.29 0L5.6 15.186a.307.307 0 000 .57l6.255 2.625a.402.402 0 00.29 0l6.255-2.625a.307.307 0 000-.57l-6.255-2.623z" fill="white"/>
    </svg>
  )
}
