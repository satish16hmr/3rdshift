// @ts-nocheck
'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Coins, CopyCheck, Pin, Search } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import Link from 'next/link'
import { Heading } from '@/components/heading'
import { Input, InputGroup } from '@/components/input'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import { Badge } from '@/components/badge'
import { Pagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import TeamSearchModal from '@/components/workers/TeamSearchModal'
import { Loader } from '@/components/loader'

import { workers } from '@/lib/workers/registry'
import { getWorkerAvatarSrcBySlug } from '@/lib/worker-avatars'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { useWorkerTaskCounts } from '@/lib/hooks/useWorkerTaskCounts'

const CATEGORIES = [
  'All',
  ...[
    ...new Set(
      workers.filter(w => w.active).map(w => w.category)
    )
  ].sort()
]

const PLAN_LEVEL = { none: 0, starter: 1, pro: 2, operator: 3 }

// ─── Skeleton primitives ──────────────────────────────────────────────────────

function Bone({
  width = '100%',
  height = 12,
  radius = 6,
  className = '',
  style = {},
}: {
  width?: string | number
  height?: number
  radius?: number
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`animate-pulse bg-zinc-200 ${className}`}
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  )
}

function CardSkeleton({ widths = [100, 85, 60] }: { widths?: number[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
      <div className="px-4 py-5 border-b border-zinc-200 bg-white">
        <div className="flex items-start gap-3 mb-3">
          <Bone width={44} height={44} radius={9999} />
          <div className="flex-1 min-w-0 pt-0.5">
            <Bone width="65%" height={14} style={{ marginBottom: 6 }} />
            <Bone width="45%" height={12} />
          </div>
        </div>
        <Bone
          width="100%"
          height={40}
        />
      </div>
      <div className="px-4 py-2.5 flex items-center justify-between">
        <Bone width={72} height={20} radius={9999} />
        <div className="flex items-center gap-2">
          <Bone width={28} height={12} radius={4} />
          <Bone width={36} height={12} radius={4} />
        </div>
      </div>
    </div>
  )
}

function TeamPageSkeleton() {
  const cardVariants: [number, number, number][] = [
    [100, 85, 60], [100, 78, 55], [100, 90, 65], [100, 82, 50],
    [100, 88, 70], [100, 75, 58], [100, 92, 62], [100, 80, 45],
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-7 md:mb-8 lg:mb-10">
        <div>
          <Bone className='hidden lg:flex' width={80} height={28} style={{ marginBottom: 6 }} />
          <Bone width={180} height={20} style={{ marginTop: 4 }} />
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-2.5 mb-10">
        <div className="mb-2 5">
          <Bone width="100%" height={36} radius={8} />
        </div>
        <div className="flex overflow-auto lg:flex-wrap gap-1.5">
          {[36, 80, 90, 76, 100, 84, 110, 112, 68, 78, 88, 90, 54, 110, 112, 68, 78, 88, 90, 54,].map((w, i) => (
            <Bone key={i} width={w} height={34} radius={9999} />
          ))}
        </div>
      </div>

      {/* Recommended section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 my-8">
          <Bone width={16} height={16} radius={2} />
          <Bone width={130} height={16} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-4 gap-2.5">
          {cardVariants.slice(0, 4).map((widths, i) => (
            <CardSkeleton key={i} widths={widths} />
          ))}
        </div>
      </div>

      {/* All team members section */}
      <div className="flex items-center gap-2 my-8">
        <Bone width={16} height={16} radius={2} />
        <Bone width={130} height={16} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-4 gap-2.5">
        {cardVariants.map((widths, i) => (
          <CardSkeleton key={i} widths={widths} />
        ))}
      </div>
    </div>
  )
}

// ─── Existing components ──────────────────────────────────────────────────────

function PinButton({ workerSlug, pinnedSlugs, onToggle }) {
  const isPinned = pinnedSlugs.has(workerSlug)
  const [loading, setLoading] = useState(false)

  const handleClick = async (e) => {
    const supabase = createClient();
    const { data: { session }, } = await supabase.auth.getSession();
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch('/api/pin-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ workerSlug, action: isPinned ? 'unpin' : 'pin' }),
      })
      if (res.ok) onToggle(workerSlug, !isPinned)
    } catch { /* silent */ }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={isPinned ? 'Unpin from My Team' : 'Pin to My Team'}
      className={`flex size-[28px] items-center justify-center rounded-[8px] border transition-colors focus:outline-none cursor-pointer ${isPinned
        ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
        : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600'
        }`}
    >
      {loading ? (
        <Loader size={3} className="!size-3" />
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity={isPinned ? '1' : '.4'}>
          <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
        </svg>
      )}
    </button>
  )
}

