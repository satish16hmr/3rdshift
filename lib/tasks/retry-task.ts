import { createClient } from '@/lib/supabase/client'

export interface RetryTaskOptions {
  task: {
    id: string
    worker_slug: string
    input: any
    workspace_id?: string
  }
  router: { push: (url: string) => void }
  showToast?: (msg: string | any) => void
}

export async function retryFreeTask({ task, router, showToast }: RetryTaskOptions): Promise<boolean> {
  if (!task?.id) return false
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false

    const res = await fetch('/api/tasks/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        worker_slug: task.worker_slug,
        input: task.input,
        workspace_id: task.workspace_id,
        retry_task_id: task.id,
      })
    })

    const data = await res.json()
    if (res.ok && data.taskId) {
      router.push(`/dashboard/tasks/result?taskId=${data.taskId}`)
      return true
    } else {
      showToast?.(data.error || 'Failed to retry task')
      return false
    }
  } catch (err: any) {
    showToast?.('Failed to retry task')
    return false
  }
}
