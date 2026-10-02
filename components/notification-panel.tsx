
// @ts-nocheck
'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import NotificationEmptyPng from '@/public/images/notification/emptyNotification.png'
import * as Headless from '@headlessui/react'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { Ellipsis, MessageSquareText, PanelLeftClose } from 'lucide-react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

import { Text } from '@/components/text'
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
} from '@/components/dropdown'
import { Switch } from './switch'

import { createClient } from '@/lib/supabase/client'
import { workspaceFetch, WORKSPACE_CHANGED_EVENT } from '@/lib/workspace-client'
import { agentFetch } from '@/lib/agent-mode/api'

const LAST_SEEN_KEY = '3rdshift_notif_last_seen'

function getLastSeen() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LAST_SEEN_KEY)
}
function setLastSeen(iso) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_SEEN_KEY, iso)
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMins = Math.floor((now - d) / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Worker meta for Team Updates panel
const WORKER_META = {
  'ava-team-lead': { name: 'Ava', emoji: '⭐' },
  'content-writer': { name: 'Ava', emoji: '✍️' },
  'hook-specialist': { name: 'Sam', emoji: '🪝' },
  'email-copywriter': { name: 'Mira', emoji: '📧' },
  'ad-copywriter': { name: 'Tate', emoji: '📣' },
  'newsletter-writer': { name: 'Oscar', emoji: '📰' },
  'seo-strategist': { name: 'Kai', emoji: '🔍' },
  'social-media-creator': { name: 'Ash', emoji: '🎬' },
  'lead-generator': { name: 'Lenny', emoji: '🎯' },
  'spreadsheet-builder': { name: 'Sienna', emoji: '📊' },
  'product-naming-specialist': { name: 'Sully', emoji: '💡' },
}

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

function avatarKey(workerName: any) {
  return workerName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function avatarSrc(workerName: any) {
  if (!workerName) return null
  const key = avatarKey(workerName)
  return AVATAR_NAMES.has(key) ? `${AVATAR_BASE}/${key}.png` : null
}

// ---------------------------------------------------------------------------
// Workflow notification row (existing)
// ---------------------------------------------------------------------------
function WorkflowNotificationRow({ notification, onRead, onClose }) {
  // Try to find a worker name from the title to display avatar
  let workerName = ''
  for (const name of Array.from(AVATAR_NAMES)) {
    if (notification.title?.toLowerCase().includes(name)) {
      workerName = name.charAt(0).toUpperCase() + name.slice(1)
      break
    }
  }
  const workerAvatarSrc = workerName ? avatarSrc(workerName) : null

  return (
    <div className="group/row relative px-5 py-4 border-b border-zinc-100 last:border-0 hover:bg-zinc-50/30 transition-colors">
      <Link
        href={`/dashboard/agent-mode/runs/${notification.run_id || notification.id}`}
        onClick={() => {
          if (!notification.read) onRead(notification)
          onClose?.()
        }}
        className="absolute inset-0 z-0"
        aria-hidden="true"
      />

      {/* Top line with Avatar and Dropdown */}
      <div className="flex justify-between items-start mb-3 relative z-10 pointer-events-none">
        <Link
          href={`/dashboard/agent-mode/runs/${notification.run_id || notification.id}`}
          onClick={() => {
            if (!notification.read) onRead(notification)
            onClose?.()
          }}
          className="pointer-events-auto"
        >
          {workerAvatarSrc ? (
            <Image src={workerAvatarSrc} alt={workerName} width={32} height={32} className="size-8 rounded-full object-cover shrink-0" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm">
              {notification.emoji || '🔔'}
            </span>
          )}
        </Link>
        {/* Dropdown Menu */}
        <div className="relative z-10 pointer-events-auto">
          <Dropdown>
            <DropdownButton
              plain
              aria-label="More options"
              className="flex size-7 items-center justify-center rounded-lg hover:bg-zinc-950/5 bg-transparent transition-colors p-0!"
            >
              <Ellipsis className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-zinc-600" />
            </DropdownButton>
            <DropdownMenu anchor="bottom end" className="p-2 rounded-lg!">
              {!notification.read && (
                <DropdownItem
                  onClick={() => onRead(notification)}
                  className="flex gap-2 items-center hover:bg-zinc-950/5! data-focus:bg-zinc-950/5! cursor-pointer! rounded-md!"
                >
                  <DropdownLabel className="text-[#414651] text-xs">Mark as read</DropdownLabel>
                </DropdownItem>
              )}
              <DropdownItem
                href={`/dashboard/agent-mode/runs/${notification.run_id || notification.id}`}
                onClick={onClose}
                className="flex gap-2 items-center hover:bg-zinc-950/5! data-focus:bg-zinc-950/5! cursor-pointer! rounded-md!"
              >
                <DropdownLabel className="text-[#414651] text-xs">View workflows</DropdownLabel>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* Clickable content area */}
      <div className="relative z-10 pointer-events-none">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 w-full max-w-[75%]">
            {!notification.read && <span className="size-1.5 shrink-0 rounded-full bg-[#ef4444]" />}
            <span className="text-sm font-medium text-zinc-800 w-full truncate">{notification.title}</span>
          </div>
          <p className="text-xs text-neutral-500 justify-end">{formatTime(notification.time)}</p>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {notification.description}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team Update row
// ---------------------------------------------------------------------------
function TeamUpdateRow({ update, onRead, onNavigate }) {
  const meta = WORKER_META[update.worker_slug] || {
    name: update.worker_slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    emoji: '💡'
  }
  const workerAvatarSrc = avatarSrc(meta.name)

  return (
    <div className="group/row relative px-5 py-4 border-b border-zinc-100 last:border-0 hover:bg-zinc-50/30 transition-colors">
      {/* Top line with Avatar and Dropdown */}
      <div className="flex justify-between items-start">
        <div
          onClick={() => { onRead(update.id); onNavigate(update.worker_slug) }}
          className="cursor-pointer"
        >
          {workerAvatarSrc ? (
            <Image src={workerAvatarSrc} alt={meta.name} width={32} height={32} className="size-8 rounded-full object-cover shrink-0" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm">
              {meta.emoji}
            </span>
          )}
        </div>
        {/* Dropdown Menu */}
        <Dropdown>
          <DropdownButton
            plain
            aria-label="More options"
            className="flex size-7 items-center justify-center rounded-lg hover:bg-zinc-950/5 bg-transparent transition-colors p-0!"
          >
            <Ellipsis className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-zinc-600" />
          </DropdownButton>
          <DropdownMenu anchor="bottom end" className="p-2 rounded-lg!">
            {!update.read && (
              <DropdownItem
                onClick={() => onRead(update.id)}
                className="flex gap-2 items-center hover:bg-zinc-950/5! data-focus:bg-zinc-950/5! cursor-pointer! rounded-md!"
              >
                <DropdownLabel className="text-[#414651] text-xs">Mark as read</DropdownLabel>
              </DropdownItem>
            )}
            <DropdownItem
              onClick={() => onNavigate(update.worker_slug)}
              className="flex gap-2 items-center hover:bg-zinc-950/5! data-focus:bg-zinc-950/5! cursor-pointer! rounded-md!"
            >
              <DropdownLabel className="text-[#414651] text-xs">Go to chat</DropdownLabel>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      {/* Clickable content area (Name + Time + Description) */}
      <div
        onClick={() => { onRead(update.id); onNavigate(update.worker_slug) }}
        className="cursor-pointer mt-2"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            {!update.read && <span className="size-1.5 shrink-0 rounded-full bg-[#ef4444] max-lg:absolute max-lg:top-[20px]" />}
            <span className="text-sm font-semibold text-zinc-950">{meta.name}</span>
          </div>
          <span className="text-xs text-zinc-400">{formatTime(update.created_at)}</span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {update.preview_text}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Starter upsell row
// ---------------------------------------------------------------------------
function StarterUpsellRow() {
  return (
    <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50/10">
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5">
        <div className="flex items-start gap-2.5 mb-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm opacity-50">🔍</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-semibold text-zinc-400">Kai</span>
              <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-600">PRO</span>
            </div>
            <p className="text-xs text-zinc-400 blur-[3px] select-none line-clamp-1">Your competitor just published content ranking for your top keyword. Here&apos;s the angle they missed...</p>
          </div>
        </div>
        <Link href="/dashboard/settings/billing" className="block text-center text-xs font-semibold text-blue-600 hover:text-blue-700">
          Upgrade to Pro to hear from more of your team &rarr;
        </Link>
      </div>
    </div>
  )
}

function normalizeAlertUrl(url: string | null | undefined): string {
  if (!url) return ''
  let target = url.trim()
  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const parsed = new URL(target)
      target = parsed.pathname + parsed.search + parsed.hash
    } catch {
      // ignore
    }
  }
  if (target === '/dashboard/billing' || target.startsWith('/dashboard/billing?')) {
    target = target.replace('/dashboard/billing', '/dashboard/settings/billing')
  }
  return target
}

function cleanAlertLinkText(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\s*(?:&rarr;|→|➔|\u2192)+\s*$/g, '').trim()
}

// ---------------------------------------------------------------------------
// System/user alert row (Updates tab)
// ---------------------------------------------------------------------------
function AlertRow({ alert, onRead, onClose }) {
  const iconMap = {
    credit_depleted: '🔔',
    credit_low: '⚠️',
    new_worker: '🎉',
    product_update: '🚀',
  }
  const icon = iconMap[alert.type] || '🔔'

  const targetUrl = normalizeAlertUrl(alert.link_url)
  const linkText = cleanAlertLinkText(alert.link_text)

  return (
    <div className="group/row relative px-5 py-4 border-b border-zinc-100 last:border-0 hover:bg-zinc-50/30 transition-colors">
      {/* Top line with Icon and Dropdown */}
      <div className="flex justify-between items-start">
        <div
          onClick={() => {
            if (!alert.is_read) onRead(alert.id, alert._source)
          }}
          className="cursor-pointer"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm">
            {icon}
          </span>
        </div>
        {/* Dropdown Menu */}
        <Dropdown>
          <DropdownButton
            plain
            aria-label="More options"
            className="flex size-7 items-center justify-center rounded-lg hover:bg-zinc-950/5 bg-transparent transition-colors p-0!"
          >
            <Ellipsis className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-zinc-600" />
          </DropdownButton>
          <DropdownMenu anchor="bottom end" className="p-2 rounded-lg!">
            {!alert.is_read && (
              <DropdownItem
                onClick={() => onRead(alert.id, alert._source)}
                className="flex gap-2 items-center hover:bg-zinc-950/5! data-focus:bg-zinc-950/5! cursor-pointer! rounded-md!"
              >
                <DropdownLabel className="text-[#414651] text-xs">Mark as read</DropdownLabel>
              </DropdownItem>
            )}
            {targetUrl && linkText && (
              <DropdownItem
                href={targetUrl}
                onClick={onClose}
                className="flex gap-2 items-center hover:bg-zinc-950/5! data-focus:bg-zinc-950/5! cursor-pointer! rounded-md!"
              >
                <DropdownLabel className="text-[#414651] text-xs">{linkText}</DropdownLabel>
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>
      </div>

      {/* Clickable content area */}
      <div
        onClick={() => {
          if (!alert.is_read) onRead(alert.id, alert._source)
        }}
        className="cursor-pointer mt-2"
      >
        <div className="flex justify-between items-center">
          <div className="flex flex-1 items-center gap-1.5 max-w-[75%]">
            {!alert.is_read && <span className="size-1.5 shrink-0 rounded-full bg-[#ef4444] max-lg:absolute max-lg:top-[20px]" />}
            <span className="text-sm font-medium text-zinc-800 w-full truncate">{alert.title}</span>
          </div>
          <p className="text-xs text-neutral-500 justify-end">{formatTime(alert.created_at)}</p>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {alert.body}
        </p>
        {targetUrl && linkText && (
          <Link
            href={targetUrl}
            className="mt-1.5 inline-block text-xs font-medium text-blue-600 hover:text-blue-700"
            onClick={(e) => {
              e.stopPropagation()
              onClose?.()
            }}
          >
            {linkText} &rarr;
          </Link>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center bg-white">
      <div className="relative mb-6">
        <Image src={NotificationEmptyPng} alt='notification empty state' width={170} height={70} className='w-[170px] h-auto object-contain' quality={1000} />
      </div>
      <h3 className="text-sm font-semibold text-zinc-950">Nothing new yet</h3>
      <p className="mt-1.5 max-w-[280px] text-xs text-zinc-500 leading-normal">
        Your AI team will drop insights, updates, and suggestions here once work starts rolling.
      </p>
    </div>
  )
}

export function NotificationPanel({ open, onClose, onUnreadCountChange, sidebarCollapsed = false }) {
  const router = useRouter()
  const [tab, setTab] = useState('all')
  const [workflows, setWorkflows] = useState([])
  const [teamUpdates, setTeamUpdates] = useState([])
  const [alerts, setAlerts] = useState([])
  const [plan, setPlan] = useState('starter')
  const [loading, setLoading] = useState(false)
  const [teamLoaded, setTeamLoaded] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mediaQuery.matches)
    const handler = (e) => setIsMobile(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const handleClose = useCallback(() => {
    onClose?.()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('close-mobile-sidebar'))
    }
  }, [onClose])

  const prevIsMobileRef = useRef(isMobile)
  useEffect(() => {
    if (isMobile && !prevIsMobileRef.current && open) {
      handleClose()
    }
    prevIsMobileRef.current = isMobile
  }, [isMobile, open, handleClose])

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('notifications_enabled') !== 'false'
  })

  const toggleNotifications = () => {
    setNotificationsEnabled(prev => {
      const next = !prev
      localStorage.setItem('notifications_enabled', String(next))
      return next
    })
  }

  const fetchWorkflows = useCallback(async () => {
    try {
      const since = getLastSeen()
      const url = since ? `/api/agent-mode/notifications?since=${encodeURIComponent(since)}` : '/api/agent-mode/notifications'
      const res = await agentFetch(url)
      if (res.ok) {
        const data = await res.json()
        setWorkflows(data.notifications ?? [])
      }
    } catch { }
  }, [])

  const fetchAlerts = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/user-alerts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts ?? [])
      }
    } catch { }
  }, [])

  const fetchTeamUpdates = useCallback(async () => {
    setTeamError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setTeamError('Sign in again to load notifications.')
        return
      }
      const res = await workspaceFetch('/api/team-updates?limit=20', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setTeamUpdates(data.updates ?? [])
        setPlan(data.plan ?? 'starter')
      } else {
        setTeamError(data.error || 'Could not load team updates.')
      }
    } catch (error) {
      console.error('[notifications] Failed to fetch team updates', error)
      setTeamError('Could not load team updates.')
    } finally {
      setTeamLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setTeamLoaded(false)
    setTeamError('')
    Promise.all([fetchWorkflows(), fetchTeamUpdates(), fetchAlerts()]).finally(() => setLoading(false))
  }, [open, fetchWorkflows, fetchTeamUpdates, fetchAlerts])

  // useEffect(() => {
  //   if (!open || loading) return
  //   if (tab === 'team' && teamUpdates.length === 0 && (alerts.length > 0 || workflows.length > 0)) {
  //     setTab('all')
  //   }
  // }, [tab])

  const markTeamRead = async (id) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await workspaceFetch('/api/team-updates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'mark_read', id }),
      })
      setTeamUpdates(prev => prev.map(u => u.id === id ? { ...u, read: true } : u))
      onUnreadCountChange?.(prev => Math.max(0, (prev ?? 1) - 1))
    } catch { }
  }

  const markAllTeamRead = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await workspaceFetch('/api/team-updates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      setTeamUpdates(prev => prev.map(u => ({ ...u, read: true })))
      onUnreadCountChange?.(0)
    } catch { }
  }

  const handleTeamNav = (workerSlug) => {
    const navSlug = workerSlug === 'ava-team-lead' ? 'content-writer' : workerSlug
    router.push(`/dashboard/team/${navSlug}?tab=chat`)
    handleClose()
  }

  const markAlertRead = async (id, source) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch('/api/user-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'mark_read', id, source }),
      })
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
    } catch { }
  }

  const markAllWorkflowsRead = useCallback(() => {
    const now = new Date().toISOString()
    setLastSeen(now)
    setWorkflows(prev => prev.map(n => ({ ...n, read: true, group: 'earlier' })))
  }, [])

  const markWorkflowRead = useCallback((notification) => {
    const readThrough = notification.time || new Date().toISOString()
    setLastSeen(readThrough)
    setWorkflows(prev => prev.map(n => {
      if (n.id === notification.id) return { ...n, read: true, group: 'earlier' }
      if (n.time && new Date(n.time) <= new Date(readThrough)) {
        return { ...n, read: true, group: 'earlier' }
      }
      return n
    }))
  }, [])

  const markAllUpdatesRead = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetch('/api/user-alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'mark_all_read' }),
        })
      }
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
      markAllWorkflowsRead()
    } catch { }
  }

  const teamUnread = teamUpdates.filter(u => !u.read).length
  const alertsUnread = alerts.filter(a => !a.is_read).length
  const workflowUnread = workflows.filter(n => !n.read).length

  useEffect(() => {
    onUnreadCountChange?.(teamUnread + alertsUnread + workflowUnread)
  }, [teamUnread, alertsUnread, workflowUnread, onUnreadCountChange])

  const renderPanelContent = (isMobileView = false) => {
    return (
      <div className={`bg-zinc-100 lg:bg-white h-full overflow-auto ${isMobileView ? '' : 'shadow-xl rounded-xl shadow-zinc-900/15 ring-1 ring-zinc-950/5'}`}>
        {/* Header */}
        <div className={`flex flex-wrap lg:flex-nowrap items-center justify-between px-1.5 lg:px-5 pb-4 ${isMobileView ? 'pt-6' : 'pt-8'}`}>
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-3">
              {isMobileView && (
                <button
                  onClick={handleClose}
                  aria-label="Close notifications"
                  className="cursor-pointer flex lg:size-9 shrink-0 items-center justify-center lg:rounded-lg lg:border lg:border-zinc-200 lg:bg-white text-zinc-500 lg:shadow-sm transition hover:text-zinc-900"
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
              )}
              <h2 className="text-xl font-semibold text-zinc-800">Notification</h2>
            </div>
            {isMobileView && (
              <button
                onClick={handleClose}
                aria-label="Collapse panel"
                className="cursor-pointer flex size-8 items-center justify-center rounded-lg hover:bg-zinc-950/5 text-zinc-500 transition hover:text-zinc-900"
              >
                <PanelLeftClose className="size-5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 ml-auto lg:ml-0 mt-4 lg:mt-0">
            <div className="flex items-center gap-2">
              <Switch
                checked={notificationsEnabled}
                onChange={setNotificationsEnabled}
                color="blue"
                className="cursor-pointer"
              />
              <span className="text-sm font-medium text-zinc-700 min-w-13 w-full">
                {notificationsEnabled ? 'Unread' : 'Read'}
              </span>
            </div>

            <Dropdown>
              <DropdownButton
                plain
                aria-label="More options"
                className="flex size-8 items-center justify-center rounded-lg hover:bg-zinc-950/5 bg-transparent transition-colors p-0!"
              >
                <Ellipsis className="w-5! h-5! cursor-pointer" />
              </DropdownButton>
              <DropdownMenu anchor="bottom end" className="p-2 rounded-lg! sm:data-[anchor~=end]:[--anchor-offset:-0px]!">
                <DropdownItem
                  onClick={() => {
                    if (tab === 'all') {
                      markAllTeamRead()
                      markAllUpdatesRead()
                    } else if (tab === 'team') {
                      markAllTeamRead()
                    } else {
                      markAllUpdatesRead()
                    }
                  }}
                  className="flex gap-2 items-center hover:bg-zinc-950/5! data-focus:bg-zinc-950/5! cursor-pointer! rounded-md!"
                >
                  <MessageSquareText className="w-5 h-5 cursor-pointer text-[#414651]" />
                  <DropdownLabel className="text-[#414651] text-xs">Mark all as read</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        {/* Tabs - Pill Navigation */}
        <div className="px-1.5 lg:px-5">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-50 border border-zinc-200">
            <button
              onClick={() => setTab('all')}
              className={`w-fit px-2 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${tab === 'all'
                ? 'bg-white text-zinc-700'
                : 'text-[#717680] hover:text-zinc-800'
                }`}
            >
              All
              {(teamUnread + alertsUnread + workflowUnread) > 0 && (
                <span className="size-1.5 rounded-full bg-red-600" />
              )}
            </button>
            <button
              onClick={() => setTab('team')}
              className={`w-fit px-2 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${tab === 'team'
                ? 'bg-white text-zinc-700'
                : 'text-[#717680] hover:text-zinc-800'
                }`}
            >
              Team
              {teamUnread > 0 && (
                <span className="size-1.5 rounded-full bg-red-600" />
              )}
            </button>
            <button
              onClick={() => setTab('updates')}
              className={`w-fit px-2 flex items-center justify-center gap-2 py-1.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${tab === 'updates'
                ? 'bg-white text-zinc-700'
                : 'text-[#717680] hover:text-zinc-800'
                }`}
            >
              Updates
              {(alertsUnread + workflowUnread) > 0 && (
                <span className="size-1.5 rounded-full bg-red-600" />
              )}
            </button>
          </div>
        </div>

        {(loading || !teamLoaded) && teamUpdates.length === 0 && workflows.length === 0 ? (
          <div className="flex items-center justify-center h-[calc(100vh-160px)]">
            <div className="size-6 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
          </div>
        ) : (
          <div className="px-1 lg:px-5 mt-6">
            {/* Team tab */}
            {tab === 'team' && (
              <>
                {teamError ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-xl">!</span>
                    <p className="mt-4 text-sm font-medium text-zinc-950">Could not load team updates</p>
                    <Text className="mt-1 text-center text-xs">{teamError}</Text>
                  </div>
                ) : teamUpdates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-xl">👋</span>
                    <p className="mt-4 text-sm font-medium text-zinc-950">Your team will check in soon</p>
                    <Text className="mt-1 text-center text-xs">Ideas and alerts appear here after your first week of activity.</Text>
                  </div>
                ) : (
                  <div>
                    {teamUpdates.map(u => (
                      <TeamUpdateRow
                        key={u.id}
                        update={u}
                        onRead={markTeamRead}
                        onNavigate={handleTeamNav}
                      />
                    ))}
                    {/* Starter upsell */}
                    {plan === 'starter' && <StarterUpsellRow />}
                  </div>
                )}
              </>
            )}

            {/* Updates tab */}
            {tab === 'updates' && (
              <>
                {alerts.length === 0 && workflows.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs p-10 h-[calc(100vh-182px)]">
                    <EmptyState />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs max-h-[calc(100vh-182px)] overflow-y-auto">
                    {alerts.map(a => (
                      <AlertRow key={a.id} alert={a} onRead={markAlertRead} onClose={handleClose} />
                    ))}
                    {workflows.map(n => (
                      <WorkflowNotificationRow
                        key={n.id}
                        notification={n}
                        onRead={markWorkflowRead}
                        onClose={handleClose}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* All tab */}
            {tab === 'all' && (
              <>
                {teamUpdates.length === 0 && alerts.length === 0 && workflows.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs p-10 h-[calc(100vh-182px)]">
                    <EmptyState />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs max-h-[calc(100vh-182px)] overflow-y-auto">
                    {[
                      ...teamUpdates.map(u => ({ ...u, _rowType: 'team' })),
                      ...alerts.map(a => ({ ...a, _rowType: 'alert' })),
                      ...workflows.map(n => ({ ...n, _rowType: 'workflow' })),
                    ]
                      .sort((a, b) => {
                        const timeA = new Date(a.created_at || a.time || 0).getTime()
                        const timeB = new Date(b.created_at || b.time || 0).getTime()
                        return timeB - timeA
                      })
                      .map(item => {
                        if (item._rowType === 'team') {
                          return (
                            <TeamUpdateRow
                              key={item.id}
                              update={item}
                              onRead={markTeamRead}
                              onNavigate={handleTeamNav}
                            />
                          )
                        } else if (item._rowType === 'alert') {
                          return (
                            <AlertRow
                              key={item.id}
                              alert={item}
                              onRead={markAlertRead}
                              onClose={handleClose}
                            />
                          )
                        } else {
                          return (
                            <WorkflowNotificationRow
                              key={item.id}
                              notification={item}
                              onRead={markWorkflowRead}
                              onClose={handleClose}
                            />
                          )
                        }
                      })}
                    {plan === 'starter' && <StarterUpsellRow />}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop only covers main content area — sidebar stays visible */}
      <div
        className="fixed inset-y-0 z-[60] bg-black/50 backdrop-blur-md transition-[left,opacity] duration-300 ease-in-out max-lg:hidden"
        style={{ left: `${sidebarCollapsed ? 148 : 376}px`, right: 0 }}
        onClick={onClose}
      />
      {/* Panel slides out to the RIGHT of the sidebar */}
      <div
        className="fixed inset-y-0 z-[70] w-[280px] lg:max-w-[447px] w-full h-screen bg-zinc-300 max-lg:hidden p-2 pl-0 rounded-r-xl transition-[left] duration-300 ease-in-out"
        style={{ left: `${sidebarCollapsed ? 148 : 376}px` }}
      >
        {renderPanelContent(false)}
      </div>

      {/* Mobile view: Drawer slides in from the left (same as settings drawer) */}
      {isMobile && (
        <Headless.Transition show={open} as={Fragment}>
          <div className="lg:hidden">
            <Headless.TransitionChild
              as={Fragment}
              enter="transition-opacity ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div
                className="fixed inset-y-0 right-0 z-[60] bg-black/30"
                style={{ left: '64px' }}
                onClick={onClose}
              />
            </Headless.TransitionChild>

            <Headless.TransitionChild
              as={Fragment}
              enter="transition-transform ease-out duration-300"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition-transform ease-in duration-200"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <div className="fixed inset-y-0 left-[64px] z-[70] max-[390px]:w-[246px] w-[284px]">
                <div className="flex h-full flex-col bg-zinc-100 shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
                  {renderPanelContent(true)}
                </div>
              </div>
            </Headless.TransitionChild>
          </div>
        </Headless.Transition>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Bell button — shows combined unread count (team updates primary)
// ---------------------------------------------------------------------------
export function NotificationBell({ unreadCount = 0, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-zinc-950/5"
      aria-label="Notifications"
      data-team-updates-bell="true"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-zinc-500">
        <path
          d="M10 2a5.002 5.002 0 00-4.9 4.01C4.43 8.51 4 11 4 12.5c0 .5-.5 1.5-1 2h14c-.5-.5-1-1.5-1-2 0-1.5-.43-3.99-1.1-6.49A5.002 5.002 0 0010 2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 14.5a2.5 2.5 0 005 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Hook — fetch combined unread count (team updates + workflows)
// ---------------------------------------------------------------------------
export function useNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchCount = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setUnreadCount(0)
        return
      }
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [teamRes, alertsRes] = await Promise.all([
        workspaceFetch('/api/team-updates?limit=20', { headers }),
        fetch('/api/user-alerts', { headers }),
      ])
      let total = 0
      if (teamRes.ok) {
        const d = await teamRes.json()
        total += (d.updates ?? []).filter((update) => !update.read).length
      }
      if (alertsRes.ok) {
        const d = await alertsRes.json()
        total += (d.alerts ?? []).filter((alert) => !alert.is_read).length
      }
      setUnreadCount(total)
    } catch {
      setUnreadCount(0)
    }
  }, [])

  useEffect(() => {
    fetchCount()
    // Poll every 2 minutes
    const interval = setInterval(fetchCount, 2 * 60 * 1000)
    window.addEventListener(WORKSPACE_CHANGED_EVENT, fetchCount)
    window.addEventListener('storage', fetchCount)
    return () => {
      clearInterval(interval)
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, fetchCount)
      window.removeEventListener('storage', fetchCount)
    }
  }, [fetchCount])

  // Set up Supabase realtime for instant badge updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('team-updates-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_updates' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_alerts' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notification_reads' }, fetchCount)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCount])

  return [unreadCount, setUnreadCount]
}
