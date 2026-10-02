// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import {
  ArrowRightStartOnRectangleIcon,
  Cog8ToothIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import {
  Cog6ToothIcon,
  ChevronLeftIcon,
  GiftIcon,
  BoltIcon,
  LockClosedIcon,
  UserIcon,
} from '@heroicons/react/20/solid'
import { Activity, BadgeQuestionMark, Bell, Book, BookOpen, BookText, ChartColumnIncreasing, ChartPie, Check, ChevronDown, ChevronUp, CircleUser, Clock, CopyCheck, CreditCard, Download, Gift, GitBranch, LogOut, Network, PanelLeftClose, PanelLeftOpen, Settings, TriangleAlert, UserPen, UserRoundPlus, Users, Waypoints, X } from 'lucide-react'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid'
import LogoCutoutPng from '@/public/logoCutout.png'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { Avatar } from '@/components/avatar'
import InstallBanner from '@/components/pwa/InstallBanner'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/dropdown'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '@/components/sidebar'
import { NotificationBell, NotificationPanel, useNotificationCount } from '@/components/notification-panel'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal'
import CreditAlerts from '@/components/agent-mode/CreditAlerts'
import UpgradePlanModal from './dashboard/UpgradePlanModal'
import { ProfileBottomSheet } from './ProfileBottomSheet'
import WorkerPicker from './agent-mode/WorkerPicker'
import JarvisChat from './jarvis/JarvisChat'

import { getWorkspaceInitials } from '@/lib/initials'
import { clearStoredWorkspaceId, getStoredWorkspaceId, setStoredWorkspaceId } from '@/lib/workspace-client'
import { createClient } from '@/lib/supabase/client'
import { getCreditDisplaySummary } from '@/lib/billing/credit-balance'
import { Dialog, DialogBody, DialogTitle } from './dialog'

// import UpgradeSuccessModal from './dashboard/UpgadeSuccessModal'

function Logo({ src = null, initials = '', className = '' }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Company logo" className={`w-7.5 h-7.5 rounded-full object-cover ${className}`} />
  }

  if (initials) {
    return (
      <span className={`flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-semibold text-white ${className}`}>
        {initials}
      </span>
    )
  }

  return (
    <Image src={LogoCutoutPng} alt="3rdShift" style={{ height: '40px', width: 'auto' }} className={className} />
  )
}

const PLAN_CREDIT_LIMITS = {
  starter: 0,
  pro: 50,
  operator: 150,
}

const PLAN_TASK_LIMITS = {
  starter: 200,
  pro: 500,
  operator: 1250,
}

