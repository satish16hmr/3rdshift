'use client'

import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

type Plan = 'free' | 'starter' | 'pro' | 'operator'

type TeamUpdateSettings = {
  enabled: boolean
  frequency: 'once_weekly' | 'few_times_weekly'
  worker_overrides: Record<string, boolean>
  ava_enabled: boolean
}

type TeamUpdateFrequency = TeamUpdateSettings['frequency']

// ---------------------------------------------------------------------------
// System 1 workers only — Ava (content-writer) is System 2 (team lead)
// and is NOT listed here
// ---------------------------------------------------------------------------
const PROACTIVE_WORKERS_META: Array<{
  slug: string
  name: string
  role: string
  emoji: string
  minPlan: Plan
  image: string
}> = [
    { slug: 'hook-specialist', name: 'Sam', image: "/images/team-update/team-member1.png", role: 'Hook Specialist', emoji: ':hook:', minPlan: 'starter' },
    { slug: 'email-copywriter', name: 'Mira', image: "/images/team-update/team-member2.png", role: 'Email Copywriter', emoji: ':e-mail:', minPlan: 'starter' },
    { slug: 'ad-copywriter', name: 'Tate', image: "/images/team-update/team-member3.png", role: 'Ad Copywriter', emoji: ':mega:', minPlan: 'starter' },
    { slug: 'seo-strategist', name: 'Kai', image: "/images/team-update/team-member4.png", role: 'SEO Strategist', emoji: ':mag:', minPlan: 'pro' },
    { slug: 'social-media-creator', name: 'Ash', image: "/images/team-update/team-member5.png", role: 'Short-Form Video Script Writer', emoji: ':clapper:', minPlan: 'pro' },
    { slug: 'lead-generator', name: 'Lenny', image: "/images/team-update/team-member6.png", role: 'Lead Generator', emoji: ':dart:', minPlan: 'operator' },
  ]

const PLAN_ORDER: Plan[] = ['starter', 'pro', 'operator']

function ToggleSkeleton() {
  return <Skeleton className="h-5 w-9 shrink-0 rounded-full bg-zinc-100" />
}

