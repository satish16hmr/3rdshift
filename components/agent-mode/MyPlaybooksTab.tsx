// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/toast-provider'
import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { HEAVY_WORKER_CREDITS } from '@/lib/agent-mode/types'

const DAY_ABBR = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' }

function PlaybookCard({ playbook, onDeploy, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const cost = (playbook.workers ?? []).reduce((acc, w) => {
    const heavy = HEAVY_WORKER_CREDITS[w.worker_id] ?? 0
    return { light: acc.light + (heavy === 0 ? 1 : 0), heavy: acc.heavy + heavy }
  }, { light: 0, heavy: 0 })

  const costLabel = [
    cost.light > 0 ? `${cost.light} light` : null,
    cost.heavy > 0 ? `${cost.heavy} heavy` : null,
  ].filter(Boolean).join(' + ') || 'free'

  const scheduleLabel = playbook.schedule_days?.length > 0
    ? playbook.schedule_days.map(d => DAY_ABBR[d] ?? d).join(', ')
    : 'No schedule'

  return (
    <div className="relative rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-zinc-950 truncate">{playbook.name}</h3>
            <span className="shrink-0 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">Custom</span>
          </div>

          {playbook.description && (
            <p className="text-xs text-zinc-500 mb-2 line-clamp-1">{playbook.description}</p>
          )}

          {/* Worker sequence */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {(playbook.workers ?? []).map((w, i) => {
              const meta = workerRegistry.find(r => r.slug === w.worker_id)
              return (
                <div key={i} className="flex items-center gap-1">
                  <span className="flex items-center gap-1 rounded-md bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                    <span>{meta?.emoji ?? '🤖'}</span>
                    <span>{meta?.personaName ?? w.worker_id}</span>
                  </span>
                  {i < (playbook.workers.length - 1) && <span className="text-zinc-300 text-xs">→</span>}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>📅 {scheduleLabel}</span>
            <span>💳 {costLabel} per run</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onDeploy(playbook)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Deploy →
          </button>
          {/* Edit/Delete menu — owner-only (R14 routes) */}
          {onEdit && onDelete && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 w-32 rounded-xl border border-zinc-100 bg-white py-1 shadow-lg" onMouseLeave={() => setMenuOpen(false)}>
                  <button onClick={() => { setMenuOpen(false); onEdit(playbook) }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50">Edit</button>
                  {!confirming
                    ? <button onClick={() => setConfirming(true)} className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50">Delete</button>
                    : <button onClick={() => { setMenuOpen(false); setConfirming(false); onDelete(playbook.id) }} className="w-full px-3 py-1.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Confirm delete</button>
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyPlaybooksTab({ onUsePlaybook, isOwner = null }) {
  const { showToast } = useToast()
  const [playbooks, setPlaybooks] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    agentFetch('/api/custom-playbooks')
      .then(r => r.json())
      .then(data => { setPlaybooks(data.playbooks ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDeploy = (playbook) => {
    // Convert to preset format for ChainBuilder
    onUsePlaybook({
      name: playbook.name,
      workers: playbook.workers,
      default_schedule_days: playbook.schedule_days,
    })
  }

  const handleEdit = (playbook) => {
    onUsePlaybook({
      name: playbook.name,
      workers: playbook.workers,
      default_schedule_days: playbook.schedule_days,
      _editPlaybookId: playbook.id,
    })
  }

  const handleDelete = async (id) => {
    await agentFetch(`/api/custom-playbooks/${id}`, { method: 'DELETE' })
    setPlaybooks(prev => prev.filter(p => p.id !== id))
    showToast({ title: 'Playbook deleted', variant: 'success' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
      </div>
    )
  }

  return (
    <div>

      {playbooks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-14 text-center">
          <p className="text-base font-semibold text-zinc-700 mb-1">No custom playbooks yet</p>
          <p className="text-sm text-zinc-500">Build a chain and click "Save as Playbook" to save it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {playbooks.map(p => (
            <PlaybookCard
              key={p.id}
              playbook={p}
              onDeploy={handleDeploy}
              onEdit={isOwner === true ? handleEdit : undefined}
              onDelete={isOwner === true ? handleDelete : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
