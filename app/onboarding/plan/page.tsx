// @ts-nocheck
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthFooter from '@/components/auth/AuthFooter'
import PlanCard from '@/components/dashboard/PlanCard'
import Tabs from '@/components/Tabs'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import AuthBgPng from '@/public/images/auth/authBg.png'
import { BILLING_CATALOG } from '@/lib/billing/catalog'

const PLAN_ORDER = ['starter', 'pro', 'operator'] as const

const PLAN_COPY = {
  starter: {
    anchorPrice: '$59',
    description: 'For creators who want content on autopilot.',
    teamMembers: '40 team members',
  },
  pro: {
    anchorPrice: '$159',
    description: 'For businesses running lead, research, and admin weekly',
    teamMembers: 'All 70+ team members',
    featured: true,
  },
  operator: {
    anchorPrice: '$399',
    description: 'For operators and agencies running at scale.',
    teamMembers: 'All 70+ team members',
  },
}

const formatTaskLimit = (value) => value.toLocaleString('en-US')

const PLANS = PLAN_ORDER.map((id) => {
  const catalog = BILLING_CATALOG[id]
  const monthlySavings = Math.max(0, catalog.monthly_price_usd - catalog.annual_price_usd)
  const annualSavings = monthlySavings * 12

  return {
    id,
    name: catalog.name,
    anchorPrice: PLAN_COPY[id].anchorPrice,
    annualPrice: `$${catalog.annual_price_usd}`,
    monthlyPrice: `$${catalog.monthly_price_usd}`,
    annualSavings: `$${annualSavings.toLocaleString('en-US')}/year`,
    monthlySavings: `$${monthlySavings}/mo`,
    description: PLAN_COPY[id].description,
    features: [
      `${formatTaskLimit(catalog.light_task_limit)} light tasks/month`,
      PLAN_COPY[id].teamMembers,
      catalog.heavy_credits > 0 ? `${catalog.heavy_credits} heavy credits/month` : 'Light tasks only — add heavy credits on Pro (top-ups never expire)',
      'Email & chat support',
    ],
    featured: PLAN_COPY[id].featured,
  }
})

export default function OnboardingPlanPage() {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState('annual')
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const autoCheckoutStarted = useRef(false)

  const startCheckout = useCallback(async (plan, checkoutBillingCycle = 'annual') => {
    setLoadingPlan(plan)
    setError('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billing_cycle: checkoutBillingCycle }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.message || data.error || 'Checkout failed. Please try again.')
        setLoadingPlan(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Checkout failed. Please try again.')
      setLoadingPlan(null)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login?redirect=/onboarding/plan')

      const params = new URLSearchParams(window.location.search)
      const plan = params.get('plan')
      const billing = params.get('billing') === 'monthly' ? 'monthly' : 'annual'
      const checkout = params.get('checkout')
      const shouldAutoCheckout = checkout === 'auto'

      setBillingCycle(billing)
      setNotice(checkout === 'cancelled' ? "Checkout cancelled — you haven't been charged." : '')

      if (
        session &&
        shouldAutoCheckout &&
        !autoCheckoutStarted.current &&
        PLANS.some((item) => item.id === plan)
      ) {
        autoCheckoutStarted.current = true
        startCheckout(plan, billing)
      }
    })
  }, [router, startCheckout])

  return (
    <main className="bg-white p-4 pb-36 sm:p-6 sm:pb-36 lg:p-15 lg:pb-36 xl:h-screen">
      <Image
        src={AuthBgPng}
        alt="Auth Background"
        className="w-full h-full fixed top-0 left-0 z-0 lg:hidden"
        width={1000}
        height={1000}
      />
      <div className="relative z-10 mx-auto max-w-350 bg-white lg:bg-transparent rounded-xl px-4 lg:px-0 py-8 lg:py-0">
        <div className="text-left hidden lg:block">
          <p className='text-neutral-500 font-medium'>STEP 1/4</p>
          <h2 className='text-zinc-800 text-2xl font-semibold my-1'>Pick the plan that fits how you'll work.</h2>
          <p className='text-neutral-500 text-sm'>Choose a plan to start running your AI team.</p>
        </div>
        <div className="lg:mt-10 flex justify-center">
          <div className="w-full sm:w-auto inline-flex items-center gap-1">
            <Tabs
              activeTab={billingCycle}
              onChange={setBillingCycle}
              className="bg-zinc-50 border border-zinc-200 rounded-[10px]"
              tabClassName="px-4 py-2 text-sm font-semibold rounded-md"
              activeTabClassName="bg-white text-zinc-950 shadow-sm"
              tabs={[
                {
                  label: "Monthly",
                  value: "monthly",
                },
                {
                  value: "annual",
                  label: "Annual",
                  render: (
                    <div className="flex items-center gap-2">
                      <span>Annual</span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[#EFF8FF] border border-[#B2DDFF] text-blue-500">
                        Save 50%
                      </span>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>

        {notice && <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">{notice}</p>}
        {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}

        <div className="bg-zinc-100 border border-[#E4E7EC] p-2.5 rounded-4xl mt-10">
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5'>
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                loadingPlan={loadingPlan}
                startCheckout={startCheckout}
              />
            ))}
          </div>
        </div>
        <AuthFooter />
      </div>
    </main>
  )
}
