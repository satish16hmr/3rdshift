// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api-fetch'
import { Button } from './ui/button'
import { Textarea } from './textarea'
import { Dialog } from '@/components/dialog'
const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', operator: 'Operator' }
const PLAN_PRICES = {
  starter: { annual: 29, monthly: 39 },
  pro: { annual: 79, monthly: 99 },
  operator: { annual: 199, monthly: 249 },
}
const CANCEL_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'not_using', label: "Not using it enough" },
  { value: 'missing_feature', label: 'Missing a feature I need' },
  { value: 'switching', label: 'Switching to something else' },
  { value: 'other', label: 'Other' },
]
const PLAN_LOSES = {
  operator: ['150 heavy credits/month', 'Access to all 70+ AI team members', 'Brand context memory', 'Priority support', 'Early access to new team members'],
  pro: ['50 heavy credits/month', 'Access to all 70+ AI team members', 'Brand context memory', 'Priority support'],
  starter: ['Light tasks only', 'Access to 40 AI team members on Starter'],
}
export function CancellationModal({ plan, billingCycle, onClose, onComplete }) {
  const [step, setStep] = useState(1) // 1=survey, 2=offer, 3=confirm
  const [reason, setReason] = useState('')
  const [featureText, setFeatureText] = useState('')
  const [offer, setOffer] = useState(null) // result from get_offer
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accessEndsOn, setAccessEndsOn] = useState('')
  const [actionDone, setActionDone] = useState('') // 'discounted' | 'downgraded' | 'cancelled'
  const [newPlan, setNewPlan] = useState('')
  const cycle = billingCycle === 'monthly' ? 'monthly' : 'annual'
  async function apiCall(body) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await apiFetch('/api/cancel-flow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    // Surface HTTP errors as error objects so callers can handle them
    if (!res.ok && !data.error) {
      data.error = `Request failed (${res.status})`
    }
    return data
  }
  async function handleSurveyNext() {
    if (!reason) { setError('Please select a reason.'); return }
    setError('')
    setLoading(true)
    const data = await apiCall({ action: 'get_offer', cancelReason: reason })
    if (data.error) {
      setError(data.error)
      setLoading(false)
      return
    }
    if (data.skipOffer || data.offerType === 'none') {
      setStep(3)
      setLoading(false)
      return
    }
    setOffer(data)
    setStep(2)
    setLoading(false)
  }
  async function handleApplyDiscount() {
    setLoading(true)
    setError('')
    const data = await apiCall({ action: 'apply_discount' })
    if (data.success) {
      setActionDone('discounted')
      onComplete?.('discounted')
    } else {
      setError(data.error || 'Something went wrong')
    }
    setLoading(false)
  }
  async function handleFeatureFeedback() {
    setLoading(true)
    setError('')
    const data = await apiCall({ action: 'submit_feature_feedback', featureText })
    if (data.success) {
      setActionDone('feature_thanks')
      onComplete?.('feature_thanks')
    } else {
      setError(data.error || 'Something went wrong')
    }
    setLoading(false)
  }
  async function handleDowngrade(targetPlan) {
    setLoading(true)
    setError('')
    const data = await apiCall({ action: 'downgrade', targetPlan })
    if (data.success) {
      setNewPlan(targetPlan)
      setActionDone('downgraded')
      onComplete?.('downgraded', targetPlan)
    } else {
      setError(data.error || 'Something went wrong')
    }
    setLoading(false)
  }
  async function handleConfirmCancel() {
    setLoading(true)
    setError('')
    const data = await apiCall({ action: 'confirm_cancel' })
    if (data.success) {
      setAccessEndsOn(data.accessEndsOn)
      setActionDone('cancelled')
      onComplete?.('cancelled')
    } else {
      setError(data.error || 'Something went wrong')
    }
    setLoading(false)
  }
  // ── SUCCESS SCREENS ────────────────────────────────────────────────────────
  if (actionDone === 'feature_thanks') {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-4">
          <div className="text-4xl mb-4">🙏</div>
          <h2 className="text-lg font-semibold text-zinc-950">Thanks for the feedback</h2>
          <p className="mt-2 text-sm text-zinc-500">We're on it. We ship fast — check back soon.</p>
          <button onClick={onClose} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Stay on my plan →</button>
        </div>
      </Modal>
    )
  }
  if (actionDone === 'discounted') {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-4">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-lg font-semibold text-zinc-950">20% off applied</h2>
          <p className="mt-2 text-sm text-zinc-500">Your discount has been applied for the next 3 months. We're glad you're staying.</p>
          <button onClick={onClose} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Back to billing →</button>
        </div>
      </Modal>
    )
  }
  if (actionDone === 'downgraded') {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-4">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-zinc-950">Downgraded to {PLAN_LABELS[newPlan]}</h2>
          <p className="mt-2 text-sm text-zinc-500">You're now on {PLAN_LABELS[newPlan]} at ${PLAN_PRICES[newPlan]?.[cycle]}/mo. You can upgrade anytime.</p>
          <button onClick={onClose} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Back to billing →</button>
        </div>
      </Modal>
    )
  }
  if (actionDone === 'cancelled') {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-4">
          <div className="text-4xl mb-4">👋</div>
          <h2 className="text-lg font-semibold text-zinc-950">Subscription cancelled</h2>
          <p className="mt-2 text-sm text-zinc-500">Your access continues until <strong>{accessEndsOn}</strong>. Your task history is saved for 90 days.</p>
          <button onClick={onClose} className="mt-6 w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">Close</button>
        </div>
      </Modal>
    )
  }
  return (
    <Modal onClose={onClose}>
      {/* ── STEP 1: Survey ── */}
      {step === 1 && (
        <div className="pt-3">
          <div className="border-b border-zinc-200 px-4 sm:px-6">
            <h2 className="text-lg font-semibold text-zinc-800 mb-4 max-w-[85%]">Before you go — what's the reason?</h2>
          </div>
          <div className="mt-5 space-y-3 sm:spce-y-4 md:space-y-5 px-4 sm:px-6">
            {CANCEL_REASONS.map(r => (
              <div key={r.value}>
                <label key={r.value} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition ${reason === r.value ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => { setReason(r.value); setError('') }} className="accent-blue-600" />
                  <span className="text-sm font-medium text-[#414651]">{r.label}</span>
                </label>
                {r.value === 'other' && reason === 'other' && (
                  <div className='mt-5'>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Description</label>
                    <Textarea
                      // value={otherReason}
                      // onChange={(e) => setOtherReason(e.target.value)}
                      placeholder="Description"
                      className="h-32"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-red-500 px-4! sm:px-6!">{error}</p>}
          <div className="mt-3 sm:mt-5 flex items-center justify-center sm:justify-between flex-wrap gap-2 p-4! sm:p-6! sm:pt-5! border-t border-zinc-200">
            <button onClick={onClose} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Never mind, keep my plan →</button>
            <Button onClick={handleSurveyNext} disabled={loading} variant="primary" className='order-1 sm:order-2 w-full! sm:w-auto!'>
              {loading ? 'Loading…' : 'Continue →'}
            </Button>
          </div>
        </div>
      )}
      {/* ── STEP 2: Offer ── */}
      {step === 2 && offer && (
        <div className="pt-3">
          <div className="border-b border-zinc-200 px-4 sm:px-6">
            <h2 className="text-lg font-semibold text-zinc-800 mb-4 max-w-[85%]">Before you cancel</h2>
          </div>
          {/* Feature request */}
          {offer.offerType === 'feature_request' && (
            <div>
              <div className="mt-5 space-y-3 px-4 sm:px-6">
                <p className="mt-2 text-sm text-zinc-500">Tell us what's missing — we ship fast.</p>
                <Textarea
                  value={featureText}
                  onChange={e => setFeatureText(e.target.value)}
                  placeholder="What feature do you need?"
                  className="h-32"
                />
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              <div className="mt-5 flex items-center justify-center sm:justify-between flex-wrap gap-3 sm:gap-2 p-4! sm:p-6! sm:pt-5! border-t border-zinc-200">
                <button onClick={() => setStep(3)} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Cancel anyway →</button>
                <Button disabled={loading || !featureText.trim()}
                  onClick={handleFeatureFeedback} variant="primary" className='order-1 sm:order-2 w-full! sm:w-auto!'>
                  {loading ? 'Saving…' : 'Stay and wait for it'}
                </Button>
              </div>
            </div>
          )}
          {/* Discount only */}
          {offer.offerType === 'discount_only' && (
            <>
              <div className="mt-5 space-y-3 px-4 sm:px-6">
                <p className="mt-2 text-sm text-zinc-500">Stay for 20% off your next 3 months.</p>
                <button onClick={handleApplyDiscount} disabled={loading} className="w-full rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-3.5 text-left hover:bg-blue-100 disabled:opacity-50 transition">
                  <p className="text-sm font-semibold text-blue-700">Stay for 20% off your next 3 months</p>
                  <p className="mt-0.5 text-xs text-blue-500">Applied instantly to your current subscription</p>
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              <div className="mt-5 flex items-center justify-center sm:justify-between flex-wrap gap-3 sm:gap-2 p-4! sm:p-6! sm:pt-5! border-t border-zinc-200">
                <button onClick={onClose} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Never mind, keep my plan →</button>
                <button onClick={() => setStep(3)} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Cancel anyway →</button>
              </div>
            </>
          )}
          {/* Discount + downgrade */}
          {offer.offerType === 'discount_or_downgrade' && (
            <>
              <div className="mt-5 space-y-3 px-4 sm:px-6">
                <p className="mt-2 text-sm text-zinc-500">We'd hate to lose you. Here's what we can offer:</p>
                <div className="space-y-3">
                  <button onClick={handleApplyDiscount} disabled={loading} className="w-full rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-3.5 text-left hover:bg-blue-100 disabled:opacity-50 transition">
                    <p className="text-sm font-semibold text-blue-700">Stay for 20% off your next 3 months</p>
                    <p className="mt-0.5 text-xs text-blue-500">Applied instantly — no action needed after this</p>
                  </button>
                  {(Array.isArray(offer.downgradeTo) ? offer.downgradeTo : [offer.downgradeTo]).filter(Boolean).map(tp => (
                    <button key={tp} onClick={() => handleDowngrade(tp)} disabled={loading} className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-50 transition">
                      <p className="text-sm font-semibold text-zinc-800">Or downgrade to {PLAN_LABELS[tp]} (${PLAN_PRICES[tp]?.[cycle]}/mo)</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Keep your data and lower the monthly cost</p>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              <div className="mt-5 flex items-center justify-center sm:justify-between flex-wrap gap-3 sm:gap-2 p-4! sm:p-6! sm:pt-5! border-t border-zinc-200">
                <button onClick={onClose} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Never mind, keep my plan →</button>
                <button onClick={() => setStep(3)} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Cancel anyway →</button>
              </div>
            </>
          )}
          {/* Downgrade only */}
          {offer.offerType === 'downgrade_only' && (
            <>
              <div className="mt-5 space-y-3 px-4 sm:px-6">
                <p className="mt-2 text-sm text-zinc-500">
                  {reason === 'not_using'
                    ? `Downgrade to ${plan === 'operator' ? 'Pro' : 'Starter'} and keep access to everything you need.`
                    : `Downgrade to ${plan === 'operator' ? 'Pro or Starter' : 'Starter'} to keep your data.`}
                </p>
                <div className="mt-4 space-y-3">
                  {(Array.isArray(offer.downgradeTo) ? offer.downgradeTo : [offer.downgradeTo]).map(tp => (
                    <button key={tp} onClick={() => handleDowngrade(tp)} disabled={loading} className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-50 transition">
                      <p className="text-sm font-semibold text-zinc-800">Downgrade to {PLAN_LABELS[tp]}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">${PLAN_PRICES[tp]?.[cycle]}/mo</p>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              <div className="mt-5 flex items-center justify-center sm:justify-between flex-wrap gap-3 sm:gap-2 p-4! sm:p-6! sm:pt-5! border-t border-zinc-200">
                <button onClick={onClose} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Never mind, keep my plan →</button>
                <button onClick={() => setStep(3)} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Cancel anyway →</button>
              </div>
            </>
          )}
        </div>
      )}
      {/* ── STEP 3: Confirm ── */}
      {step === 3 && (
        <div className="pt-3">
          <div className="border-b border-zinc-200 px-4 sm:px-6">
            <h2 className="text-lg font-semibold text-zinc-800 mb-4 max-w-[85%]">Confirm cancellation</h2>
          </div>

          <div className="mt-5 space-y-5 px-4 sm:px-6">
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-2 text-sm text-zinc-700">
              <p>Your <strong>{PLAN_LABELS[plan]}</strong> subscription will end at the end of your current billing period.</p>
              <p>You&apos;ll keep full access until then and can resume anytime before the cancellation date.</p>
              <p className="font-medium text-zinc-950 mt-2">You&apos;ll lose access to:</p>
              <ul className="mt-1 space-y-1">
                {(PLAN_LOSES[plan] || []).map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-red-400">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-400">Your task history will be saved for 90 days after cancellation.</p>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-500 px-4 sm:px-6">{error}</p>}
          <div className="mt-5 flex items-center justify-center sm:justify-between flex-wrap gap-3 sm:gap-2 p-4! sm:p-6! sm:pt-5! border-t border-zinc-200">
            <button onClick={onClose} className="text-sm text-neutral-500 font-semibold hover:text-zinc-600 cursor-pointer order-2 sm:order-1 h-9">Never mind, keep my plan →</button>
            <Button onClick={handleConfirmCancel} disabled={loading} variant="destructive" className='order-1 sm:order-2 w-full! sm:w-auto!'>
              {loading ? 'Cancelling…' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
function Modal({ children, onClose }) {
  return (
    <Dialog open={true} onClose={onClose} size="md" backdropClassName='bg-black/50! transition-none!' className="max-w-[90%]! sm:max-w-md! transition-none! p-0!">
      <div className="relative w-full">
        <button onClick={onClose} className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 z-10">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </Dialog>
  )
}