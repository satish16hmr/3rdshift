// @ts-nocheck
'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { CheckCircle, Filter, Loader, Plus, Search, X } from 'lucide-react'
import { format, isValid } from 'date-fns'

import { Badge } from '@/components/badge'
import { Divider } from '@/components/divider'
import { Heading, Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog'
import { createClient } from '@/lib/supabase/client'
import { getStoredWorkspaceId } from '@/lib/workspace-client'
import { getWorkerBySlug, workers } from '@/lib/workers/registry'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import SchedulePicker from '@/src/components/SchedulePicker'
import { getWorkerAvatarSrcBySlug } from '@/lib/worker-avatars'
import { Pagination } from '@/components/pagination'
import Image from 'next/image'

// ---------------------------------------------------------------------------
// Filter pills
// ---------------------------------------------------------------------------
const filters = ['All', 'Completed', 'Running', 'Partial', 'Failed']

const statusOptions = ['All', 'Completed', 'Running', 'Partial', 'Failed']
const categoryOptions = ['Content', 'Writing & Copy', 'Research & Strategy', 'Data & Analytics', 'Admin & Ops', 'Documents & Reports', 'Design & Creative']
const dateOptions = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Last 60 days', 'Last 90 days', 'Custom Range']

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------
function StatusDot({ status }) {
  const colors = {
    completed: 'bg-emerald-500',
    processing: 'bg-blue-500 animate-pulse',
    pending: 'bg-blue-500 animate-pulse',
    failed: 'bg-red-500',
  }
  return (
    <span className={`inline-block size-2 shrink-0 rounded-full ${colors[status] || 'bg-zinc-300'}`} />
  )
}

// ---------------------------------------------------------------------------
// Filter Dialog
// ---------------------------------------------------------------------------
function FilterDialog({ open, onClose, onApply, initialFilters }) {
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedDate, setSelectedDate] = useState('Last 7 days')
  const [customDate, setCustomDate] = useState('')

  useEffect(() => {
    if (open) {
      setSelectedStatus(initialFilters?.status || 'All')
      setSelectedCategory(initialFilters?.category || null)
      setSelectedDate(initialFilters?.date || 'Last 7 days')
      setCustomDate(initialFilters?.customDate || '')
    }
  }, [open, initialFilters])

  const handleApply = () => {
    onApply({ status: selectedStatus, category: selectedCategory, date: selectedDate, customDate })
    onClose()
  }

  const PillButton = ({ label, selected, onClick }) => (
    <button
      onClick={onClick}
      className={`h-8.5 text-nowrap rounded-full border px-4 py-1.5 text-xs/5 font-medium transition cursor-pointer ${selected
        ? 'border-[#8DAFF9] bg-[#F5F8FF] text-blue-500'
        : 'border-zinc-200 text-[#181818]'
        }`}
    >
      {label}
    </button>
  )

  return (
    <Dialog open={open} onClose={onClose} className="w-[90%]! md:w-160! max-w-none! p-0! max-h-[90vh]! overflow-auto">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-zinc-800">Filter</h3>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none cursor-pointer"><X className='size-4' /></button>
      </div>

      <DialogBody className='px-4 sm:px-6 py-4 sm:py-5 mt-0!'>
        {/* Status */}
        <div className="mb-5">
          <p className="mb-3 text-sm font-medium text-[#414651]">Status</p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((s) => (
              <PillButton
                key={s}
                label={s}
                selected={selectedStatus === s}
                onClick={() => setSelectedStatus(s)}
              />
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="mb-5">
          <p className="mb-3 text-sm font-medium text-[#414651]">Category</p>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((c) => (
              <PillButton
                key={c}
                label={c}
                selected={selectedCategory === c}
                onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
              />
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <p className="mb-3 text-sm font-medium text-[#414651]">Date</p>
          <div className="flex flex-wrap gap-2">
            {dateOptions.map((d) => {
              if (d === 'Custom Range') {
                const getCustomDateLabel = () => {
                  if (customDate) {
                    const parts = customDate.split(',')
                    const start = parts[0] ? new Date(parts[0]) : null
                    const end = parts[1] ? new Date(parts[1]) : null
                    if (start && isValid(start) && end && isValid(end)) {
                      return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`
                    }
                  }
                  return 'Custom Range'
                }

                return (
                  <SchedulePicker
                    key={d}
                    value={customDate}
                    onChange={(val) => {
                      setCustomDate(val)
                    }}
                    onTriggerClick={() => setSelectedDate(d)}
                    selectRange={true}
                    customTrigger={
                      <button
                        type="button"
                        className={`h-8.5 text-nowrap rounded-full border px-4 py-1.5 text-xs/5 font-medium transition cursor-pointer ${selectedDate === d
                          ? 'border-[#8DAFF9] bg-[#F5F8FF] text-blue-500'
                          : 'border-zinc-200 text-[#181818]'
                          }`}
                      >
                        {selectedDate === d && customDate ? getCustomDateLabel() : 'Custom Range'}
                      </button>
                    }
                    useMobileDialog={true}
                  />
                )
              }
              return (
                <PillButton
                  key={d}
                  label={d}
                  selected={selectedDate === d}
                  onClick={() => setSelectedDate(d)}
                />
              )
            })}
          </div>
        </div>
      </DialogBody>

      <DialogActions className="m-0! p-3! pr-4! sm:p-6! border-t border-zinc-200 items-end!">
        <Button
          className="w-17!"
          onClick={handleApply}
          variant="primary"
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ filter }) {
  return (
    <div className="flex flex-col justify-center items-center gap-3 mb-8">
      <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
        <Loader className='size-4 text-[#C5C7CB]' />
        <div className='flex flex-col gap-2 flex-1'>
          <span className="left-6 top-2 h-1.5 w-20 rounded bg-[#E7E8EA]" />
          <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
        </div>
      </div>
      <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
        <CheckCircle className='size-6 text-[#71717A]' />
        <div className='flex flex-col gap-2 flex-1'>
          <span className="left-6 top-2 h-1.5 w-24 rounded bg-[#8DAFF9]" />
          <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
        </div>
      </div>
      <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
        <Loader className='size-4 text-[#C5C7CB]' />
        <div className='flex flex-col gap-2 flex-1'>
          <span className="left-6 top-2 h-1.5 w-20 rounded bg-[#E7E8EA]" />
          <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyTasks() {
  const [activeFilter, setActiveFilter] = useState('All')
  const [tasks, setTasks] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 100
  const router = useRouter()

  // Debounce search input changes (300ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedSearchQuery('')
      return
    }
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeFilter, appliedFilters, debouncedSearchQuery])

  useEffect(() => {
    const supabase = createClient()
    let channel = null

    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const workspaceId = getStoredWorkspaceId()
      let taskQuery = supabase
        .from('tasks')
        .select('id, worker_slug, status, output_status, input, created_at, output_format', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (workspaceId) {
        taskQuery = taskQuery.eq('workspace_id', workspaceId)
      } else {
        taskQuery = taskQuery.eq('user_id', user.id)
      }

      // 1. Search Query filter (Server side)
      if (debouncedSearchQuery.trim()) {
        const cleanQ = debouncedSearchQuery.trim().replace(/[,()"\\]/g, ' ')
        if (cleanQ) {
          const matchingSlugs = workers
            .filter(w => (w.name || '').toLowerCase().includes(cleanQ.toLowerCase()))
            .map(w => w.slug)

          const inputKeys = [
            'topic', 'post_concept', 'video_topic', 'course_topic', 'what_to_track',
            'what_to_automate', 'what_selling', 'episode_title', 'project_title',
            'project', 'target_role', 'subject', 'company_name', 'business_name',
            'brand_name', 'keyword', 'target_keyword', 'product_name', 'product',
            'business', 'description', 'role_title', 'role', 'market', 'industry',
            'niche', 'task_description', 'experience', 'goal'
          ]
          const orParts = [
            `worker_slug.ilike.%${cleanQ}%`,
            `status.ilike.%${cleanQ}%`,
            ...inputKeys.map(k => `input->>${k}.ilike.%${cleanQ}%`)
          ]
          matchingSlugs.forEach(slug => {
            orParts.push(`worker_slug.eq.${slug}`)
          })
          taskQuery = taskQuery.or(orParts.join(','))
        }
      }

      // 2. Active status pill filter
      if (activeFilter !== 'All') {
        if (activeFilter === 'Running') {
          taskQuery = taskQuery.in('status', ['processing', 'pending'])
        } else if (activeFilter === 'Partial') {
          taskQuery = taskQuery.eq('status', 'completed').eq('output_status', 'potentially_truncated')
        } else if (activeFilter === 'Completed') {
          taskQuery = taskQuery.eq('status', 'completed').or('output_status.is.null,output_status.neq.potentially_truncated')
        } else {
          taskQuery = taskQuery.eq('status', activeFilter.toLowerCase())
        }
      }

      // 3. FilterDialog options
      if (appliedFilters) {
        if (appliedFilters.status && appliedFilters.status !== 'All') {
          if (appliedFilters.status === 'Running') {
            taskQuery = taskQuery.in('status', ['processing', 'pending'])
          } else if (appliedFilters.status === 'Partial') {
            taskQuery = taskQuery.eq('status', 'completed').eq('output_status', 'potentially_truncated')
          } else if (appliedFilters.status === 'Completed') {
            taskQuery = taskQuery.eq('status', 'completed').or('output_status.is.null,output_status.neq.potentially_truncated')
          } else {
            taskQuery = taskQuery.eq('status', appliedFilters.status.toLowerCase())
          }
        }

        if (appliedFilters.category) {
          const catQ = appliedFilters.category.toLowerCase()
          const catSlugs = workers
            .filter(w => w.category && (w.category.toLowerCase().includes(catQ) || catQ.includes(w.category.toLowerCase())))
            .map(w => w.slug)

          if (catSlugs.length > 0) {
            taskQuery = taskQuery.in('worker_slug', catSlugs)
          } else {
            taskQuery = taskQuery.in('worker_slug', ['__none__'])
          }
        }

        if (appliedFilters.date) {
          const now = new Date()
          const dateStr = appliedFilters.date

          if (dateStr === 'Today') {
            const start = new Date(now)
            start.setHours(0, 0, 0, 0)
            taskQuery = taskQuery.gte('created_at', start.toISOString())
          } else if (dateStr === 'Yesterday') {
            const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            start.setHours(0, 0, 0, 0)
            const end = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            end.setHours(23, 59, 59, 999)
            taskQuery = taskQuery.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
          } else if (dateStr === 'Last 7 days') {
            const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            taskQuery = taskQuery.gte('created_at', start.toISOString())
          } else if (dateStr === 'Last 30 days') {
            const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            taskQuery = taskQuery.gte('created_at', start.toISOString())
          } else if (dateStr === 'Last 60 days') {
            const start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
            taskQuery = taskQuery.gte('created_at', start.toISOString())
          } else if (dateStr === 'Last 90 days') {
            const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            taskQuery = taskQuery.gte('created_at', start.toISOString())
          } else if (dateStr === 'Custom Range' && appliedFilters.customDate) {
            const parts = appliedFilters.customDate.split(',')
            const start = parts[0] ? new Date(parts[0]) : null
            const end = parts[1] ? new Date(parts[1]) : null
            if (start && end) {
              const startLimit = new Date(start)
              startLimit.setHours(0, 0, 0, 0)
              const endLimit = new Date(end)
              endLimit.setHours(23, 59, 59, 999)
              taskQuery = taskQuery.gte('created_at', startLimit.toISOString()).lte('created_at', endLimit.toISOString())
            }
          }
        }
      }

      // Range query for server-side 100-item pagination
      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      taskQuery = taskQuery.range(from, to)

      const { data, count, error } = await taskQuery
      if (!error) {
        setTasks(data || [])
        setTotalCount(count || 0)
      }
      setLoading(false)

      const realtimeFilter = workspaceId
        ? `workspace_id=eq.${workspaceId}`
        : `user_id=eq.${user.id}`
      channel = supabase
        .channel('tasks-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: realtimeFilter,
        }, () => {
          load()
        })
        .subscribe()
    }
    load()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [currentPage, debouncedSearchQuery, activeFilter, appliedFilters])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  }, [totalCount])

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      <div>
        <Heading className='text-2xl! text-zinc-800! font-semibold! hidden lg:block'>My Tasks</Heading>
        <Subheading className='text-neutral-500! text-sm! sm:text-base! font-normal!'>Track and manage all your submitted tasks in one place.</Subheading>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-5 sm:mt-6">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setFilterDialogOpen(true)}
            className="cursor-pointer"
          >
            <Filter className="size-4" />
            Filter
          </Button>
        </div>

        {/* ── Filter Dialog ── */}
        <FilterDialog
          open={filterDialogOpen}
          onClose={() => setFilterDialogOpen(false)}
          onApply={(filters) => setAppliedFilters(filters)}
          initialFilters={appliedFilters}
        />
      </div>

      {/* ── Task list ── */}
      <div className="mt-4 divide-y divide-zinc-950/[0.04] bg-white">
        {loading ? (
          <div className="rounded-xl border border-zinc-950/[0.08] max-h-[calc(100vh-260px)] overflow-y-auto">
            <table className="w-full text-sm table-fixed xl:table-auto">
              <thead className='bg-[#FAFAFA]'>
                <tr className="border-b border-zinc-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#717680]">Task Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#717680] hidden xl:table-cell">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#717680] hidden xl:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="group transition-colors">
                    <td className="px-4 py-4 sm:px-6 w-[70%]">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Skeleton className="size-10 rounded-full" />
                          <div className='min-w-0 flex-1 flex flex-col gap-1.5'>
                            <Skeleton className="h-4 w-48 max-w-full" />
                            <Skeleton className="h-3 w-32 max-w-[80%]" />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 xl:hidden">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tasks.length === 0 ? (
          <div className='min-h-[calc(100vh-250px)] sm:min-h-0 rounded-xl border border-zinc-950/[0.08] p-6 flex flex-col items-center justify-center'>
            <div className="flex min-h-[190px] flex-col items-center justify-center text-center">
              <EmptyState />
              <p className="font-semibold leading-5 text-zinc-800">
                {searchQuery || appliedFilters ? 'No tasks matching your search or filter' : 'No recent task yet'}
              </p>
              <p className="mt-1 text-[13px] leading-4 text-neutral-500">
                {searchQuery || appliedFilters ? 'Try adjusting your search query or filter options' : 'Tasks will appear here once you start using AI team'}
              </p>
            </div>
            {searchQuery || appliedFilters ? (
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(''); setAppliedFilters(null); setActiveFilter('All') }}
                className="mt-3 cursor-pointer"
              >
                Clear Filters
              </Button>
            ) : (
              <div className="flex justify-center items-center">
                <Button
                  variant="outline"
                  onClick={() => { window.dispatchEvent(new Event('open-worker-picker')) }}
                  className="mt-3 cursor-pointer"
                >
                  Create New Task
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-950/[0.08] max-h-[calc(100vh-260px)] overflow-y-auto">
            <table className="w-full text-sm table-fixed xl:table-auto">
              <thead className='bg-[#FAFAFA]'>
                <tr className="border-b border-zinc-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#717680]">Task Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#717680] hidden xl:table-cell">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#717680] hidden xl:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {tasks.map((task) => {
                  const worker = getWorkerBySlug(task.worker_slug)
                  const isRunning = task.status === 'processing' || task.status === 'pending'

                  const title =
                    task.input?.topic || task.input?.post_concept || task.input?.video_topic ||
                    task.input?.course_topic || task.input?.what_to_track || task.input?.what_to_automate ||
                    task.input?.what_selling || task.input?.episode_title || task.input?.project_title ||
                    task.input?.project || task.input?.target_role || task.input?.subject ||
                    task.input?.company_name || task.input?.business_name || task.input?.brand_name ||
                    task.input?.keyword || task.input?.target_keyword || task.input?.product_name ||
                    task.input?.product || task.input?.business || task.input?.description ||
                    task.input?.role_title || task.input?.role || task.input?.market ||
                    task.input?.industry || task.input?.niche || task.input?.task_description ||
                    task.input?.experience || task.input?.goal || worker?.name || task.worker_slug

                  const timeAgo = (dateStr) => {
                    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
                    if (diff < 60) return 'just now'
                    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
                    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
                    return `${Math.floor(diff / 86400)}d ago`
                  }

                  return (
                    <tr
                      key={task.id}
                      onClick={() => router.push(`/dashboard/tasks/result?taskId=${task.id}`)}
                      className="group cursor-pointer hover:bg-zinc-950/[0.025] transition-colors"
                    >
                      <td className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div>
                              {(() => {
                                const avatarSrc = getWorkerAvatarSrcBySlug(task.worker_slug)
                                return avatarSrc ? (
                                  <Image
                                    src={avatarSrc}
                                    alt={worker?.name || task.worker_slug}
                                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl border border-zinc-200 bg-zinc-50"
                                    width={40}
                                    height={40}
                                  />
                                ) : (
                                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl border border-zinc-200 bg-zinc-50">
                                    {worker?.emoji || '🤖'}
                                  </div>
                                )
                              })()}
                            </div>
                            <div className='min-w-0 flex-1'>
                              <p className="truncate text-sm font-medium text-zinc-800 capitalize">
                                {typeof title === 'string' ? title.slice(0, 60) : worker?.name || task.worker_slug}
                              </p>
                              <p className='truncate text-xs text-neutral-500 mt-0.5'>
                                {worker?.name || task.worker_slug}
                              </p>
                            </div>
                          </div>

                          {/* Right aligned on mobile, hidden on desktop */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0 xl:hidden">
                            {(() => {
                              const isPartial = task.status === 'completed' && task.output_status === 'potentially_truncated'
                              return (
                                <Badge color={isPartial ? 'yellow' : task.status === 'completed' ? 'green' : isRunning ? 'blue' : 'red'}>
                                  {isPartial ? 'Partial' : isRunning ? 'Running' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                                </Badge>
                              )
                            })()}
                            <span className="text-xs text-neutral-500">
                              {timeAgo(task.created_at)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-500 hidden xl:table-cell">
                        {timeAgo(task.created_at)}
                      </td>
                      <td className="px-6 py-4 hidden xl:table-cell">
                        {(() => {
                          const isPartial = task.status === 'completed' && task.output_status === 'potentially_truncated'
                          return (
                            <Badge color={isPartial ? 'yellow' : task.status === 'completed' ? 'green' : isRunning ? 'blue' : 'red'}>
                              {isPartial ? 'Partial' : isRunning ? 'Running' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                            </Badge>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer count and Pagination ── */}
      {totalCount > 0 ? (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Text className="!text-xs !text-zinc-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} tasks
          </Text>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      ) : loading ? (
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="size-10 rounded-md" />
          </div>
        </div>
      ) : null}
    </div>
  )
}