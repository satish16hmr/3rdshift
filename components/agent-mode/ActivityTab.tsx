// @ts-nocheck
'use client'
import { agentFetch } from '@/lib/agent-mode/api'
import RunOutputModal from '@/components/agent-mode/RunOutputModal'

import { useState, useEffect } from 'react'
import { workers as workerRegistry } from '@/lib/workers/registry'

const STATUS_ICONS = {
  completed:      '✅',
  partial:        '⚠️',
  failed:         '❌',
  running:        '⏳',
  pending_rescue: '🔄',
}

const FILTERS = ['All', 'Completed', 'Failed', 'This Week', 'This Month']

function WorkerStatusIcon({ status }) {
  if (status === 'completed') return <span className="text-emerald-500 text-xs">✓</span>
  if (status === 'failed')    return <span className="text-red-500 text-xs">✗</span>
  if (status === 'skipped')   return <span className="text-zinc-400 text-xs">–</span>
  return null
}

export default function ActivityTab() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [selectedRun, setSelectedRun] = useState(null)

  const loadRuns = async (pg = 1) => {
    setLoading(true)
    const statusParam = filter === 'Completed' ? '&status=completed'
      : filter === 'Failed' ? '&status=failed'
      : ''
    const timeframeParam = filter === 'This Week' ? '&timeframe=week'
      : filter === 'This Month' ? '&timeframe=month'
      : ''
    try {
      const res = await agentFetch(`/api/agent-mode/runs?page=${pg}${statusParam}${timeframeParam}`)
      const data = await res.json()
      let items = data.runs ?? []

      setRuns(prev => pg === 1 ? items : [...prev, ...items])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { setPage(1); loadRuns(1) }, [filter])

  const openRunDetail = async (runId) => {
    const res = await agentFetch(`/api/agent-mode/runs/${runId}`)
    const data = await res.json()
    if (data.run) setSelectedRun(data.run)
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-1.5 mb-5">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && runs.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
        </div>
      ) : runs.length === 0 ? (
        <div className="py-12 text-center text-sm text-zinc-400">No runs yet. Activate a chain and run it to see activity here.</div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => {
            const workerResults = run.worker_results ?? []
            return (
              <div key={run.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span>{STATUS_ICONS[run.status] ?? '⏳'}</span>
                      <p className="text-sm font-semibold text-zinc-950">{run.agent_mode_chains?.name ?? 'Chain'}</p>
                      <span className="text-xs text-zinc-400">{run.trigger_type}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-2">{formatDate(run.started_at)}</p>

                    {/* Worker status row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {workerResults.map((w, i) => {
                        const meta = workerRegistry.find(r => r.slug === w.worker_id)
                        return (
                          <div key={i} className="flex items-center gap-0.5">
                            <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] border ${
                              w.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                              : w.status === 'failed' ? 'bg-red-50 border-red-100 text-red-700'
                              : 'bg-zinc-50 border-zinc-100 text-zinc-400'
                            }`}>
                              {meta?.emoji ?? '🤖'} {meta?.personaName ?? w.worker_id}
                            </span>
                            {i < workerResults.length - 1 && <span className="text-zinc-200 text-[10px]">→</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* Credits */}
                    {(run.total_light_consumed > 0 || run.total_heavy_consumed > 0) && (
                      <p className="text-[10px] text-zinc-400 mt-1.5">
                        Credits used: {[
                          run.total_light_consumed > 0 ? `${run.total_light_consumed} light` : null,
                          run.total_heavy_consumed > 0 ? `${run.total_heavy_consumed} heavy` : null,
                        ].filter(Boolean).join(' + ')}
                        {run.total_light_refunded + run.total_heavy_refunded > 0 && (
                          <span className="text-emerald-600 ml-1">
                            ({[
                              run.total_light_refunded > 0 ? `${run.total_light_refunded} light` : null,
                              run.total_heavy_refunded > 0 ? `${run.total_heavy_refunded} heavy` : null,
                            ].filter(Boolean).join(' + ')} refunded)
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => openRunDetail(run.id)}
                    className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    View Outputs
                  </button>
                </div>
              </div>
            )
          })}

          {/* Load more */}
          {runs.length >= page * 20 && (
            <button
              onClick={() => { setPage(p => p + 1); loadRuns(page + 1) }}
              className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700"
            >
              Load more
            </button>
          )}
        </div>
      )}

      {/* Output modal */}
      {selectedRun && (
        <RunOutputModal run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </div>
  )
}
