// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ArrowRight, Calendar, Clock, Coins, History } from 'lucide-react'
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid'
import RunOutputModal from '@/components/agent-mode/RunOutputModal'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Badge } from '@/components/badge'
import ChainCard, { ChainCardSkeleton } from '@/components/agent-mode/ChainCard'
import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'

const STATUS_ICONS = {
  completed: '✅',
  partial: '⚠️',
  failed: '❌',
  running: '⏳',
  pending_rescue: '🔄',
}

const STATUS_STYLES = {
  completed: { bg: 'bg-[#ECFDF3]', border: "border border-[#ABEFC6]", text: 'text-[#067647]', label: 'Success' },
  failed: { bg: 'bg-red-50', border: "border border-red-200", text: 'text-red-700', label: 'Failed' },
  running: { bg: 'bg-blue-50', border: "border border-blue-200", text: 'text-blue-700', label: 'Running' },
  partial: { bg: 'bg-amber-50', border: "border border-amber-200", text: 'text-amber-700', label: 'Partial' },
  pending_rescue: { bg: 'bg-purple-50', border: "border border-purple-200", text: 'text-purple-700', label: 'Pending Rescue' },
}

const FILTERS = ['All', 'Completed', 'Failed', 'This Week', 'This Month']

export default function ChainHistory() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [selectedRun, setSelectedRun] = useState(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const loadRuns = async (pg = 1) => {
    setLoading(true)

    const statusParam =
      filter === 'Completed'
        ? '&status=completed'
        : filter === 'Failed'
          ? '&status=failed'
          : ''

    const timeframeParam =
      filter === 'This Week'
        ? '&timeframe=week'
        : filter === 'This Month'
          ? '&timeframe=month'
          : ''

    try {
      const res = await agentFetch(
        `/api/agent-mode/runs?page=${pg}${statusParam}${timeframeParam}`
      )

      if (!res.ok) return

      const data = await res.json()

      let items = data.runs ?? []

      setRuns(prev => (pg === 1 ? items : [...prev, ...items]))
    } catch (err) {
      console.error(err)
    }

    setLoading(false)
  }

  useEffect(() => {
    setPage(1)
    loadRuns(1)
  }, [filter])

  const openRunDetail = async (runId: string) => {
    try {
      const res = await agentFetch(`/api/agent-mode/runs/${runId}`)

      if (!res.ok) return

      const data = await res.json()

      if (data.run) {
        setSelectedRun(data.run)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const formatDate = (iso: string) => {
    if (!iso) return ''

    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatTime = (iso: string) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatRunDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
    const day = d.toLocaleDateString('en-US', { day: 'numeric' })
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    const year = d.toLocaleDateString('en-US', { year: 'numeric' })
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${weekday} ${day} ${month} ${year}, ${time}`
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      {/* <div>
        <Subheading className="text-2xl! text-zinc-800! hidden sm:flex">
          My Activity
        </Subheading>

        <Text className="sm:mt-1 text-neutral-500!">
          Track and manage all your submitted tasks in one place.
        </Text>
      </div> */}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <Badge
            key={f}
            color="zinc"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full! text-xs sm:text-sm font-medium cursor-pointer transition-colors ${filter === f
              ? 'bg-blue-500! text-white!'
              : 'bg-white! text-[#181818]! border! border-zinc-200! hover:bg-zinc-100!'
              }`}
          >
            {f}
          </Badge>
        ))}
      </div>

      {/* Loading */}
      {loading && runs.length === 0 ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <ChainCardSkeleton key={i} />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
          <p className="text-base font-semibold text-zinc-700">
            No activity found
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Run a chain to see activity here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map(run => {
            const chain = {
              id: run.id,
              name: run.agent_mode_chains?.name ?? 'Chain',
              status: run.status,
              schedule_days: run.agent_mode_chains?.schedule_days ?? [],

              workers:
                run.worker_results?.map(worker => ({
                  worker_id: worker.worker_id,
                })) ?? [],

              // activity-specific fields
              started_at: run.started_at,
              total_light_consumed: run.total_light_consumed,
              total_heavy_consumed: run.total_heavy_consumed,
              total_light_refunded: run.total_light_refunded,
              total_heavy_refunded: run.total_heavy_refunded,
            }

            return (
              <ChainCard
                key={run.id}
                chain={chain}
                isActivity
                onViewOutputs={() => openRunDetail(run.id)}
              />
            )
          })}

          {/* Load More */}
          {runs.length >= page * 20 && (
            <button
              onClick={() => {
                const nextPage = page + 1
                setPage(nextPage)
                loadRuns(nextPage)
              }}
              className="w-full py-3 text-sm font-medium text-zinc-500 hover:text-zinc-700"
            >
              Load More
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {selectedRun && (
        <RunOutputModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </section>
  )
}