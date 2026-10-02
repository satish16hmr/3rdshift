// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { CircleCheck } from 'lucide-react'

import { Heading, Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Divider } from '@/components/divider'
import { Badge } from '@/components/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CancellationModal } from '@/components/cancellation-modal'
import { PlanChangeModal } from '@/components/plan-change-modal'

import { createClient } from '@/lib/supabase/client'
import { trackBillingViewed, trackUpgradeClicked } from '@/lib/posthog'
import { apiFetch } from '@/lib/api-fetch'
import { getCreditDisplaySummary } from '@/lib/billing/credit-balance'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

// Top-up pack definitions (displayed prices in dollars)
const TOPUP_PACKS = [
  { name: 'small', credits: 25, annual: 47, monthly: 47, label: 'Small' },
  { name: 'medium', credits: 50, annual: 87, monthly: 87, label: 'Medium' },
  { name: 'large', credits: 100, annual: 167, monthly: 167, label: 'Large' },
]

function TopUpSection({ billingCycle, planCreditsRemaining, topupCredits }) {
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const isAnnual = billingCycle !== 'monthly'

  const handleBuy = async (packName) => {
    setLoading(packName)
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await apiFetch('/api/topup-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ pack: packName }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Something went wrong')
        setLoading(null)
      }
    } catch {
      setError('Failed to start checkout')
      setLoading(null)
    }
  }

  return (
    <div id="top-up" className='sm:col-span-2'>
      <div>
        <h3 className="text-lg font-semibold text-zinc-800">Need more heavy credits this month?</h3>
        <p className="text-sm text-neutral-500 mt-1">
          Top-up credits are added to your current balance immediately.
        </p>
      </div>

      {topupCredits > 0 && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          You have <strong>{topupCredits} top-up credits</strong> remaining this billing period.
        </div>
      )}

      <div className="grid grid-cols-1 min-[500px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 my-4 sm:my-5">
        {TOPUP_PACKS.map(pack => {
          const price = isAnnual ? pack.annual : pack.monthly
          return (
            <div key={pack.name} className="rounded-2xl border border-zinc-200 p-5 flex flex-col items-center text-center gap-5">
              <div className="flex justify-between w-full">
                <div>
                  <p className="text-lg font-semibold text-zinc-950 text-left">{pack.label}</p>
                  <p className="text-sm text-zinc-500 mt-0.5">{pack.credits} credits</p>
                </div>
                <p className="text-2xl font-semibold text-zinc-950">${price}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => handleBuy(pack.name)}
                disabled={loading === pack.name}
                className="text-zinc-700 w-full!"
              >
                {loading === pack.name ? 'Loading...' : 'Buy Now'}
              </Button>
            </div>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <p className="text-sm text-neutral-500">
        Top-up credits never expire and carry over indefinitely.
      </p>
    </div>
  )
}

async function openCustomerPortal() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const res = await apiFetch('/api/customer-portal', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  } else {
    alert(data.error || 'Could not open billing portal. Please contact us through the Help & Support section in your dashboard.')
  }
}

const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', operator: 'Operator' }
const PLAN_PRICES = {
  starter: { annual: 29, monthly: 39 },
  pro: { annual: 79, monthly: 99 },
  operator: { annual: 199, monthly: 249 },
}
const PLAN_CREDITS = { starter: 0, pro: 50, operator: 150 }
function formatSubscriptionDate(timestamp) {
  if (!timestamp) return null
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const PLAN_FEATURES = {
  starter: ['200 light tasks/month', 'Light tasks only — add heavy credits on Pro (top-ups never expire)', '40 team members on Starter', '1 workspace', '5 Team Chat messages/day', 'In-app support'],
  pro: ['500 light tasks/month', '50 heavy credits/mo', 'All 70+ team members', '3 workspaces', 'Team Chat with memory + deliverables', '5 native integrations', 'Template presets on premium team members'],
  operator: ['1,250 light tasks/month', '150 heavy credits/mo', 'All 70+ team members', 'Workflows & Playbooks', '2 team seats', '9 integrations + Zapier', 'Top-up credit packs', 'Activity dashboard'],
}

const UPGRADE_CONFIG = {
  starter: {
    label: 'Unlock more with Pro →',
    subtitle: '50 credits/mo · All 70+ team members',
    href: '/pricing',
  },
  pro: {
    label: 'Unlock more with Operator →',
    subtitle: '150 credits/mo · Workflows',
    href: '/founding?plan=operator',
  },
}

function ManagePlanButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    await openCustomerPortal()
    setLoading(false)
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="primary"
      className="w-fit shadow-sm"
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Opening…
        </>
      ) : 'Manage Plan →'}
    </Button>
  )
}

function BillingAccountSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5 gap-y-4 sm:gap-y-6 md:gap-y-8">
      <div className="rounded-2xl border border-zinc-950/[0.08] bg-white p-4 sm:p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <Skeleton className="mb-4 h-7 w-28 bg-zinc-200" />
            <Skeleton className="h-7 w-25.5 rounded-full bg-zinc-200" />
          </div>
          <Skeleton className="h-12 w-24 bg-zinc-200" />
        </div>

        {/* <div className="mb-5 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full bg-zinc-200" />
            <Skeleton className="h-4 w-32 bg-zinc-200" />
          </div>
          <Skeleton className="mt-2 h-4 w-full bg-zinc-200" />
        </div> */}

        <ul className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <li key={index} className="flex items-center gap-2.5">
              <Skeleton className="h-6 w-6 rounded-full bg-zinc-200" />
              <Skeleton className={`h-4 bg-zinc-200 ${index % 2 === 0 ? 'w-40' : 'w-52'}`} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-zinc-950/[0.08] bg-white p-4 sm:p-5 md:p-6 flex flex-col justify-between">
        <div>
          <Skeleton className="h-5 w-32 bg-zinc-200" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-full bg-zinc-200" />
            <Skeleton className="h-4 w-3/4 bg-zinc-200" />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <Skeleton className="my-2 h-2 w-full rounded-full bg-zinc-200" />
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-28 bg-zinc-200" />
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-4 w-24 bg-zinc-200" />
                <Skeleton className="h-4 w-40 bg-zinc-200" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="top-up-skeleton" className="sm:col-span-2">
        <div>
          <Skeleton className="h-6 w-72 max-w-full bg-zinc-200" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full bg-zinc-200" />
        </div>

        <div className="grid grid-cols-1 min-[500px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 my-4 sm:my-5">
          {TOPUP_PACKS.map((pack) => (
            <div key={pack.name} className="rounded-2xl border border-zinc-200 p-5 flex flex-col items-center text-center gap-5">
              <div className="flex justify-between w-full gap-4">
                <div>
                  <Skeleton className="h-5 w-16 bg-zinc-200" />
                  <Skeleton className="mt-2 h-4 w-20 bg-zinc-200" />
                </div>
                <Skeleton className="h-8 w-14 bg-zinc-200" />
              </div>
              <Skeleton className="h-9 w-full bg-zinc-200" />
            </div>
          ))}
        </div>

        <Skeleton className="h-4 w-64 max-w-full bg-zinc-200" />
      </div>

      {/* <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 sm:p-5">
        <Skeleton className="h-11 w-full bg-zinc-100" />
        <Skeleton className="mx-auto mt-2 h-3 w-40 bg-zinc-100" />
      </div>

      <div className="flex justify-start">
        <Skeleton className="h-4 w-20 bg-zinc-200" />
      </div> */}

      <div className="flex justify-between items-center gap-2 sm:col-span-2">
        <Skeleton className="h-9 w-32 bg-zinc-200" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-20 bg-zinc-200" />
          <Skeleton className="h-4 w-20 bg-zinc-200" />
        </div>
      </div>

      <Skeleton className="h-4 w-80 max-w-full bg-zinc-200 sm:col-span-2" />
    </div>
  )
}

