'use client'

import { useState, useMemo, useEffect } from 'react'
import type { MouseEvent } from 'react'
import Image from 'next/image'
import { X, Search, Coins, ArrowLeft, ArrowRight, CopyCheck, Pin, Check } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip';

import { Dialog, DialogTitle } from '@/components/dialog'
import { Pagination } from '@/components/pagination'
import { Badge } from '@/components/badge'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { Loader } from '../loader'

import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { getWorkerPromptConfig } from '@/lib/workers/configs'
import { createClient } from '@/lib/supabase/client'
import { useWorkerTaskCounts } from '@/lib/hooks/useWorkerTaskCounts'


const ITEMS_PER_PAGE = 9

interface WorkerPickerProps {
  onSelect: (slug: string) => void
  title?: string
  onClose: () => void
  open: boolean
  isLoading?: boolean
  onlyChainCompatible?: boolean
  existingWorkers?: any[]
}

export function WorkerCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-100 overflow-hidden text-left">
      <div className="bg-white rounded-b-xl px-4 py-5 border-b border-zinc-200">
        <div className="flex items-center gap-3 shrink-0 relative">
          {/* Avatar Skeleton */}
          <Skeleton className="size-16 rounded-full shrink-0" />

          <div className="min-w-0 flex-1 space-y-2">
            {/* Persona Name Skeleton */}
            <Skeleton className="h-5 w-24 rounded" />
            {/* Name/Role Skeleton */}
            <Skeleton className="h-4 w-36 rounded" />
          </div>
        </div>

        {/* Description Skeleton */}
        <div className="mt-3.5 space-y-2">
          <Skeleton className="h-3.5 w-full rounded" />
        </div>
      </div>

      {/* Bottom section (Badge + Stats) */}
      <div className="flex items-center justify-between shrink-0 px-4 py-2 bg-zinc-100">
        {/* Badge Skeleton */}
        <Skeleton className="h-5 w-16 rounded" />

        {/* Stats Skeletons */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-6 rounded" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-6 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WorkerPicker({
  onSelect,
  title = "Add Members",
  onClose,
  open,
  isLoading = false,
  onlyChainCompatible = false,
  existingWorkers = [],
}: WorkerPickerProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pinnedSlugs, setPinnedSlugs] = useState<Set<string>>(new Set())
  const [pinningSlugs, setPinningSlugs] = useState<Set<string>>(new Set())
  const { counts: workerTaskCounts, loading: workerTaskCountsLoading } = useWorkerTaskCounts()

  const categoriesList = useMemo(() => {
    const list = workerRegistry.filter(w => {
      if (!w.active) return false
      if (onlyChainCompatible) {
        if (w.chainCompatible === false) return false
        if (!getWorkerPromptConfig(w.slug)) return false
      }
      return true
    })
    return [
      'All',
      ...Array.from(new Set(list.map(w => w.category))).sort()
    ]
  }, [onlyChainCompatible])

  useEffect(() => {
    if (!open) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      supabase
        .from('pinned_workers')
        .select('worker_slug')
        .eq('user_id', user.id)
        .then(({ data }) => {
          if (data) {
            setPinnedSlugs(new Set(data.map((p: { worker_slug: string }) => p.worker_slug)))
          }
        })
    })
  }, [open])

  const togglePin = async (slug: string, e: MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    if (pinningSlugs.has(slug)) return

    setPinningSlugs(prev => new Set(prev).add(slug))

    const isPinned = pinnedSlugs.has(slug)

    try {
      const res = await agentFetch('/api/pin-worker', {
        method: 'POST',
        body: JSON.stringify({ workerSlug: slug, action: isPinned ? 'unpin' : 'pin' }),
      })
      if (res.ok) {
        setPinnedSlugs(prev => {
          const next = new Set(prev)
          if (isPinned) {
            next.delete(slug)
          } else {
            next.add(slug)
          }
          return next
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPinningSlugs(prev => {
        const next = new Set(prev)
        next.delete(slug)
        return next
      })
    }
  }

  const filtered = useMemo(() => {
    return workerRegistry.filter(w => {
      if (!w.active) return false
      if (onlyChainCompatible) {
        if (w.chainCompatible === false) return false
        if (!getWorkerPromptConfig(w.slug)) return false
      }
      const matchesSearch = !search ||
        w.personaName.toLowerCase().includes(search.toLowerCase()) ||
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.description.toLowerCase().includes(search.toLowerCase())

      const matchesCat = category === 'All' || w.category === category

      return matchesSearch && matchesCat
    })
  }, [search, category, onlyChainCompatible])

  const sortedWorkersList = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aPinned = pinnedSlugs.has(a.slug) ? 0 : 1
      const bPinned = pinnedSlugs.has(b.slug) ? 0 : 1
      if (aPinned !== bPinned) return aPinned - bPinned
      const aName = (a.personaName || a.name || '').toLowerCase()
      const bName = (b.personaName || b.name || '').toLowerCase()
      return aName.localeCompare(bName)
    })
  }, [filtered, pinnedSlugs])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)

  const sortedWorkers = useMemo(() => {
    return sortedWorkersList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  }, [sortedWorkersList, currentPage])

  const handleSelect = (slug: string) => {
    onSelect(slug)
  }

  const pickerLoading = isLoading || workerTaskCountsLoading

  return (
    <Dialog className='max-sm:w-[95%] sm:min-w-[85%] lg:min-w-[80%] 2xl:min-w-[66%] overflow-hidden p-0! h-[89.3vh]' open={open} onClose={onClose}>
      <div className="flex flex-col h-full bg-[#F5F5F5] sm:bg-white">
        {/* Header */}
        <div className="items-center justify-between px-6 py-3 bg-zinc-50 border-b border-zinc-100 shrink-0 sticky top-0 left-0 z-10 hidden sm:flex">
          <DialogTitle className="text-lg font-bold text-zinc-950">{title}</DialogTitle>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className='flex flex-col flex-1 min-h-0 overflow-y-auto'>
          <div className='flex flex-col p-2.5 md:py-5 md:px-6'>
            {/* Scrollable Content Container */}
            <div className="min-h-0">
              {/* Search container */}
              <div className="sm:bg-zinc-50 sm:border sm:border-zinc-200/60 sm:rounded-xl sm:p-2.5 mb-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search workers - leads..."
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value)
                      setCurrentPage(1)
                      setSelectedSlug(null)
                    }}
                    autoFocus
                    className="w-full rounded-lg border border-zinc-200 bg-white h-10 py-2 pl-9 pr-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-none mt-2.5">
                  {pickerLoading ? (
                    [44, 76, 116, 150, 126, 100, 156, 134].map((width, idx) => (
                      <Skeleton
                        key={idx}
                        className="h-8 rounded-full shrink-0"
                        style={{ width: `${width}px` }}
                      />
                    ))
                  ) : (
                    categoriesList.map(cat => (
                      <Badge
                        color="zinc"
                        key={cat}
                        onClick={() => {
                          setCategory(cat)
                          setCurrentPage(1)
                          setSelectedSlug(null)
                        }}
                        className={`px-4 py-1.5 rounded-full! text-sm font-medium transition-colors cursor-pointer text-nowrap! ${category === cat
                          ? 'bg-blue-500! text-white!'
                          : 'text-[#181818]! bg-white! hover:bg-zinc-100! border! border-zinc-200!'
                          }`}
                      >
                        {cat}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Section Header */}
              <div className="flex items-center gap-2 mb-8 shrink-0">
                <span className="size-3 bg-blue-500" />
                <span className="text-xs font-normal text-zinc-500 uppercase">All Team Members</span>
              </div>

              {/* Worker Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pickerLoading ? (
                  Array.from({ length: ITEMS_PER_PAGE }).map((_, idx) => (
                    <WorkerCardSkeleton key={idx} />
                  ))
                ) : (
                  sortedWorkers.map(worker => {
                    const modeCreditValues = worker.modeCredits ? Object.values(worker.modeCredits) : []
                    const creditCost = modeCreditValues.length > 0
                      ? Math.min(...modeCreditValues)
                      : (worker.creditCost ?? (worker.taskType === 'heavy' ? 1 : 0))
                    const isHeavy = creditCost > 0
                    const persona = worker.personaName
                    const avatarSrc = `/images/marketing/workers-figma/${persona.toLowerCase()}.png`
                    const isSelected = selectedSlug === worker.slug
                    const isPinned = pinnedSlugs.has(worker.slug)
                    const completedTaskCount = workerTaskCounts[worker.slug] ?? 0
                    const isAlreadyInWorkflow = existingWorkers.some((w: any) => w.worker_id === worker.slug)

                    return (
                      <div
                        key={worker.slug}
                        onClick={() => {
                          if (isAlreadyInWorkflow) return
                          setSelectedSlug(worker.slug)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          if (isAlreadyInWorkflow) return
                          handleSelect(worker.slug)
                        }}
                        className={`relative rounded-xl border overflow-hidden transition-all text-left group ${isAlreadyInWorkflow
                          ? 'border-blue-500 bg-blue-50/40 cursor-not-allowed opacity-90'
                          : isPinned
                            ? 'bg-blue-500 border-blue-500 shadow-xs hover:border-blue-500 hover:shadow-md cursor-pointer'
                            : 'bg-zinc-100 border-zinc-200 hover:border-blue-500 hover:shadow-md cursor-pointer'
                          } ${isSelected && !isAlreadyInWorkflow ? 'border border-blue-500 shadow-xs' : ''}
                          `}
                      >
                        <div className={`rounded-b-xl px-4 py-5 border-b transition-colors ${isAlreadyInWorkflow ? 'bg-blue-50/5 border-blue-100/20' : 'bg-white border-zinc-200'
                          }`}>
                          <div className="flex items-center gap-3 shrink-0 relative">
                            <div onClick={(e) => !isAlreadyInWorkflow && togglePin(worker.slug, e)} className={`absolute -top-3 -right-2 shadow-xs size-8 xl:size-11 rounded-xl flex items-center justify-center transition-all
    ${isAlreadyInWorkflow ? 'pointer-events-none opacity-0' : isPinned ? 'opacity-100 border border-blue-500 text-blue-500'
                                : pinningSlugs.has(worker.slug) ? 'opacity-100 bg-white border border-zinc-300'
                                  : 'xl:opacity-0 xl:group-hover:opacity-100 bg-white border border-zinc-300'
                              }`}>
                              {pinningSlugs.has(worker.slug) ? (
                                <Loader size={4} className="!size-4 text-blue-500" />
                              ) : (
                                <Pin
                                  className={`size-4 transition-all
        ${isPinned ? 'text-blue-500' : 'text-zinc-700 rotate-45'}`}
                                />
                              )}
                            </div>

                            {/* Avatar container with status badge overlay */}
                            <div className="relative shrink-0">
                              <Image
                                src={avatarSrc}
                                alt={persona}
                                width={64}
                                height={64}
                                className="size-16 rounded-full object-cover bg-zinc-50 border border-zinc-200"
                                onError={(e) => {
                                  e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="22" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="18" fill="%23717680">🤖</text></svg>`
                                }}
                              />
                              {((isSelected && !isAlreadyInWorkflow) || isAlreadyInWorkflow) && (
                                <div className={`absolute -top-1.5 -left-1.5 bg-blue-500 text-white rounded-full p-0.5 shadow-sm z-20 flex items-center justify-center border-2 border-white size-5.5`}>
                                  <Check className="size-3" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-lg font-semibold text-blue-500 group-hover:text-blue-700 transition-colors truncate">
                                {persona}
                              </p>
                              <p className="text-base text-zinc-950 font-normal truncate">
                                {worker.name}
                              </p>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-zinc-500 leading-relaxed truncate line-clamp-1 mt-3 flex-1">
                            {worker.description}
                          </p>
                        </div>

                        {/* Bottom section (Badge + Stats) */}
                        {
                          isAlreadyInWorkflow ? (
                            <div className="flex items-center justify-between shrink-0 px-4 py-2 bg-blue-50/10 border-t border-blue-100/20">
                              <Badge className='bg-blue-50! border border-blue-200! text-xs! text-blue-700!'>
                                Added
                              </Badge>
                              <span className="text-xs text-blue-600 font-medium">Already in workflow</span>
                            </div>
                          ) : isPinned ? (
                            <>
                              <div className="flex items-center justify-between shrink-0 px-4 py-2">
                                <p className='text-white text-xs font-normal'>Work with {persona || worker.name}</p>
                                <ArrowRight className='text-white text-lg' />
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between shrink-0 px-4 py-2">
                              {/* Badge */}
                              <Badge className='bg-white! border border-zinc-300! text-xs! text-zinc-700!'>
                                {isHeavy ? 'PRO+' : 'Popular'}
                              </Badge>

                              {/* Stats */}
                              <div className="flex items-center gap-2.5">
                                {/* Workspace completed task count */}
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
                                          {persona} completed {completedTaskCount} {completedTaskCount === 1 ? 'task' : 'tasks'} in this workspace
                                          <Tooltip.Arrow className="tooltip-arrow" />
                                        </Tooltip.Content>
                                      </Tooltip.Portal>
                                    </Tooltip.Root>
                                  )}

                                  {/* Credit Cost with tooltip */}
                                  {isHeavy && <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                      <div className="flex items-center gap-1 text-zinc-400">
                                        <Coins className="size-4 text-zinc-400" />
                                        <span className="text-sm font-normal text-zinc-500">
                                          {creditCost}
                                        </span>
                                      </div>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                      <Tooltip.Content side='bottom' align='center'
                                        className="bg-gray-800 text-white px-3 py-2 rounded-md text-sm z-[999]"
                                        sideOffset={5}
                                      >
                                        Require {creditCost} heavy credits
                                        <Tooltip.Arrow className="fill-gray-800" />
                                      </Tooltip.Content>
                                    </Tooltip.Portal>
                                  </Tooltip.Root>}
                                </Tooltip.Provider>
                              </div>
                            </div>
                          )
                        }
                      </div>
                    )
                  })
                )}
                {!pickerLoading && filtered.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 py-12 text-center text-sm text-zinc-400">
                    No team members match your search.
                  </div>
                )}
              </div>
            </div>

            {/* Pagination Row */}
            {!pickerLoading && totalPages > 1 && (
              <div className="flex items-center justify-between md:px-1 pt-5 shrink-0">
                <Button
                  variant='outline'
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="border-0 bg-white hover:bg-transparent hover:text-blue-500 disabled:bg-white disabled:hover:bg-white"
                >
                  <span><ArrowLeft className="sm:mr-1 size-3.5" /></span>
                  <span className='hidden sm:flex'>Previous</span>
                </Button>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page: number) => {
                    setCurrentPage(page)
                    setSelectedSlug(null)
                  }}
                  className='justify-center!'
                />

                <Button
                  variant='outline'
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="border-0 bg-white hover:bg-transparent hover:text-blue-500"
                >
                  <span className='hidden sm:flex'>Next</span>
                  <span><ArrowRight className="sm:ml-1 size-3.5" /></span>
                </Button>
              </div>
            )}

            {/* Action Footer */}
          </div>
        </div>
        <div className="flex items-center bg-zinc-50 justify-between p-5 border-t border-zinc-200 shrink-0">
          <Button variant="outline" onClick={onClose} className="bg-white">
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={pickerLoading || !selectedSlug || existingWorkers.some((w: any) => w.worker_id === selectedSlug)}
            onClick={() => selectedSlug && handleSelect(selectedSlug)}
          >
            Next <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