function getWorkerTierBadge(worker) {
  if (worker.taskType === 'light') return null
  if (worker.modeCredits) {
    const hasFreeMode = Object.values(worker.modeCredits).some(c => c === 0)
    const hasPaidMode = Object.values(worker.modeCredits).some(c => c > 0)
    if (hasFreeMode && hasPaidMode) return 'mixed'
    if (hasFreeMode) return null
  }
  if (worker.minPlan === 'operator') return 'operator'
  return 'pro'
}

function getCreditDisplay(worker) {
  const tierBadge = getWorkerTierBadge(worker)

  if (worker.taskType === 'heavy' && tierBadge === 'mixed') return { label: 'All plans', tone: 'green' }
  if (worker.taskType === 'heavy' && tierBadge === 'operator') return { label: 'Operator+', tone: 'purple' }
  if (worker.taskType === 'heavy') {
    const cost = worker.modeCredits
      ? Math.max(...Object.values(worker.modeCredits))
      : (worker.creditCost || 3)
    return { label: `${cost} ${cost === 1 ? '' : ''}`, tone: 'zinc' }
  }

  return null
}

function getCardButtonCopy(worker, userPlan, locked, isHeavyLocked) {
  if (locked) return worker.minPlan === 'operator' ? 'Upgrade to Operator →' : 'Upgrade to Pro →'
  if (isHeavyLocked) return 'Upgrade to Pro →'
  return 'Use this team member →'
}

function CreditPill({ display }) {
  if (!display) return null
  const className = display.tone === 'green'
    ? 'border-green-200 bg-green-50 text-green-700'
    : display.tone === 'purple'
      ? 'border-purple-200 bg-purple-50 text-purple-700'
      : 'border-zinc-200 bg-white text-zinc-500'

  return (
    <span className={`inline-flex items-center rounded-[6px] border px-[8px] py-[4px] text-[14px] font-medium ${className}`}>
      {display.label}
    </span>
  )
}

