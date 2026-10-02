// @ts-nocheck
'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import LogoPng from '../../public/icons/icon-192.png'
import IllustrationEmpty from "@/public/images/IllustrationEmpty.png";
import { CheckCircle, Loader } from 'lucide-react'
import clsx from 'clsx'

import { Badge } from '@/components/badge'
import { UpgradeButton } from '@/components/upgrade-button'
import { Divider } from '@/components/divider'
import { Heading, Subheading } from '@/components/heading'
import { Pagination } from '../../components/pagination'
import { Text } from '@/components/text'
import { Skeleton } from '@/components/ui/skeleton'
import { QuickActionsGrid } from '@/components/quick-actions/QuickActionsGrid'
import { CompleteSetupWidget } from './Completesetupwidget'

import { createClient } from '@/lib/supabase/client'
import { getStoredWorkspaceId } from '@/lib/workspace-client'
import { getWorkerBySlug } from '@/lib/workers/registry'


const DASHBOARD_LOAD_TIMEOUT_MS = 8000
const DASHBOARD_TASKS_PER_PAGE = 5
const CHECKOUT_SUCCESS_STORAGE_KEY = 'onboarding_checkout_success'
const BLOCKED_BILLING_STATUSES = new Set([
  'canceled',
  'cancelled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
])
const AVATAR_BASE = '/images/marketing/workers-figma'
const AVATAR_NAMES = new Set([
  'alice', 'ash', 'ava', 'beck', 'bella', 'blair', 'bree', 'brody', 'cade', 'cara', 'case', 'charlie',
  'clay', 'cruz', 'dale', 'darcy', 'dex', 'dina', 'duncan', 'elliot', 'ellis', 'ember', 'emma', 'eve',
  'flynn', 'gus', 'heath', 'holly', 'iris', 'ivy', 'jett', 'joe', 'joss', 'jude', 'jules', 'kai',
  'knox', 'koa', 'lane', 'lena', 'lenny', 'lyra', 'mack', 'marlo', 'mira', 'naru', 'nash', 'nico',
  'nora', 'opal', 'oscar', 'paul', 'penn', 'pete', 'peyton', 'piper', 'quinn', 'reed', 'remy', 'ren',
  'rio', 'sage', 'sam', 'shay', 'sienna', 'silas', 'sully', 'tala', 'tate', 'tess', 'thea', 'trey',
  'vera', 'vince', 'wes', 'wilma', 'zane', 'zeke',
])

function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  ms: number = DASHBOARD_LOAD_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId)
  })
}

