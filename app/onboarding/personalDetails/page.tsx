'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthFooter from '@/components/auth/AuthFooter'
import RightPanel from '@/components/auth/RightPanel'
import AvatarUpload from '@/components/AvatarUpload'
import { Input } from '@/components/input'
import OnboardingStepper from '@/components/onboarding/OnboardingStepper'
import { Textarea } from '@/components/textarea'
import { createClient } from '@/lib/supabase/client'
import { personalDetailsSchema } from '@/src/schema/onboarding.schema'
import Image from 'next/image'
import authBgPng from '@/public/images/auth/authBg.png'
import { BILLING_CATALOG } from '@/lib/billing/catalog'

type AccountData = {
    name: string
    avatar_url: string | null
    email?: string
}

const CHECKOUT_SUCCESS_STORAGE_KEY = 'onboarding_checkout_success'
const CHECKOUT_PLAN_POLL_ATTEMPTS = 10
const CHECKOUT_PLAN_POLL_DELAY_MS = 1000

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const hasSelectedPlan = (plan?: string | null) => !!plan && plan !== 'none'

const formatStoredContext = (value?: string | null) => {
    if (!value) return ''

    const trimmed = value.trim()
    if (!trimmed) return ''

    try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
            return parsed.filter(item => typeof item === 'string' && item.trim()).join(', ')
        }
    } catch {
        // Not JSON; fall through to the stored text.
    }

    return trimmed
}

