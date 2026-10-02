// @ts-nocheck
'use client'

import { useState } from 'react'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Text } from '@/components/text'
import {
  Dialog,
  DialogTitle,
  DialogBody,
} from '@/components/dialog'

// ---------------------------------------------------------------------------
// Plan data
// ---------------------------------------------------------------------------
const plans = {
  starter: {
    name: 'Starter',
    monthly: 39,
    annual: 29,
    credits: 0,
    features: [
      '40 AI team members on Starter',
      '200 light tasks per month',
      'Proactive team updates',
      'Integrations: Google Drive, LinkedIn, Instagram, Facebook',
    ],
  },
  pro: {
    name: 'Pro',
    monthly: 99,
    annual: 79,
    credits: 50,
    popular: true,
    features: [
      'All 70+ team members',
      '500 light tasks per month',
      '50 heavy task credits per month',
      'Team Chat with memory and deliverables',
      'Brand context on every task',
      'Template presets on premium team members',
      'Integrations: Google Workspace, Notion, Mailchimp, WordPress, Buffer',
    ],
  },
  operator: {
    name: 'Operator',
    monthly: 249,
    annual: 199,
    credits: 150,
    features: [
      'Everything in Pro',
      '1,250 light tasks per month',
      '150 heavy task credits per month',
      'Workflows and Playbooks',
      'Zapier integration',
      'Activity dashboard',
      'Top-up credit packs',
      '2 seats',
    ],
  },
}

// ---------------------------------------------------------------------------
// Checkmark icon
// ---------------------------------------------------------------------------
function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-emerald-500">
      <path d="M4 8.5L6.5 11L12 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Upgrade Modal
// ---------------------------------------------------------------------------
export function UpgradeModal({ open, onClose, currentPlan = 'starter', requiredTier = 'operator' }) {
  const [billing, setBilling] = useState('annual') // annual is default
  const [selectedPlan, setSelectedPlan] = useState(requiredTier === 'pro' ? 'pro' : 'operator')
  const [paymentStep, setPaymentStep] = useState('select') // select | checkout | success

  const plan = plans[selectedPlan]
  const price = billing === 'annual' ? plan.annual : plan.monthly

  if (paymentStep === 'success') {
    return (
      <Dialog open={open} onClose={onClose} size="sm">
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 14.5L11.5 19L21 9" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="mt-5 text-lg font-semibold text-zinc-950">
            Thanks for subscribing
          </h2>
          <Text className="mt-2">
            A payment to 3rdShift will appear on your statement.
          </Text>
          <div className="mt-4 w-full rounded-lg border border-zinc-950/[0.06] px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">3RDSHIFT</span>
              <span className="font-medium text-zinc-950">
                ${price}.00
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Powered by Stripe
          </p>
          <Button
            color="dark/zinc"
            className="mt-6 w-full justify-center"
            onClick={onClose}
          >
            Let's go →
          </Button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
        {/* ═══ Left: Plan details ═══ */}
        <div className="p-2 lg:border-r lg:border-zinc-950/[0.06] lg:pr-8">
          <DialogTitle className="!text-2xl">
            3rdShift <span className="text-blue-600">{plan.name}</span>
          </DialogTitle>

          <Text className="mt-2">
            Unlock all team members, more credits, and more.
          </Text>

          {/* Price + billing toggle */}
          <div className="mt-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold text-zinc-950">
                ${price}
              </span>
              <span className="text-sm text-zinc-500">/ month</span>
            </div>

            {/* Billing toggle */}
            <div className="mt-4 inline-flex items-center rounded-full border border-zinc-950/10 p-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  billing === 'monthly'
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('annual')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  billing === 'annual'
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Yearly
                <span className="ml-1.5 text-emerald-500">Save 20%</span>
              </button>
            </div>
          </div>

          {/* Plan selector pills */}
          <div className="mt-6 flex gap-2">
            {Object.entries(plans).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setSelectedPlan(key)}
                disabled={key === currentPlan}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                  key === selectedPlan
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : key === currentPlan
                      ? 'border-zinc-200 text-zinc-300'
                      : 'border-zinc-950/10 text-zinc-600 hover:border-zinc-950/20'
                }`}
              >
                {p.name}
                {key === currentPlan && (
                  <span className="ml-1 text-zinc-300">· Current</span>
                )}
              </button>
            ))}
          </div>

          {/* Features */}
          <div className="mt-6 space-y-3">
            {plan.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Check />
                <span className="text-sm text-zinc-600">{f}</span>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="mt-8 border-t border-zinc-950/[0.05] pt-6">
            <p className="text-[11px] text-zinc-400">Trusted by 500+ teams</p>
          </div>
        </div>

        {/* ═══ Right: Checkout (Stripe-style) ═══ */}
        <div className="mt-6 lg:mt-0 lg:pl-8">
          <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <img src="/logo-icon.png" alt="3rdShift" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} />
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  Subscribe to 3rdShift {plan.name}
                </p>
                <p className="text-xl font-semibold text-zinc-950">
                  ${price}.00
                  <span className="text-sm font-normal text-zinc-500">
                    {' '}per month
                  </span>
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-zinc-700">
                Email
              </label>
              <div className="mt-1.5 rounded-lg border border-zinc-950/10 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                josh@3rdshift.com
              </div>
            </div>

            {/* Payment method */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-zinc-700">
                Payment method
              </label>
              <div className="mt-1.5 space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-950/10 px-3 py-2.5">
                  <span className="flex size-4 items-center justify-center rounded-full border-[5px] border-zinc-950" />
                  <span className="text-sm text-zinc-700">Card</span>
                </div>
                <Input placeholder="1234 1234 1234 1234" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="MM / YY" />
                  <Input placeholder="CVC" />
                </div>
              </div>
            </div>

            {/* Cardholder */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-zinc-700">
                Cardholder name
              </label>
              <Input className="mt-1.5" placeholder="Full name on card" />
            </div>

            {/* Country */}
            <div className="mt-5">
              <label className="block text-sm font-medium text-zinc-700">
                Country or region
              </label>
              <Select className="mt-1.5" name="country">
                <option>United States</option>
                <option>Canada</option>
                <option>United Kingdom</option>
              </Select>
              <Input className="mt-3" placeholder="ZIP" />
            </div>

            {/* Subscribe button */}
            <Button
              color="dark/zinc"
              className="mt-6 w-full justify-center"
              onClick={() => setPaymentStep('success')}
            >
              Subscribe
            </Button>

            <p className="mt-3 text-center text-[11px] text-zinc-400">
              By subscribing, you authorize 3rdShift to charge you according
              to the terms until you cancel.
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
