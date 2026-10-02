// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { Pagination } from '@/components/pagination'
import { clearStoredWorkspaceId, getStoredWorkspaceId } from '@/lib/workspace-client'
import { getCreditDisplaySummary } from '@/lib/billing/credit-balance'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PLAN_CREDIT_LIMITS: Record<string, number> = {
  starter: 0,
  pro: 50,
  operator: 150,
}

const PLAN_TASK_LIMITS: Record<string, number> = {
  starter: 200,
  pro: 500,
  operator: 1250,
}

type CreditSummary = {
  remaining: number
  limit: number
  planRemaining?: number
  topupRemaining?: number
}

type WorkspaceSummary = {
  id: string
  plan?: string | null
  heavy_credits_limit?: number | null
}

type WorkspaceResponse = {
  activeWorkspaceId?: string | null
  workspaces?: WorkspaceSummary[]
  ownerCredits?: {
    heavy_credits_remaining?: number | null
    plan_credits_remaining?: number | null
    topup_credits_remaining?: number | null
    available_credits_remaining?: number | null
    included_credits_limit?: number | null
    heavy_credits_limit?: number | null
    plan?: string | null
  } | null
}

type WorkspaceMember = {
  user_id: string
  role?: string | null
  name?: string | null
  email?: string | null
  avatar_url?: string | null
  task_count?: number | null
}

type WorkspaceMembersResponse = {
  members?: WorkspaceMember[]
}

type WorkspaceActivityResponse = {
  workspace?: {
    heavy_credits_limit?: number | null
    light_tasks_limit?: number | null
  } | null
  completed_count?: number
}

function getInitials(value?: string | null) {
  const parts = (value || '').trim().split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return (value || '??').slice(0, 2).toUpperCase()
}

