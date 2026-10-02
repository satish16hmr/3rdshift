// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { Badge } from '@/components/badge'

const STATUS_STYLES = {
  completed: { bg: 'bg-[#ECFDF3]', border: 'border-[#ABEFC6]', text: 'text-[#067647]', label: 'Completed', icon: CheckCircle2 },
  failed:    { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',    label: 'Failed',    icon: XCircle },
  running:   { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',   label: 'Running',   icon: Loader2 },
  partial:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',  label: 'Partial',   icon: AlertTriangle },
  queued:    { bg: 'bg-zinc-50',    border: 'border-zinc-200',   text: 'text-zinc-500',   label: 'Queued',    icon: Clock },
  pending_rescue: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', label: 'Retrying', icon: Loader2 },
}

const FILTERS = ['All', 'Completed', 'Running', 'Failed']

export default function RunsListPage() {
  const router = useRouter()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)

  const loadRuns = useCallback(async (pg = 1) => {
    setLoading(true)
    const statusParam = filter === 'Completed' ? '&status=completed'
      : filter === 'Running' ? '&status=running'
      : filter === 'Failed' ? '&status=failed'
      : ''
    try {
      const res = await agentFetch(`/api/agent-mode/runs?page=${pg}${statusParam}`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setRuns(prev => pg === 1 ? (data.runs ?? []) : [...prev, ...(data.runs ?? [])])
    } catch {}
    setLoading(false)
  }, [filter])

  useEffect(() => { setPage(1); loadRuns(1) }, [filter, loadRuns])

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="max-w-[996px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/dashboard/agent-mode')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Activity</h1>
          <p className="text-xs text-zinc-500">All workflow runs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-5">
        {FILTERS.map(f => (
          <Badge
            key={f}
            color="zinc"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full! text-xs sm:text-sm font-medium cursor-pointer transition-colors ${
              filter === f
                ? 'bg-blue-500! text-white!'
                : 'bg-white! text-[#181818]! border! border-zinc-200! hover:bg-zinc-100!'
            }`}
          >
            {f}
          </Badge>
        ))}
      </div>

      {/* Run list */}
      {loading && runs.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
          <p className="text-base font-semibold text-zinc-700">No runs yet</p>
          <p className="mt-1 text-sm text-zinc-500">Run a workflow to see activity here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => {
            const workerResults = run.worker_results ?? []
            const statusStyle = STATUS_STYLES[run.status] ?? STATUS_STYLES.queued
            const StatusIcon = statusStyle.icon

            return (
              <button
                key={run.id}
                onClick={() => router.push(`/dashboard/agent-mode/runs/${run.id}`)}
                className="w-full text-left rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-semibold text-zinc-950 truncate">{run.agent_mode_chains?.name ?? 'Workflow'}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}>
                        <StatusIcon className={`size-3 ${run.status === 'running' || run.status === 'pending_rescue' ? 'animate-spin' : ''}`} />
                        {statusStyle.label}
                      </span>
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
                        Credits: {[
                          run.total_light_consumed > 0 ? `${run.total_light_consumed} light` : null,
                          run.total_heavy_consumed > 0 ? `${run.total_heavy_consumed} heavy` : null,
                        ].filter(Boolean).join(' + ')}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="size-4 text-zinc-400 shrink-0 mt-1" />
                </div>
              </button>
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
    </div>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  )
}
