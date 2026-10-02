'use client'

import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { z } from 'zod'
import { Loader } from '../loader'
import { Button } from '../ui/button'
import { Dialog, DialogBody, DialogTitle } from '../dialog'
import { createClient } from '@/lib/supabase/client'
import { setStoredWorkspaceId } from '@/lib/workspace-client'

const workspaceSchema = z.object({
  name: z.string().trim().min(1, { message: 'Workspace name is required' })
})

export default function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const validation = workspaceSchema.safeParse({ name })
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Workspace name is required')
      return
    }
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Not logged in'); setLoading(false); return }

      const res = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: name.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Failed to create workspace')
        setLoading(false)
        return
      }

      setStoredWorkspaceId(data.workspace_id)
      onClose()
      window.location.href = '/dashboard'
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <Dialog className="max-w-[90%]! sm:max-w-120! p-4! sm:p-5! md:p-6! transition-none!" backdropClassName='bg-black/50! transition-none!' open onClose={onClose} size="md">
      <div className="flex items-center justify-between">
        <DialogTitle className="text-base! sm:text-lg! md:text-xl! font-bold! text-[#111113]!">Create New Workspace</DialogTitle>
        <button
          onClick={onClose}
          className="border-none bg-transparent text-xl text-zinc-500 cursor-pointer leading-none"
        >
          <X className='size-5' />
        </button>
      </div>

      <form onSubmit={handleCreate}>
        <DialogBody className="mt-3! sm:mt-4! mb-4! sm:mb-6!">
          <label className="mb-1.5 block text-[13px] font-semibold text-gray-700">Workspace Name</label>
          <input
            type="text"
            value={name}
            onChange={e => {
              setName(e.target.value)
              setError('')
            }}
            placeholder="Acme Corp, Side Project, etc."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm box-border h-9"
          />
          {error && <p className="text-[13px] text-red-500 mt-1 mb-0">{error}</p>}
          <p className="mt-2 mb-0 text-xs text-zinc-500">
            New workspaces use your account&apos;s existing plan and shared credit pool.
          </p>
        </DialogBody>

        <div className="flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-fit! h-9! rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-gray-700 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            className={`h-9! rounded-lg border-none py-2.5 text-sm font-bold text-white flex items-center justify-center gap-1.5 w-19.5! ${loading ? 'bg-blue-300 cursor-default' : 'bg-blue-600 cursor-pointer'}`}
          >
            {loading ? (
              <>
                <Loader size={4} className="text-white" />
                {/* Creating… */}
              </>
            ) : (
              'Create'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}