function WorkspaceUsageSkeleton() {
  return (
    <section className="space-y-3 sm:space-y-4 lg:space-y-5" aria-busy="true">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Workspace Usage</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Workspace usage and activity across all members.
        </Text>
      </div>

      <div>
        <Subheading className="text-base! text-zinc-800!">Credits</Subheading>
        <div className="grid grid-cols-1 gap-2.5 pt-5 sm:grid-cols-2">
          {[0, 1].map(index => (
            <div key={index} className="rounded-xl border border-zinc-200 p-5">
              <Skeleton className={`h-5 bg-zinc-100 ${index === 0 ? 'w-28' : 'w-32'}`} />
              <Skeleton className="mt-3 h-2 rounded-full bg-zinc-100" />
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <Skeleton aria-hidden="true" className={`h-4 shrink-0 bg-zinc-100 ${index === 0 ? 'w-32' : 'w-20'}`} />
              </div>
              <Skeleton aria-hidden="true" className={`mt-2 h-4 shrink-0 bg-zinc-100 w-48`} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Subheading className="text-base! text-zinc-800!">Seats</Subheading>
        <div className="mt-5 flex flex-wrap gap-3">
          <div
            className="flex w-full flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-5 min-[380px]:w-fit min-[380px]:flex-row min-[380px]:items-center sm:gap-5 md:gap-10"
          >
            <div className="flex items-center gap-3 sm:gap-5 md:gap-10">
              <Skeleton className="size-10 shrink-0 rounded-full bg-zinc-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28 bg-zinc-100" />
                <Skeleton className="h-3 w-16 bg-zinc-100" />
              </div>
            </div>
            <Skeleton className="h-4 w-12 bg-zinc-100" />
          </div>
        </div>
      </div>

      <div>
        <div>
          <Subheading className="text-base! text-zinc-800!">Recent Activity</Subheading>
          <p className="mt-1 text-sm text-neutral-500">
            Tasks from all workspace members.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-200">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={`flex w-full flex-col gap-2 px-6 py-4 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between md:gap-4 ${index !== 4
                ? 'border-b border-zinc-200'
                : ''
                }`}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-2.5 w-2.5 rounded-full bg-zinc-100" />
                <div>
                  <Skeleton className="h-4 w-44 max-w-[52vw] bg-zinc-100" />
                  <Skeleton className="mt-2 h-4 w-24 bg-zinc-100" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1 text-left min-[380px]:flex-col sm:items-end sm:text-right">
                <Skeleton className="h-4 w-20 bg-zinc-100" />
                <Skeleton className="h-4 w-28 bg-zinc-100" />
              </div>
            </div>
          ))}

          <div className="border-t border-zinc-200 px-4 sm:px-6 py-4 bg-white rounded-b-xl">
            <Skeleton className="h-4 w-44 bg-zinc-100" />

            <div className="flex items-center justify-between gap-2 w-full min-[380px]:w-auto mt-6">
              <Skeleton className="h-8 w-8 md:w-24 shrink-0 rounded-md bg-zinc-100" />

              <div className="flex flex-1 min-[380px]:flex-none items-center justify-center gap-1.5">
                <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-zinc-100" />
                <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-zinc-100" />
                <Skeleton className="h-8 w-8 shrink-0 rounded-md bg-zinc-100" />
              </div>

              <Skeleton className="h-8 w-8 md:w-24 shrink-0 rounded-md bg-zinc-100" />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

const WorkspaceUsage = () => {
  const router = useRouter()
  const [completedTaskCountLoaded, setCompletedTaskCountLoaded] = useState(false)
  const [completedTaskCount, setCompletedTaskCount] = useState(0)
  const [creditSummaryLoaded, setCreditSummaryLoaded] = useState(false)
  const [creditSummary, setCreditSummary] = useState<CreditSummary>({ remaining: 0, limit: 0 })
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [plan, setPlan] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const buildHeaders = (accessToken: string, useStoredWorkspace = true) => {
      const storedWorkspaceId = useStoredWorkspace ? getStoredWorkspaceId() : null
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      }
      if (storedWorkspaceId) headers['x-workspace-id'] = storedWorkspaceId
      return { headers, storedWorkspaceId }
    }

    const loadWorkspace = async (accessToken: string, useStoredWorkspace = true): Promise<WorkspaceResponse> => {
      const { headers, storedWorkspaceId } = buildHeaders(accessToken, useStoredWorkspace)
      const res = await fetch('/api/workspace', { headers })
      const data = await res.json().catch(() => ({}))

      if (!res.ok && storedWorkspaceId && data?.error === 'No workspace found') {
        clearStoredWorkspaceId()
        return loadWorkspace(accessToken, false)
      }

      if (!res.ok) throw new Error(data?.error || 'Workspace load failed')
      return data
    }

    const loadMembers = async (accessToken: string): Promise<WorkspaceMembersResponse> => {
      const { headers } = buildHeaders(accessToken)
      const res = await fetch('/api/workspace/members', { headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Workspace members load failed')
      return data
    }

    const loadActivity = async (accessToken: string): Promise<WorkspaceActivityResponse> => {
      const { headers } = buildHeaders(accessToken)
      const res = await fetch('/api/workspace/activity', { headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Workspace activity load failed')
      return data
    }

    const loadUsage = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setCompletedTaskCountLoaded(true)
          setCreditSummaryLoaded(true)
          setMembersLoaded(true)
          setTasksLoaded(true)
        }
        return
      }

      const [
        sessionResult,
        profileResult,
        completedTasksResult,
        tasksResult,
        topupsResult,
      ] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from('profiles')
          .select('plan, heavy_credits_remaining, full_name, email, avatar_url')
          .eq('id', user.id)
          .single(),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'completed'),
        supabase
          .from('tasks')
          .select('id, worker_slug, status, created_at, completed_at, user_id, category')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('credit_topups')
          .select('credits_remaining, expires_at')
          .eq('user_id', user.id)
          .gt('credits_remaining', 0),
      ])

      if (cancelled) return

      const profile = profileResult.data
      const fallbackPlanRemaining = Math.max(Number(profile?.heavy_credits_remaining ?? 0), 0)
      const fallbackTopupRemaining = (topupsResult.data ?? [])
        .filter((t) => !t.expires_at || new Date(t.expires_at).getTime() > Date.now())
        .reduce((sum, t) => sum + Math.max(Number(t.credits_remaining ?? 0), 0), 0)
      let resolvedPlan = profile?.plan || ''
      let resolvedCompletedTaskCount = completedTasksResult.count || 0
      let resolvedMembers: WorkspaceMember[] = []
      let resolvedCreditSummary: CreditSummary = {
        remaining: fallbackPlanRemaining + fallbackTopupRemaining,
        limit: PLAN_CREDIT_LIMITS[(resolvedPlan || '').toLowerCase()] ?? 0,
        planRemaining: fallbackPlanRemaining,
        topupRemaining: fallbackTopupRemaining,
      }
      let resolvedTasks = tasksResult.data || []

      const session = sessionResult.data.session
      if (session) {
        try {
          const workspaceData = await loadWorkspace(session.access_token)
          if (!cancelled) {
            const activeWorkspace = workspaceData.workspaces?.find(
              workspace => workspace.id === workspaceData.activeWorkspaceId
            )
            resolvedPlan = workspaceData.ownerCredits?.plan || activeWorkspace?.plan || resolvedPlan
            const planLimit = PLAN_CREDIT_LIMITS[(resolvedPlan || '').toLowerCase()] ?? 0
            resolvedCreditSummary = {
              remaining: workspaceData.ownerCredits?.available_credits_remaining ?? resolvedCreditSummary.remaining,
              limit: workspaceData.ownerCredits?.included_credits_limit ?? workspaceData.ownerCredits?.heavy_credits_limit ?? activeWorkspace?.heavy_credits_limit ?? planLimit,
              planRemaining: workspaceData.ownerCredits?.plan_credits_remaining ?? workspaceData.ownerCredits?.heavy_credits_remaining ?? resolvedCreditSummary.planRemaining,
              topupRemaining: workspaceData.ownerCredits?.topup_credits_remaining ?? resolvedCreditSummary.topupRemaining ?? 0,
            }
          }
        } catch {
          // Keep profile-derived values if workspace lookup is unavailable.
        }

        try {
          const membersData = await loadMembers(session.access_token)
          if (!cancelled) {
            resolvedMembers = membersData.members || []
          }
        } catch {
          // Keep seats empty if member lookup is unavailable.
        }

        try {
          const activityData = await loadActivity(session.access_token)
          if (!cancelled) {
            resolvedCompletedTaskCount = activityData.completed_count ?? resolvedCompletedTaskCount
            resolvedCreditSummary = {
              ...resolvedCreditSummary,
              limit: resolvedCreditSummary.limit || activityData.workspace?.heavy_credits_limit || 0,
            }
            if (activityData.tasks) {
              resolvedTasks = activityData.tasks
            }
            if (activityData.members) {
              resolvedMembers = activityData.members
            }
          }
        } catch {
          // Workspace activity is only available when the active workspace supports team usage.
        }
      }

      if (cancelled) return

      // Fallback for members if not loaded (personal workspaces / non-operator plan)
      if (!resolvedMembers || resolvedMembers.length === 0) {
        resolvedMembers = [{
          user_id: user.id,
          role: 'owner',
          name: profile?.full_name || profile?.email || 'Owner',
          email: profile?.email || '',
          avatar_url: profile?.avatar_url || null,
          task_count: resolvedCompletedTaskCount,
        }]
      }

      setPlan(resolvedPlan)
      setCreditSummary(resolvedCreditSummary)
      setCompletedTaskCount(resolvedCompletedTaskCount)
      setMembers(resolvedMembers)
      setTasks(resolvedTasks)
      setCompletedTaskCountLoaded(true)
      setCreditSummaryLoaded(true)
      setMembersLoaded(true)
      setTasksLoaded(true)
    }

    loadUsage().catch(() => {
      if (!cancelled) {
        setCompletedTaskCountLoaded(true)
        setCreditSummaryLoaded(true)
        setMembersLoaded(true)
        setTasksLoaded(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [tasks])

  const totalPages = Math.ceil(tasks.length / itemsPerPage)
  const paginatedTasks = tasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const formatTaskDate = (isoString?: string | null) => {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
        return 'bg-[#17B26A]' // green
      case 'running':
      case 'executing':
        return 'bg-blue-500 animate-pulse'
      case 'failed':
        return 'bg-red-500'
      default:
        return 'bg-zinc-400'
    }
  }

  const creditLimit = creditSummary.limit || PLAN_CREDIT_LIMITS[(plan || '').toLowerCase()] || 0
  const creditDisplay = getCreditDisplaySummary({
    planCreditsRemaining: creditSummary.planRemaining ?? creditSummary.remaining,
    topupCreditsRemaining: creditSummary.topupRemaining ?? 0,
    includedCreditsLimit: creditLimit,
  })
  const creditPercent = creditLimit > 0 ? Math.min(100, Math.max(0, Math.round((creditDisplay.availableCreditsRemaining / creditLimit) * 100))) : 0
  const taskLimit = PLAN_TASK_LIMITS[(plan || '').toLowerCase()] || 1250
  const completedTaskPercent = taskLimit > 0 ? Math.min(100, Math.max(0, Math.round((completedTaskCount / taskLimit) * 100))) : 0
  const creditsZero = creditSummaryLoaded && creditDisplay.isDepleted
  const usageLoaded = completedTaskCountLoaded && creditSummaryLoaded && membersLoaded && tasksLoaded

  if (!usageLoaded) {
    return <WorkspaceUsageSkeleton />
  }

  return (
    <section className="space-y-3 sm:space-y-4 lg:space-y-5">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Workspace Usage</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Workspace usage and activity across all members.
        </Text>
      </div>
      <div>
        <Subheading className="text-base! text-zinc-800!">Credits</Subheading>
        <div className="grid grid-cols-1 gap-2.5 pt-5 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-5">
            <h4 className="text-base font-semibold text-zinc-950 sm:text-base">Heavy Credits</h4>
            {creditSummaryLoaded ? (
              <div className="mt-4 h-2 rounded-full bg-zinc-200">
                <div
                  className={`h-2 rounded-full ${creditsZero ? 'bg-red-500' : 'bg-blue-600'}`}
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
            ) : (
              <Skeleton className="mt-4 h-2 rounded-full" />
            )}
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              {creditSummaryLoaded ? (
                <span className="shrink-0 font-semibold text-zinc-900">
                  {creditDisplay.primaryText}
                  <span className="block text-xs font-normal text-zinc-500">{creditDisplay.breakdownText}</span>
                </span>
              ) : (
                <Skeleton aria-hidden="true" className="h-4 w-12 shrink-0" />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-5">
            <h4 className="text-base font-semibold text-zinc-950 sm:text-base">Task Completed</h4>
            {completedTaskCountLoaded ? (
              <div className="mt-4 h-2 rounded-full bg-zinc-200">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{ width: `${completedTaskPercent}%` }}
                />
              </div>
            ) : (
              <Skeleton className="mt-4 h-2 rounded-full" />
            )}
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              {completedTaskCountLoaded ? (
                <span className="shrink-0 font-semibold text-zinc-900">
                  {completedTaskCount} <span className="font-normal text-zinc-500">/ {taskLimit}</span>
                </span>
              ) : (
                <Skeleton aria-hidden="true" className="h-4 w-14 shrink-0" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <Subheading className="text-base! text-zinc-800!">Seats</Subheading>
        <div className="mt-5 flex flex-wrap gap-3">
          {!membersLoaded ? (
            [0, 1].map(index => (
              <div key={index} className="flex min-w-56 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))
          ) : members.length > 0 ? (
            members.map(member => {
              const displayName = member.name || member.email || 'Workspace member'
              const taskCount = member.task_count ?? 0

              return (
                <div key={member.user_id} className="flex flex-col min-[380px]:flex-row w-full sm:w-fit min-[380px]:items-center justify-between gap-3 sm:gap-5 md:gap-10 rounded-xl border border-zinc-200 bg-white p-5">
                  <div className="flex items-center gap-3 sm:gap-5 md:gap-10">
                    <div
                      aria-label={displayName}
                      role="img"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 bg-cover bg-center text-sm font-semibold text-white outline outline-1 -outline-offset-1 outline-black/10"
                      style={member.avatar_url ? { backgroundImage: `url(${member.avatar_url})` } : undefined}
                    >
                      {!member.avatar_url && getInitials(displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">{displayName}</p>
                      <p className="text-sm capitalize text-neutral-500">{member.role || 'member'}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm text-neutral-500">
                    {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-neutral-500">No seats found for this workspace.</p>
          )}
        </div>
      </div>

      <div>
        <div>
          <Subheading className='text-zinc-800! text-base!'>Recent Activity</Subheading>
          <p className="text-sm text-neutral-500 mt-1">
            Tasks from all workspace members.
          </p>
        </div>

        {/* List */}
        <div className='rounded-xl border border-zinc-200 mt-5 bg-white overflow-hidden'>
          {paginatedTasks.length > 0 ? (
            <>
              {paginatedTasks.map((task, index) => {
                const worker = workerRegistry.find(w => w.slug === task.worker_slug)
                const title = worker?.name || task.worker_slug || 'Task'
                const member = members.find(m => m.user_id === task.user_id)
                const author = member?.name || member?.email || 'Workspace member'
                const displayStatus = (task.status || 'pending').charAt(0).toUpperCase() + (task.status || 'pending').slice(1)
                const date = formatTaskDate(task.created_at)

                return (
                  <div
                    key={task.id}
                    onClick={() => router.push(`/dashboard/tasks/result?taskId=${task.id}`)}
                    className={`flex overflow-auto gap-2 md:gap-4 px-6 py-4 min-[380px]:justify-between w-full cursor-pointer hover:bg-zinc-50 transition-colors ${index !== paginatedTasks.length - 1
                      ? "border-b border-zinc-200"
                      : ""
                      }`}
                  >
                    {/* Left */}
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full text-nowrap ${getStatusColor(task.status)}`} />

                      <div>
                        <h3 className="text-sm font-medium text-zinc-800 max-w-36.5 sm:max-w-full text-nowrap truncate">
                          {title}
                        </h3>

                        <p className="text-sm text-neutral-500 text-nowrap max-w-36 truncate">
                          by {author}
                        </p>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="text-left sm:text-right flex flex-wrap items-end gap-1 justify-between min-[380px]:flex-col">
                      <p className="text-sm font-medium text-zinc-800 min-[380px]:text-right text-nowrap">
                        {displayStatus}
                      </p>

                      <p className="text-sm text-neutral-500 min-[380px]:text-right text-nowrap max-w-27.5 truncate">
                        {date}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-wrap gap-4 items-center justify-between border-t border-zinc-200 px-4 sm:px-6 py-4 bg-white">
                  <div className="text-sm text-zinc-500">
                    Showing <span className="font-semibold text-zinc-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-semibold text-zinc-800">
                      {Math.min(currentPage * itemsPerPage, tasks.length)}
                    </span>{' '}
                    of <span className="font-semibold text-zinc-800">{tasks.length}</span> tasks
                  </div>

                  <div className="flex items-center justify-between gap-2 w-full">
                    <Button
                      variant='outline'
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="border-0 bg-white hover:bg-transparent hover:text-blue-500 disabled:bg-white disabled:hover:bg-white shrink-0"
                    >
                      <span><ArrowLeft className="sm:mr-1 size-3.5" /></span>
                      <span className='hidden md:flex'>Previous</span>
                    </Button>

                    <div className='flex-1 max-w-[calc(100%-80px)] md:max-w-none flex justify-center overflow-auto scrollbar-none'>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        className="justify-center!"
                      />
                    </div>

                    <Button
                      variant='outline'
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="border-0 bg-white hover:bg-transparent hover:text-blue-500 disabled:bg-white disabled:hover:bg-white shrink-0"
                    >
                      <span className='hidden md:flex'>Next</span>
                      <span><ArrowRight className="sm:ml-1 size-3.5" /></span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center text-sm text-neutral-500 bg-white">
              No recent activity.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default WorkspaceUsage
