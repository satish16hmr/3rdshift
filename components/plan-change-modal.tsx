'use client'

import { useState, useEffect } from 'react'

type PlanSlug = 'starter' | 'pro' | 'operator'
type BillingCycle = 'monthly' | 'annual'
type PreviewPayload = { currentPlan: string; currentCycle: string; newPlan: string; newCycle: string; amountDue?: number; prorationCredit?: number; currentPeriodEnd?: number | null; isUpgrade?: boolean; isDowngrade?: boolean; _isMock?: boolean }
type PlanChangeModalProps = { open: boolean; onClose: () => void; currentPlan: PlanSlug; currentCycle?: BillingCycle; workspaceId?: string; onComplete?: (data: unknown) => void }
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Dialog, DialogBody } from '@/components/dialog'
import { Button } from './ui/button'

const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', operator: 'Operator' }
const PLAN_ORDER: Record<string, number> = { starter: 1, pro: 2, operator: 3 }

const PLAN_PRICES: Record<string, Record<string, number>> = {
  starter: { annual: 29, monthly: 39 },
  pro: { annual: 79, monthly: 99 },
  operator: { annual: 199, monthly: 249 },
}

// Accurate features per plan (for billing page info and modal)
const PLAN_FEATURES_FULL: Record<string, string[]> = {
  starter: [
    '200 light tasks/month',
    'Light tasks only — add heavy credits on Pro (top-ups never expire)',
    '40 AI team members on Starter',
    '1 workspace',
    '5 Team Chat messages/day',
    'In-app support',
  ],
  pro: [
    '500 light tasks/month',
    '50 heavy credits/mo',
    'All 70+ team members',
    '3 workspaces',
    'Team Chat with memory + deliverables',
    '5 native integrations (Google Drive, Notion, Mailchimp, WordPress, Buffer)',
    'Proactive team updates',
  ],
  operator: [
    '1,250 light tasks/month',
    '150 heavy credits/mo',
    'All 70+ team members',
    '10 workspaces',
    'Team Chat with memory + deliverables',
    'Workflows & Playbooks',
    '2 team seats',
    '9 integrations (all Pro + Zapier)',
    'Top-up credit packs',
    'Activity dashboard',
  ],
}

// What specifically unlocks when upgrading (upgrade path specific)
const UPGRADE_UNLOCKS: Record<string, string[]> = {
  'starter→pro': [
    '50 heavy credits/mo',
    'All 70+ team members (unlocks premium team members)',
    'Team Chat with memory + deliverables',
    '5 native integrations',
    'Proactive team updates',
  ],
  'starter→operator': [
    '150 heavy credits/mo',
    'All 70+ team members (unlocks premium team members)',
    'Workflows & Playbooks',
    '2 team seats',
    '9 integrations',
    'Top-up credit packs',
    'Activity dashboard',
  ],
  'pro→operator': [
    '150 heavy credits/mo (up from 50)',
    'Workflows & Playbooks',
    '2 team seats',
    'Zapier integration',
    'Top-up credit packs',
    'Activity dashboard',
  ],
}

// What locks when downgrading
const DOWNGRADE_LOCKS: Record<string, string[]> = {
  'operator→pro': [
    'Workflows & Playbooks (paused — data preserved)',
    'Scheduling (paused)',
    'Zapier (connections preserved but inactive)',
    '2nd team seat removed',
    'Activity dashboard locked',
  ],
  'operator→starter': [
    '40 Starter team members retained',
    'Team Chat reverts to 5 msgs/day',
    'All integrations paused',
  ],
  'pro→starter': [
    'Team Chat locked (reverts to 5 msgs/day)',
    'Integrations paused (connections preserved)',
    'Premium team members locked',
  ],
}

