// @ts-nocheck
'use client'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { Button } from '../ui/button'
import { Layers2, X } from 'lucide-react'

function WorkerStatusIcon({ status }) {
  if (status === 'completed') return <span className="bg-emerald-500 text-white size-4.5 flex items-center justify-center rounded-sm text-base">✓</span>
  if (status === 'failed') return <span className="bg-red-500 text-white size-4.5 flex items-center justify-center rounded-sm text-base">✗</span>
  if (status === 'skipped') return <span className="bg-zinc-400 text-white size-4.5 flex items-center justify-center rounded-sm text-base">–</span>
  return null
}

export default function RunOutputModal({ run, onClose }) {
  const workers = run.worker_results ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="relative mx-4 w-[90%] sm:w-200 max-h-[90vh] overflow-auto flex flex-col rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-zinc-200">
          <div className="flex items-center gap-4">
            <Button variant="outline" className='size-12! hidden sm:flex'><Layers2 className='size-6 text-[#414651]!' /></Button>
            <h3 className="text-lg font-semibold text-zinc-800">Run Outputs — {run.agent_mode_chains?.name ?? 'Chain'}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none cursor-pointer"><X className='size4' /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {workers.map((w, i) => {
            const meta = workerRegistry.find(r => r.slug === w.worker_id)
            return (
              <div key={i} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex justify-between sm:items-center gap-y-4 gap-x-2 mb-4 sm:mb-2 flex-col sm:flex-row">
                  <div className="flex items-center gap-2">
                    <span className='size-10 border border-zinc-200 flex items-center justify-center rounded-full text-2xl'>{meta?.emoji ?? '🤖'}</span>
                    <p className="text-base font-medium text-zinc-800 max-w-40 truncate">{meta?.personaName ?? w.worker_id} · {meta?.name ?? ''}</p>
                    <WorkerStatusIcon status={w.status} />
                  </div>
                  <span className={`ml-auto text-sm font-medium rounded-full px-2.5 py-0.5 border ${w.status === 'completed' ? 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]'
                    : w.status === 'failed' ? 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]'
                      : 'bg-zinc-50 text-zinc-500 border-zinc-500'
                    }`}>{w.status}</span>
                </div>
                {w.status === 'completed' && w.output && (
                  <div className="rounded-lg bg-zinc-100 border border-zinc-300 px-3.5 py-3 text-sm text-zinc-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {w.output}
                  </div>
                )}
                {w.status === 'failed' && w.error && (
                  <p className="text-sm text-red-600 bg-[#FFFBFA] border border-[#FDA29B] rounded-lg px-3.5 py-3">{w.error}</p>
                )}
                {w.status === 'skipped' && (
                  <p className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3.5 py-3 italic">Skipped — upstream team member failed</p>
                )}
                {w.provider && (
                  <p className="text-sm text-zinc-400 mt-1.5">Provider: {w.provider}</p>
                )}
              </div>
            )
          })}
          {workers.length === 0 && (
            <p className="text-sm text-zinc-500">No run output is available for this run.</p>
          )}
        </div>
      </div>
    </div>
  )
}
