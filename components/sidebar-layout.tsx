// @ts-nocheck
'use client'

import React, { Fragment, useState, useEffect } from 'react'
import { PanelRightClose } from 'lucide-react'
import * as Headless from '@headlessui/react'
import { NavbarItem } from './navbar'
import { usePathname } from 'next/navigation'

function OpenMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 6.75C2 6.33579 2.33579 6 2.75 6H17.25C17.6642 6 18 6.33579 18 6.75C18 7.16421 17.6642 7.5 17.25 7.5H2.75C2.33579 7.5 2 7.16421 2 6.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H17.25C17.6642 12.5 18 12.8358 18 13.25C18 13.6642 17.6642 14 17.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z" />
    </svg>
  )
}

function CloseMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  )
}

// DesktopSidebar renders the sidebar only on lg+ screens.
function DesktopSidebar({ sidebar, collapsed, toggleCollapsed, setCollapsed }) {
  return (
    <div
      className="dashboard-sidebar-desktop bg-zinc-300 dark:bg-zinc-950 flex"
      data-dashboard-sidebar="desktop"
      data-collapsed={collapsed ? 'true' : undefined}
    >
      {sidebar({ collapsed, toggleCollapsed, setCollapsed, isMobileSidebar: false })}
    </div>
  )
}

// MobileSidebar renders the sidebar in a dialog on small screens
function MobileSidebarDialog({ open, close, sidebar }) {
  return (
    <Headless.Transition show={open} as={Fragment}>
      <Headless.Dialog onClose={close} className="relative z-50 lg:hidden">

        <Headless.TransitionChild
          as={Fragment}
          enter="transition-opacity ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
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
          <Headless.DialogPanel className="fixed inset-y-0 left-0 z-50 w-77.5 min-[390px]:w-87">
            <div className="flex h-full flex-col bg-zinc-100 shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
              {sidebar()}
            </div>
          </Headless.DialogPanel>
        </Headless.TransitionChild>

      </Headless.Dialog>
    </Headless.Transition>
  )
}