function formatDate(isoString: string) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatCurrency(amount: number) {
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`
}

function getPreviewEndDate(preview: PreviewPayload | null) {
  return preview?.currentPeriodEnd ? new Date(preview.currentPeriodEnd * 1000) : new Date(Date.now() + ((preview?.newCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000))
}

export function PlanChangeModal({ open, onClose, currentPlan, currentCycle, workspaceId, onComplete }: PlanChangeModalProps) {
  const [step, setStep] = useState('select') // select | confirm | loading | success
  const [targetPlan, setTargetPlan] = useState<PlanSlug | null>(null)
  const [targetCycle, setTargetCycle] = useState<string>(currentCycle || 'annual')
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')

  const currentOrder = PLAN_ORDER[currentPlan] ?? 1
  const availablePlans = Object.keys(PLAN_ORDER).filter(p => p !== currentPlan)

  useEffect(() => {
    if (targetPlan && step === 'confirm') {
      loadPreview()
    }
  }, [targetPlan, targetCycle, step])

  const loadPreview = async () => {
    setPreviewLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // Try real preview first
      let res = await fetch(`/api/upgrade-preview?plan=${targetPlan}&cycle=${targetCycle}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      let data = await res.json()

      // D4 fix: removed mock fallback. If no active subscription, show subscribe CTA instead.
      if (!res.ok) {
        if (data.error === 'No active subscription' || data.error === 'No subscription') {
          setError('no_subscription')
        } else {
          setError(data.error || 'Failed to load preview')
        }
      } else {
        setPreview(data)
      }
    } catch {
      setError('Failed to load plan details. Please try again.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSelectPlan = (plan: PlanSlug) => {
    setTargetPlan(plan)
    setPreview(null)
    setError('')
    setStep('confirm')
  }

  const handleConfirm = async () => {
    if (!preview) return
    setStep('loading')
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await apiFetch('/api/plan-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          workspaceId,
          targetPlan,
          targetCycle,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Plan change failed. Please try again.')
        setStep('confirm')
        return
      }
      setStep('success')
      if (onComplete) onComplete(data)
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('confirm')
    }
  }

  // Derive upgrade/downgrade from plan order (not from preview, which may be mock with wrong current)
  const isUpgrade = targetPlan ? (PLAN_ORDER[targetPlan] ?? 0) > currentOrder : false
  const isDowngrade = targetPlan ? (PLAN_ORDER[targetPlan] ?? 0) < currentOrder : false
  const upgradeKey = targetPlan ? `${currentPlan}→${targetPlan}` : ''
  const unlocks = UPGRADE_UNLOCKS[upgradeKey] || []
  const locks = DOWNGRADE_LOCKS[upgradeKey] || []

  if (!open) return null

  return (
    <Dialog className="p-4! sm:p-6! transition-none!" open={open} onClose={onClose} size="lg" backdropClassName='bg-black/50! transition-none!'>
      <DialogBody padding={false} className="mt-0!">
        <div style={{ maxHeight: 'calc(100vh - 120px)' }}>

          {/* ── SUCCESS ── */}
          {step === 'success' && preview && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M7 14.5L11.5 19L21 9" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111113', marginBottom: 8 }}>
                {isUpgrade ? `Welcome to ${PLAN_LABELS[preview.newPlan]}!` : 'Downgrade scheduled'}
              </h2>
              <p style={{ fontSize: 14, color: '#71717a', marginBottom: 24 }}>
                {isUpgrade
                  ? 'Your plan is upgraded. New features and credits are active now.'
                  : `Your plan will switch to ${PLAN_LABELS[preview.newPlan]} on ${formatDate(getPreviewEndDate(preview).toISOString())}. You keep ${PLAN_LABELS[currentPlan]} access until then.`
                }
              </p>
              <button onClick={() => { onClose(); window.location.reload() }}
                style={{ width: '100%', padding: 12, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                {isUpgrade ? 'Get started →' : 'Got it'}
              </button>
            </div>
          )}

          {/* ── LOADING ── */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#71717a', fontSize: 14 }}>
              Processing your plan change...
            </div>
          )}

          {/* ── SELECT ── */}
          {step === 'select' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111113', marginBottom: 6 }}>Change plan</h2>
                <p style={{ fontSize: 14, color: '#71717a' }}>
                  Currently on <strong>{PLAN_LABELS[currentPlan]}</strong> ({currentCycle === 'monthly' ? 'monthly' : 'annual'} billing).
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {availablePlans.map(plan => {
                  const isUp = (PLAN_ORDER[plan] ?? 0) > currentOrder
                  const price = PLAN_PRICES[plan]?.[targetCycle] ?? 0
                  return (
                    <button key={plan} onClick={() => handleSelectPlan(plan as PlanSlug)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, border: `1px solid ${isUp ? '#dbeafe' : '#e4e4e7'}`, background: isUp ? '#eff6ff' : '#fafafa', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111113' }}>
                          {PLAN_LABELS[plan]}
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: isUp ? '#2563eb' : '#f4f4f5', color: isUp ? '#fff' : '#71717a', borderRadius: 4, padding: '2px 6px' }}>
                            {isUp ? 'UPGRADE' : 'DOWNGRADE'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#71717a', marginTop: 3 }}>
                          {PLAN_FEATURES_FULL[plan]?.slice(0, 2).join(' · ')}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#111113', whiteSpace: 'nowrap' }}>
                        {formatCurrency(price)}<span style={{ fontSize: 13, fontWeight: 400, color: '#71717a' }}>/mo</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Billing cycle toggle */}
              <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#71717a' }}>Billing:</span>
                <div style={{ display: 'inline-flex', borderRadius: 99, border: '1px solid #e4e4e7', padding: 2 }}>
                  {['monthly', 'annual'].map(c => (
                    <button key={c} onClick={() => setTargetCycle(c)}
                      style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: targetCycle === c ? '#111113' : 'transparent', color: targetCycle === c ? '#fff' : '#71717a' }}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                      {c === 'annual' && <span style={{ marginLeft: 4, color: targetCycle === 'annual' ? '#86efac' : '#16a34a' }}>Save {targetPlan === 'starter' ? '26' : '20'}%</span>}
                    </button>
                  ))}
                </div>
              </div>

              <Button variant="outline" onClick={onClose} className='w-full mt-4.5'>
                Close
              </Button>
            </>
          )}

          {/* ── CONFIRM ── */}
          {step === 'confirm' && targetPlan && (
            <>
              <button onClick={() => { setStep('select'); setPreview(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', fontSize: 13, marginBottom: 16, padding: 0 }}>
                ← Back
              </button>

              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111113', marginBottom: 6 }}>
                {isUpgrade ? `Upgrade to ${PLAN_LABELS[targetPlan]}` : `Downgrade to ${PLAN_LABELS[targetPlan]}`}
              </h2>

              {previewLoading && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#71717a', fontSize: 14 }}>Loading details...</div>
              )}

              {error && !previewLoading && (
                error === 'no_subscription' ? (
                  // D4 fix: no active subscription — show subscribe CTA instead of fake success
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 20, textAlign: 'center' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>No active subscription found</p>
                    <p style={{ fontSize: 13, color: '#3b82f6', marginBottom: 16 }}>To access this plan, start a new subscription.</p>
                    <a href="/pricing" style={{ display: 'inline-block', background: '#2563eb', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>View Plans →</a>
                  </div>
                ) : (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#dc2626' }}>{error}</div>
                )
              )}

              {preview && !previewLoading && (
                <>
                  {/* UPGRADE confirmation */}
                  {isUpgrade && (
                    <>
                      {/* Price card */}
                      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #e4e4e7' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#71717a' }}>
                          <span>Current plan</span>
                          <span style={{ color: '#111113', fontWeight: 500 }}>
                            {PLAN_LABELS[currentPlan]} — {formatCurrency(PLAN_PRICES[currentPlan]?.[preview.currentCycle] ?? 0)}/mo ({preview.currentCycle})
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#71717a' }}>
                          <span>New plan</span>
                          <span style={{ color: '#111113', fontWeight: 500 }}>
                            {PLAN_LABELS[targetPlan]} — {formatCurrency(PLAN_PRICES[targetPlan]?.[preview.newCycle] ?? 0)}/mo ({preview.newCycle === 'annual' ? 'billed annually' : 'billed monthly'})
                          </span>
                        </div>
                        {(preview.prorationCredit ?? 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#71717a' }}>
                            <span>Credit for unused time</span>
                            <span style={{ color: '#16a34a', fontWeight: 500 }}>−{formatCurrency(preview.prorationCredit ?? 0)}</span>
                          </div>
                        )}
                        {(preview as any)._isMock && (preview.prorationCredit ?? 0) > 0 && (
                          <div style={{ fontSize: 12, color: '#71717a', marginBottom: 8, fontStyle: 'italic' }}>
                            ~15 days remaining · simulated proration
                          </div>
                        )}
                        <div style={{ borderTop: '1px solid #e4e4e7', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#111113' }}>
                          <span>Due today</span>
                          <span>{formatCurrency(preview.amountDue ?? 0)}</span>
                        </div>
                      </div>

                      {/* What you're getting */}
                      {unlocks.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', marginBottom: 8 }}>What you get immediately:</p>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {unlocks.map((f: string) => (
                              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                                <span style={{ color: '#2563eb', fontWeight: 700, marginTop: 1 }}>✓</span>{f}
                              </li>
                            ))}
                            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#71717a' }}>
                              <span style={{ color: '#2563eb', fontWeight: 700, marginTop: 1 }}>✓</span>
                              Credits reset to {PLAN_FEATURES_FULL[targetPlan]?.[1]} immediately
                            </li>
                            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#71717a' }}>
                              <span style={{ color: '#2563eb', fontWeight: 700, marginTop: 1 }}>✓</span>
                              New billing date: today · Next charge {formatCurrency((PLAN_PRICES[targetPlan]?.[preview.newCycle] ?? 0) * (preview.newCycle === 'annual' ? 12 : 1))} on{' '}
                              {getPreviewEndDate(preview)
                                .toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                            </li>
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  {/* DOWNGRADE confirmation */}
                  {isDowngrade && (
                    <>
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                        <p style={{ fontSize: 14, color: '#92400e', fontWeight: 500, marginBottom: 8 }}>
                          Your {PLAN_LABELS[currentPlan]} plan stays active until{' '}
                          <strong>{getPreviewEndDate(preview).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
                        </p>
                        <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
                          No charge today. Your next bill will be{' '}
                          <strong>{formatCurrency(PLAN_PRICES[targetPlan]?.[preview.currentCycle] ?? 0)}/mo</strong> on that date.
                        </p>
                      </div>

                      {locks.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', marginBottom: 8 }}>What changes on that date:</p>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                              <span style={{ color: '#f59e0b', marginTop: 1 }}>•</span>
                              Credits reset to {PLAN_FEATURES_FULL[targetPlan]?.[1]}
                            </li>
                            {locks.map((f: string) => (
                              <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                                <span style={{ color: '#f59e0b', marginTop: 1 }}>•</span>{f}
                              </li>
                            ))}
                            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#71717a', fontStyle: 'italic' }}>
                              <span style={{ color: '#71717a', marginTop: 1 }}>•</span>
                              Your saved data and Playbooks are preserved — re-upgrade anytime to restore
                            </li>
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: 14, color: '#dc2626' }}>{error}</div>
                  )}

                  {(preview as any)._isMock && (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#854d0e' }}>
                      🧪 <strong>Test mode</strong> — no real Stripe subscription. Simulates the flow without charging.
                    </div>
                  )}

                  <Button
                  variant="primary"
                  className='w-full mb-2.5'
                    onClick={handleConfirm}
                  >
                    {(preview as any)._isMock
                      ? `Simulate ${isUpgrade ? 'Upgrade' : 'Downgrade'} →`
                      : isUpgrade
                        ? `Upgrade Now — ${formatCurrency(preview.amountDue ?? 0)} today`
                        : `Confirm Downgrade to ${PLAN_LABELS[targetPlan]}`
                    }
                  </Button>
                  <Button
                  variant="outline"
                  className='w-full'
                    onClick={() => { setStep('select'); setPreview(null) }}
                  >
                    {isDowngrade ? `Keep ${PLAN_LABELS[currentPlan]}` : 'Back'}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </DialogBody>
    </Dialog>
  )
}