function avatarKey(workerName: any) {
  return workerName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function avatarSrc(workerName: any) {
  const key = avatarKey(workerName)
  return AVATAR_NAMES.has(key) ? `${AVATAR_BASE}/${key}.png` : null
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------



function TaskRow({ task, now }: {
  task: any,
  now: number,
}) {
  const worker = getWorkerBySlug(task.worker_slug)
  const isRunning = task.status === 'processing' || task.status === 'pending'
  const workerAvatarSrc = avatarSrc(worker?.personaName || worker?.name || task.worker_slug)

  const title = task.input?.topic
    || task.input?.target_role
    || task.input?.subject
    || task.input?.company_name
    || task.input?.keyword
    || task.input?.product_name
    || task.input?.task_description
    || task.input?.experience
    || worker?.name
    || task.worker_slug

  const timeAgo = (dateStr) => {
    const diff = Math.floor((now - new Date(dateStr)) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <Link href={`/dashboard/tasks/result?taskId=${task.id}`}
      className="group flex min-h-[62px] items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 cursor-pointer sm:px-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E9EAEB] bg-zinc-50">
        {workerAvatarSrc ? (
          <Image src={workerAvatarSrc} alt="" aria-hidden="true" width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          <span className="text-base">{worker?.emoji || '🤖'}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-4 text-zinc-800 capitalize">
          {typeof title === 'string' ? title.slice(0, 60) : worker?.name || task.worker_slug}
        </span>
        <span className="mt-0.5 block truncate text-xs leading-4 text-neutral-500">
          {worker?.name || task.worker_slug}
        </span>
      </span>
      <span className="hidden shrink-0 text-sm text-neutral-500 sm:block">{timeAgo(task.created_at)}</span>
      <span
        className={clsx(
          'flex h-5 shrink-0 items-center rounded-full border px-2 text-[12px] font-medium leading-none',
          task.status === 'completed'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : isRunning
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-red-200 bg-red-50 text-red-700'
        )}
      >
        {isRunning ? 'Running' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
      </span>
    </Link>
  )
}

function EmptyTasksIllustration() {
  return (
    <div className="flex flex-col justify-center items-center gap-3 mb-8">
      <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
        <Loader className='size-4' />
        <div className='flex flex-col gap-2 flex-1'>
          <span className="left-6 top-2 h-1.5 w-20 rounded bg-[#E7E8EA]" />
          <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
        </div>
      </div>
      <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
        <CheckCircle className='size-6' />
        <div className='flex flex-col gap-2 flex-1'>
          <span className="left-6 top-2 h-1.5 w-24 rounded bg-[#8DAFF9]" />
          <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
        </div>
      </div>
      <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
        <Loader className='size-4' />
        <div className='flex flex-col gap-2 flex-1'>
          <span className="left-6 top-2 h-1.5 w-20 rounded bg-[#E7E8EA]" />
          <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
        </div>
      </div>
    </div>
  )
}

type RecentTasksFooterProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function RecentTasksFooter({
  currentPage,
  totalPages,
  onPageChange,
}: RecentTasksFooterProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E9EAEB] bg-[#FAFAFA] px-4 py-3 sm:px-5">
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        className="mx-0!"
        cls="hover:bg-gray-100! cursor-pointer!"
      />

      <Link
        href="/dashboard/tasks"
        className="inline-flex h-8 items-center justify-center w-full sm:w-auto gap-4 rounded-md border border-[#D5D7DA] bg-white px-4 text-xs font-medium text-zinc-800 shadow-xs transition hover:border-blue-200 hover:text-blue-600"
      >
        View All
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  )
}

function QuickActionCardSkeleton({ index }) {
  const titleWidths = ['w-36', 'w-44', 'w-32', 'w-40', 'w-48', 'w-34', 'w-42', 'w-36']
  const subtitleWidths = ['w-44', 'w-36', 'w-40', 'w-32', 'w-44', 'w-36', 'w-40', 'w-32']
  const tagWidths = ['w-32', 'w-36', 'w-28', 'w-32', 'w-36', 'w-32', 'w-28', 'w-40']

  return (
    <div className="relative flex min-h-[142px] flex-col overflow-hidden rounded-xl border border-[#E9EAEB] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full bg-zinc-200/80" />
          <span className="min-w-0 space-y-2">
            <Skeleton className={`h-4 max-w-full bg-zinc-200/80 ${titleWidths[index % titleWidths.length]}`} />
            <Skeleton className={`h-3 max-w-full bg-zinc-100 ${subtitleWidths[index % subtitleWidths.length]}`} />
          </span>
        </div>
        <Skeleton className="size-5 shrink-0 rounded bg-zinc-200/80" />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <span className="flex h-5 items-center gap-1 rounded-md border border-[#D5D7DA] bg-white px-1.5">
          <Skeleton className="size-1.5 rounded-full bg-zinc-300" />
          <Skeleton className={`h-2.5 bg-zinc-200/80 ${tagWidths[index % tagWidths.length]}`} />
        </span>
        <Skeleton className="size-10 rounded-lg bg-zinc-100" />
      </div>
    </div>
  )
}

function RecentTaskRowSkeleton({ index }) {
  const titleWidths = ['w-44', 'w-40', 'w-48', 'w-36', 'w-42']
  const subtitleWidths = ['w-36', 'w-32', 'w-40', 'w-28', 'w-36']

  return (
    <div className="flex min-h-[62px] items-center gap-3 px-4 py-3 sm:px-5">
      <Skeleton className="size-10 shrink-0 rounded-full bg-zinc-200/80" />
      <span className="min-w-0 flex-1 space-y-2">
        <Skeleton className={`h-4 max-w-full bg-zinc-200/80 ${titleWidths[index % titleWidths.length]}`} />
        <Skeleton className={`h-3 max-w-full bg-zinc-100 ${subtitleWidths[index % subtitleWidths.length]}`} />
      </span>
      <Skeleton className="hidden h-4 w-14 shrink-0 bg-zinc-100 sm:block" />
      <Skeleton className="h-5 w-20 shrink-0 rounded-full bg-zinc-100" />
    </div>
  )
}

function DashboardLoadingSkeleton() {
  return (
    <div className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-7 w-72 max-w-[60%] bg-zinc-200/80" />
        </div>

        <span className="flex shrink-0 items-center gap-3">
          <Skeleton className="h-5 w-36 bg-zinc-100" />
          <Skeleton className="h-6 w-16 rounded-md bg-zinc-100" />
        </span>
      </div>

      <div className="mt-8 flex min-h-[116px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-[#FAFAFA] px-4 py-2.5">
          <Skeleton className="size-6 rounded-full bg-zinc-200" />
          <Skeleton className="h-4 w-24 bg-zinc-200/80" />
        </div>
        <div className="space-y-3 px-6 py-5">
          <Skeleton className="h-5 w-80 max-w-full bg-zinc-100" />
          {/* <Skeleton className="h-4 w-56 max-w-[70%] bg-zinc-50" /> */}
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-28 bg-zinc-200/80" />
          <Skeleton className="h-4 w-28 bg-zinc-100" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <QuickActionCardSkeleton key={index} index={index} />
          ))}
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex items-center border-b border-[#E9EAEB] bg-[#FAFAFA] px-4 py-3">
          <Skeleton className="h-4 w-24 bg-zinc-200/80" />
        </div>
        <div className="divide-y divide-[#E9EAEB]">
          {Array.from({ length: 5 }).map((_, index) => (
            <RecentTaskRowSkeleton key={index} index={index} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[#E9EAEB] bg-[#FAFAFA] px-4 py-3 sm:px-5">
          <div className="hidden items-center gap-6 sm:flex">
            {[24, 24, 24, 36, 24].map((width, index) => (
              <Skeleton key={index} className="h-3 bg-zinc-100" style={{ width }} />
            ))}
          </div>
          <Skeleton className="ml-auto h-8 w-28 bg-white" />
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pinned worker card (compact)
// ---------------------------------------------------------------------------
function PinnedWorkerCard({ worker }) {
  return (
    <Link
      href={`/dashboard/team/${worker.worker_slug}`}
      className="group flex flex-col items-center gap-2 rounded-xl border border-zinc-950/[0.08] bg-white p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-950/15"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">
        {worker.emoji || '🤖'}
      </span>
      <span className="block text-xs font-semibold text-zinc-950 leading-tight">
        {worker.worker_name || worker.worker_slug}
      </span>
      <span className="block text-xs text-blue-600 font-medium">Run task →</span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
function DashboardHomeInner() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userPlan, setUserPlan] = useState(null)
  const [billingStatus, setBillingStatus] = useState('active')
  const [pinnedWorkers, setPinnedWorkers] = useState([])
  const [jarvisInput, setJarvisInput] = useState('')
  const [taskTotalCount, setTaskTotalCount] = useState(0)
  const [now] = useState(() => Date.now())
  const searchParams = useSearchParams()
  const foundingSession = searchParams.get('founding_session')
  const checkoutSucceeded = searchParams.get('checkout') === 'success'
  const [currentPage, setCurrentPage] = useState(1)
  const didRunOneTimeSetupRef = useRef(false)
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [userInitials, setUserInitials] = useState('')

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const shouldRunOneTimeSetup = !didRunOneTimeSetupRef.current
        didRunOneTimeSetupRef.current = true

        // Complete pending workspace invite if one is stored (user logged in via invite link)
        const pendingInviteToken = shouldRunOneTimeSetup ? localStorage.getItem('pending_invite_token') : null
        if (shouldRunOneTimeSetup && pendingInviteToken) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              const invRes = await fetch('/api/workspace/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ token: pendingInviteToken }),
              })
              localStorage.removeItem('pending_invite_token')
              if (invRes.ok) {
                // Reload so workspace context updates
                window.location.href = '/dashboard'
                return
              }
            }
          } catch { /* Non-fatal */ }
        }

        // Link founding member status — from URL param or localStorage (email confirmation flow)
        const pendingSession = shouldRunOneTimeSetup ? (foundingSession || localStorage.getItem('pending_founding_session')) : null
        if (shouldRunOneTimeSetup && pendingSession) {
          try {
            await fetch('/api/founding-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: pendingSession }),
            })
            localStorage.removeItem('pending_founding_session')
            window.history.replaceState({}, '', '/dashboard')
          } catch {
            // Non-fatal
          }
        }

        // Send welcome email on first visit — only if not already sent
        // Use localStorage as primary gate, Supabase created_at as secondary check
        // (only send if account was created within last 10 minutes = new signup)
        const welcomeKey = `welcome_sent_${user.id}`
        if (shouldRunOneTimeSetup && !localStorage.getItem(welcomeKey)) {
          try {
            const supabase2 = createClient()
            const { data: profileData } = await supabase2.from('profiles').select('plan, is_founding_member, created_at').eq('id', user.id).single()
            // Only send welcome email if account is brand new (created within last 10 minutes)
            const isNewAccount = profileData?.created_at &&
              (Date.now() - new Date(profileData.created_at).getTime()) < 10 * 60 * 1000
            if (isNewAccount) {
              const firstName = user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name?.split(' ')[0] || ''
              const actualPlan = profileData?.plan || null
              const { data: { session } } = await supabase.auth.getSession()
              await fetch('/api/send-welcome', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ email: user.email, firstName, plan: actualPlan }),
              })
            }
            // Always set localStorage so we don't check again on this device
            localStorage.setItem(welcomeKey, '1')
          } catch {
            // Non-fatal
          }
        }

        // Fetch workspace — needed for both workspace ID (query scoping) and plan override
        // Must be awaited so tasks/pins/chats use the correct workspace_id on first load
        let workspaceId = getStoredWorkspaceId()
        let activeWorkspace = null
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            const wsRes = await withTimeout(
              fetch('/api/workspace', { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
              null,
              4000
            )
            if (wsRes?.ok) {
              const d = await wsRes.json()
              if (d.activeWorkspaceId) workspaceId = d.activeWorkspaceId
              const ws = d.workspaces?.find(w => w.id === d.activeWorkspaceId)
              if (ws) {
                activeWorkspace = ws
                if (ws.plan) setUserPlan(ws.plan)
              }
            }
          }
        } catch { /* fall back to stored ID */ }

        // ── Parallel fetch: profile + tasks + pinned workers ──
        // All only need user.id / workspaceId — no serial dependency between them.
        // Note: must reassign after .eq() — Supabase builder returns a new object each call.
        const taskStart = (currentPage - 1) * DASHBOARD_TASKS_PER_PAGE
        const taskEnd = taskStart + DASHBOARD_TASKS_PER_PAGE - 1
        let taskQ = supabase
          .from('tasks')
          .select('id, worker_slug, status, input, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(taskStart, taskEnd)
        taskQ = workspaceId ? taskQ.eq('workspace_id', workspaceId) : taskQ.eq('user_id', user.id)

        let pinQ = supabase.from('pinned_workers').select('worker_slug, pinned_at').order('pinned_at', { ascending: true }).limit(5)
        pinQ = workspaceId ? pinQ.eq('workspace_id', workspaceId) : pinQ.eq('user_id', user.id)

        const profileQ = supabase.from('profiles').select('full_name, plan, billing_status, is_founding_member, avatar_url').eq('id', user.id).single()

        const [profileRes, tasksRes, pinsRes] = await withTimeout(
          Promise.all([
            Promise.resolve(profileQ).catch(() => ({ data: null })),
            Promise.resolve(taskQ).catch(() => ({ data: [] })),
            Promise.resolve(pinQ).catch(() => ({ data: [] })),
          ]),
          [{ data: null }, { data: [] }, { data: [] }]
        )

        // Profile
        const profile = profileRes.data
        if (profile) {
          setUserPlan(profile.plan || 'none')

          const billingStatus = profile.billing_status || 'active'
          setBillingStatus(billingStatus)
          const hasActiveSubscription =
            profile.plan &&
            profile.plan !== 'none' &&
            !BLOCKED_BILLING_STATUSES.has(billingStatus)

          if (checkoutSucceeded && hasActiveSubscription) {
            window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY)
            window.history.replaceState({}, '', '/dashboard')
          }
        }

        let nameToUse = ''
        if (activeWorkspace?.name) {
          nameToUse = activeWorkspace.name
        } else if (profile?.full_name) {
          nameToUse = profile.full_name
        } else if (user.user_metadata?.full_name) {
          nameToUse = user.user_metadata.full_name
        } else if (user.user_metadata?.name) {
          nameToUse = user.user_metadata.name
        }

        let firstName = nameToUse.trim().split(' ')[0] || ''
        firstName = firstName.replace(/'s$/i, '')
        setUserName(firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : '')

        const parts = nameToUse.trim().split(' ').filter(Boolean)
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : nameToUse.slice(0, 2).toUpperCase()
        setUserInitials(initials)
        setUserAvatarUrl(profile?.avatar_url || user.user_metadata?.avatar_url || null)

        // Tasks
        setTasks(tasksRes.data || [])
        setTaskTotalCount(tasksRes.count || 0)

        // Pinned workers
        const pins = pinsRes.data
        if (pins && pins.length > 0) {
          const { getWorkerBySlug: getWorker } = await import('@/lib/workers/registry')
          const enriched = pins.map(p => {
            const w = getWorker(p.worker_slug)
            return { worker_slug: p.worker_slug, worker_name: w?.name || p.worker_slug, emoji: w?.emoji || '🤖' }
          })
          setPinnedWorkers(enriched)
        }

        setLoading(false)
      } catch (err) {
        console.error('[dashboard] load error:', err)
        setLoading(false)
      }
    }
    load()
  }, [currentPage, foundingSession, checkoutSucceeded])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const sendJarvisLauncherMessage = () => {
    const message = jarvisInput.trim()
    if (!message) return
    setJarvisInput('')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jarvis:send', { detail: { message } }))
    }
  }

  const handleJarvisLauncherKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendJarvisLauncherMessage()
    }
  }

  // Show skeleton while loading — never show half-rendered state
  if (loading) {
    return <DashboardLoadingSkeleton />
  }

  const totalPages = Math.ceil(taskTotalCount / DASHBOARD_TASKS_PER_PAGE)

  return (
    <>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className="flex items-center gap-3">
          {/* Profile avatar */}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-semibold">
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userAvatarUrl} alt={userName || 'Profile'} width={40} height={40} className="h-full w-full object-cover" />
            ) : (
              userInitials || userName?.slice(0, 2).toUpperCase() || '?'
            )}
          </span>
          <Heading className='text-zinc-800! text-base! sm:text-xl! md:text-2xl!'>{greeting}{userName ? `, ${userName}` : ''} 👋</Heading>
        </div>
        <div className="sm:mt-1.5 flex items-center gap-3 flex-wrap">
          <Text className="text-muted! text-xs! sm:text-sm! md:text-base!">{today}</Text>
          {userPlan && userPlan !== 'none' && (
            <Badge color={userPlan === 'operator' ? 'purple' : userPlan === 'pro' ? 'blue' : 'zinc'}>
              {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
            </Badge>
          )}
        </div>
      </div>
      {billingStatus === 'past_due' && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 sm:flex sm:items-center sm:justify-between">
          <span><strong>Payment failed</strong> — update your card to keep your team active.</span>
          <button type="button" onClick={async () => { const { data: { session } } = await createClient().auth.getSession(); const res = await fetch('/api/customer-portal', { method: 'POST', headers: { ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) } }); const data = await res.json().catch(() => ({})); if (data.url) window.location.href = data.url }} className="mt-3 font-semibold text-red-700 underline sm:mt-0">Update your card →</button>
        </div>
      )}

      {userPlan === 'none' && (
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800 sm:flex sm:items-center sm:justify-between">
          <span><strong>Choose a plan to activate your team.</strong></span>
          <Link href="/pricing" className="mt-3 font-semibold text-blue-700 underline sm:mt-0">View Plans →</Link>
        </div>
      )}

      <div className="w-full mt-8">
        <div className="flex flex-col w-full border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="py-2.5 px-4 bg-[#FAFAFA] flex items-center gap-3">
            <Image src={LogoPng} alt='logo' className='rounded-full size-6' />
            <span className="text-blue-500 font-medium  tracking-tight">
              Ask Jarvis
            </span>
          </div>
          <div>
            <textarea
              name="task_input"
              rows={1}
              placeholder="Ask anything, He knows your whole team..."
              value={jarvisInput}
              onChange={e => setJarvisInput(e.target.value)}
              onKeyDown={handleJarvisLauncherKeyDown}
              maxLength={20000}
              className='w-full px-6 py-2 sm:py-5 ring-0! outline-none max-h-150 min-h-16'
            />
          </div>
        </div>
      </div>

      <QuickActionsGrid />

      {/* ── My Team (pinned workers) ── */}
      {pinnedWorkers.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <Subheading>My Team</Subheading>
            <Link href="/dashboard/team" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Manage →
            </Link>
          </div>
          <Divider className="mt-3" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pinnedWorkers.map((w) => (
              <PinnedWorkerCard key={w.worker_slug} worker={w} />
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Tasks ── */}
      <section className="mt-8 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex items-center border-b border-[#E9EAEB] bg-[#FAFAFA] px-4 py-3">
          <h2 className="text-sm font-medium text-[#717680]">Recent Task</h2>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <>
            <div className="flex min-h-[190px] flex-col items-center justify-center px-4 py-8 text-center">
              <div className="sm:hidden">
                <Image src={IllustrationEmpty} alt="Empty tasks" className='size-30 mb-1' />
              </div>
              <div className="hidden sm:flex">
                <EmptyTasksIllustration />
              </div>
              <p className="font-semibold leading-5 text-zinc-800">No recent task yet</p>
              <p className="mt-1 text-[13px] leading-4 text-neutral-500">Tasks will appear here once you start using AI team</p>
            </div>
            <div className="flex items-center justify-center border-t border-[#E9EAEB] bg-[#FAFAFA] px-4 py-3">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-worker-picker'))}
                className="inline-flex cursor-pointer h-8 items-center justify-center gap-2 rounded-md border border-[#D5D7DA] bg-white px-4 text-sm font-medium text-[#414651] shadow-xs transition hover:border-blue-200 hover:text-blue-600"
              >
                Create New Task
                <span aria-hidden="true" className="text-base">+</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="divide-y divide-[#E9EAEB]">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} now={now} />
              ))}
            </div>
            <RecentTasksFooter
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </section>

      {/* ── Upgrade banner — only show to starter/none users, never during load or for pro/operator ── */}
      {(userPlan !== null && userPlan !== 'pro' && userPlan !== 'operator') && (
        <div className="mt-10 flex flex-col gap-4 rounded-xl border border-zinc-950/[0.06] bg-gradient-to-r from-zinc-50 via-blue-50/40 to-zinc-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
          <div>
            <p className="text-sm/6 font-semibold text-zinc-950">{userPlan === 'none' ? 'Choose a plan to activate your team' : 'Unlock all 70+ team members'}</p>
            <Text className="mt-0.5">
              {userPlan === 'none' ? 'Pick a plan to start using your AI team members.' : 'Upgrade to Pro for 50 heavy credits/month, brand memory, and access to every team member.'}
            </Text>
          </div>
          <UpgradeButton color="blue" className="w-full sm:w-auto sm:shrink-0">Upgrade to Pro →</UpgradeButton>
        </div>
      )}
      {/* ── Pro upgrade banner — show to pro users to nudge toward Operator ── */}
      {(userPlan === 'pro') && (
        <div className="mt-10 flex flex-col gap-4 rounded-xl border border-zinc-950/[0.06] bg-gradient-to-r from-zinc-50 via-blue-50/40 to-zinc-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
          <div>
            <p className="text-sm/6 font-semibold text-zinc-950">Ready for more?</p>
            <Text className="mt-0.5">
              Upgrade to Operator for 150 heavy credits/month, Workflows, Playbooks, and a 2nd team seat.
            </Text>
          </div>
          <UpgradeButton color="blue" className="w-full sm:w-auto sm:shrink-0">Upgrade to Operator →</UpgradeButton>
        </div>
      )}
    </>
  )
}

export default function DashboardHome() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Suspense fallback={null}>
      <DashboardHomeInner />
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
            <CompleteSetupWidget />
          </div>,
          document.body
        )}
    </Suspense>
  )
}