function RailShortcut({ href, label, description, tooltipContent, children, active, onClick, className = '', tooltipClassName = '', tooltipArrowClassName = '' }) {
  const iconSpan = (
    <span className={`flex size-10 items-center justify-center rounded-md bg-white text-zinc-600 shadow-sm border border-[#E5E5E5] transition hover:text-blue-600 hover:ring-blue-200 cursor-pointer ${active ? 'text-blue-600 ring-blue-200' : ''} ${className}`}>
      {children}
    </span>
  )

  const trigger = onClick
    ? <button type="button" onClick={onClick} aria-label={label}>{iconSpan}</button>
    : <Link href={href} aria-label={label} className="flex">{iconSpan}</Link>

  if (!description && !tooltipContent) return trigger

  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={12}
          className={`z-[80] w-[250px] min-[390px]:w-[305px] sm:w-[336px] rounded-lg bg-white px-4 py-3 text-sm text-zinc-700 shadow-xl ${tooltipClassName}`}
        >
          <span className={`absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 bg-white ${tooltipArrowClassName}`} />
          {tooltipContent || (
            <>
              <span className="block font-semibold text-zinc-900">{label}</span>
              <span className="mt-1 block leading-5">{description}</span>
            </>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

function SidebarToggleButton({ collapsed, onClick, className = '' }) {
  const Icon = collapsed ? PanelLeftOpen : X
  const label = collapsed ? 'Open sidebar' : 'Collapse sidebar'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 items-center justify-center text-zinc-500 transition hover:text-zinc-900 cursor-pointer ${className}`}
    >
      <Icon className={`${collapsed ? 'size-5' : 'size-4'}`} />
    </button>
  )
}

function CollapsedRailItem({ href, label, active, onClick, children, badge, className = '' }) {
  const itemClassName = `relative flex size-9 items-center justify-center rounded-lg transition cursor-pointer ${active
    ? 'bg-[#f5f8ff] text-blue-500'
    : 'text-zinc-500 hover:bg-white hover:text-zinc-900'
    } ${className}`
  const content = (
    <>
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold leading-none text-white ring-2 ring-white">
          {badge}
        </span>
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={itemClassName}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={itemClassName}>
      {content}
    </button>
  )
}

export function ApplicationLayout({ children }) {
  const pathname = usePathname()
  const isSettingsPage = pathname.startsWith('/dashboard/settings')
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useNotificationCount()
  const [isFoundingMember, setIsFoundingMember] = useState(false)
  const [userProfile, setUserProfile] = useState({ name: '', email: '', initials: '', plan: '', avatarUrl: null })
  const [userProfileLoaded, setUserProfileLoaded] = useState(false)
  const [activeTaskCount, setActiveTaskCount] = useState(0)
  const [agentModeUpgradeOpen, setAgentModeUpgradeOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null)
  const [activeWorkspaceLogoUrl, setActiveWorkspaceLogoUrl] = useState(null)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [workspacePlanLoaded, setWorkspacePlanLoaded] = useState(false)
  const [isOwner, setIsOwner] = useState(null) // null = loading; true = owner; false = member
  const [creditsZero, setCreditsZero] = useState(false)
  const [creditSummary, setCreditSummary] = useState({ remaining: 0, limit: 0 })
  const [completedTaskCount, setCompletedTaskCount] = useState(0)
  const [creditSummaryLoaded, setCreditSummaryLoaded] = useState(false)
  const [completedTaskCountLoaded, setCompletedTaskCountLoaded] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const accountDropdownRef = useRef(null)
  const router = useRouter()
  const [, setOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [workspaceAccordionOpen, setWorkspaceAccordionOpen] = useState(
    () => pathname.startsWith('/dashboard/agent-mode')
  )
  const [showWorkerPicker, setShowWorkerPicker] = useState(false)

  const canAccessReferrals = Boolean(userProfile.plan && userProfile.plan !== 'none')
  // Allow pages/components to open the WorkerPicker by dispatching a global event:
  useEffect(() => {
    const handler = () => setShowWorkerPicker(true)
    window.addEventListener('open-worker-picker', handler)
    return () => window.removeEventListener('open-worker-picker', handler)
  }, [])

  useEffect(() => {
    if (pathname.startsWith('/dashboard/agent-mode')) {
      setWorkspaceAccordionOpen(true)
    }
  }, [pathname])

  useEffect(() => {
    setNotifOpen(false)
  }, [pathname])

  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [])


  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      const fallbackName = user.user_metadata?.full_name || user.email || ''
      const fallbackEmail = user.email || ''
      const fallbackParts = fallbackName.trim().split(' ').filter(Boolean)
      const fallbackInitials = fallbackParts.length >= 2
        ? (fallbackParts[0][0] + fallbackParts[fallbackParts.length - 1][0]).toUpperCase()
        : fallbackName.slice(0, 2).toUpperCase()
      setUserProfile({
        name: fallbackName || fallbackEmail,
        email: fallbackEmail,
        initials: fallbackInitials || '??',
        plan: '',
        avatarUrl: user.user_metadata?.avatar_url || null,
      })

      supabase
        .from('profiles')
        .select('is_founding_member, full_name, plan, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_founding_member) setIsFoundingMember(true)
          const name = data?.full_name || user.user_metadata?.full_name || user.email || ''
          const email = user.email || ''
          const profilePlan = data?.plan || ''
          const parts = name.trim().split(' ').filter(Boolean)
          const initials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase()
          setUserProfile({ name: name || email, email, initials: initials || '??', plan: profilePlan, avatarUrl: data?.avatar_url || null })
        })
        .catch(() => { })
        .finally(() => setUserProfileLoaded(true))

      // Load active workspace info — workspace plan overrides profile plan for seat members
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setWorkspacePlanLoaded(true)
          setCreditSummaryLoaded(true)
          return
        }
        const loadWorkspace = (useStoredWorkspace = true) => {
          const storedWsId = useStoredWorkspace ? getStoredWorkspaceId() : null
          const headers = { 'Authorization': `Bearer ${session.access_token}` }
          if (storedWsId) headers['x-workspace-id'] = storedWsId

          return fetch('/api/workspace', { headers })
            .then(async r => {
              const d = await r.json().catch(() => ({}))
              if (!r.ok && storedWsId && d?.error === 'No workspace found') {
                clearStoredWorkspaceId()
                return loadWorkspace(false)
              }
              if (!r.ok) throw new Error(d?.error || 'Workspace load failed')
              return d
            })
        }

        loadWorkspace()
          .then(d => {
            if (d.workspaces) setWorkspaces(d.workspaces)
            const resolvedId = d.activeWorkspaceId
            if (resolvedId) {
              setActiveWorkspaceId(resolvedId)
              // Persist to localStorage so all API calls use this workspace
              setStoredWorkspaceId(resolvedId)
              const ws = d.workspaces?.find(w => w.id === resolvedId)
              setActiveWorkspaceLogoUrl(prev => ws?.company_logo_url || prev || null)
              if (!ws?.company_logo_url) {
                const logoHeaders = {
                  'Authorization': `Bearer ${session.access_token}`,
                  'x-workspace-id': resolvedId,
                }
                fetch('/api/company-logo', { headers: logoHeaders })
                  .then(r => r.ok ? r.json() : null)
                  .then(logoData => {
                    if (logoData?.logoUrl) setActiveWorkspaceLogoUrl(logoData.logoUrl)
                  })
                  .catch(() => { })
              }
              // ownerCredits.plan = workspace owner's profile plan (seat members get this)
              // Fall back to ws.plan for owners (ownerCredits is null for owners)
              const resolvedPlan = d.ownerCredits?.plan || ws?.plan
              if (resolvedPlan) {
                setUserProfile(prev => ({ ...prev, plan: resolvedPlan }))
              }
            }
            // Check credits for sidebar red dot
            const ownerCredits = d.ownerCredits?.available_credits_remaining
            const ownerPlanCredits = d.ownerCredits?.plan_credits_remaining ?? d.ownerCredits?.heavy_credits_remaining
            const ownerTopupCredits = d.ownerCredits?.topup_credits_remaining ?? 0
            const ownerLimit = d.ownerCredits?.included_credits_limit ?? d.ownerCredits?.heavy_credits_limit
            const workspaceLimit = d.workspaces?.find(w => w.id === d.activeWorkspaceId)?.heavy_credits_limit
            const planLimit = PLAN_CREDIT_LIMITS[(d.ownerCredits?.plan || d.workspaces?.find(w => w.id === d.activeWorkspaceId)?.plan || '').toLowerCase()] ?? 0
            if (typeof ownerCredits === 'number') {
              setCreditsZero(ownerCredits === 0)
              setCreditSummary({
                remaining: ownerCredits,
                limit: ownerLimit ?? workspaceLimit ?? planLimit,
                planRemaining: ownerPlanCredits ?? ownerCredits,
                topupRemaining: ownerTopupCredits,
              })
              setCreditSummaryLoaded(true)
            } else {
              // Fallback: fetch profile + active top-ups directly for owners
              Promise.all([
                supabase.from('profiles').select('heavy_credits_remaining, plan').eq('id', user.id).single(),
                supabase.from('credit_topups').select('credits_remaining, expires_at').eq('user_id', user.id).gt('credits_remaining', 0),
              ])
                .then(([{ data: p }, { data: topups }]) => {
                  if (!p) return
                  const planRemaining = Math.max(Number(p.heavy_credits_remaining ?? 0), 0)
                  const topupRemaining = (topups ?? [])
                    .filter((t) => !t.expires_at || new Date(t.expires_at).getTime() > Date.now())
                    .reduce((sum, t) => sum + Math.max(Number(t.credits_remaining ?? 0), 0), 0)
                  const remaining = planRemaining + topupRemaining
                  setCreditsZero(remaining === 0)
                  setCreditSummary({
                    remaining,
                    limit: PLAN_CREDIT_LIMITS[(p.plan || '').toLowerCase()] ?? 0,
                    planRemaining,
                    topupRemaining,
                  })
                })
                .finally(() => setCreditSummaryLoaded(true))
            }
            if (d.userRole) setIsOwner(d.userRole === 'owner')
            setWorkspacePlanLoaded(true)
          }).catch(() => {
            setWorkspacePlanLoaded(true)
            setCreditSummaryLoaded(true)
          })
      })

      // Load real active task count (processing + pending)
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['processing', 'pending'])
        .then(({ count }) => {
          setActiveTaskCount(count || 0)
        })

      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .then(({ count }) => {
          setCompletedTaskCount(count || 0)
        })
        .finally(() => setCompletedTaskCountLoaded(true))
    })
  }, [])

  // Listen for avatar updates from the settings page
  useEffect(() => {
    const handler = (e) => {
      setUserProfile(prev => ({ ...prev, avatarUrl: e.detail.avatarUrl || null }))
    }
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      const logoUrl = e.detail.logoUrl || null
      setActiveWorkspaceLogoUrl(logoUrl)
      setWorkspaces(prev => prev.map(workspace => (
        workspace.id === activeWorkspaceId
          ? { ...workspace, company_logo_url: logoUrl }
          : workspace
      )))
    }
    window.addEventListener('company-logo-updated', handler)
    return () => window.removeEventListener('company-logo-updated', handler)
  }, [activeWorkspaceId])

  useEffect(() => {
    if (!activeWorkspaceId) return

    let cancelled = false
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      fetch('/api/company-logo', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-workspace-id': activeWorkspaceId,
        },
      })
        .then(r => r.ok ? r.json() : null)
        .then(logoData => {
          if (cancelled) return
          const logoUrl = logoData?.logoUrl || null
          setActiveWorkspaceLogoUrl(logoUrl)
          setWorkspaces(prev => prev.map(workspace => (
            workspace.id === activeWorkspaceId
              ? { ...workspace, company_logo_url: logoUrl }
              : workspace
          )))
        })
        .catch(() => { })
    })

    return () => {
      cancelled = true
    }
  }, [activeWorkspaceId, pathname])

  useEffect(() => {
    if (!accountMenuOpen) return

    const handlePointerDown = (event) => {
      if (accountMenuRef.current?.contains(event.target)) return
      if (accountDropdownRef.current?.contains(event.target)) return
      setAccountMenuOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [accountMenuOpen])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearStoredWorkspaceId()
    router.push('/login')
  }

  const handleSwitchWorkspace = (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) return
    setStoredWorkspaceId(workspaceId)
    setActiveWorkspaceId(workspaceId)
    window.location.reload()
  }
  const activeWorkspaceName = workspaces.find(w => w.id === activeWorkspaceId)?.name ||
    (userProfile.name ? `${userProfile.name.split(' ')[0]}'s Workspace` : 'My Workspace')
  const activeCompanyLogoUrl = activeWorkspaceLogoUrl || workspaces.find(w => w.id === activeWorkspaceId)?.company_logo_url || null
  const activeWorkspaceInitials = getWorkspaceInitials(activeWorkspaceName)
  const creditLimit = creditSummary.limit || PLAN_CREDIT_LIMITS[(userProfile.plan || '').toLowerCase()] || 0
  const creditDisplay = getCreditDisplaySummary({
    planCreditsRemaining: creditSummary.planRemaining ?? creditSummary.remaining,
    topupCreditsRemaining: creditSummary.topupRemaining ?? 0,
    includedCreditsLimit: creditLimit,
  })
  const creditPercent = creditLimit > 0 ? Math.min(100, Math.max(0, Math.round((creditDisplay.availableCreditsRemaining / creditLimit) * 100))) : 0
  const taskLimit = PLAN_TASK_LIMITS[(userProfile.plan || '').toLowerCase()] || 1250
  const completedTaskPercent = taskLimit > 0 ? Math.min(100, Math.max(0, Math.round((completedTaskCount / taskLimit) * 100))) : 0
  const userAvatarSrc = userProfileLoaded ? userProfile.avatarUrl || undefined : undefined
  const userAvatarInitials = userProfileLoaded && !userProfile.avatarUrl ? userProfile.initials : undefined
  const userAvatarClassName = !userProfileLoaded
    ? 'bg-black/20 animate-pulse text-transparent'
    : !userProfile.avatarUrl
      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'
      : ''
  const sidebarHeaderLoaded = userProfileLoaded && workspacePlanLoaded
  const isAccountSettingsActive = pathname === '/dashboard/settings' || pathname === '/dashboard/settings/account'

  const [mobileAccountMenuOpen, setMobileAccountMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mobileBottomSheet = window.matchMedia('(max-width: 1023px)')
    const updateMobile = (e) => {
      const matches = typeof e === 'boolean' ? e : e.matches
      setIsMobile(matches)
      if (matches) {
        setAccountMenuOpen(false)
      } else {
        setMobileAccountMenuOpen(false)
      }
    }
    updateMobile(mobileBottomSheet)
    const handler = (e) => updateMobile(e)
    mobileBottomSheet.addEventListener('change', handler)
    return () => mobileBottomSheet.removeEventListener('change', handler)
  }, [])


  return (
    <>
      <SidebarLayout
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        navbar={
          <Navbar>
            <NavbarSpacer />
            {/* <NavbarSection>
              <NavbarItem onClick={() => setNotifOpen(o => !o)}><NotificationBell unreadCount={unreadCount} onClick={() => setNotifOpen(o => !o)} /></NavbarItem>
              <Dropdown>
                <DropdownButton as={NavbarItem}>
                  <Avatar
                    src={userAvatarSrc}
                    initials={userAvatarInitials}
                    className={`size-8 ${userAvatarClassName}`}
                    square
                  />
                </DropdownButton>
                <DropdownMenu className="min-w-64" anchor="bottom end">
                  <DropdownItem href="/dashboard/settings">
                    <Cog8ToothIcon />
                    <DropdownLabel>Settings</DropdownLabel>
                  </DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={handleSignOut}>
                    <ArrowRightStartOnRectangleIcon />
                    <DropdownLabel>Sign out</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </NavbarSection> */}
          </Navbar>
        }
        sidebar={({ collapsed: sidebarCollapsed = false, toggleCollapsed: toggleSidebarCollapsed = () => { }, isMobileSidebar = false } = {}) => (
          <Sidebar className="lg:relative lg:bg-zinc-300 p-0 lg:flex-row! lg:gap-3 lg:p-2 lg:pr-0 dark:bg-zinc-950 px-0! lg:px-2!">
            <TooltipPrimitive.Provider delayDuration={200}>
              <div className="w-16 lg:w-11 shrink-0 flex-col items-center gap-4 pt-5 flex h-[calc(100vh-16px)]">
                <Link href="/dashboard" aria-label="Dashboard" className="mb-4 flex size-10 items-center justify-center">
                  <Logo />
                </Link>
                <div className="space-y-4 flex flex-col justify-center items-center">
                  {!workspacePlanLoaded ? (
                    <Skeleton className="size-10 rounded-lg bg-[#c5cad1]" />
                  ) : (
                    <>
                      {workspaces.map((workspace) => (
                        <RailShortcut
                          key={workspace.id}
                          label={workspace.name}
                          onClick={() => {
                            handleSwitchWorkspace(workspace.id)
                            setMobileAccountMenuOpen(false)
                          }}
                          active={pathname === '/dashboard/settings/brand-context'}
                          tooltipClassName='w-[250px]! min-[390px]:w-[305px]! sm:w-[336px]! border border-zinc-200'
                          tooltipArrowClassName='hidden'
                          tooltipContent={
                            <span className="relative block">
                              <div className="flex items-center gap-3">
                                <span className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white`}>
                                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 transition-all`}>
                                    <Logo
                                      src={workspace.company_logo_url}
                                      initials={getWorkspaceInitials(workspace.name)}
                                      className="w-6 h-6 rounded-full"
                                    />
                                  </div>
                                </span>
                                <span className="min-w-0">
                                  <span className={`block truncate font-semibold`}>
                                    {workspace.name}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-zinc-500">Company workspace</span>
                                </span>
                              </div>
                              <div className='flex flex-col min-[390px]:flex-row items-center gap-2 justify-between mt-3.5'>
                                <Link
                                  href="/dashboard/settings/brand-context"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 sm:px-4 font-semibold text-body text-sm shadow-sm transition hover:border-blue-200 hover:bg-blue-50 cursor-pointer w-full min-[390px]:w-auto"
                                >
                                  <Cog6ToothIcon className="size-4 fill-current" />
                                  Settings
                                </Link>
                                <Link
                                  href="/dashboard/settings/invite-members"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 sm:px-4 text-sm font-semibold text-body shadow-sm transition hover:border-blue-200 hover:bg-blue-50 cursor-pointer w-full min-[390px]:w-auto"
                                >
                                  <Users className="size-4 fill-current" />
                                  Invite members
                                </Link>
                              </div>
                            </span>
                          }
                          className={`overflow-hidden p-1 ${workspace.id === activeWorkspaceId ? 'ring-1! ring-black!' : ''
                            }`}
                        >
                          <div className={`relative flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 transition-all overflow-visible`}>
                            <Logo
                              src={workspace.company_logo_url}
                              initials={getWorkspaceInitials(workspace.name)}
                              className="w-6 h-6 rounded-full"
                            />
                          </div>
                        </RailShortcut>
                      ))}
                    </>
                  )}
                </div>
                <RailShortcut
                  label="Add New Workspace"
                  description="Workspaces keep your team members, tasks, and brand profile separate. Create one per business or client."
                  onClick={() => setShowCreateWorkspace(true)}
                  className="border! border-[#717680]! bg-transparent!"
                >
                  <PlusIcon className="size-5" />
                </RailShortcut>

                <div className="mt-auto flex flex-col items-center gap-4 pb-5">
                  {canAccessReferrals && (
                    <RailShortcut href="/dashboard/referrals" label="Refer & Earn" description="Share 3rdShift and earn 20% of every payment from customers you refer — for life." active={pathname.startsWith('/dashboard/referrals')} className='bg-transparent! border-0! shadow-none!'>
                      <GiftIcon className={`size-6 ${pathname.startsWith('/dashboard/referrals') ? 'text-blue-500' : 'text-[#717680]'}`} />
                    </RailShortcut>
                  )}
                  <RailShortcut href="/dashboard/help" label="Help & Support" description="Access our comprehensive resource center to find quick answers, step-by-step tutorials, or contact our dedicated support team for assistance." active={pathname.startsWith('/dashboard/help')} className='bg-transparent! border-0! shadow-none!'>
                    <ChatBubbleLeftRightIcon className={`size-6 ${pathname.startsWith('/dashboard/help') ? 'text-blue-500' : 'text-[#717680]'}`} />
                  </RailShortcut>
                  <div ref={isMobileSidebar ? undefined : accountMenuRef} className="relative flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (isMobile || isMobileSidebar) {
                          setMobileAccountMenuOpen(true)
                        } else {
                          setAccountMenuOpen(open => !open)
                        }
                      }}
                      aria-label="Account menu"
                      aria-expanded={(isMobile || isMobileSidebar) ? mobileAccountMenuOpen : accountMenuOpen}
                      className="flex size-10 items-center justify-center rounded-full transition hover:ring-2 hover:ring-blue-200 cursor-pointer"
                    >
                      <Avatar
                        src={userAvatarSrc}
                        initials={userAvatarInitials}
                        alt={userProfile.name || 'Account'}
                        className={`size-10 rounded-full! ${userAvatarClassName}`}
                      />
                    </button>

                    {/* Desktop dropdown is rendered via portal — see createPortal below */}
                  </div>
                </div>
              </div>
            </TooltipPrimitive.Provider>

            <div
              className={`overflow-hidden flex min-w-0 flex-1 flex-col h-[calc(100vh-16px)] bg-zinc-100 shadow-sm lg:flex-none lg:rounded-xl scrollable transition-[width,opacity,transform] duration-300 ease-in-out relative ${sidebarCollapsed
                ? 'lg:w-20 lg:translate-x-0 lg:bg-zinc-100! lg:opacity-100'
                : 'lg:w-76.5 lg:translate-x-0 lg:opacity-100'
                }`}
            >
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {sidebarCollapsed ? (
                  <>
                    <div className="flex justify-center px-2 pt-4">
                      <SidebarToggleButton collapsed onClick={toggleSidebarCollapsed} />
                    </div>

                    <div className="mt-1 flex flex-1 flex-col items-center gap-3 px-2 min-h-0">
                      {isSettingsPage ? (
                        <>
                          <CollapsedRailItem href="/dashboard/settings/account" label="Account Info" active={isAccountSettingsActive}>
                            <CircleUser className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/install-app" label="Install The App" active={pathname === '/dashboard/settings/install-app'}>
                            <Download className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/billing" label="Billing" active={pathname === '/dashboard/settings/billing'}>
                            <CreditCard className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/integration" label="Integrations" active={pathname === '/dashboard/settings/integration'}>
                            <Network className="size-5 -rotate-90" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/brand-context" label="Brand Context" active={pathname === '/dashboard/settings/brand-context'}>
                            <Book className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/invite-members" label="Invite Members" active={pathname === '/dashboard/settings/invite-members'}>
                            <UserRoundPlus className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/workspace-usage" label="Workspace usage" active={pathname === '/dashboard/settings/workspace-usage'}>
                            <ChartPie className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/team-update" label="Team Update" active={pathname === '/dashboard/settings/team-update'}>
                            <UserPen className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/memory" label="Memory" active={pathname === '/dashboard/settings/memory'}>
                            <Clock className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/settings/delete-account" label="Delete Account" active={pathname === '/dashboard/settings/delete-account'}>
                            <TriangleAlert className="size-5" />
                          </CollapsedRailItem>
                        </>
                      ) : (
                        <>
                          <CollapsedRailItem
                            label="Notifications"
                            active={notifOpen}
                            onClick={() => setNotifOpen(open => !open)}
                            badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : null}
                          >
                            <Bell className="size-5 cursor-pointer" />
                          </CollapsedRailItem>
                          <CollapsedRailItem onClick={() => setShowWorkerPicker(true)} label="Add Task" className='bg-blue-500! text-white!'>
                            <PlusIcon className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard" label="Dashboard" active={pathname === '/dashboard'}>
                            <ChartColumnIncreasing className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem href="/dashboard/team" label="Team Members" active={pathname.startsWith('/dashboard/team')}>
                            <Users className="size-5" />
                          </CollapsedRailItem>
                          <CollapsedRailItem
                            href="/dashboard/tasks"
                            label="My Tasks"
                            active={pathname.startsWith('/dashboard/tasks')}
                            badge={activeTaskCount > 0 ? (activeTaskCount > 9 ? '9+' : activeTaskCount) : null}
                          >
                            <CopyCheck className="size-5" />
                          </CollapsedRailItem>
                          {isOwner === true && (
                            (!workspacePlanLoaded || userProfile.plan === 'operator') ? (
                              <div className="space-y-3">
                                <CollapsedRailItem label="Workflows" href="/dashboard/agent-mode/chains" current={pathname === '/dashboard/agent-mode/chains'}>
                                  <Waypoints className='size-5' />
                                </CollapsedRailItem>
                                <CollapsedRailItem label="Playbooks" href="/dashboard/agent-mode/playbooks" current={pathname === '/dashboard/agent-mode/playbooks'}>
                                  <BookOpen className='size-5' />
                                </CollapsedRailItem>
                                {/* <CollapsedRailItem label="My Playbook" href="/dashboard/agent-mode/my-playbook" current={pathname === '/dashboard/agent-mode/my-playbook'}>
                                  <BookText className='size-5' />
                                </CollapsedRailItem> */}
                                {/* <CollapsedRailItem label="Activity" href="/dashboard/agent-mode/activity" current={pathname === '/dashboard/agent-mode/activity'}>
                                  <Activity className='size-5' />
                                </CollapsedRailItem> */}
                              </div>
                            ) : (
                              <CollapsedRailItem label="Workflows" active={false} onClick={() => setAgentModeUpgradeOpen(true)}>
                                <BoltIcon className="size-5" />
                              </CollapsedRailItem>
                            )
                          )}
                          {canAccessReferrals && (
                            <CollapsedRailItem href="/dashboard/referrals" label="Referrals" active={pathname.startsWith('/dashboard/referrals')}>
                              <Gift className="size-5" />
                            </CollapsedRailItem>
                          )}
                          <CollapsedRailItem href="/dashboard/settings/account" label="Setting Workspace" active={pathname.startsWith('/dashboard/settings')}>
                            <Settings className="size-5" />
                          </CollapsedRailItem>
                        </>
                      )}
                    </div>

                    <div className="mt-auto flex flex-col items-center gap-2 px-2 pb-4">
                      <CollapsedRailItem href="/dashboard/help" label="Help & Support" active={pathname.startsWith('/dashboard/help')} className='bg-white! size-13!'>
                        <BadgeQuestionMark className="size-5" />
                      </CollapsedRailItem>
                    </div>
                  </>
                ) : isSettingsPage ? (
                  <>
                    <SidebarHeader className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 sm:gap-5">
                          <Link
                            href="/dashboard"
                            aria-label="Back to dashboard"
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:text-zinc-900"
                          >
                            <ChevronLeftIcon className="size-5" />
                          </Link>
                          <h2 className="text-xl font-semibold text-zinc-900">Settings</h2>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => setNotifOpen(o => !o)}
                            aria-label="Notifications"
                            data-team-updates-bell="true"
                            className={`relative flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${notifOpen ? 'bg-blue-50 text-blue-600' : 'text-zinc-500'}`}
                          >
                            <Bell className="size-5 cursor-pointer" />
                            {unreadCount > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white leading-none">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </span>
                            )}
                          </button>
                          {!sidebarCollapsed && (
                            <SidebarToggleButton
                              collapsed={false}
                              onClick={toggleSidebarCollapsed}
                              className="bg-white border border-zinc-300 rounded-full shrink-0 h-6! w-6!"
                            />
                          )}
                        </div>
                      </div>
                    </SidebarHeader>

                    <SidebarBody className="px-4 py-0">
                      <SidebarSection className="gap-1">
                        <SidebarItem href="/dashboard/settings/account" current={pathname === '/dashboard/settings/account'}>
                          <CircleUser className='size-5' />
                          <SidebarLabel>Account Info</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/install-app" current={pathname === '/dashboard/settings/install-app'}>
                          <Download className='size-5' />
                          <SidebarLabel>Install The App</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/billing" current={pathname === '/dashboard/settings/billing'}>
                          <CreditCard className='size-5' />
                          <SidebarLabel>Billing</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/integration" current={pathname === '/dashboard/settings/integration'}>
                          <Network className='transform -rotate-90 size-5' />
                          <SidebarLabel>Integrations</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/brand-context" current={pathname === '/dashboard/settings/brand-context'}>
                          <Book className='size-5' />
                          <SidebarLabel>Brand Context</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/invite-members" current={pathname === '/dashboard/settings/invite-members'}>
                          <UserRoundPlus className='size-5' />
                          <SidebarLabel>Invite Members</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/workspace-usage" current={pathname === '/dashboard/settings/workspace-usage'}>
                          <ChartPie className='size-5' />
                          <SidebarLabel>Workspace usage</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/team-update" current={pathname === '/dashboard/settings/team-update'}>
                          <UserPen className='size-5' />
                          <SidebarLabel>Team Update</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/memory" current={pathname === '/dashboard/settings/memory'}>
                          <Clock className='size-5' />
                          <SidebarLabel>Memory</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/settings/delete-account" current={pathname === '/dashboard/settings/delete-account'}>
                          <TriangleAlert className='size-5' />
                          <SidebarLabel>Delete Account</SidebarLabel>
                        </SidebarItem>
                      </SidebarSection>
                      <SidebarSpacer />
                    </SidebarBody>
                  </>
                ) : (
                  <>
                    <SidebarHeader className="sticky top-0 z-20 bg-zinc-100/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-100/85 dark:border-white/10 dark:bg-zinc-900/95">
                      <div className="flex items-center justify-between gap-3">
                        {sidebarHeaderLoaded ? (
                          <Dropdown>
                            <DropdownButton
                              as="button"
                              className="flex min-w-0 items-center gap-2 rounded-md text-left text-2xl font-semibold text-zinc-900 transition"
                            >
                              <span className="truncate text-xl">{activeWorkspaceName}</span>
                            </DropdownButton>
                          </Dropdown>
                        ) : (
                          <Skeleton className="h-6 w-44 max-w-[75%] bg-zinc-200/80" />
                        )}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isFoundingMember && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 max-sm:hidden">
                              ⚡ Founding
                            </span>
                          )}
                          <button
                            onClick={() => setNotifOpen(o => !o)}
                            aria-label="Notifications"
                            data-team-updates-bell="true"
                            className={`relative flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${notifOpen ? 'bg-blue-50 text-blue-600' : 'text-zinc-500'}`}
                          >
                            <Bell className="size-5 cursor-pointer" />
                            {unreadCount > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white leading-none">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </span>
                            )}
                          </button>
                          {!sidebarCollapsed && (
                            <SidebarToggleButton
                              collapsed={false}
                              onClick={toggleSidebarCollapsed}
                              className="bg-white border border-zinc-300 rounded-full shrink-0 h-6! w-6!"
                            />
                          )}
                        </div>
                      </div>

                      <Button onClick={() => setShowWorkerPicker(true)} variant="primary" className="h-9! mt-5 sm:mt-6 w-full! flex! items-center! justify-between!">
                        Add Task
                        <PlusIcon className='text-white!' />
                      </Button>

                    </SidebarHeader>

                    <SidebarBody className="px-4 py-0">
                      <SidebarSection>
                        <SidebarItem href="/dashboard" current={pathname === '/dashboard'}>
                          <ChartColumnIncreasing className='size-5' />
                          <SidebarLabel>Dashboard</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/team" current={pathname.startsWith('/dashboard/team')}>
                          <Users className='size-5' />
                          <SidebarLabel>Team Members</SidebarLabel>
                        </SidebarItem>
                        <SidebarItem href="/dashboard/tasks" current={pathname.startsWith('/dashboard/tasks')}>
                          <CopyCheck className='size-5' />
                          <SidebarLabel>My Tasks</SidebarLabel>
                          {activeTaskCount > 0 && (
                            <span className="ml-auto flex h-6 min-w-8 items-center justify-center rounded-full bg-white px-2 text-xs font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-950/10">
                              {activeTaskCount}
                            </span>
                          )}
                        </SidebarItem>
                        {/* Workflows — hidden for non-owner members; Operator + owner gets full access */}
                        {isOwner === true ? (
                          (!workspacePlanLoaded || userProfile.plan === 'operator') ? (
                            <div className="space-y-1">
                              <SidebarItem
                                cls="w-full! flex! items-center! justify-between!"
                                onClick={() => setWorkspaceAccordionOpen(!workspaceAccordionOpen)}
                              >
                                <div className="flex flex-1 items-center gap-2">
                                  <BoltIcon className='size-5' />
                                  <SidebarLabel>Workflows</SidebarLabel>
                                </div>
                                <ChevronDown
                                  className="size-4 text-zinc-400"
                                  style={{
                                    transition: 'transform 300ms ease-in-out',
                                    transform: workspaceAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                  }}
                                />
                              </SidebarItem>

                              <div
                                style={{
                                  maxHeight: workspaceAccordionOpen ? '200px' : '0px',
                                  overflow: 'hidden',
                                  transition: 'max-height 300ms ease-in-out, opacity 300ms ease-in-out',
                                  opacity: workspaceAccordionOpen ? 1 : 0,
                                }}
                              >
                                <SidebarItem href="/dashboard/agent-mode/chains" current={pathname === '/dashboard/agent-mode/chains'}>
                                  <div className="pl-6">
                                    <SidebarLabel>Workflows</SidebarLabel>
                                  </div>
                                </SidebarItem>
                                <SidebarItem href="/dashboard/agent-mode/playbooks" current={pathname === '/dashboard/agent-mode/playbooks'}>
                                  <div className="pl-6">
                                    <SidebarLabel>Playbooks</SidebarLabel>
                                  </div>
                                </SidebarItem>
                                {/* <SidebarItem href="/dashboard/agent-mode/my-playbook" current={pathname === '/dashboard/agent-mode/my-playbook'}>
                                  <div className="pl-6">
                                    <SidebarLabel>My Playbook</SidebarLabel>
                                  </div>
                                </SidebarItem> */}
                                {/* <SidebarItem href="/dashboard/agent-mode/activity" current={pathname === '/dashboard/agent-mode/activity'}>
                                  <div className="pl-6">
                                    <SidebarLabel>Activity</SidebarLabel>
                                  </div>
                                </SidebarItem> */}
                              </div>
                            </div>
                          ) : (
                            <SidebarItem onClick={() => setAgentModeUpgradeOpen(true)} current={false}>
                              <BoltIcon className='size-5' />
                              <SidebarLabel className="flex items-center gap-1.5">
                                Workflows
                                <LockClosedIcon className="size-3 text-zinc-400" />
                              </SidebarLabel>
                            </SidebarItem>
                          )
                        ) : (
                          <SidebarItem cls="w-full! flex! items-center! justify-between!">
                            <div className="flex flex-1 items-center gap-2">
                              <BoltIcon className='size-5' />
                              <SidebarLabel>Workflows</SidebarLabel>
                            </div>
                            <ChevronDown
                              className="size-4 text-zinc-400"
                              style={{
                                transition: 'transform 300ms ease-in-out',
                                transform: workspaceAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}
                            />
                          </SidebarItem>
                        )}
                        {canAccessReferrals && (
                          <SidebarItem href="/dashboard/referrals" current={pathname.startsWith('/dashboard/referrals')}>
                            <Gift className='size-5' />
                            <SidebarLabel>Referrals</SidebarLabel>
                          </SidebarItem>
                        )}
                        <SidebarItem href="/dashboard/settings/account" current={pathname === '/dashboard/settings/account'}>
                          <Settings className='size-5' />
                          <SidebarLabel>Setting Workspace</SidebarLabel>
                        </SidebarItem>
                      </SidebarSection>
                      <SidebarSpacer />
                    </SidebarBody>

                    <SidebarFooter className="px-4 pb-6">
                      <div className="rounded-2xl bg-white p-4">
                        <h3 className="mb-4 text-sm font-semibold text-zinc-800">Credit</h3>

                        {creditSummaryLoaded ? (
                          <div className="h-2 rounded-full bg-zinc-200">
                            <div
                              className={`h-2 rounded-full ${creditsZero ? 'bg-red-500' : 'bg-blue-500'}`}
                              style={{ width: `${creditPercent}%` }}
                            />
                          </div>
                        ) : (
                          <Skeleton className="h-2 rounded-full bg-zinc-100" />
                        )}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                          <span className="truncate text-zinc-500">Heavy Credit</span>
                          {creditSummaryLoaded ? (
                            <span className="font-normal text-zinc-500">{creditDisplay.breakdownCreditText}</span>
                          ) : (
                            <></>
                          )}
                          {creditSummaryLoaded ? (
                            <div className="flex justify-between items-center w-full">
                              <span className="shrink-0 font-semibold text-zinc-950">
                                {creditDisplay.primaryText}
                              </span>
                              <span className="font-normal text-zinc-500">{creditDisplay.breakdownTopUpText}
                              </span>
                            </div>
                          ) : (
                            <Skeleton aria-hidden="true" className="h-4 w-12 shrink-0 bg-zinc-100" />
                          )}
                        </div>

                        {completedTaskCountLoaded ? (
                          <div className="mt-4 h-2 rounded-full bg-zinc-200">
                            <div
                              className="h-2 rounded-full bg-blue-600"
                              style={{ width: `${completedTaskPercent}%` }}
                            />
                          </div>
                        ) : (
                          <Skeleton className="mt-4 h-2 rounded-full bg-zinc-100" />
                        )}
                        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-zinc-500">Task Completed</span>
                          {completedTaskCountLoaded ? (
                            <span className="shrink-0 font-semibold text-zinc-950">
                              {completedTaskCount} <span className="font-normal text-zinc-500">/ {taskLimit}</span>
                            </span>
                          ) : (
                            <Skeleton aria-hidden="true" className="h-4 w-14 shrink-0 bg-zinc-100" />
                          )}
                        </div>

                        <Button className="mt-4 w-full!" variant="outline" onClick={() => setUpgradeDialogOpen(true)}>
                          Upgrade plan
                        </Button>
                      </div>
                    </SidebarFooter>
                  </>
                )}
              </div>
              {/* {!sidebarCollapsed && (
                <SidebarToggleButton
                  collapsed={false}
                  onClick={toggleSidebarCollapsed}
                  className="absolute -right-3 top-10 z-20 h-8! w-8! rounded-full border border-r-0 border-zinc-200 bg-white lg:flex"
                />
              )} */}
            </div>
          </Sidebar>
        )}
      >
        <InstallBanner />
        {children}
      </SidebarLayout>
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} onUnreadCountChange={setUnreadCount} sidebarCollapsed={sidebarCollapsed} />
      <JarvisChat />
      <CreditAlerts />
      {showCreateWorkspace && <CreateWorkspaceModal onClose={() => setShowCreateWorkspace(false)} />}

      <WorkerPicker
        title="Add Task"
        open={showWorkerPicker}
        onSelect={(worker) => {
          setShowWorkerPicker(false)
          const slug = worker?.worker_slug || worker?.slug || worker?.id || worker
          if (slug) router.push(`/dashboard/team/${encodeURIComponent(slug)}`)
        }}
        onClose={() => setShowWorkerPicker(false)}
        existingWorkers={[]}
      />

      {/* Workflows upgrade modal for non-Operator users */}
      <Dialog open={agentModeUpgradeOpen} onClose={() => setAgentModeUpgradeOpen(false)} size="md" className="max-w-[90%]! sm:max-w-sm! p-4! sm:p-6!">
        <div className="mb-2 sm:mb-4 flex size-9 sm:size-12 items-center justify-center rounded-full bg-blue-100">
          <BoltIcon className="size-5 sm:size-6 text-blue-600" />
        </div>
        <DialogTitle>Workflows — Operator Only</DialogTitle>
        <p className="text-sm text-zinc-500 mt-1 mb-5">Automate your business with team member chains and schedules.</p>
        <DialogBody className="mt-0!">
          <ul className="space-y-2 mb-4 sm:mb-6">
            {[
              'Chain up to 5 team members together — output flows automatically from one to the next',
              'Schedule chains to run on any days of the week',
              'Choose from 20+ playbooks or build your own',
              'Wake up to finished work every morning',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                <span className="mt-0.5 text-blue-600 font-bold">•</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500 mb-4">Workflows is included with the Operator plan.</p>
          <a href="/dashboard/settings/billing" className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-[13px] sm:text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            Upgrade to Operator — $199/mo →
          </a>
        </DialogBody>
      </Dialog>
      <UpgradePlanModal
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        currentPlan={userProfile.plan}
        workspaceId={activeWorkspaceId}
      />


      {/* <UpgradeSuccessModal
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        onContinue={() => {
          setOpen(false)
          router.push('/dashboard')
        }}
      /> */}
      {/* Account dropdown portal — renders in document.body, fully outside sidebar stacking context */}
      {!isMobile && accountMenuOpen && typeof window !== 'undefined' && accountMenuRef.current &&
        createPortal(
          <div
            ref={accountDropdownRef}
            style={{
              position: 'fixed',
              bottom: window.innerHeight - accountMenuRef.current.getBoundingClientRect().bottom,
              left: accountMenuRef.current.getBoundingClientRect().right + 14,
            }}
            className="z-[80] w-82 rounded-xl bg-white p-5 shadow-xl ring-1 ring-zinc-950/10"
          >
            <div className="flex items-center gap-4">
              <Avatar
                src={userAvatarSrc}
                initials={userAvatarInitials}
                alt={userProfile.name || 'Account'}
                className={`size-10 rounded-full! ${userAvatarClassName}`}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-6 text-zinc-800">
                  {userProfile.name || 'Account'}
                </p>
                <p className="truncate text-sm text-muted">{userProfile.email}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Link
                href="/dashboard/settings/account"
                onClick={() => setAccountMenuOpen(false)}
                className="flex h-9 items-center justify-center text-body gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-base font-semibold text-zinc-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
              >
                <UserIcon className="size-5 fill-current" />
                Account
              </Link>
              <button
                type="button"
                onClick={() => { setAccountMenuOpen(false); handleSignOut() }}
                className="flex h-9 items-center text-error justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-base font-semibold text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 cursor-pointer"
              >
                <ArrowRightStartOnRectangleIcon className="size-5 fill-current" />
                Log out
              </button>
            </div>
          </div>,
          document.body
        )
      }

      <ProfileBottomSheet
        open={isMobile && mobileAccountMenuOpen}
        onClose={() => setMobileAccountMenuOpen(false)}
        resizable={true}
      >
        {/* Header - User Info */}
        <div className="flex justify-between items-center px-4 gap-3 w-full">
          <div className="flex items-center gap-3 w-full">
            <Avatar
              src={userAvatarSrc}
              initials={userAvatarInitials}
              alt={userProfile.name || 'Account'}
              className={`size-10 rounded-full! ${userAvatarClassName}`}
            />
            <div className="min-w-0 max-w-[65%] min-[390px]:max-w-full flex-1">
              <p className="truncate text-sm font-medium text-zinc-800">
                {userProfile.name || 'Account'}
              </p>
              <p className="truncate text-sm text-neutral-500">
                {userProfile.email}
              </p>
            </div>
            <Link
              href="/dashboard/settings/account"
              onClick={() => setMobileAccountMenuOpen(false)}
              aria-label="Account Settings"
            >
              <Settings className="w-5 h-5 text-neutral-500 cursor-pointer shrink-0 hover:text-zinc-800 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 px-4 pb-4 border-b border-gray-200">
          <button
            type="button"
            onClick={() => {
              setMobileAccountMenuOpen(false)
              handleSignOut()
            }}
            className="h-9 flex w-full items-center justify-center gap-2 rounded-lg border border-[#FDA29B] p-4 transition bg-white hover:bg-red-50 text-[#D92D20] font-semibold text-sm cursor-pointer"
          >
            <ArrowRightStartOnRectangleIcon className="size-5" />
            Log out
          </button>
        </div>

        <div className="p-4">
          <p className="text-xs font-medium text-zinc-800 mb-4">
            Workspaces
          </p>
          <div className="space-y-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => {
                  handleSwitchWorkspace(workspace.id)
                  setMobileAccountMenuOpen(false)
                }}
                className="w-full flex items-center gap-2 justify-between px-3 py-2 rounded-lg bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                    <Logo
                      src={workspace.company_logo_url}
                      initials={getWorkspaceInitials(workspace.name)}
                      className="w-6 h-6 rounded-full"
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-zinc-800">{workspace.name}</p>
                  </div>
                </div>
                {activeWorkspaceId === workspace.id && (
                  <Check className="w-5 h-5 text-neutral-500" />
                )}
              </button>
            ))}

            {workspaces.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-500">No workspaces yet</p>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setMobileAccountMenuOpen(false)
              setShowCreateWorkspace(true)
            }}
            className="flex items-center gap-1 text-sm text-neutral-500 font-semibold h-9 px-3 mt-4 cursor-pointer"
          >
            <PlusIcon className="w-5 h-5" />
            Create Workspace
          </button>
        </div>

      </ProfileBottomSheet>
    </>
  )
}
