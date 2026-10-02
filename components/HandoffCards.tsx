// @ts-nocheck
'use client'

import React from 'react'
import Link from 'next/link'
import { getWorkerBySlug } from '@/lib/workers/registry'

// Store handoff context in sessionStorage for large payloads (e.g., Eve JD → Dale)
function storeHandoffContext(workerSlug, context) {
  try {
    sessionStorage.setItem(`handoff_context_${workerSlug}`, JSON.stringify(context));
  } catch (e) { /* sessionStorage unavailable */ }
}

/**
 * HandoffCards — "Keep going with your team" UI section
 *
 * Renders BELOW the deliverable on the result page.
 * Visually distinct from the output (different background + section divider).
 * Populated from worker.handoffWorkers (flat) or worker.handoffWorkersByMode (per-mode).
 * Nothing in this component touches the deliverable text or downloads.
 */
export default function HandoffCards({ worker, taskInput, taskOutput }) {
  if (!worker) return null

  // Resolve handoffs: per-mode if available, else flat
  let handoffs = []
  const mode = taskInput?.[worker.workerModeField] || null

  if (worker.handoffWorkersByMode && mode && worker.handoffWorkersByMode[mode]) {
    handoffs = worker.handoffWorkersByMode[mode]
  } else if (worker.handoffWorkers && worker.handoffWorkers.length > 0) {
    handoffs = worker.handoffWorkers
  }

  if (!handoffs.length) return null

  return (
    <div className="border-t border-zinc-950/[0.06] p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-zinc-950">Keep going with your team</span>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {handoffs.length} worker{handoffs.length !== 1 ? 's' : ''} ready
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {handoffs.map((h, i) => {
          const target = getWorkerBySlug(h.workerId)
          if (!target) return null

          // Build the link: worker form URL + optional mode prefill
          let href = `/dashboard/team/${target.slug}`
          if (h.mode && target.workerModeField) {
            href += `?${target.workerModeField}=${h.mode}`
          }

          // For Dale (interview-question-writer) handoffs from JD workers:
          // store the full output text in sessionStorage as job_description context
          const handleClick = () => {
            if (h.workerId === 'interview-question-writer' && taskOutput?.text) {
              storeHandoffContext('interview-question-writer', {
                job_description: taskOutput.text,
                role: taskInput?.role_title || taskInput?.job_title || '',
              });
            }
          };

          return (
            <Link
              key={i}
              href={href}
              onClick={handleClick}
              className="group flex items-start gap-3 rounded-xl border border-zinc-950/[0.07] bg-zinc-50 p-4 transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-xl shadow-sm ring-1 ring-zinc-950/[0.06]">
                {target.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-950 group-hover:text-blue-700">
                  {target.personaName} <span className="font-normal text-zinc-500">·</span>{' '}
                  <span className="font-normal text-zinc-600">{target.name}</span>
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{h.cta}</p>
              </div>
              <svg
                className="mt-1 size-4 shrink-0 text-zinc-300 transition-colors group-hover:text-blue-400"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M6 12l4-4-4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
