// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Calendar, Clock, Coins, History, X } from 'lucide-react'
import { EllipsisVerticalIcon, BoltIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from '../dialog'
import { Button } from '../ui/button'
import { Loader } from '../loader'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { HEAVY_WORKER_CREDITS } from '@/lib/agent-mode/types'
import { Skeleton } from '../ui/skeleton'
import { useRouter } from 'next/navigation'

const STATUS_STYLES = {
  active: { bg: 'bg-[#ECFDF3]', border: "border border-[#ABEFC6]", text: 'text-[#067647]', label: 'Active' },
  paused: { bg: 'bg-amber-100', border: "border border-amber-500", text: 'text-amber-700', label: 'Paused' },
  inactive: { bg: 'bg-zinc-50', border: "border border-zinc-300", text: 'text-zinc-700', label: 'Draft' },
  completed: { bg: 'bg-[#ECFDF3]', border: "border border-[#ABEFC6]", text: 'text-[#067647]', label: 'Success' },
  failed: { bg: 'bg-red-50', border: "border border-red-200", text: 'text-red-700', label: 'Failed' },
  running: { bg: 'bg-blue-50', border: "border border-blue-200", text: 'text-blue-700', label: 'Running' },
  partial: { bg: 'bg-amber-50', border: "border border-amber-200", text: 'text-amber-700', label: 'Partial' },
  pending_rescue: { bg: 'bg-purple-50', border: "border border-purple-200", text: 'text-purple-700', label: 'Pending Rescue' },
}

const DAY_ABBR = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }

export function ChainCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>

      {/* Worker sequence */}
      <div className="flex flex-col sm:flex-row items-center gap-2 flex-wrap mb-5 bg-[#F5F5F5] border border-zinc-200 rounded-xl p-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
            <div className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl shadow-sm py-2 px-3 w-full sm:w-auto">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
            {i === 0 && <Skeleton className="size-5 rounded" />}
          </div>
        ))}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-13.5" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

