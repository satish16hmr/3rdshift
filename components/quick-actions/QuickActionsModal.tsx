'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { QuickActionCard } from '@/components/quick-actions/QuickActionCard'
import { Pagination } from '@/components/pagination'
import { Dialog } from '../dialog'

import { QUICK_ACTIONS, QUICK_ACTION_GOALS, QUICK_ACTION_GOAL_COLORS, type QuickActionFilter } from '@/lib/quick-actions'

const QUICK_ACTIONS_PER_PAGE = 40

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M7.25 12.25C10.0114 12.25 12.25 10.0114 12.25 7.25C12.25 4.48858 10.0114 2.25 7.25 2.25C4.48858 2.25 2.25 4.48858 2.25 7.25C2.25 10.0114 4.48858 12.25 7.25 12.25Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.75 10.75L13.75 13.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function QuickActionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [goal, setGoal] = useState<QuickActionFilter>('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [hoveredGoal, setHoveredGoal] = useState<QuickActionFilter | null>(null)

  useEffect(() => {
    if (open) {
      setCurrentPage(1)
    }
  }, [open])

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return QUICK_ACTIONS.filter((action) => {
      const matchesSearch = !normalizedQuery || action.action.toLowerCase().includes(normalizedQuery)
      const matchesGoal = goal === 'All' || action.goal === goal
      return matchesSearch && matchesGoal
    })
  }, [goal, query])

  const totalPages = Math.ceil(filteredActions.length / QUICK_ACTIONS_PER_PAGE)
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages))
  const pageStart = (safeCurrentPage - 1) * QUICK_ACTIONS_PER_PAGE
  const paginatedActions = filteredActions.slice(pageStart, pageStart + QUICK_ACTIONS_PER_PAGE)

  const handleClose = () => {
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      // Override the panel sizing: remove default size constraints and apply custom ones
      className="relative flex h-[95vh] w-[calc(100vw-20px)]! sm:min-w-[calc(100vw-40px)]! flex-col overflow-hidden rounded-2xl border border-zinc-950/[0.08] shadow-2xl z-50 p-0!"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-[#FAFAFA] border-b border-[#E9EAEB] px-5 py-4 sm:px-6 shrink-0">
        <h2 id="quick-actions-title" className="text-lg font-semibold text-zinc-800">Quick Actions</h2>
        <button
          type="button"
          aria-label="Close quick actions"
          onClick={handleClose}
          className="cursor-pointer"
        >
          <X className="text-[#A4A7AE] text-xl" />
        </button>
      </div>

      {/* Search + filters */}
      <div className="px-5 py-4 sm:px-6 shrink-0">
        <div className="flex flex-col gap-3 bg-[#F5F5F5] border border-[#E4E7EC] rounded-xl p-2.5">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><SearchIcon /></span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search workers - leads"
              className="w-full rounded-xl border border-zinc-950/[0.10] bg-white py-3 pl-9 pr-3 text-sm text-zinc-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
          <div className="flex gap-2 overflow-auto">
            {(QUICK_ACTION_GOALS as QuickActionFilter[]).map((filterGoal) => {
              const selected = goal === filterGoal
              const isHovered = hoveredGoal === filterGoal
              const isHighlighted = selected || isHovered
              const color = filterGoal === 'All' ? '#2563eb' : QUICK_ACTION_GOAL_COLORS[filterGoal]
              return (
                <button
                  key={filterGoal}
                  type="button"
                  onClick={() => {
                    setGoal(filterGoal)
                    setCurrentPage(1)
                  }}
                  onMouseEnter={() => setHoveredGoal(filterGoal)}
                  onMouseLeave={() => setHoveredGoal(null)}
                  className="rounded-full border px-3 py-1.5 text-xs transition text-nowrap cursor-pointer"
                  style={{
                    borderColor: isHighlighted ? color : 'rgba(9, 9, 11, 0.10)',
                    backgroundColor: isHighlighted ? color : '#ffffff',
                    color: isHighlighted ? '#ffffff' : '#181818',
                  }}
                >
                  {filterGoal}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Scrollable action grid */}
      <div className="overflow-y-auto flex-1 px-5 py-5 sm:px-6 pb-20">
        {filteredActions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedActions.map((action) => (
              <QuickActionCard key={`${action.action}-${action.slug}`} action={action} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-950/[0.12] px-6 py-10 text-center">
            <p className="text-sm font-medium text-zinc-950">No quick actions found.</p>
            <p className="mt-1 text-sm text-zinc-500">Try a different search or goal filter.</p>
          </div>
        )}
      </div>

      {/* Sticky pagination footer */}
      {totalPages > 1 && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-white px-5 py-3 sm:px-6 sticky bottom-0 left-0 z-20 border-t border-zinc-100 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
            className="cursor-pointer justify-self-start text-sm font-medium text-[#535862] transition hover:text-blue-600 disabled:pointer-events-none disabled:opacity-40 flex items-center gap-1.5"
          >
            ←    <span className='hidden sm:flex'>Previous</span>
          </button>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="justify-center!"
          />
          {/* <span className="text-center text-sm font-medium text-[#535862] sm:hidden">
            {safeCurrentPage} / {totalPages}
          </span> */}
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safeCurrentPage === totalPages}
            className="cursor-pointer justify-self-end text-sm font-medium text-[#535862] transition hover:text-blue-600 disabled:pointer-events-none disabled:opacity-40 flex items-center gap-1.5"
          >
            <span className='hidden sm:flex'>Next</span> →
          </button>
        </div>
      )}
    </Dialog>
  )
}