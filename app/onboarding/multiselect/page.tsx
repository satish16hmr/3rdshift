'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import OnboardingStepper from '@/components/onboarding/OnboardingStepper'
import RightPanel from '@/components/auth/RightPanel'
import AuthFooter from '@/components/auth/AuthFooter'
import MultiselectAuthBgPng from '@/public/images/onboarding/multiselectBg.png'
import { Checkbox, CheckboxField, CheckboxGroup } from '@/components/checkbox'
import { createClient } from '@/lib/supabase/client'
import AuthBgPng from '@/public/images/auth/authBg.png'

const CHECKOUT_SUCCESS_STORAGE_KEY = 'onboarding_checkout_success'
const CHECKOUT_PLAN_POLL_ATTEMPTS = 10
const CHECKOUT_PLAN_POLL_DELAY_MS = 1000

const BLOCKED_BILLING_STATUSES = new Set([
  'canceled',
  'cancelled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
])

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const hasSelectedPlan = (plan?: string | null) => !!plan && plan !== 'none'

const hasActiveSubscription = (profile?: { plan?: string | null; billing_status?: string | null } | null) =>
  hasSelectedPlan(profile?.plan) && !BLOCKED_BILLING_STATUSES.has(profile?.billing_status || 'active')

const options = [
  { id: 1, label: 'Grow my audience', description: 'Content, social posts, newsletters, personal brand' },
  { id: 2, label: 'Find customers', description: 'Leads, sales outreach, email sequences, cold outreach' },
  { id: 3, label: 'Sell digital products', description: 'Courses, ebooks, templates, membership' },
  { id: 4, label: 'Launch or market a product', description: 'Landing pages, ads, launch sequences, positioning' },
  { id: 5, label: 'Build my brand', description: 'Naming, positioning, brand strategy, design direction' },
  { id: 6, label: 'Run my business better', description: 'Standard Operating Procedures (SOPs), hiring, operations, documentation' },
  { id: 7, label: 'Just exploring', description: 'Show me the highlights - I’ll figure it out' },
]
interface Step {
  title: string;
  description: string;
  status: "completed" | "active" | "pending";
}
const initialSteps: Step[] = [
  {
    title: "Step 1",
    description: "Building your workspace",
    status: "pending",
  },
  {
    title: "Step 2",
    description: "Meeting your AI team",
    status: "pending",
  },
  {
    title: "Step 3",
    description: "You're all set. Let's go.",
    status: "pending",
  },
];