export function SidebarLayout({
  navbar,
  sidebar,
  children,
  collapsed: propCollapsed,
  onCollapsedChange: propOnCollapsedChange,
  pageTitle: pageTitleOverride,
}) {
  const [showSidebar, setShowSidebar] = useState(false)
  const [localCollapsed, setLocalCollapsed] = useState(false)
  const pathname = usePathname();

  useEffect(() => {
    const handleClose = () => setShowSidebar(false)
    window.addEventListener('close-mobile-sidebar', handleClose)
    return () => window.removeEventListener('close-mobile-sidebar', handleClose)
  }, [])

  useEffect(() => {
    setShowSidebar(false)
  }, [pathname])

  const desktopSidebarCollapsed = propCollapsed !== undefined ? propCollapsed : localCollapsed

  const handleSetCollapsed = (val: boolean | ((prev: boolean) => boolean)) => {
    if (propOnCollapsedChange) {
      const nextVal = typeof val === 'function' ? val(desktopSidebarCollapsed) : val
      propOnCollapsedChange(nextVal)
    } else {
      setLocalCollapsed(val)
    }
  }

  const toggleDesktopSidebar = () => {
    handleSetCollapsed(collapsed => !collapsed)
  }

  // Normalize: accept render function or JSX element
  const sidebarFn = typeof sidebar === 'function' ? sidebar : () => sidebar

  const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/team': 'Team Members',
    '/dashboard/tasks': 'My Task',
    '/dashboard/tasks/result': 'My Task',
    '/dashboard/tasks/slug': 'My Task',
    '/dashboard/agent-mode': 'Workflows',
    '/dashboard/agent-mode/runs': 'Build a workflow',
    '/dashboard/agent-mode/chains': 'My Workflows',
    '/dashboard/agent-mode/playbooks': 'Playbooks',
    '/dashboard/referrals': 'Refer & Earn',
    '/dashboard/help': 'Help & Support',
    '/dashboard/settings': 'Settings',
    '/dashboard/settings/account': 'Settings - Account Information',
    '/dashboard/settings/install-app': 'Settings - Install The App',
    '/dashboard/settings/billing': 'Settings - Billing',

    '/dashboard/settings/integration': 'Settings - Integrations',
    '/dashboard/settings/brand-context': 'Settings - Brand Context',
    '/dashboard/settings/invite-members': 'Settings - Invite members',
    '/dashboard/settings/workspace-usage': 'Settings - Workspace Usage',
    '/dashboard/settings/team-update': 'Settings - Team Update',
    '/dashboard/settings/memory': 'Settings - Saved Memories',
    '/dashboard/settings/delete-account': 'Settings - Danger Zone',
  }

  const [titleOverride, setTitleOverride] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: CustomEvent) => setTitleOverride(e.detail.title)
    window.addEventListener('page-title-override', handler as EventListener)
    return () => window.removeEventListener('page-title-override', handler as EventListener)
  }, [])

  // Then change the title line to:

  const getPageTitle = (pathname: string) => {
    if (PAGE_TITLES[pathname]) {
      return PAGE_TITLES[pathname]
    }

    // Team member detail page
    if (/^\/dashboard\/team\/[^/]+$/.test(pathname)) {
      return 'My Task'
    }

    if (/^\/dashboard\/tasks(\/.*)?$/.test(pathname)) {
      return 'My Task'
    }

    if (/^\/dashboard\/agent-mode\/runs(\/.*)?$/.test(pathname)) {
      return 'Build a workflow'
    }

    return 'Dashboard'
  }

  const pageTitle = getPageTitle(pathname)
  return (
    <div
      className="dashboard-shell bg-white lg:bg-zinc-300 dark:bg-zinc-900 dark:lg:bg-zinc-950 lg:gap-2!"
      data-sidebar-collapsed={desktopSidebarCollapsed ? 'true' : undefined}
      style={{
        '--dashboard-sidebar-current-width': desktopSidebarCollapsed
          ? 'var(--dashboard-sidebar-collapsed-width)'
          : 'var(--dashboard-sidebar-open-width)',
      }}
    >
      {/* Desktop sidebar — isolated component, always mounted */}
      <DesktopSidebar
        sidebar={sidebarFn}
        collapsed={desktopSidebarCollapsed}
        toggleCollapsed={toggleDesktopSidebar}
        setCollapsed={handleSetCollapsed}
      />

      {/* Mobile sidebar — only mounted when open */}
      <MobileSidebarDialog
        open={showSidebar}
        close={() => setShowSidebar(false)}
        sidebar={() => sidebarFn({
          collapsed: false,
          toggleCollapsed: () => setShowSidebar(false),
          setCollapsed: () => setShowSidebar(false),
          isMobileSidebar: true,
        })}
      />

      {/* Mobile navbar */}
      <header className="dashboard-mobile-header items-center px-4 min-h-[56px] border-b border-zinc-950/[0.05] bg-white fixed inset-x-0 top-0 z-[60]">
        <div className="py-2.5 flex items-center gap-2 lg:hidden">
          <NavbarItem onClick={() => setShowSidebar(true)} aria-label="Open navigation">
            <PanelRightClose className='w-5 h-5 text-[#292D32]' />
          </NavbarItem>
          <span className="text-base md:text-lg font-semibold text-black">{pageTitle}</span>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      {/* Main content */}
      <main
        className="dashboard-main flex flex-1 flex-col pt-[56px] pb-2 lg:min-w-0 lg:pt-2 px-0! lg:px-2!"
        data-sidebar-collapsed={desktopSidebarCollapsed ? 'true' : undefined}
      >
        <div className="dashboard-main-surface overflow-x-hidden overflow-y-auto grow p-4 sm:p-6 lg:rounded-lg lg:bg-white lg:p-8 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10">
          <div>{children}</div>
        </div>
      </main>
    </div>
  )
}
