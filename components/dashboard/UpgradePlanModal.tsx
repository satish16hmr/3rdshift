"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Dialog, DialogBody, DialogTitle } from '@/components/dialog'
import PlanCard from './PlanCard';
import Tabs from '../Tabs';
import { createClient } from '@/lib/supabase/client'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    anchorPrice: '$59',
    annualPrice: '$29',
    monthlyPrice: '$39',
    annualSavings: '$120/year',
    monthlySavings: '$10/mo',
    description: 'For creators who want content on autopilot.',
    features: ['200 light tasks/month', '40 team members', 'Light tasks only — add heavy credits on Pro (top-ups never expire)', '1 workspace', 'Email & chat support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    anchorPrice: '$159',
    annualPrice: '$79',
    monthlyPrice: '$99',
    annualSavings: '$240/year',
    monthlySavings: '$20/mo',
    description: 'For businesses running lead, research, and admin weekly',
    features: ['500 light tasks/month', 'All 70+ team members', '50 heavy credits/month', '3 workspaces', 'Email & chat support'],
    featured: true,
  },
  {
    id: 'operator',
    name: 'Operator',
    anchorPrice: '$399',
    annualPrice: '$199',
    monthlyPrice: '$249',
    annualSavings: '$600/year',
    monthlySavings: '$50/mo',
    description: 'For operators and agencies running at scale.',
    features: ['1,250 light tasks/month', 'All 70+ team members', '150 heavy credits/month', '2 seats', '10 workspaces', 'Email & chat support'],
  },
]

interface UpgradePlanModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan?: string;
  workspaceId?: string | null;
}

const UpgradePlanModal = ({
  open,
  onClose,
  currentPlan = '',
}: UpgradePlanModalProps) => {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState('annual')
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true);
  }, []);


  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login?redirect=/onboarding/plan')
    })
  }, [router])

  if (!mounted) return null;

  const startCheckout = async (plan: any, billingOverride = billingCycle) => {
    setLoadingPlan(plan)
    setError('')
    if (['starter', 'pro', 'operator'].includes(String(currentPlan).toLowerCase())) {
      // Existing subscribers must change plans through /api/plan-change on the
      // billing page. Never send them through fresh Checkout; that creates a
      // second subscription and routes them back into onboarding.
      router.push('/dashboard/settings/billing')
      onClose()
      return
    }
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billing_cycle: billingOverride }),
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
  }
  return createPortal(
    <div>
      <Dialog className='max-sm:w-[95%] sm:min-w-[85%] lg:min-w-[80%] 2xl:min-w-[66%] max-h-[90vh] min-h-[82vh] overflow-auto! p-0!' open={open} onClose={onClose}>
        <div className="flex items-center justify-between pl-6 pr-4 sm:pr-5 xl:pr-6 py-3 bg-zinc-50 border-b border-zinc-100 shrink-0 sticky top-0 left-0 z-40">
          <DialogTitle className="text-lg font-bold text-zinc-950">Select Plan</DialogTitle>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
            <X className="size-5" />
          </button>
        </div>
        <DialogBody className='mt-0! px-4! sm:px-6! py-5!'>
          <div className='flex justify-center mb-5'>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        </DialogBody>
      </Dialog>
    </div>,
    document.body
  );
};

export default UpgradePlanModal;