export default function MultiselectPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [animatedSteps, setAnimatedSteps] = useState<Step[]>(initialSteps);
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/login?redirect=/onboarding/multiselect')
        return
      }

      const checkoutSucceeded = new URLSearchParams(window.location.search).get('checkout') === 'success'
      const checkoutSuccessGrace =
        checkoutSucceeded || window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY) === 'true'

      if (checkoutSucceeded) {
        window.sessionStorage.setItem(CHECKOUT_SUCCESS_STORAGE_KEY, 'true')
      }

      const loadProfilePlan = async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single()

        return profile?.plan || null
      }

      let selectedPlan = await loadProfilePlan()

      if (!hasSelectedPlan(selectedPlan) && checkoutSuccessGrace) {
        for (let attempt = 0; attempt < CHECKOUT_PLAN_POLL_ATTEMPTS; attempt += 1) {
          await wait(CHECKOUT_PLAN_POLL_DELAY_MS)
          selectedPlan = await loadProfilePlan()
          if (hasSelectedPlan(selectedPlan)) break
        }
      }

      if (!hasSelectedPlan(selectedPlan) && !checkoutSuccessGrace) {
        router.replace('/onboarding/plan')
        return
      }
    })
  }, [router])
  const toggleOption = (label: string) => {
    setSelected(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label].slice(-5)
    )
  }

  const completeOnboarding = async () => {
    try {
      const supabase = createClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return false
      }

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goals: selected,
        }),
      })

      return res.ok
    } catch (error) {
      console.error(error)
      return false
    }
  }

  const handleSaveGoals = async () => {
    setError('')
    setIsSaving(true)
    const success = await completeOnboarding()

    if (!success) {
      setError('Could not finish onboarding. Please try again.')
      setIsSaving(false)
      return
    }

    setAnimatedSteps(initialSteps)
    setIsProcessing(true)
    setIsSaving(false)
  }

  const waitForDashboardEntitlement = useCallback(async () => {
    const checkoutSuccessGrace = window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY) === 'true'

    if (!checkoutSuccessGrace) return false

    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const loadProfileSubscription = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, billing_status')
        .eq('id', user.id)
        .single()

      return profile || null
    }

    let profile = await loadProfileSubscription()

    if (!hasActiveSubscription(profile)) {
      for (let attempt = 0; attempt < CHECKOUT_PLAN_POLL_ATTEMPTS; attempt += 1) {
        await wait(CHECKOUT_PLAN_POLL_DELAY_MS)
        profile = await loadProfileSubscription()
        if (hasActiveSubscription(profile)) break
      }
    }

    return hasActiveSubscription(profile)
  }, [])

  useEffect(() => {
    if (!isProcessing) return;

    let mounted = true;

    const animateSteps = async () => {
      for (let i = 0; i < initialSteps.length; i++) {
        if (!mounted) return;

        setAnimatedSteps(prev =>
          prev.map((step, idx) => ({
            ...step,
            status:
              idx < i
                ? "completed"
                : idx === i
                  ? "active"
                  : "pending",
          }))
        );

        await new Promise(resolve => setTimeout(resolve, 1500));

        setAnimatedSteps(prev =>
          prev.map((step, idx) =>
            idx === i
              ? { ...step, status: "completed" }
              : step
          )
        );

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const checkoutSuccessGrace = window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY) === 'true'
      const entitlementVisible = await waitForDashboardEntitlement()

      if (entitlementVisible) {
        window.sessionStorage.removeItem(CHECKOUT_SUCCESS_STORAGE_KEY)
        router.push("/dashboard");
        return
      }

      router.push(checkoutSuccessGrace ? "/dashboard?checkout=success" : "/dashboard");
    };

    animateSteps();

    return () => {
      mounted = false;
    };
  }, [isProcessing, router, waitForDashboardEntitlement]);

  const completedSteps = animatedSteps.filter(
    step => step.status === "completed"
  ).length;

  const activeStep = animatedSteps.findIndex(
    step => step.status === "active"
  );

  const progress =
    ((completedSteps + (activeStep >= 0 ? 0.5 : 0)) / animatedSteps.length) *
    100;

  return (
    <div className="min-h-screen overflow-auto">
      {
        isProcessing ? (
          <div className="flex flex-1 flex-col h-[calc(100vh-61px)] justify-center items-center px-4">
            <p className="text-zinc-800 font-semibold text-xl text-center md:hidden">
              Setting up your profile and workspace...
            </p>
            <div className="w-full max-w-xs md:hidden my-10">
              <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-in-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="w-[220px]">
              {animatedSteps.map((step, index) => (
                <div key={index} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-700 ease-in-out ${step.status === "completed"
                        ? "bg-blue-500 text-white scale-100"
                        : step.status === "active"
                          ? "bg-blue-500 scale-110 shadow-lg shadow-blue-200"
                          : "border-2 border-zinc-200 bg-white scale-100"
                        }`}
                    >
                      {step.status === "completed" ? (
                        <span className="animate-in zoom-in duration-300">✓</span>
                      ) : step.status === "active" ? (
                        <div className="size-2 rounded-full bg-white animate-ping absolute" />
                      ) : null}

                      {step.status === "active" && (
                        <div className="size-2 rounded-full bg-white" />
                      )}

                      {step.status === "pending" && (
                        <div className="size-2 rounded-full bg-zinc-200" />
                      )}
                    </div>

                    {index !== initialSteps.length - 1 && (
                      <div
                        className={`w-0.5 my-1 h-8 ${step.status === "completed"
                          ? "bg-blue-600"
                          : "bg-zinc-200"
                          }`}
                      />
                    )}
                  </div>
                  <div>
                    <h3
                      className={`text-sm font-semibold transition-colors duration-500 ${step.status === "active"
                        ? "text-[#154FCD]"
                        : "text-zinc-700"
                        }`}
                    >
                      {step.title}
                    </h3>

                    <p
                      className={`text-sm font-normal transition-colors duration-500 ${step.status === "active"
                        ? "text-blue-600"
                        : "text-zinc-600"
                        }`}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-zinc-800 font-semibold text-2xl mt-10 hidden md:flex">
              Setting up your profile and workspace...
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row h-[calc(100vh-106px)] min-[380px]:h-[calc(100vh-86px)] min-[645px]:h-[calc(100vh-63px)] xl:h-[calc(100vh-61px)] overflow-auto xl:overflow-hidden">
            {/* Left column */}
            <div className="flex flex-1 flex-col h-full p-3 sm:p-6 2xl:px-15 2xl:max-w-[50%] pt-5 xl:pt-10 pb-2 bg-white rounded-xl overflow-auto relative">
              <Image src={AuthBgPng} alt="Auth Background" className={`w-full h-full absolute top-0 left-0 z-0 lg:hidden`} width={1000} height={1000} />

              <div className="mx-auto w-full max-w-188 h-full flex flex-col justify-between bg-white max-lg:h-fit relative z-10 max-lg:rounded-md max-lg:py-8 max-lg:px-4">
                <div>
                  <p className="text-neutral-500 font-medium">STEP 4/4</p>
                  <h2 className="text-zinc-800 text-2xl font-semibold my-1">What brings you here?</h2>
                  <p className="text-neutral-500 text-sm">Pick up to 3. We’ll customize your dashboard to match.</p>

                  {/* Checkbox group */}
                  <div className="bg-zinc-100 rounded-xl border border-zinc-200 mt-8 p-4 sm:p-6 space-y-5">
                    <CheckboxGroup className="space-y-3!">
                      <p className='text-neutral-500 text-sm pb-3 flex md:hidden justify-center'>{selected.length || 0} of {options.length} selected</p>
                      {options.map(option => (
                        <CheckboxField key={option.label} className='bg-white p-4 rounded-xl cursor-pointer' onClick={() => toggleOption(option.label)}>
                          <Checkbox
                            className=''
                            color="blue"
                            checked={selected.includes(option.label)}
                            onChange={() => toggleOption(option.label)}
                          />
                          <div data-slot="label" className="text-zinc-700 text-sm font-medium">
                            {option.label}
                          </div>
                          <div data-slot="description" className="text-neutral-500 text-sm">
                            {option.description}
                          </div>
                        </CheckboxField>
                      ))}
                    </CheckboxGroup>
                  </div>

                  {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
                </div>

                <OnboardingStepper
                  currentStep={4}
                  totalSteps={4}
                  buttonText="Save Goal Preferences"
                  onBack={() => router.push('/onboarding')}   
                  onSubmit={handleSaveGoals}
                  loading={isSaving}
                  className='w-45!'
                />
              </div>
            </div>

            {/* Right column */}
            <RightPanel
              signUp={true}
              textContainerClassName="max-w-[500px] top-14"
              bgImg={MultiselectAuthBgPng}
              bgImgClassName='bg-cover!'
              title="Start working in minutes."
              description="Complete these easy steps to put your AI team to work — no onboarding calls or contracts required."
            />
          </div>
        )
      }
      <AuthFooter />
    </div>
  )
}