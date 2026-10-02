'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Check, MoreVertical, Trash2 } from 'lucide-react'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Skeleton } from '@/components/ui/skeleton'
import { workers as workerRegistry } from '@/lib/workers/registry'

type SavedMemory = {
  id: string | number
  content: string
  created_at?: string
  savedAt?: string
  memory_type?: string
  source?: string
  member_id?: string | null
  member_name?: string
}

type SortOrder = 'newest' | 'oldest'
type OpenMenu = 'sort' | 'actions' | null

const sortOptions: Array<{ label: string; value: SortOrder }> = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
]

const formatSavedDate = (date: string) => {
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'long',
      day: 'numeric',
    }).format(new Date(date))
  } catch {
    return ''
  }
}

function MemorySkeleton() {
  const rowWidths = [
    'w-[78%]',
    'w-[72%]',
    'w-[90%]',
    'w-[64%]',
    'w-[86%]',
    'w-[78%]',
    'w-[72%]',
    'w-[90%]',
    'w-[64%]',
    'w-[86%]',
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white" aria-busy="true">
      <div className="flex h-14 items-center justify-end gap-3 border-b border-zinc-200 px-3 sm:px-6">
        <Skeleton className="size-6 rounded-md bg-zinc-200" />
        <Skeleton className="size-6 rounded-md bg-zinc-200" />
      </div>

      <div className="divide-y divide-zinc-200">
        {rowWidths.map((width, index) => (
          <div key={index} className="px-4 py-4 sm:px-6">
            <Skeleton className={`h-5 max-w-full bg-zinc-100 ${width}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Memory() {
  const [loading, setLoading] = useState(true)
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [memories, setMemories] = useState<SavedMemory[]>([])
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)

  useEffect(() => {
    let active = true
    const loadMemories = async () => {
      try {
        const results = await Promise.all(
          workerRegistry
            .filter(worker => worker.active)
            .map(async worker => {
              const memberId = worker.slug
              const response = await fetch(`/api/chat/memories/${encodeURIComponent(memberId)}`, {
                method: 'GET',
                credentials: 'include',
              })
              if (!response.ok) throw new Error(`Failed to fetch memories for ${memberId}`)
              const payload = await response.json() as {
                member_memories?: SavedMemory[]
                brand_memories?: SavedMemory[]
              }
              return [
                ...(payload.member_memories ?? []).map(memory => ({
                  ...memory,
                  member_id: memory.member_id ?? memberId,
                  member_name: worker.name,
                })),
                ...(payload.brand_memories ?? []).map(memory => ({
                  ...memory,
                  member_id: memory.member_id ?? null,
                  member_name: 'Brand memory',
                })),
              ]
            })
        )

        const deduped = new Map<string | number, SavedMemory>()
        for (const memory of results.flat()) deduped.set(memory.id, memory)
        if (active) setMemories([...deduped.values()])
      } catch (err) {
        console.error('Failed to load memories:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadMemories()

    return () => {
      active = false
    }
  }, [])

  const handleDeleteMemory = async (memory: SavedMemory) => {
    try {
      const memberId = memory.member_id || 'brand'
      const response = await fetch(`/api/chat/memories/${encodeURIComponent(memberId)}?id=${encodeURIComponent(String(memory.id))}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to delete memory')

      setMemories(current => current.filter(currentMemory => currentMemory.id !== memory.id))
    } catch (err) {
      console.error('Failed to delete memory:', err)
    }
  }

  const sortedMemories = useMemo(
    () =>
      [...memories].sort((a, b) => {
        const firstDate = new Date(a.created_at || a.savedAt || 0).getTime()
        const secondDate = new Date(b.created_at || b.savedAt || 0).getTime()

        return sortOrder === 'newest' ? secondDate - firstDate : firstDate - secondDate
      }),
    [memories, sortOrder]
  )

  const selectedMemory = sortedMemories[0]

  return (
    <section className="w-full max-w-[1440px]">
      <div className="mb-5">
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Saved Memories</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Your team members proactively send you ideas, reminders, and alerts in Team chat.
        </Text>
      </div>

      {loading ? (
        <MemorySkeleton />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-end gap-3 border-b border-zinc-200 px-3 h-14 sm:px-6">
            <div
              className="relative"
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenu(null)
              }}
            >
              <button
                type="button"
                aria-label="Sort memories"
                aria-expanded={openMenu === 'sort'}
                onClick={() => setOpenMenu(current => (current === 'sort' ? null : 'sort'))}
                className='cursor-pointer'
              >
                <ArrowUpDown className="size-6" />
              </button>

              {openMenu === "sort" && (
                <div className="absolute right-0 top-full z-30 mt-2 w-48.5 rounded-lg bg-white shadow-lg ring-1 ring-zinc-950/10 p-3">
                  <p className="pb-3 mb-2 text-xs font-semibold text-zinc-950 border-b border-zinc-200">Sort</p>
                  {sortOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSortOrder(option.value)
                        setOpenMenu(null)
                      }}
                      className="flex w-full items-center justify-between gap-3 p-2 text-left text-xs text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer rounded-md"
                    >
                      <span>{option.label}</span>
                      {sortOrder === option.value && <Check className="size-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className="relative"
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenu(null)
              }}
            >
              <button
                type="button"
                aria-label="Memory actions"
                aria-expanded={openMenu === 'actions'}
                onClick={() => setOpenMenu(current => (current === 'actions' ? null : 'actions'))}
                className='cursor-pointer'
              >
                <MoreVertical className="size-6" />
              </button>

              {openMenu === 'actions' && (
                <div className="absolute right-0 top-full z-30 mt-2 w-48.5 rounded-lg bg-white py-2 shadow-lg ring-1 ring-zinc-950/10">
                  <div className="px-2">
                    <button
                      type="button"
                      disabled={!selectedMemory}
                      onClick={() => {
                        if (!selectedMemory) return
                        handleDeleteMemory(selectedMemory)
                        setOpenMenu(null)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 rounded-md cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {selectedMemory && (
                    <>
                      <div className="mx-3 my-2 h-px bg-zinc-200" />
                      <p className="px-3 pb-1 text-xs text-zinc-500">
                        Saved on {formatSavedDate(selectedMemory.created_at || selectedMemory.savedAt || '')} from {selectedMemory.member_name || selectedMemory.memory_type || selectedMemory.source || 'chat'}.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-zinc-200">
            {sortedMemories.map(memory => (
              <div key={memory.id} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-zinc-800 font-medium">{memory.content}</p>
                  <p className="mt-1 text-xs text-zinc-400">{memory.member_name || memory.memory_type || memory.source || 'Chat memory'}</p>
                </div>
                <span className="text-xs text-zinc-400 font-normal shrink-0">
                  {formatSavedDate(memory.created_at || memory.savedAt || '')}
                </span>
              </div>
            ))}

            {sortedMemories.length === 0 && (
              <div className="px-4 py-10 text-center sm:px-6">
                <p className="text-sm font-medium text-zinc-900">No saved memories</p>
                <p className="mt-1 text-sm text-zinc-500">New reminders and ideas will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