export default function ChainCard({ chain, onEdit, onRunNow, onPause, onResume, onDelete, onViewOutputs, onDeploy, isActivity, isMyPlayBook = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef(null)
  const router = useRouter();

  const statusStyle = STATUS_STYLES[chain.status] ?? STATUS_STYLES.inactive
  const scheduleLabel = chain.schedule_days?.length > 0
    ? chain.schedule_days.map(d => DAY_ABBR[d] ?? d).join(', ')
    : 'Not scheduled'

  const cost = chain.workers?.reduce((acc, w) => {
    const heavy = HEAVY_WORKER_CREDITS[w.worker_id] ?? 0
    return { light: acc.light + (heavy === 0 ? 1 : 0), heavy: acc.heavy + heavy }
  }, { light: 0, heavy: 0 }) ?? { light: 0, heavy: 0 }

  const costLabel = [
    cost.light > 0 ? `${cost.light} light` : null,
    cost.heavy > 0 ? `${cost.heavy} heavy` : null,
  ].filter(Boolean).join(' + ')


  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 transition-colors">
      {/* Left */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-nowrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="text-sm font-medium text-zinc-800 truncate min-w-0 max-w-[calc(100%-60px)]">{chain.name}</h3>
            {
              isMyPlayBook ? (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-300 shrink-0`}>
                  Custom
                </span>
              ) : (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text} shrink-0`}>
                  {statusStyle.label}
                </span>
              )
            }
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDeploy && (
              <button
                onClick={onDeploy}
                className="hidden sm:inline-flex rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer"
              >
                Deploy →
              </button>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-black hover:bg-zinc-100 cursor-pointer"
              >
                <EllipsisVerticalIcon className="size-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-8 z-20 w-[140px] rounded-xl border border-zinc-100 bg-white py-1 shadow-lg"
                >
                  {onDeploy && (
                    <button
                      onClick={() => { setMenuOpen(false); onDeploy() }}
                      className="w-full px-3 py-1.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 cursor-pointer sm:hidden border-b border-zinc-100"
                    >
                      Deploy
                    </button>
                  )}
                  {
                    isActivity ? (
                      <>
                        <button onClick={() => router.push(`/dashboard/agent-mode/runs/${chain.id}`)} className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">Run Now</button>
                      </>
                    ) : (
                      <>
                        {onEdit && <button onClick={() => { setMenuOpen(false); onEdit() }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">Edit</button>}
                        {onRunNow && <button onClick={() => { setMenuOpen(false); onRunNow() }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">Run Now</button>}
                        {chain.status === 'active' && onPause
                          ? <button onClick={() => { setMenuOpen(false); onPause() }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">Pause</button>
                          : chain.status === 'paused' && onResume
                            ? <button onClick={() => { setMenuOpen(false); onResume() }} className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">Resume</button>
                            : null
                        }
                        {onDelete && <button onClick={() => {
                          setMenuOpen(false)
                          setDeleteDialogOpen(true)
                        }} className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 cursor-pointer">Delete</button>}
                      </>
                    )
                  }

                </div>
              )}
            </div>
          </div>
        </div>


        {/* Worker sequence */}
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-wrap mb-5 bg-[#F5F5F5] border border-[#E9EAEB] rounded-xl p-3">
          {(chain.workers ?? []).map((w, i) => {
            const meta = workerRegistry.find(r => r.slug === w.worker_id)
            return (
              <div key={i} className='flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto'>
                <div className="flex items-center gap-3 bg-white border border-[#D5D7DA] rounded-xl shadow-sm py-2 px-3 w-full sm:w-auto">
                  <Image
                    src={`/images/marketing/workers-figma/${(meta?.personaName ?? w.worker_id ?? '').toLowerCase()}.png`}
                    alt={meta?.personaName ?? w.worker_id}
                    className="w-10 h-10 rounded-full object-cover bg-zinc-50 border border-zinc-100"
                    onError={(e) => {
                      e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="%23717680">${meta?.emoji ?? '🤖'}</text></svg>`
                    }}
                    width={40}
                    height={40}
                  />
                  <div>
                    <p className='text-sm font-medium text-zinc-800'>{meta?.personaName ?? w.worker_id}</p>
                    <p className='text-xs text-neutral-500'>{meta?.slug}</p>
                  </div>
                </div>
                {i < (chain.workers.length - 1) && <ArrowRight className='size-6 text-[#A4A7AE] transform rotate-90 sm:rotate-0' />}
              </div>
            )
          })}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-5 text-xs text-neutral-500 font-normal">
          <div className="flex items-center gap-1">
            <History className="size-4" />
            <span>Recurring</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="size-4" />
            <span>{scheduleLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Coins className="size-4" />
            <span>{costLabel || 'free'} per run</span>
          </div>
        </div>
      </div>

      {/* delete dialof */}
      <Dialog
        open={deleteDialogOpen}
        onClose={setDeleteDialogOpen}
        size="sm"
        className={`p-0! overflow-hidden! max-[400px]:w-[85%] max-[700px]:w-[80%]`}
      >
        <div className="relative p-5">
          <X onClick={() => setDeleteDialogOpen(false)} className='hover:text-black transition-all duration-300 text-zinc-600 absolute top-3 right-3 size-4 cursor-pointer' />
          <DialogTitle>Delete Chain</DialogTitle>

          <DialogDescription className="mt-2 text-sm text-zinc-500">
            Are you sure you want to delete "{chain.name}"?
            This action cannot be undone.
          </DialogDescription>
        </div>
        <div className='flex items-center justify-end gap-3 bg-zinc-50 border-t border-zinc-100 py-3 px-5'>
          <Button
            variant="outline"
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(false)}
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              try {
                setDeleting(true)
                await onDelete?.()
                setDeleteDialogOpen(false)
              } finally {
                setDeleting(false)
              }
            }}
          >
            {deleting ? (
              <div className="flex items-center gap-2">
                <Loader size={4} />
                {/* <span>Deleting...</span> */}
              </div>
            ) : (
              'Delete'
            )}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