const PersonalDetailsPage = () => {
    const [name, setName] = useState('')
    const [profile, setProfile] = useState({ additional_context: '' })
    const [errors, setErrors] = useState({ name: '' })
    const [data, setData] = useState<AccountData>({
        name: '',
        avatar_url: null,
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [activePlan, setActivePlan] = useState<string | null>(null)
    const router = useRouter()


    useEffect(() => {
        const loadProfile = async () => {
            try {
                const supabase = createClient()

                const { data: { session }, } = await supabase.auth.getSession()

                if (!session) {
                    router.replace('/login?redirect=/onboarding/personalDetails')
                    return
                }

                const {
                    data: { user },
                } = await supabase.auth.getUser()

                if (!user) {
                    router.replace('/login?redirect=/onboarding/personalDetails')
                    return
                }

                const checkoutSucceeded = new URLSearchParams(window.location.search).get('checkout') === 'success'
                if (checkoutSucceeded) {
                    window.sessionStorage.setItem(CHECKOUT_SUCCESS_STORAGE_KEY, 'true')
                }

                const loadProfilePlan = async () => {
                    const { data: profilePlan } = await supabase
                        .from('profiles')
                        .select('plan')
                        .eq('id', user.id)
                        .single()

                    return profilePlan?.plan || null
                }

                let selectedPlan = await loadProfilePlan()

                if (!hasSelectedPlan(selectedPlan) && checkoutSucceeded) {
                    for (let attempt = 0; attempt < CHECKOUT_PLAN_POLL_ATTEMPTS; attempt += 1) {
                        await wait(CHECKOUT_PLAN_POLL_DELAY_MS)
                        selectedPlan = await loadProfilePlan()
                        if (hasSelectedPlan(selectedPlan)) break
                    }
                }

                if (!hasSelectedPlan(selectedPlan) && !checkoutSucceeded) {
                    router.replace('/onboarding/plan')
                    return
                }

                if (hasSelectedPlan(selectedPlan)) {
                    setActivePlan(selectedPlan)
                }

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select(`
                    full_name,
                    brand_context,
                    avatar_url,
                    email
                    `)
                    .eq('id', user.id)
                    .single()

                if (error) {
                    console.error('Profile fetch error:', error)
                    setError('Could not load your profile. Please refresh and try again.')
                    return
                }

                setName(profile?.full_name || '')

                setProfile({
                    additional_context: formatStoredContext(profile?.brand_context),
                })

                setData({
                    name: profile?.full_name || '',
                    email: profile?.email || '',
                    avatar_url: profile?.avatar_url || null,
                })
            } catch (err) {
                console.error('Failed to load profile:', err)
                setError('Could not load your profile. Please refresh and try again.')
            }
        }

        loadProfile()
    }, [router])

    // -----------------------------
    // VALIDATION
    // -----------------------------
    const validateForm = () => {
        const result = personalDetailsSchema.safeParse({ name })

        if (!result.success) {
            const fieldErrors = result.error.flatten().fieldErrors

            setErrors({
                name: fieldErrors.name?.[0] || '',
            })

            return false
        }

        setErrors({ name: '' })
        return true
    }

    // -----------------------------
    // SUBMIT
    // -----------------------------
    const handleSubmit = async () => {
        const supabase = createClient()

        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            router.replace('/login?redirect=/onboarding/personalDetails')
            return
        }

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            router.replace('/login?redirect=/onboarding/personalDetails')
            return
        }

        const isValid = validateForm()
        if (!isValid) return

        setError('')
        setLoading(true) // ✅ start loader

        try {
            const payload = {
                full_name: name,
                brand_context: profile.additional_context?.trim() || null,
            }

            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Profile update failed')
            }

            const checkoutSucceeded = window.sessionStorage.getItem(CHECKOUT_SUCCESS_STORAGE_KEY) === 'true'
            router.push(checkoutSucceeded ? '/onboarding?checkout=success' : '/onboarding')
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.')
        } finally {
            setLoading(false) // ✅ stop loader
        }
    }

    // -----------------------------
    // INITIALS
    // -----------------------------
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

    // -----------------------------
    // UI
    // -----------------------------
    return (
        <div className='min-h-screen overflow-auto'>
            <div className="flex flex-col lg:flex-row h-[calc(100vh-106px)] min-[380px]:h-[calc(100vh-86px)] min-[645px]:h-[calc(100vh-63px)] xl:h-[calc(100vh-61px)] overflow-auto xl:overflow-hidden">
                {/* ── Left column: form ── */}
                <div className="flex flex-1 flex-col md:justify-center p-3 sm:p-6 2xl:px-15 2xl:max-w-[50%] relative pt-5 xl:pt-10 pb-2 bg-white rounded-xl">
                    <Image src={authBgPng} alt="Auth Background" className={`w-full h-full absolute top-0 left-0 z-0 lg:hidden`} width={1000} height={1000} />

                    <div className="mx-auto w-full max-w-190 h-full flex flex-col justify-between bg-white max-lg:h-fit relative z-10 max-lg:rounded-xl max-lg:pt-8 max-lg:px-4">

                        <div>
                            {activePlan && (() => {
                                const plan = BILLING_CATALOG[activePlan as keyof typeof BILLING_CATALOG]
                                return plan ? (
                                    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        <strong>Payment confirmed</strong> — {plan.name} is active: {plan.light_task_limit.toLocaleString()} light tasks/mo, {plan.heavy_credits} heavy credits.
                                    </div>
                                ) : null
                            })()}
                            <p className="text-neutral-500 font-medium">STEP 2/4</p>
                            <h2 className="text-zinc-800 text-2xl font-semibold my-1">
                                Personal details & preferences
                            </h2>
                            <p className="text-neutral-500 text-sm">
                                Your company info, audience, and tone. Every team member uses this as shared context across all chats and tasks.
                            </p>

                            <div className="bg-zinc-100 rounded-xl border border-zinc-200 mt-8 p-4 sm:p-6 space-y-5">

                                <div className="flex items-center gap-5">
                                    <AvatarUpload
                                        initials={initials}
                                        avatarUrl={data.avatar_url}
                                        onUpdate={(url: string | null) =>
                                            setData(prev => ({ ...prev, avatar_url: url }))
                                        }
                                        avatarClassName="size-15.5!"
                                        uploadBtn={false}
                                        variant='uploadModal'
                                    />

                                    <div className="flex-1 w-full">
                                        <label className="text-sm text-zinc-700 font-medium">
                                            Name
                                        </label>

                                        <Input
                                            type="text"
                                            value={name}
                                            error={errors.name}
                                            placeholder="e.g. John"
                                            onChange={(e) => {
                                                setName(e.target.value)

                                                if (errors.name) {
                                                    setErrors(prev => ({
                                                        ...prev,
                                                        name: '',
                                                    }))
                                                }
                                            }}
                                            className="mt-1.5"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-700">
                                        Additional Context
                                    </label>

                                    <Textarea
                                        value={profile.additional_context}
                                        onChange={e =>
                                            setProfile(p => ({
                                                ...p,
                                                additional_context: e.target.value,
                                            }))
                                        }
                                        placeholder="Anything else your team members should always know..."
                                        className="mt-1.5 h-32!"
                                    />
                                </div>

                            </div>
                        </div>

                        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

                        <OnboardingStepper
                            currentStep={2}
                            totalSteps={4}
                            buttonText={loading ? 'Saving...' : 'Save Personal Profile'}
                            onSubmit={handleSubmit}
                            loading={loading}
                            disabled={loading}
                            showBack={false}
                            className='w-43.25!'
                        />

                    </div>
                </div>

                {/* RIGHT */}
                <RightPanel />
            </div>

            <AuthFooter />
        </div>
    )
}

export default PersonalDetailsPage