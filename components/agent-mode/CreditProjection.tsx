// @ts-nocheck
'use client'
import { agentFetch } from '@/lib/agent-mode/api'

import { useEffect, useState } from 'react'
import { calcChainCostPerRun, getMissingWorkerModeFields } from '@/lib/agent-mode/types'

import { getWorkerBySlug } from '@/lib/workers/registry'

function getProjectionFingerprint(workers, scheduleDays) {
  if (!workers || workers.length < 2) return ''
  const workerItems = workers
    .map(w => {
      const meta = getWorkerBySlug(w.worker_id)
      const settings = w.form_settings ?? w.config ?? {}
      const modeVal = meta?.workerModeField ? (settings[meta.workerModeField] ?? '') : ''
      return `${w.worker_id}:${modeVal}`
    })
    .sort()
    .join('|')

  const days = [...(scheduleDays || [])].sort().join(',')
  return `${workerItems}#${days}`
}

export default function CreditProjection({ workers, scheduleDays }) {
  const [projection, setProjection] = useState(null)
  const [loading, setLoading] = useState(false)

  const fingerprint = getProjectionFingerprint(workers, scheduleDays)

  useEffect(() => {
    if (!workers || workers.length < 2) return

    let isCancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      agentFetch('/api/agent-mode/credit-projection', {
        method: 'POST',
        body: JSON.stringify({ workers, schedule_days: scheduleDays }),
      })
        .then(r => r.json())
        .then(data => {
          if (!isCancelled) {
            setProjection(data)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!isCancelled) setLoading(false)
        })
    }, 300)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [fingerprint])

  const missingModes = getMissingWorkerModeFields(workers)
  const cost = missingModes.length > 0 ? { light: 0, heavy: 0 } : calcChainCostPerRun(workers, { requireMode: true })
  const lightLabel = cost.light > 0 ? `${cost.light} light task${cost.light > 1 ? 's' : ''}` : null
  const heavyLabel = cost.heavy > 0 ? `${cost.heavy} heavy credit${cost.heavy > 1 ? 's' : ''}` : null
  const costLine = missingModes.length > 0 ? 'Choose a mode' : ([lightLabel, heavyLabel].filter(Boolean).join(' + ') || '0 tasks')

  const scheduleSummary = scheduleDays.length > 0
    ? scheduleDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
    : 'Not scheduled'

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Credit Projection</p>

      <div className="space-y-2 sm:space-y-1 text-sm text-zinc-700">
        <div className="flex justify-between flex-wrap gap-1">
          <span>Chain cost per run:</span>
          <span className="font-semibold text-zinc-950">{costLine}</span>
        </div>
        <div className="flex justify-between flex-wrap gap-1">
          <span>Schedule:</span>
          <span className="font-semibold text-zinc-950">{scheduleSummary}</span>
        </div>

        {projection && scheduleDays.length > 0 && (
          <>
            <div className="flex justify-between flex-wrap gap-1">
              <span>Estimated monthly runs:</span>
              <span className="font-semibold text-zinc-950">~{projection.runs_per_month}×</span>
            </div>
            <div className="flex justify-between flex-wrap gap-1">
              <span>Estimated monthly cost:</span>
              <span className="font-semibold text-zinc-950">
                {[
                  projection.monthly_light > 0 ? `~${projection.monthly_light} light tasks` : null,
                  projection.monthly_heavy > 0 ? `~${projection.monthly_heavy} heavy credits` : null,
                ].filter(Boolean).join(' + ') || 'Included'}
              </span>
            </div>
            {projection.remaining_heavy !== undefined && (
              <div className="flex justify-between flex-wrap gap-1 text-zinc-500">
                <span>Heavy credits remaining after:</span>
                <span>{Math.max(0, projection.remaining_heavy_after)} / {projection.allowance_heavy}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 50% warning */}
      {projection && (projection.over_50_percent_light || projection.over_50_percent_heavy) && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ This chain will use a significant portion of your monthly credits. You'll still have {Math.max(0, projection.remaining_heavy_after)} heavy credits for other work.
        </div>
      )}
    </div>
  )
}
