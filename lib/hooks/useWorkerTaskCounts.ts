'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WORKSPACE_CHANGED_EVENT, workspaceFetch } from '@/lib/workspace-client'

export type WorkerTaskCounts = Record<string, number>

export function useWorkerTaskCounts() {
  const [counts, setCounts] = useState<WorkerTaskCounts>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadCounts = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          if (!cancelled) setCounts({})
          return
        }

        const res = await workspaceFetch('/api/worker-task-counts', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!res.ok) {
          if (!cancelled) setCounts({})
          return
        }

        const data = await res.json()
        if (!cancelled) setCounts(data.counts || {})
      } catch (error) {
        console.error('[useWorkerTaskCounts] Failed to load worker task counts', error)
        if (!cancelled) setCounts({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCounts()
    window.addEventListener(WORKSPACE_CHANGED_EVENT, loadCounts)

    return () => {
      cancelled = true
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, loadCounts)
    }
  }, [])

  return { counts, loading }
}
