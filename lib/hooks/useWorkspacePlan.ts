'use client'

/**
 * useWorkspacePlan — single source of truth for plan on the client.
 *
 * Reads the workspace owner's plan via /api/workspace.
 * Works for both workspace owners AND seat members.
 * Never reads from profiles directly — that's the bug we kept repeating.
 *
 * Returns: { plan: string | null, loading: boolean }
 *   plan = null while loading
 *   plan = 'starter' | 'pro' | 'operator' once loaded
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

export function useWorkspacePlan(): { plan: string | null; loading: boolean } {
  const [plan, setPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.access_token}`,
      }
      const wsId = getStoredWorkspaceId()
      if (wsId) headers['x-workspace-id'] = wsId

      fetch('/api/workspace', { headers })
        .then(r => r.json())
        .then(d => {
          const activeWs = d.workspaces?.find((w: { id: string; plan: string }) => w.id === d.activeWorkspaceId)
          // ownerCredits.plan is populated for seat members (reads from owner's profile)
          const resolvedPlan = d.ownerCredits?.plan || activeWs?.plan || 'starter'
          setPlan(resolvedPlan)
        })
        .catch(() => setPlan('starter'))
        .finally(() => setLoading(false))
    })
  }, [])

  return { plan, loading }
}
