// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthFooter from '@/components/auth/AuthFooter'
import { Input } from '@/components/input'
import RightPanel from '@/components/auth/RightPanel'
import { Textarea } from '@/components/textarea'
import OnboardingStepper from '@/components/onboarding/OnboardingStepper'
import AvatarUpload from '@/components/AvatarUpload'
import { onboardingStep2Schema } from '@/src/schema/onboarding.schema'
import authBgPng from '@/public/images/auth/authBg.png'
import Image from 'next/image'

const CHECKOUT_SUCCESS_STORAGE_KEY = 'onboarding_checkout_success'
const CHECKOUT_PLAN_POLL_ATTEMPTS = 10
const CHECKOUT_PLAN_POLL_DELAY_MS = 1000

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const hasSelectedPlan = (plan?: string | null) => !!plan && plan !== 'none'

export default function OnboardingPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [goals, setGoals] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [brandTone, setBrandTone] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [finalizingPayment, setFinalizingPayment] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [data, setData] = useState({
    name: '',
    email: '',
    avatar_url: null,
  })

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login?redirect=/onboarding')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login?redirect=/onboarding')
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

      if (!hasSelectedPlan(selectedPlan) && checkoutSuccessGrace) {
        setFinalizingPayment(true)
        window.setTimeout(() => window.location.reload(), CHECKOUT_PLAN_POLL_DELAY_MS)
        return
      }

      if (!hasSelectedPlan(selectedPlan) && !checkoutSuccessGrace) {
        router.replace('/onboarding/plan')
        return
      }

      const name = user.user_metadata?.full_name || user.user_metadata?.name || ''

      setFullName(name)
      setWorkspaceName(name ? `${name.split(' ')[0]}'s Workspace` : 'My Workspace')

      const { data: brand } = await supabase
        .from('brand_profile')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)

      if (membershipError) {
        console.error('Failed to load workspace membership:', membershipError)
      } else if (memberships && memberships.length > 0) {
        setWorkspaceId(memberships[0].workspace_id)
      }

      if (brand) {
        setCompanyName(brand.company_name || '')
        setIndustry(brand.industry || '')
        setTargetAudience(brand.audience || '')
        setCompetitors(brand.competitors || '')
        setBrandTone(brand.tone || '')
        setAdditionalContext(brand.additional_context || '')
      }
    })
  }, [router])

  // -----------------------------
  // FIXED VALIDATION (IMPORTANT)
  // -----------------------------
  const validateStep = () => {
    const result = onboardingStep2Schema.safeParse({
      companyName,
      targetAudience,
      industry,
      competitors: competitors?.trim() ? competitors : undefined,
      brandTone,
      additionalContext,
    })

    if (result.success) {
      setErrors({})
      return true
    }

    const fieldErrors: Record<string, string> = {}

    for (const err of result.error.issues) {
      const key = err.path?.[0]
      if (key && typeof key === 'string') {
        fieldErrors[key] = err.message
      }
    }

    setErrors(fieldErrors)
    setError('Please fix the highlighted fields')
    return false
  }

  const completeOnboarding = async () => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login?redirect=/onboarding')
        return
      }

      const isValid = validateStep()
      if (!isValid) {
        setLoading(false)
        return
      }

      if (!fullName.trim()) {
        setError('Name is required.')
        setLoading(false)
        return
      }

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      }

      let resolvedWorkspaceId = workspaceId
      const workspaceDisplayName = companyName.trim() || `${fullName.split(' ')[0]}'s Workspace`

      if (!resolvedWorkspaceId) {
        const workspaceRes = await fetch('/api/workspace/create', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: workspaceDisplayName,
          }),
        })

        const workspaceData = await workspaceRes.json()

        if (!workspaceRes.ok) {
          setError(workspaceData?.message || workspaceData?.error || 'Failed to create workspace')
          setLoading(false)
          return
        }

        resolvedWorkspaceId = workspaceData.workspace_id
        setWorkspaceId(resolvedWorkspaceId)
      }

      const brandRes = await fetch('/api/brand-profile', {
        method: 'PUT',
        headers: {
          ...headers,
          'x-workspace-id': resolvedWorkspaceId,
        },
        body: JSON.stringify({
          company_name: companyName,
          industry,
          audience: targetAudience,
          tone: brandTone,
          competitors,
          additional_context: additionalContext,
        }),
      })

      if (!brandRes.ok) {
        const data = await brandRes.json().catch(() => ({}))
        setError(data?.error || 'Failed to save brand profile')
        setLoading(false)
        return
      }

      // 3️⃣ COMPLETE ONBOARDING
      // const res = await fetch('/api/onboarding/complete', {
      //   method: 'POST',
      //   headers,
      //   body: JSON.stringify({
      //     full_name: fullName,
      //     workspace_name: workspaceName,
      //     goals,
      //     company_name: companyName,
      //     target_audience: targetAudience,
      //     industry,
      //     competitors,
      //     brand_tone: brandTone,
      //     additional_context: additionalContext,
      //   }),
      // })

      // if (!res.ok) {
      //   const data = await res.json().catch(() => ({}))

      //   if (data.error === 'subscription_required') {
      //     router.replace('/onboarding/plan')
      //     return
      //   }

      //   setError('Could not finish onboarding. Please try again.')
      //   setLoading(false)
      //   return
      // }

      const checkoutSucceeded = window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY) === 'true'
      router.replace(checkoutSucceeded ? '/onboarding/multiselect?checkout=success' : '/onboarding/multiselect')
    } catch (err) {
      console.log(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      key: 'targetAudience',
      label: 'Target Audience',
      value: targetAudience,
      setter: setTargetAudience,
      placeholder: 'e.g. Small business owners, CTOs at Series A startups',
    },
    {
      key: 'industry',
      label: 'Industry',
      value: industry,
      setter: setIndustry,
      placeholder: 'e.g. SaaS, E-Commerce, Healthcare',
    },
    {
      key: 'competitors',
      label: 'Competitors',
      value: competitors,
      setter: setCompetitors,
      placeholder: 'e.g. HubSpot, Salesforce',
    },
    {
      key: 'brandTone',
      label: 'Brand Tone',
      value: brandTone,
      setter: setBrandTone,
      placeholder: 'e.g. Professional but conversational, no jargon',
    },
  ]

  const initials = data.name
    ? (() => {
      const parts = data.name.trim().split(' ').filter(Boolean)
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : data.name.slice(0, 2).toUpperCase()
    })()
    : data.email
      ? data.email.slice(0, 2).toUpperCase()
      : '??'

  if (finalizingPayment) {
    return (
      <div className="min-h-screen overflow-auto">
        <div className="flex min-h-[calc(100vh-61px)] items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-zinc-950">Finalizing your payment…</h1>
            <p className="mt-3 text-sm text-zinc-500">Stripe confirmed checkout. We’re activating your workspace now, and this page will refresh automatically.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-auto">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] min-[380px]:h-[calc(100vh-80px)] min-[635px]:h-full xl:h-[calc(100vh-61px)] overflow-auto xl:overflow-hidden">
        {/* ── Left column: form ── */}
        <div className="flex flex-1 flex-col justify-center p-3 md:p-6 2xl:px-15 2xl:max-w-[50%] pt-5 xl:pt-10 pb-2 relative rounded-xl">
          <Image src={authBgPng} alt="Auth Background" className={`w-full h-full absolute top-0 left-0 z-0 lg:hidden`} width={1000} height={1000} />

          <div className="mx-auto w-full max-w-190 bg-white max-lg:h-fit relative z-10 max-lg:rounded-md max-lg:py-8 max-lg:px-4 overflow-auto">

            <p className="text-neutral-500 font-medium">STEP 3/4</p>

            <h2 className="text-zinc-800 text-2xl font-semibold my-1">
              Setup workspace
            </h2>

            <p className="text-neutral-500 text-sm">
              Your company info, audience, and tone. Every team member uses this as shared context across all chats and tasks.
            </p>

            <div className="bg-zinc-100 rounded-xl border border-zinc-200 mt-8 p-4 sm:p-6 space-y-5">

              <div className="flex items-center gap-5">
                <AvatarUpload
                  initials={initials}
                  avatarUrl={data.avatar_url}
                  onUpdate={(url) =>
                    setData((prev) => ({ ...prev, avatar_url: url }))
                  }
                  avatarClassName="size-15.5!"
                  uploadBtn={false}
                  variant="uploadModal"
                />

                <div className="flex-1 w-full">
                  <label className="text-sm text-zinc-700 font-medium">
                    Company Name
                  </label>

                  <Input
                    type="text"
                    value={companyName}
                    placeholder="e.g. Acme Group"
                    onChange={(e) => {
                      setCompanyName(e.target.value)
                      setErrors((p) => ({ ...p, companyName: '' }))
                    }}
                    className="mt-1.5"
                  />

                  {errors.companyName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.companyName}
                    </p>
                  )}
                </div>
              </div>

              {fields.map((field) => (
                <div key={field.key}>
                  <label className="text-sm text-zinc-700 font-medium">
                    {field.label}
                  </label>

                  <Input
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(e) => {
                      field.setter(e.target.value)
                      setErrors((p) => ({ ...p, [field.key]: '' }))
                    }}
                    className="mt-1.5"
                  />

                  {errors[field.key] && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors[field.key]}
                    </p>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Additional Context
                </label>

                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="mt-1.5 h-32!"
                />

                {errors.additionalContext && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.additionalContext}
                  </p>
                )}
              </div>
            </div>

            <OnboardingStepper
              currentStep={3}
              totalSteps={4}
              buttonText="Save Personal Profile"
              loading={loading}
              onSubmit={completeOnboarding}
              onBack={() => router.push('/onboarding/personalDetails')}
              className='w-45!'
            />
          </div>
        </div>

        <RightPanel />
      </div>

      <AuthFooter />
    </div>
  )
}