function TeamUpdatesSkeleton() {
  return (
    <section className="space-y-3 sm:space-y-4 lg:space-y-5 max-w-[996px]" aria-busy="true">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Account Information</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Your personal account information and login credentials.
        </Text>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 bg-zinc-100" />
            <Skeleton className="h-4 w-64 max-w-[60vw] bg-zinc-100" />
          </div>
          <ToggleSkeleton />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 bg-zinc-100" />
            <Skeleton className="h-4 w-64 max-w-[60vw] bg-zinc-100" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28 rounded-lg bg-zinc-100" />
            <Skeleton className="h-9 w-40 rounded-lg bg-zinc-100" />
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6">
          <Skeleton className="mb-3 h-4 w-36 bg-zinc-100" />
          <div className="space-y-3">
            {PROACTIVE_WORKERS_META.map(worker => (
              <div key={worker.slug} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-10 shrink-0 rounded-full bg-zinc-100" />
                  <Skeleton className="h-4 w-16 bg-zinc-100" />
                </div>
                <ToggleSkeleton />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-100 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48 bg-zinc-100" />
              <Skeleton className="h-4 w-96 max-w-[60vw] bg-zinc-100" />
            </div>
            <ToggleSkeleton />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-1">
        <Skeleton className="h-9 w-36 rounded-lg bg-zinc-100" />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Team Updates Page
// ---------------------------------------------------------------------------
export default function TeamUpdatesSettings() {
  const [session, setSession] = useState<Session | null>(null)
  const [plan, setPlan] = useState<Plan>('starter')
  const [settings, setSettings] = useState<TeamUpdateSettings>({
    enabled: true,
    frequency: 'few_times_weekly',
    worker_overrides: {},
    ava_enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { setLoading(false); return }
      setSession(s)
      const { data: prof } = await supabase
        .from('profiles')
        .select('plan, team_updates_settings')
        .eq('id', s.user.id)
        .single()
      if (prof) {
        setPlan((prof.plan as Plan | null) || 'starter')
        if (prof.team_updates_settings) {
          setSettings(prev => ({ ...prev, ...(prof.team_updates_settings as Partial<TeamUpdateSettings>) }))
        }
      }
      setLoading(false)
    })
  }, [])

  const planIdx = PLAN_ORDER.indexOf(plan)

  const availableWorkers = PROACTIVE_WORKERS_META.filter(
    w => PLAN_ORDER.indexOf(w.minPlan) <= planIdx
  )

  const handleToggle = <K extends keyof TeamUpdateSettings>(key: K, value: TeamUpdateSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleWorkerToggle = (slug: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      worker_overrides: { ...prev.worker_overrides, [slug]: value },
    }))
  }

  const handleSave = async () => {
    if (!session) return
    setSaving(true)
    const supabase = createClient()
    const { data: { session: sess } } = await supabase.auth.getSession()
    if (sess) {
      await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sess.access_token}`,
        },
        body: JSON.stringify({ team_updates_settings: settings }),
      })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return <TeamUpdatesSkeleton />
  }

  return (
    <section className="space-y-3 sm:space-y-4 lg:space-y-5 max-w-[996px]">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Account Information</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Your personal account information and login credentials.
        </Text>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">

        {/* Master toggle */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-200">
          <div className='max-w-[80%]'>
            <p className="text-sm font-medium text-zinc-800">Proactive Updates</p>
            <p className="text-sm text-neutral-500">Team members check in with ideas and alerts</p>
          </div>
          <button
            onClick={() => handleToggle('enabled', !settings.enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${settings.enabled ? 'bg-blue-600' : 'bg-zinc-200'
              }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${settings.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
            />
          </button>
        </div>

        {settings.enabled && (
          <>
            {/* Frequency */}
            <div className='px-4 sm:px-6 py-4 border-b border-zinc-200 flex flex-wrap justify-between gap-3'>
              <div className='max-w-[80%]'>
                <p className="text-sm font-medium text-zinc-800">Frequency</p>
                <p className="text-sm text-neutral-500">Team member check in with ideas and alerts</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'once_weekly', label: 'Once a week' },
                  { value: 'few_times_weekly', label: 'A few times a week' },
                ] satisfies Array<{ value: TeamUpdateFrequency; label: string }>).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleToggle('frequency', opt.value)}
                    className={`rounded-lg border h-9 px-3.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer! ${settings.frequency === opt.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Worker toggles */}
            <div className='px-4 sm:px-6 py-4'>
              <p className="text-sm font-medium text-zinc-800 mb-3">Active team members</p>
              <div className="space-y-3">
                {availableWorkers.map(w => {
                  const isOn = settings.worker_overrides[w.slug] !== false
                  return (
                    <div key={w.slug} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* <span className="text-lg">{w.emoji}</span> */}
                        <Image src={w.image} width={40} height={40} alt='team-member' className="rounded-full" />
                        <span className="text-sm text-zinc-800 font-medium">{w.name}</span>
                        {/* <span className="text-xs text-zinc-400">· {w.role}</span> */}
                      </div>
                      <button
                        onClick={() => handleWorkerToggle(w.slug, !isOn)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${isOn ? 'bg-blue-600' : 'bg-zinc-200'
                          }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${isOn ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`}
                        />
                      </button>
                    </div>
                  )
                })}

                {planIdx < 1 && (
                  <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-500">
                      <span className="font-medium text-blue-600">Upgrade to Pro</span> to hear from more of your team — Kai (SEO), Ash (Social), and more.
                    </p>
                  </div>
                )}
                {planIdx < 2 && (
                  <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                    <p className="text-xs text-zinc-500">
                      <span className="font-medium text-blue-600">Upgrade to Operator</span> to unlock Lenny&apos;s weekly lead match alerts.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Ava team lead toggle */}
        <div className="border-t border-zinc-100 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className='max-w-[80%]'>
              <p className="text-sm font-medium text-zinc-800 mb-3k">Team milestones &amp; check-ins</p>
              <p className="text-sm text-neutral-500">
                Ava sends milestone celebrations, consistency encouragement, and re-engagement messages
              </p>
            </div>
            <button
              onClick={() =>
                setSettings(prev => ({
                  ...prev,
                  ava_enabled: !(prev.ava_enabled !== false),
                }))
              }
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${settings.ava_enabled !== false ? 'bg-blue-600' : 'bg-zinc-200'
                }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${settings.ava_enabled !== false ? 'translate-x-4.5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
        </div>

        {/* Save */}
      </div>
      <div className="pt-1 flex justify-end items-center">
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="primary"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save preferences'}
        </Button>
      </div>
    </section>
  )
}