export default function Billing() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false)
  const [stripePrice, setStripePrice] = useState(null)
  const [stripeCycle, setStripeCycle] = useState(null)
  const [stripeDiscount, setStripeDiscount] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false)
  const [cancelAt, setCancelAt] = useState(null)
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null)
  const [reactivating, setReactivating] = useState(false)
  const [reactivationError, setReactivationError] = useState('')
  const [topupCredits, setTopupCredits] = useState(0)
  const [userId, setUserId] = useState(null)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null)
  const [isSeatMember, setIsSeatMember] = useState(false) // true if Seat 2 (no own subscription)

  useEffect(() => {
    trackBillingViewed()
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user, } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        setUserId(user.id)
        const { data } = await supabase
          .from('profiles')
          .select('plan, billing_cycle, billing_status, full_name, email, stripe_subscription_id, heavy_credits_remaining, retention_offer_used')
          .eq('id', user.id)
          .single()
        setProfile(data)

        // Load workspace plan — overrides profile plan for both seat members and workspace switching
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          fetch('/api/workspace', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
            .then(r => r.json()).then(d => {
              if (d.activeWorkspaceId) setActiveWorkspaceId(d.activeWorkspaceId)
              const ws = d.workspaces?.find(w => w.id === d.activeWorkspaceId)
              if (ws) {
                // Always use workspace plan (covers switching + seat members)
                setProfile(prev => ({
                  ...prev,
                  plan: ws.plan,
                  _credits_limit: ws.heavy_credits_limit,
                }))
              }
              if (d.ownerCredits) {
                setTopupCredits(d.ownerCredits.topup_credits_remaining ?? 0)
                setProfile(prev => ({
                  ...prev,
                  heavy_credits_remaining: d.ownerCredits.plan_credits_remaining ?? d.ownerCredits.heavy_credits_remaining,
                  _available_credits_remaining: d.ownerCredits.available_credits_remaining,
                  _topup_credits_remaining: d.ownerCredits.topup_credits_remaining ?? 0,
                  _credits_limit: d.ownerCredits.included_credits_limit ?? d.ownerCredits.heavy_credits_limit ?? prev?._credits_limit,
                  billing_cycle: d.ownerCredits.billing_cycle || prev?.billing_cycle || 'annual',
                  stripe_subscription_id: d.ownerCredits.stripe_subscription_id || prev?.stripe_subscription_id,
                }))
              }
              if (d.userRole === 'member') {
                setIsSeatMember(true)
              }
            }).catch(() => { })
        }

        // Load active top-up credits
        const { data: topups } = await supabase
          .from('credit_topups')
          .select('credits_remaining, expires_at')
          .eq('user_id', user.id)
          .eq('is_expired', false)
          .gt('credits_remaining', 0)
        const directTopupCredits = (topups ?? [])
          .filter((t) => !t.expires_at || new Date(t.expires_at).getTime() > Date.now())
          .reduce((s, t) => s + Math.max(Number(t.credits_remaining ?? 0), 0), 0)
        setTopupCredits(directTopupCredits)
        setProfile(prev => ({
          ...prev,
          _topup_credits_remaining: prev?._topup_credits_remaining ?? directTopupCredits,
          _available_credits_remaining: prev?._available_credits_remaining ?? Math.max(Number(prev?.heavy_credits_remaining ?? 0), 0) + directTopupCredits,
        }))

        // Fetch real price/interval from Stripe if subscription exists
        if (data?.stripe_subscription_id) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/subscription-details', {
              headers: { 'Authorization': `Bearer ${session.access_token}` },
            })
            if (res.ok) {
              const details = await res.json()
              if (details.price) setStripePrice(details.price)
              if (details.interval) setStripeCycle(details.interval)
              if (details.discount) setStripeDiscount(details.discount)
              setSubscriptionStatus(details.status || null)
              setCancelAtPeriodEnd(Boolean(details.cancel_at_period_end))
              setCancelAt(details.cancel_at || null)
              setCurrentPeriodEnd(details.current_period_end || null)
            }
          } catch { /* fall back to profile data */ }
        }

        setLoading(false)
      } catch (err) {
        console.error('[billing] load error:', err)
        setLoading(false)
      }
    }
    load()
  }, [])

  const plan = profile?.plan
  // Use real Stripe data if available, fall back to profile
  const cycle = stripeCycle || (profile?.billing_cycle === 'monthly' ? 'monthly' : 'annual')
  const price = stripePrice ?? PLAN_PRICES[plan]?.[cycle] ?? 0
  // Seat members use _credits_limit from owner's workspace, others use PLAN_CREDITS
  const credits = profile?._credits_limit ?? PLAN_CREDITS[plan] ?? 0
  const features = PLAN_FEATURES[plan] ?? []
  // Whether this account has a real Stripe subscription (manually provisioned accounts do not)
  const hasStripeSubscription = !!(profile?.stripe_subscription_id)
  const futureCancelAt = cancelAt && cancelAt * 1000 > Date.now() ? cancelAt : null
  const isCancellingAtPeriodEnd = cancelAtPeriodEnd || Boolean(futureCancelAt)
  const isSubscriptionActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || !subscriptionStatus
  const canReactivateSubscription = hasStripeSubscription && isSubscriptionActive && isCancellingAtPeriodEnd
  const cancelDateLabel = formatSubscriptionDate(futureCancelAt || currentPeriodEnd)

  const handleReactivatePlan = async () => {
    setReactivating(true)
    setReactivationError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in again to resume your plan.')
      const res = await apiFetch('/api/cancel-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'resume_subscription' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Could not resume your plan')
      }
      setCancelAtPeriodEnd(false)
      setCancelAt(null)
      setSubscriptionStatus(data.status || 'active')
    } catch (error) {
      setReactivationError(error instanceof Error ? error.message : 'Could not resume your plan')
    } finally {
      setReactivating(false)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Billing</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Manage your subscription and plan details.
        </Text>
      </div>

      {loading ? (
        <BillingAccountSkeleton />
      ) : (!plan || plan === 'none') ? (
        <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-8 text-center">
          <p className="text-zinc-500 text-sm">No active plan.</p>
          <Button className="mt-4" href="/pricing">View Plans</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2.5 gap-y-4 sm:gap-y-6 md:gap-y-8">
          {profile?.billing_status === 'past_due' && (
            <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-900">Payment failed — update your card</p>
                  <p className="mt-1 text-sm text-red-800">Your team may be paused until your payment method is updated.</p>
                </div>
                <Button onClick={openCustomerPortal} variant="outline" className="bg-white! text-red-900! border-red-300! hover:bg-red-100!">Update card →</Button>
              </div>
            </div>
          )}
          {canReactivateSubscription && (
            <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Your plan is set to cancel{cancelDateLabel ? ` on ${cancelDateLabel}` : ''}.</p>
                  <p className="mt-1 text-sm text-amber-800">You&apos;ll keep full access until then.</p>
                </div>
                <Button onClick={handleReactivatePlan} disabled={reactivating} variant="outline" className="bg-white! text-amber-900! border-amber-300! hover:bg-amber-100!">
                  {reactivating ? 'Resuming…' : 'Resume plan'}
                </Button>
              </div>
              {reactivationError && <p className="mt-2 text-xs font-medium text-red-600">{reactivationError}</p>}
            </div>
          )}

          {/* Current plan card */}
          <div className="rounded-2xl border border-zinc-950/8 bg-white p-4 sm:p-5 xl:p-6">
            <div>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <div className='text-xl sm:text-2xl font-medium text-zinc-950 mb-3'>{PLAN_LABELS[plan]}</div>
                  <Badge color='blue' className="bg-[#EFF8FF]! border border-[#B2DDFF]! rounded-full! capitalize text-[#175CD3]! px-2! px-3! py-1!">{cycle === 'monthly' ? 'Monthly billing' : 'Annual billing'}</Badge>
                </div>
                <span className="text-[36px] sm:text-[38px] xl:text-[48px] text-zinc-950">
                  ${price}<span className="text-sm text-zinc-500">/mo</span>
                </span>
              </div>
              {stripeDiscount?.percentOff && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏷️</span>
                    <span className="text-sm font-semibold text-emerald-800">
                      20% discount active
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-emerald-700">
                    Your next invoice will be{' '}
                    <strong>${Math.round(price * 0.8)}/mo</strong>
                    {stripeDiscount?.expiryDate && (
                      <> · Expires {stripeDiscount.expiryDate}</>
                    )}
                    {!stripeDiscount?.expiryDate && (
                      <> · Applied for 3 months</>
                    )}
                  </p>
                </div>
              )}
            </div>

            <ul className="space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-zinc-500">
                  <CircleCheck fill="#155dfc" className='text-white w-6 h-6' strokeWidth={1.5} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Credits card */}
          <div className="rounded-2xl border border-zinc-950/[0.08] bg-white p-4 sm:p-5 md:p-6 flex flex-col justify-between">
            <div>
              <Subheading className="text-base! font-semibold!">Heavy Credits</Subheading>
              <Text className="mt-3 text-sm text-zinc-500">Used for research, lead gen, image generation, and other resource-intensive tasks.</Text>
            </div>
            <div>
              {plan === 'starter' ? (
                <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                  Heavy credits are not included on the Starter plan.{' '}
                  <button onClick={() => setShowPlanChangeModal(true)} className="font-medium text-blue-600 hover:text-blue-700" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upgrade to Pro →</button>
                </div>
              ) : (
                <>
                  {(() => {
                    const creditSummary = getCreditDisplaySummary({
                      planCreditsRemaining: profile?.heavy_credits_remaining ?? 0,
                      topupCreditsRemaining: profile?._topup_credits_remaining ?? topupCredits,
                      includedCreditsLimit: credits,
                    })
                    const rem = creditSummary.availableCreditsRemaining
                    const total = credits || 1
                    const pct = Math.min(100, Math.round((rem / total) * 100))
                    const barColor = creditSummary.isDepleted ? '#dc2626' : pct < 10 ? '#dc2626' : pct < 20 ? '#f59e0b' : '#2563eb'
                    const depleted = creditSummary.isDepleted
                    return (
                      <>
                        <div className="my-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <div className="flex items-start justify-between gap-2 text-sm">
                          <span className="text-sm text-zinc-500">Credits remaining</span>
                          <span className="text-right">
                            <span className={`font-semibold ${depleted ? "text-zinc-500" : "text-zinc-950"}`}>{creditSummary.primaryText}</span>
                            <span className="block text-xs text-zinc-500">{creditSummary.breakdownText}</span>
                          </span>
                        </div>

                        {depleted && (
                          <div style={{ marginTop: '10px', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                            <p style={{ fontSize: '13px', color: '#dc2626', fontWeight: 500, margin: '0 0 4px' }}>
                              ⚠️ You’re out of heavy credits.
                              {plan === 'operator'
                                ? ' Pick up a credit pack below to keep going.'
                                : ' Credits reset at the start of your next billing cycle. Upgrade to Operator for 150 credits/month plus top-up packs.'}
                            </p>
                            {plan !== 'operator' && (
                              <a href="/dashboard/settings/billing" style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626', textDecoration: 'underline' }}>
                                Upgrade to Operator →
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Top-up credits — Operator only */}
          {plan === 'operator' && (
            <TopUpSection
              billingCycle={cycle}
              planCreditsRemaining={profile?.heavy_credits_remaining ?? 0}
              topupCredits={topupCredits}
            />
          )}

          {/* Upgrade/Downgrade button — not for seat members */}
          {!isSeatMember && plan !== 'operator' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
              <button
                onClick={() => setShowPlanChangeModal(true)}
                className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
              >
                {UPGRADE_CONFIG[plan]?.label || 'Change plan'}
              </button>
              <p className="mt-2 text-center text-xs text-blue-500">{UPGRADE_CONFIG[plan]?.subtitle}</p>
            </div>
          )}
          {/* Actions — hidden for seat members */}
          {!isSeatMember && (
            <>
              <div className="flex justify-between items-center gap-2 sm:col-span-2">
                <ManagePlanButton />
                {hasStripeSubscription && (
                  <div className="flex flex-wrap justify-end items-center gap-x-4 gap-y-2">
                    {plan === 'operator' && (
                      <button
                        onClick={() => setShowPlanChangeModal(true)}
                        className="text-xs sm:text-sm font-semibold text-neutral-500 transition hover:text-zinc-700 hover:underline hover:underline-offset-2 cursor-pointer"
                      >
                        Change plan
                      </button>
                    )}
                    {canReactivateSubscription ? (
                      <button
                        onClick={handleReactivatePlan}
                        disabled={reactivating}
                        className="text-xs sm:text-sm font-semibold text-neutral-500 transition hover:text-zinc-700 hover:underline hover:underline-offset-2 disabled:text-zinc-300 cursor-pointer"
                      >
                        {reactivating ? 'Resuming…' : 'Reactivate'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="text-xs sm:text-sm font-semibold text-neutral-500 transition hover:text-zinc-700 hover:underline hover:underline-offset-2 cursor-pointer"
                      >
                        Cancel plan
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-400 sm:col-span-2">
                {hasStripeSubscription
                  ? canReactivateSubscription
                    ? 'To update payment info, use Manage Plan. To keep your subscription active, click Resume plan before the cancellation date.'
                    : 'To update payment info, use Manage Plan. To cancel, click Cancel plan.'
                  : 'To update payment info, use Manage Plan.'}
              </p>
            </>
          )}
          {isSeatMember && (
            <p className="text-xs text-zinc-400 sm:col-span-2">
              Billing is managed by the workspace owner.
            </p>
          )}

          {showPlanChangeModal && (
            <PlanChangeModal
              open={showPlanChangeModal}
              onClose={() => setShowPlanChangeModal(false)}
              currentPlan={plan}
              currentCycle={cycle}
              workspaceId={activeWorkspaceId}
              onComplete={() => {
                setShowPlanChangeModal(false)
                window.location.reload()
              }}
            />
          )}

          {showCancelModal && (
            <CancellationModal
              plan={plan}
              billingCycle={cycle}
              onClose={() => setShowCancelModal(false)}
              onComplete={(result, newPlanName) => {
                // For discount: modal shows success screen — don't close or reload yet
                // For downgrade/cancel: close modal and reload to show updated plan
                if (result === 'downgraded' || result === 'cancelled') {
                  setShowCancelModal(false)
                  window.location.reload()
                }
                // 'discounted' and 'feature_thanks': modal handles its own success screen
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
