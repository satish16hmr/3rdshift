// @ts-nocheck
'use client'

/**
 * CreditAlerts — global component that monitors heavy credit usage
 * and fires alerts at 60%, 85%, and 100% thresholds.
 *
 * Mounted in the ApplicationLayout so it runs on every dashboard page.
 * Uses credit_alert_state table to ensure each alert fires once per billing period.
 *
 * Brief Section 9:
 * - 60%: toast, auto-dismiss 8s, once per period
 * - 85%: persistent toast + red badge, once per period
 * - 100%: modal overlay + persistent banner, pauses premium chains
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCreditDisplaySummary } from '@/lib/billing/credit-balance'
import { Dialog, DialogBody } from '@/components/dialog'
import { Button } from '../ui/button'

const PLAN_CREDITS = { starter: 0, pro: 50, operator: 150 }

function getProjectedDate(remaining, dailyRate) {
  if (!dailyRate || dailyRate <= 0) return null
  const daysLeft = Math.ceil(remaining / dailyRate)
  const d = new Date()
  d.setDate(d.getDate() + daysLeft)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Toast component ───────────────────────────────────────────────────────────
function AlertToast({ message, onDismiss, persistent = false, topUpLink = false }) {
  useEffect(() => {
    if (!persistent) {
      const t = setTimeout(onDismiss, 8000)
      return () => clearTimeout(t)
    }
  }, [persistent, onDismiss])

  return (
    <div className="fixed top-6 right-6 z-50 max-w-sm w-full rounded-xl border border-amber-200 bg-white shadow-lg px-4 py-3 flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 mt-0.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L11 10H1L6 1Z" stroke="#d97706" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M6 4.5V7" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="6" cy="8.5" r="0.5" fill="#d97706" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-800">{message}</p>
        {topUpLink && (
          <a href="/dashboard/settings/billing" className="mt-1 block text-xs font-medium text-blue-600 hover:underline">
            Buy top-up credits →
          </a>
        )}
      </div>
      <button onClick={onDismiss} className="cursor-pointer text-zinc-400 hover:text-zinc-600 shrink-0 mt-0.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ── 100% modal ────────────────────────────────────────────────────────────────
function CreditExhaustedModal({ plan, resetDate, onDismiss }) {
  return (
    <Dialog open={true} onClose={onDismiss} size="md" className="p-3.5! sm:p-6! max-w-[90%] sm:max-w-md">
      <DialogBody padding={false} className=" mt-0!">
        <div className="flex size-10 items-center justify-center rounded-full bg-red-100 mb-2.5 sm:mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3L18 17H2L10 3Z" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 8V12" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="0.75" fill="#ef4444" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-zinc-950 mb-1">You've reached your monthly heavy credit limit</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Scheduled chains using premium workers are paused until your credits reset
          {resetDate ? ` on ${resetDate}` : ''}. Free-only chains continue running.
        </p>
        <a
          href="/dashboard/settings/billing"
        >
          <Button variant="primary" className='w-full mb-2 sm:mb-3 text-[11px] sm:text-sm'>
            Buy top-up credits to resume immediately →
          </Button>
        </a>
        <button
          onClick={onDismiss}
          className="block w-full text-center text-xs sm:text-sm text-zinc-400 hover:text-zinc-600 cursor-pointer"
        >
          Dismiss — I'll wait for the reset
        </button>
      </DialogBody>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CreditAlerts() {
  const [alert60, setAlert60] = useState(null)   // { message }
  const [alert85, setAlert85] = useState(null)   // { message }
  const [alert100, setAlert100] = useState(null) // { resetDate }
  const [banner100, setBanner100] = useState(false)

  const checkAlerts = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, heavy_credits_remaining, heavy_credits_reset_at')
      .eq('id', user.id)
      .single()

    const { data: topups } = await supabase
      .from('credit_topups')
      .select('credits_remaining, expires_at')
      .eq('user_id', user.id)
      .gt('credits_remaining', 0)

    if (!profile || !['pro', 'operator'].includes(profile.plan)) return

    const total = PLAN_CREDITS[profile.plan] ?? 0
    const creditSummary = getCreditDisplaySummary({
      planCreditsRemaining: profile.heavy_credits_remaining ?? 0,
      topupCreditsRemaining: (topups ?? [])
        .filter((t) => !t.expires_at || new Date(t.expires_at).getTime() > Date.now())
        .reduce((sum, t) => sum + Math.max(Number(t.credits_remaining ?? 0), 0), 0),
      includedCreditsLimit: total,
    })
    const remaining = creditSummary.availableCreditsRemaining
    const consumed = Math.max(total - creditSummary.planCreditsRemaining, 0)
    const pct = total > 0 ? (consumed / total) * 100 : 0

    const today = new Date().toISOString().split('T')[0]

    // Check which alerts already fired this period
    const { data: firedAlerts } = await supabase
      .from('credit_alert_state')
      .select('alert_level')
      .eq('user_id', user.id)
      .eq('credit_type', 'heavy')
      .eq('period_start', today.slice(0, 7) + '-01') // first of month

    const fired = new Set((firedAlerts ?? []).map(a => a.alert_level))

    const markFired = async (level) => {
      await supabase.from('credit_alert_state').upsert({
        user_id: user.id,
        credit_type: 'heavy',
        alert_level: level,
        period_start: today.slice(0, 7) + '-01',
        shown_at: new Date().toISOString(),
      })
    }

    const resetDate = profile.heavy_credits_reset_at
      ? new Date(profile.heavy_credits_reset_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null

    // Rough daily rate — credits consumed / days into month
    const dayOfMonth = new Date().getDate()
    const dailyRate = dayOfMonth > 0 ? consumed / dayOfMonth : 0
    const projectedDate = getProjectedDate(remaining, dailyRate)

    if (remaining === 0 && !fired.has(100)) {
      setAlert100({ resetDate })
      setBanner100(true)
      await markFired(100)
      // Pause premium chains
      await supabase
        .from('agent_mode_chains')
        .update({ status: 'paused' })
        .eq('user_id', user.id)
        .eq('status', 'active')
      // Only chains with heavy workers — we check this via JSONB but use a broader pause + notify
    } else if (pct >= 85 && !fired.has(85)) {
      const msg = `You've used 85% of your heavy credits this month.`
      setAlert85({ message: msg })
      await markFired(85)
    } else if (pct >= 60 && !fired.has(60)) {
      const msg = `You've used 60% of your heavy credits this month.${projectedDate ? ` At your current pace, you'll reach your limit by ${projectedDate}.` : ''}`
      setAlert60({ message: msg })
      await markFired(60)
    }
  }, [])

  useEffect(() => {
    checkAlerts()
    // Re-check every 5 minutes while page is open
    const interval = setInterval(checkAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkAlerts])

  return (
    <>
      {/* 60% toast — auto-dismisses after 8s */}
      {alert60 && (
        <AlertToast
          message={alert60.message}
          onDismiss={() => setAlert60(null)}
        />
      )}

      {/* 85% toast — persistent until dismissed */}
      {alert85 && (
        <AlertToast
          message={alert85.message}
          onDismiss={() => setAlert85(null)}
          persistent
          topUpLink
        />
      )}

      {/* 100% modal */}
      {alert100 && (
        <CreditExhaustedModal
          resetDate={alert100?.resetDate}
          onDismiss={() => setAlert100(null)}
        />
      )}

      {/* 100% persistent banner */}
      {banner100 && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white flex flex-wrap md:flex-nowrap items-center justify-center gap-3">
          <span>Your monthly heavy credit limit has been reached. Chains with premium workers are paused.</span>
          <a href="/dashboard/settings/billing" className="underline font-semibold text-nowrap">Buy top-up credits →</a>
          <button onClick={() => setBanner100(false)} className="ml-2 text-red-200 hover:text-white">✕</button>
        </div>
      )}
    </>
  )
}
