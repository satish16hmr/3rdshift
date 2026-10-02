// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings } from 'lucide-react'

export default function MemoryPanel({ slug, session }) {
  const [open, setOpen] = useState(false)
  const [memories, setMemories] = useState([])
  const [outputs, setOutputs] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (!open || !session) return
    setLoading(true)
    fetch(`/api/chat/memories/${slug}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(data => {
        // member_memories = per-member preferences + outputs
        // brand_memories = shared brand context (member_id IS NULL)
        const prefs = [
          ...(data.brand_memories ?? []).filter(m => m.memory_type === 'brand'),
          ...(data.member_memories ?? []).filter(m => m.memory_type === 'preference'),
        ]
        const outs = (data.member_memories ?? []).filter(m => m.memory_type === 'output')
        setMemories(prefs)
        setOutputs(outs)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open, slug, session])

  const handleDelete = async (id) => {
    if (!session) return
    setDeleting(id)
    await fetch(`/api/chat/memories/${slug}?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    setMemories(prev => prev.filter(m => m.id !== id))
    setOutputs(prev => prev.filter(m => m.id !== id))
    setDeleting(null)
  }

  const allEmpty = memories.length === 0 && outputs.length === 0

  return (
    <div className="border-y border-zinc-200 cursor-pointer!">
      {/* Toggle row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="sticky bottom-[69px] flex w-full items-center justify-between px-6 py-5 text-xs font-medium text-zinc-800 bg-white transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1 text-xs font-medium">
          Memory
          {memories.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#F5F8FF] border border-[#8DAFF9] size-4 text-xs font-medium text-blue-700">
              {memories.length}
            </span>
          )}
        </span>
        <div className="flex gap-2 text-[#71717A]">
          <Settings className='size-4' />
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Panel */}
      {open && (
        <div className="px-5 pb-4 space-y-4">
          {loading ? (
            <div className="py-4 flex justify-center">
              <div className="size-4 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-500" />
            </div>
          ) : allEmpty ? (
            <p className="text-xs text-zinc-400 py-3 text-center">
              No memories yet. {slug ? `Chat with this team member to build up context.` : ''}
            </p>
          ) : (
            <>
              {/* Preferences */}
              {memories.length > 0 && (
                <div>
                  <p className="text-xs capitalize text-neutral-500 mb-3 -mt-4">Preferences & Brand Context</p>
                  <div className="space-y-2.5">
                    {memories.map(m => (
                      <div key={m.id} className="flex items-start justify-between gap-2 group rounded-xl bg-[#F5F5F5] p-3 border border-zinc-200">
                        <p className="text-sm text-[#09090B] leading-relaxed flex-1">{m.content}</p>
                        {/* <button
                          onClick={() => handleDelete(m.id)}
                          disabled={deleting === m.id}
                          className="shrink-0 text-zinc-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete memory"
                        >
                          {deleting === m.id
                            ? <div className="size-3 animate-spin rounded-full border border-zinc-300 border-t-transparent" />
                            : <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          }
                        </button> */}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output history */}
              {outputs.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Past Deliverables</p>
                  <div className="space-y-1.5">
                    {outputs.map(m => (
                      <div key={m.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                        <p className="text-xs text-zinc-500 leading-relaxed">{m.content}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
