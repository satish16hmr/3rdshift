'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Skeleton } from '@/components/ui/skeleton'
import GoogleWorkspaceConnect from '@/components/google/GoogleWorkspaceConnect'
import SocialConnect from '@/components/integrations/SocialConnect'
import NotionConnect from '@/components/integrations/NotionConnect'
import BufferConnect from '@/components/integrations/BufferConnect'
import MailchimpConnect from '@/components/integrations/MailchimpConnect'
import WordPressConnect from '@/components/integrations/WordPressConnect'
import ZapierConnect from '@/components/integrations/ZapierConnect'
import { getStoredWorkspaceId, clearStoredWorkspaceId } from '@/lib/workspace-client'

type Plan = 'free' | 'starter' | 'pro' | 'operator'

type WorkspaceSummary = {
  id: string
  plan?: Plan | null
}

type WorkspaceResponse = {
  activeWorkspaceId?: string
  ownerCredits?: {
    plan?: Plan | null
  } | null
  workspaces?: WorkspaceSummary[]
  error?: string
}

function IntegrationCardSkeleton({ muted = false }: { muted?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 sm:p-6 ${muted ? 'border-zinc-100 bg-zinc-50' : 'border-zinc-200 bg-white'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <Skeleton className="h-11 w-11 rounded-md bg-zinc-200" />
          <div>
            <Skeleton className="mb-2 h-5 w-36 bg-zinc-200" />
            <Skeleton className="h-4 w-72 max-w-full bg-zinc-200" />
          </div>
        </div>
        <Skeleton className="h-9 w-full bg-zinc-200 md:w-32" />
      </div>
    </div>
  )
}

function IntegrationsSkeleton() {
  return (
    <section>
      <div className="space-y-4 sm:space-y-5">
        <IntegrationCardSkeleton />
        <IntegrationCardSkeleton />
        <IntegrationCardSkeleton />
        <IntegrationCardSkeleton />
        <IntegrationCardSkeleton />
        <IntegrationCardSkeleton />
        <IntegrationCardSkeleton />
        <IntegrationCardSkeleton />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Integrations Page
// Plan-based visibility: pro gets Notion/Buffer/Mailchimp/WordPress,
// operator additionally gets Zapier.
// ---------------------------------------------------------------------------
export default function IntegrationsSettings() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()

      let resolvedPlan = profileData?.plan as Plan | null | undefined

      // Workspace plan override (same pattern as original)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const loadWorkspace = (useStoredWorkspace = true): Promise<WorkspaceResponse> => {
          const storedWsId = useStoredWorkspace ? getStoredWorkspaceId() : null
          const headers: Record<string, string> = { 'Authorization': `Bearer ${session.access_token}` }
          if (storedWsId) headers['x-workspace-id'] = storedWsId

          return fetch('/api/workspace', { headers })
            .then(async r => {
              const d = await r.json().catch(() => ({})) as WorkspaceResponse
              if (!r.ok && storedWsId && d?.error === 'No workspace found') {
                clearStoredWorkspaceId()
                return loadWorkspace(false)
              }
              if (!r.ok) throw new Error(d?.error || 'Workspace load failed')
              return d
            })
        }

        try {
          const d = await loadWorkspace()
          const ws = d.workspaces?.find(w => w.id === d.activeWorkspaceId)
          resolvedPlan = d.ownerCredits?.plan || ws?.plan || resolvedPlan
        } catch { /* fall back to profile plan */ }
      }

      setPlan(resolvedPlan ?? null)
      setLoading(false)
    })
  }, [])

  // Integration visibility is plan-based, not workspace-role-based.
  const showProIntegrations = plan === 'pro' || plan === 'operator'
  const showOperatorIntegrations = plan === 'operator'

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 lg:space-y-5">
        <div>
          <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Integrations</Subheading>
          <Text className="mt-1 text-neutral-500!">
            Connect external tools to save deliverables and automate your workflow.
          </Text>
        </div>
        <IntegrationsSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Integrations</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Connect external tools to save deliverables and automate your workflow.
        </Text>
      </div>

      <section>
        <div className="space-y-4 sm:space-y-5">
          <GoogleWorkspaceConnect plan={plan} />
          <SocialConnect />

          {/* Pro integrations */}
          {showProIntegrations && (
            <>
              <NotionConnect plan={plan} />
              <BufferConnect plan={plan} />
              <MailchimpConnect plan={plan} />
              <WordPressConnect plan={plan} />
            </>
          )}

          {/* Operator integrations */}
          {showOperatorIntegrations && (
            <ZapierConnect plan={plan} />
          )}

          {/* Upsell hints for lower plans */}
          {plan !== 'pro' && plan !== 'operator' && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="text-sm text-zinc-500">
                <span className="font-medium text-blue-600">Upgrade to Pro</span> to unlock Notion, Buffer, Mailchimp, and WordPress integrations.
              </p>
            </div>
          )}
          {plan !== 'operator' && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="text-sm text-zinc-500">
                <span className="font-medium text-blue-600">Upgrade to Operator</span> to unlock Zapier automation.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
