// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from '@heroicons/react/20/solid'

import ChainBuilder from '@/components/agent-mode/ChainBuilder'
import ChainCard, { ChainCardSkeleton } from '@/components/agent-mode/ChainCard'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import ChainHistory from '@/components/agent-mode/ChainHistory'
import { useToast } from '@/components/toast-provider'

import { agentFetch } from '@/lib/agent-mode/api'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { createClient } from '@/lib/supabase/client'


const STATUS_FILTERS = ['All', 'Active', 'Paused', 'Draft', 'History',] as const
type StatusFilter = typeof STATUS_FILTERS[number]

export default function MyChainPage() {
  const router = useRouter();
  const { showToast } = useToast()

  const [chains, setChains] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingChain, setEditingChain] = useState(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const { plan: userPlan } = useWorkspacePlan()
  const [isOwner, setIsOwner] = useState(null)

  const loadChains = useCallback(async () => {
    try {
      const res = await agentFetch('/api/agent-mode/chains')
      if (!res.ok) return
      const data = await res.json()
      setChains(data.chains ?? [])
    } catch { }
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        fetch('/api/workspace', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
          .then(r => r.json())
          .then(d => { if (d.userRole) setIsOwner(d.userRole === 'owner') })
          .catch(() => { })
      }
    })
    loadChains()
  }, [loadChains])

  const activeChainCount = chains.filter(c => c.status === 'active' || c.status === 'paused').length

  const filteredChains = statusFilter === 'History' ? []
    : chains.filter(chain => {
      if (statusFilter === 'All') return true
      if (statusFilter === 'Draft') return chain.status === 'inactive'

      return (
        chain.status?.toLowerCase() ===
        statusFilter.toLowerCase()
      )
    })

  const handleChainSaved = (chain) => {
    setShowBuilder(false)
    setEditingChain(null)
    loadChains()
    showToast({ title: 'Workflow saved successfully', variant: 'success' })
  }

  const handleRunNow = async (chainId: string) => {
    try {
      const res = await agentFetch(`/api/agent-mode/chains/${chainId}/run`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.runId) {
          router.push(`/dashboard/agent-mode/runs/${data.runId}`)
        } else {
          showToast({ title: 'Workflow started — check History tab for results', variant: 'success' })
          loadChains()
        }
      } else {
        const d = await res.json()
        showToast({ title: d.error ?? 'Failed to start workflow', variant: 'error' })
      }
    } catch {
      showToast({ title: 'Failed to start workflow', variant: 'error' })
    }
  }

  const handlePause = async (chainId: string) => {
    await agentFetch(`/api/agent-mode/chains/${chainId}/pause`, { method: 'POST' })
    loadChains()
  }

  const handleResume = async (chainId: string) => {
    await agentFetch(`/api/agent-mode/chains/${chainId}/resume`, { method: 'POST' })
    loadChains()
  }

  const handleDelete = async (chainId: string) => {
    await agentFetch(`/api/agent-mode/chains/${chainId}`, { method: 'DELETE' })
    loadChains()
    showToast({ title: 'Workflow deleted', variant: 'success' })
  }

  if (showBuilder) {
    return (
      <ChainBuilder
        chain={editingChain}
        isEditing={!!editingChain}
        presetToLoad={null}
        onSaved={handleChainSaved}
        onCancel={() => { setShowBuilder(false); setEditingChain(null) }}
        userPlan={userPlan}
        onSaveAsPlaybook={undefined}
      />
    )
  }



  return (
    <section className="space-y-5 sm:space-y-6 md:space-y-7 lg:space-y-8">

      {/* Page Header */}
      <div>
        <Subheading className="text-2xl! text-zinc-800! hidden sm:flex">Workflows</Subheading>
        <Text className="sm:mt-1 text-neutral-500!">
          Track and manage all your submitted tasks in one place.
        </Text>
      </div>

      {/* Filter Tabs + Slots counter row */}
      <div className="space-y-5 sm:space-y-6 md:space-y-7 lg:space-y-8">
        {/* Status filter tabs */}
        <div className="flex items-center gap-2 w-full overflow-auto">
          {STATUS_FILTERS.map(filter => (
            <Badge
              color="zinc"
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-2 rounded-full! text-xs sm:text-sm font-medium transition-colors cursor-pointer ${statusFilter === filter
                ? 'bg-blue-500! text-white!'
                : 'text-[#181818]! bg-white! hover:bg-zinc-100! border! border-zinc-200!'
                }`}
            >
              {filter}
            </Badge>
          ))}
        </div>

        {/* Slots counter + New Workflow button */}
        <div className="flex items-center gap-4">
          <div className="w-full sm:flex items-center gap-3 space-y-3 sm:space-y-0">
            <div className="flex-1 w-full h-2 bg-[#E9EAEB] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (activeChainCount / 10) * 100)}%` }}
              />
            </div>
            <span className="text-sm text-zinc-400"><span className='font-semibold text-zinc-950'>{activeChainCount}</span> of 10 workflows active</span>
          </div>

          {/* {isOwner === true && (
            <Button
              onClick={() => {
                if (activeChainCount >= 10) {
                  showToast('10/10 slots used — delete or deactivate a workflow first', 'error')
                  return
                }
                setShowBuilder(true)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
              disabled={activeChainCount >= 10}
              title={activeChainCount >= 10 ? '10/10 slots used' : ''}
            >
              <PlusIcon className="size-4" />
              New Workflow
            </Button>
          )} */}
        </div>
      </div>

      {/* Chain List */}
      {statusFilter === 'History' ? (
        <ChainHistory />
      ) : loading || isOwner === null ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <ChainCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredChains.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
          <p className="text-base font-semibold text-zinc-700 mb-1">
            {statusFilter === 'All'
              ? 'No workflows yet'
              : `No ${statusFilter.toLowerCase()} workflows`}
          </p>

          <p className="text-sm text-zinc-500 mb-4">
            {statusFilter === 'All'
              ? 'Build your first workflow to get started.'
              : `You have no workflows with "${statusFilter}" status.`}
          </p>

          {statusFilter === 'All' && isOwner === true && (
            <button
              onClick={() => setShowBuilder(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 cursor-pointer"
            >
              Build Custom Workflow
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredChains.map(chain => (
            <ChainCard
              key={chain.id}
              chain={chain}
              onEdit={() => {
                setEditingChain(chain)
                setShowBuilder(true)
              }}
              onRunNow={() => handleRunNow(chain.id)}
              onPause={() => handlePause(chain.id)}
              onResume={() => handleResume(chain.id)}
              onDelete={() => handleDelete(chain.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}