function WorkerCard({ worker, userPlan, planLoading, pinnedSlugs, onPinToggle, completedTaskCount = 0 }) {
  const userLevel = PLAN_LEVEL[userPlan || 'none'] || 0
  const requiredLevel = PLAN_LEVEL[worker.minPlan] || 0
  const locked = !planLoading && userLevel < requiredLevel
  const hasFreeMode = worker.modeCredits && Object.values(worker.modeCredits).some(c => c === 0)
  const isHeavyLocked = !planLoading && !locked && worker.taskType === 'heavy' && !hasFreeMode && (userPlan === 'starter' || userPlan === 'none' || !userPlan)
  const isPinned = pinnedSlugs?.has(worker.slug)
  const avatarSrc = getWorkerAvatarSrcBySlug(worker.slug)
  const creditDisplay = getCreditDisplay(worker)

  return (
    <div className={`relative rounded-xl group border overflow-hidden hover:border-blue-500 hover:shadow-md transition-all text-left cursor-pointer group ${isPinned ? 'bg-blue-500' : 'bg-zinc-100'} ${isPinned ? 'border-blue-500 shadow-xs' : 'border-zinc-200'
      }`}>
      <Link href={`/dashboard/team/${worker.slug}`}>
        <div className='bg-white relative rounded-b-xl px-4 py-5 border-b border-zinc-200'>
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-3 md:gap-5">
              <span className="flex size-12 md:size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E9EAEB] bg-zinc-50">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt={`${worker.personaName || worker.name} avatar`}
                    width={64}
                    height={64}
                    className="object-cover"
                  />
                ) : (
                  <span className="text-[20px] font-bold text-zinc-500">{(worker.personaName || worker.name).charAt(0)}</span>
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm md:text-lg font-semibold text-blue-500 group-hover:text-blue-700 transition-colors truncate">{worker.personaName || worker.name}</p>
                <p className="text-sm md:text-base text-zinc-950 font-normal truncate">{worker.name}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed mt-3 flex-1">
            {worker.description}
          </p>
        </div>

        {isPinned ? (
          <div className="flex items-center justify-between shrink-0 px-4 py-2">
            <p className='text-white text-xs font-normal'>Work with {worker.personaName || worker.name}</p>
            <ArrowRight className='text-white text-base' />
          </div>
        ) : (
          <div className="flex items-center justify-between shrink-0 px-4 py-2">
            <Badge className="bg-white! border border-zinc-300! text-xs! text-zinc-700! max-w-32 overflow-hidden">
              <span className="block truncate">
                {worker.category}
              </span>
            </Badge>
            <div className="flex items-center gap-2.5">
              <Tooltip.Provider>
                {completedTaskCount > 0 && (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <div className="flex items-center gap-1 text-zinc-400">
                        <CopyCheck className="size-4 text-zinc-400" />
                        <span className="text-sm font-normal text-zinc-500">
                          {completedTaskCount}
                        </span>
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content side='bottom' align='center' className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm z-[999]" sideOffset={5}>
                        {worker.personaName} completed {completedTaskCount} {completedTaskCount === 1 ? 'task' : 'tasks'} in this workspace
                        <Tooltip.Arrow className="tooltip-arrow" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                )}

                {creditDisplay?.label && (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Coins className="size-4 text-zinc-400" />
                        <span className="text-sm font-normal text-zinc-500 max-w-[70px] truncate">
                          {creditDisplay.label}
                        </span>
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content side='bottom' align='center' className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm z-[999]" sideOffset={5}>
                        Require {creditDisplay.label} heavy credits
                        <Tooltip.Arrow className="fill-gray-800" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                )}
              </Tooltip.Provider>
            </div>
          </div>
        )}

        {(locked || isHeavyLocked) && (
          <span className="mt-[12px] text-[12px] font-medium text-blue-600">
            {getCardButtonCopy(worker, userPlan, locked, isHeavyLocked)}
          </span>
        )}
      </Link>
      {!locked && !isHeavyLocked && pinnedSlugs && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <PinButton
            workerSlug={worker.slug}
            pinnedSlugs={pinnedSlugs}
            onToggle={onPinToggle}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Team() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(['All'])
  const [browseAll, setBrowseAll] = useState(false)
  const { plan: userPlan, loading: planLoading } = useWorkspacePlan()
  const { counts: workerTaskCounts, loading: workerTaskCountsLoading } = useWorkerTaskCounts()
  const [pinnedSlugs, setPinnedSlugs] = useState(new Set())
  const [pinnedLoading, setPinnedLoading] = useState(true) // ← NEW
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const ITEMS_PER_PAGE = 16
  const [currentPage, setCurrentPage] = useState(1)
  const isStarterUser = !planLoading && userPlan === 'starter'
  const recommendedMembers = workers.filter(w => w.active).slice(0, 4)

  // Show skeleton until both plan AND pinned workers have resolved
  const isLoading = planLoading || pinnedLoading || workerTaskCountsLoading // ← NEW

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setPinnedLoading(false) // ← no user, nothing to load
        return
      }

      supabase
        .from('pinned_workers')
        .select('worker_slug')
        .eq('user_id', user.id)
        .then(({ data }) => {
          if (data) setPinnedSlugs(new Set(data.map(p => p.worker_slug)))
          setPinnedLoading(false) // ← done loading
        })
    })
  }, [])

  const handlePinToggle = (slug, nowPinned) => {
    setPinnedSlugs(prev => {
      const next = new Set(prev)
      if (nowPinned) next.add(slug)
      else next.delete(slug)
      return next
    })
  }

  const isWorkerAccessibleToStarter = (worker) => {
    if (worker.taskType === 'light') return true
    if (worker.modeCredits && Object.values(worker.modeCredits).some(c => c === 0)) return true
    return false
  }

  const filteredWorkers = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = workers.filter(w => {
      if (!w.active) return false
      if (isStarterUser && !browseAll && !isWorkerAccessibleToStarter(w)) return false
      const matchesSearch = !q || [w.name, w.personaName, w.slug, w.description, w.category]
        .some(s => s?.toLowerCase().includes(q))
      const matchesCategory =
        activeCategory.includes('All') ||
        activeCategory.includes(w.category)
      return matchesSearch && matchesCategory
    })

    return [...filtered].sort((a, b) => {
      const aPinned = pinnedSlugs.has(a.slug) ? 0 : 1
      const bPinned = pinnedSlugs.has(b.slug) ? 0 : 1
      if (aPinned !== bPinned) return aPinned - bPinned
      const aName = (a.personaName || a.name || '').toLowerCase()
      const bName = (b.personaName || b.name || '').toLowerCase()
      return aName.localeCompare(bName)
    })
  }, [search, activeCategory, pinnedSlugs, isStarterUser, browseAll])

  const totalPages = Math.ceil(filteredWorkers.length / ITEMS_PER_PAGE)

  const paginatedWorkers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredWorkers.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredWorkers, currentPage])

  // ── Render skeleton while loading ─────────────────────────────────────────
  if (isLoading) return <TeamPageSkeleton />

  // ── Normal render ─────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
        <div>
          <Heading className='hidden! lg:flex! text-2xl! font-semibold! text-zinc-800!'>Team</Heading>
          <Text className="text-sm! sm:text-base! text-neutral-500! lg:mt-1!">
            {isStarterUser && !browseAll
              ? `${filteredWorkers.length} of 40+ team members on your plan`
              : `${filteredWorkers.length} of ${workers.filter(w => w.active).length} team members`}
          </Text>
        </div>
      </div>

      <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            readOnly
            placeholder="Search workers - leads..."
            onClick={() => setSearchModalOpen(true)}
            className="w-full rounded-lg border border-zinc-200 bg-white h-10 py-2 pl-9 pr-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex lg:flex-wrap gap-2 overflow-x-auto scrollbar-none mt-2.5">
          {CATEGORIES.map((cat) => (
            <Badge
              color="zinc"
              key={cat}
              onClick={() => {
                setActiveCategory(prev => {
                  if (cat === 'All') return ['All']
                  const next = prev.includes(cat)
                    ? prev.filter(c => c !== cat)
                    : [...prev.filter(c => c !== 'All'), cat]
                  return next.length === 0 ? ['All'] : next
                })
                setCurrentPage(1)
              }}
              className={`px-4 py-1.5 rounded-full! text-sm font-medium transition-colors cursor-pointer text-nowrap! ${activeCategory.includes(cat)
                ? 'border border-blue-500! bg-blue-50! text-blue-500!'
                : 'text-[#181818]! bg-white! hover:bg-zinc-100! border! border-zinc-200!'
                }`}
            >
              {cat}
            </Badge>
          ))}
          {isStarterUser && (
            <Button
              onClick={() => setBrowseAll(prev => !prev)}
              className="ml-auto whitespace-nowrap text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              {browseAll ? '← Show only my team' : 'Browse all workers →'}
            </Button>
          )}
        </div>
      </div>

      {/* Recommended For You */}
      <div className="mb-10">
        <div className="flex items-center gap-2 my-8 shrink-0">
          <span className="size-3 bg-blue-500" />
          <span className="text-xs font-normal text-zinc-500 uppercase">RECOMEMMENDED FOR YOU</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-4 gap-2.5">
          {recommendedMembers.map((worker) => (
            <WorkerCard
              key={worker.slug}
              worker={worker}
              userPlan={userPlan}
              planLoading={planLoading}
              pinnedSlugs={pinnedSlugs}
              onPinToggle={handlePinToggle}
              completedTaskCount={workerTaskCounts[worker.slug] ?? 0}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 my-8 shrink-0">
        <span className="size-3 bg-blue-500" />
        <span className="text-xs font-normal text-zinc-500 uppercase">All Team Members</span>
      </div>

      <section className="mt-8">
        {filteredWorkers.length > 0 ? (
          <>
            {pinnedSlugs.size > 0 && !search && activeCategory === 'All' && (
              <div className="mb-3 flex items-center gap-2">
                <span className="size-2 rounded-sm bg-blue-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pinned first</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-4 gap-2.5">
              {paginatedWorkers.map((w) => (
                <WorkerCard
                  key={w.slug}
                  worker={w}
                  userPlan={userPlan}
                  planLoading={planLoading}
                  pinnedSlugs={pinnedSlugs}
                  onPinToggle={handlePinToggle}
                  completedTaskCount={workerTaskCounts[w.slug] ?? 0}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap sm:grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-white sm:px-5">
                <Button
                  variant='link'
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="justify-self-start text-sm font-medium text-zinc-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white disabled:hover:bg-white"
                >
                  <span><ArrowLeft className="sm:mr-1 size-3.5" /></span>
                  <span className='hidden sm:flex'>Previous</span>
                </Button>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  className='justify-center!'
                />

                <Button
                  variant='link'
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="justify-self-end text-sm font-medium text-zinc-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white disabled:hover:bg-white"
                >
                  <span className='hidden sm:flex'>Next</span>
                  <span><ArrowRight className="sm:mr-1 size-3.5" /></span>
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-400">No team members match your search.</p>
            <button
              onClick={() => { setSearch(''); setActiveCategory('All') }}
              className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <TeamSearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        search={search}
        setSearch={setSearch}
        workers={filteredWorkers}
        categories={CATEGORIES}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        loading={pinnedLoading || planLoading}
      />
    </div>
  )
}