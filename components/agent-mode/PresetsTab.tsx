// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { BoltIcon } from '@heroicons/react/20/solid'
import { Coins, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/badge'
import Image from 'next/image'
import { Skeleton } from '../ui/skeleton'
import { calcChainCostPerRun } from '@/lib/agent-mode/types'

const CATEGORY_DISPLAY = {
  content_creator: 'Content Creator',
  ecommerce: 'Ecommerce',
  agency: 'Agency',
  saas_startup: 'SaaS / Startup',
  recruiting: 'Recruiting',
  local_business: 'Local Business',
  multi_purpose: 'Multi-Purpose',
}

const FILTER_TABS = [
  { id: 'All', label: 'All' },
  { id: 'content_creator', label: 'Content Creator' },
  { id: 'ecommerce', label: 'Ecommerce' },
  { id: 'agency', label: 'Agency' },
  { id: 'saas_startup', label: 'SaaS / Startup' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'local_business', label: 'Local Business' },
  { id: 'multi_purpose', label: 'Multi-Purpose' },
]

const PLAYBOOK_HERO_BASE_URL = 'https://auth.3rdshift.ai/storage/v1/object/public/playbook-assets/category-heroes'

const PLAYBOOK_HERO_IMAGES = {
  content_creator: `${PLAYBOOK_HERO_BASE_URL}/Content_Creator_Playbook.png`,
  agency: `${PLAYBOOK_HERO_BASE_URL}/Agency_Playbook.png`,
  ecommerce: `${PLAYBOOK_HERO_BASE_URL}/Ecommerce_Playbook.png`,
  saas_startup: `${PLAYBOOK_HERO_BASE_URL}/Sales_Playbook.png`,
  recruiting: `${PLAYBOOK_HERO_BASE_URL}/Recruiting_Playbook.png`,
  local_business: `${PLAYBOOK_HERO_BASE_URL}/Local_Business_and_Multi_Purpose_Playbook.png`,
  multi_purpose: `${PLAYBOOK_HERO_BASE_URL}/Local_Business_and_Multi_Purpose_Playbook.png`,
}

function getPresetImageSrc(category: string) {
  return PLAYBOOK_HERO_IMAGES[category] ?? PLAYBOOK_HERO_IMAGES.multi_purpose
}

export default function PresetsTab({ onUsePreset }) {
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')

  useEffect(() => {
    agentFetch('/api/agent-mode/presets')
      .then((r) => r.json())
      .then((data) => {
        setPresets(data.presets ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = category === 'All'
    ? presets
    : presets.filter((p) => p.category === category)

  const onboardingPreset = presets.find((p) => p.is_onboarding_preset)

  if (loading) {
    return (
      <>
        <Skeleton className="h-17.5 w-full" />
        {/* Filter Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="h-[215px] bg-zinc-100 rounded-lg flex items-center justify-center">
                  <div className="size-10 rounded-full bg-zinc-200" />
                </div>
                <div className="px-5 space-y-2">
                  <div className="h-4 w-3/4 bg-zinc-100/80 rounded-md" />
                  <div className="h-3 w-4/6 bg-zinc-100/80 rounded-md" />
                  <div className="h-10 w-full bg-zinc-100/80 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-4 m-5">
                <div className="h-7 w-full bg-zinc-100/80 rounded-md" />
                <div className="h-7 w-full bg-zinc-100/80 rounded-md" />
                <div className="h-7 w-full bg-zinc-100/80 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6">
      {onboardingPreset && category === 'All' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col md:flex-row items-start gap-3 shadow-2xs">
          <BoltIcon className="size-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900 mb-0.5">New to Workflows? Start here</p>
            <p className="text-sm! text-blue-700 leading-normal">This sets up your brand context so every workflow runs better.</p>
          </div>
          <button
            onClick={() => onUsePreset(onboardingPreset)}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer"
          >
            Start Setup →
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <Badge
            color="zinc"
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={`px-4 py-2 rounded-full! text-sm font-medium transition-colors cursor-pointer text-nowrap! ${category === tab.id
              ? 'bg-blue-500! text-white!'
              : 'text-[#181818]! bg-white! hover:bg-zinc-100! border! border-zinc-200!'
              }`}
          >
            {tab.label}
          </Badge>
        ))}
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
        {filtered.map((preset) => {
          const projectedCost = calcChainCostPerRun(preset.workers ?? [])
          const cost = []
          if (projectedCost.heavy > 0) {
            cost.push(`${projectedCost.heavy} heavy credit${projectedCost.heavy > 1 ? 's' : ''}`)
          }
          if (projectedCost.light > 0) {
            cost.push(`${projectedCost.light} light task${projectedCost.light > 1 ? 's' : ''}`)
          }
          const costLabel = cost.join(' + ') || 'Free'
          const imageSrc = getPresetImageSrc(preset.category)

          return (
            <div
              key={preset.id}
              onClick={() => onUsePreset(preset)}
              className="group relative flex flex-col rounded-xl border border-zinc-300 bg-white shadow-xs hover:shadow-md hover:border-zinc-300 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="relative h-53.75 overflow-hidden bg-zinc-100">
                <Image
                  src={imageSrc}
                  alt={`${CATEGORY_DISPLAY[preset.category] ?? preset.category} playbook hero`}
                  fill
                  sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                  priority={false}
                />
                <Badge className='absolute top-3 right-3 bg-zinc-50! border border-zinc-200! rounded-md! h-6!'>{CATEGORY_DISPLAY[preset.category] ?? preset.category}</Badge>
              </div>

              <div className="flex-1 flex flex-col bg-white p-5">
                <div className="flex items-center gap-1 text-xs text-zinc-500 font-normal">
                  <Coins className="size-3.5" />
                  <span>{costLabel} per run</span>
                </div>

                <h4 className="text-sm font-bold text-zinc-950 group-hover:text-blue-600 transition-colors duration-200 mt-2 mb-1">
                  {preset.name}
                </h4>

                <p className="text-sm! text-neutral-500 font-normal leading-4.5">
                  {preset.description}
                </p>

                <div className="overflow-x-auto pt-5 mt-auto">
                  <div className="flex items-center gap-1 w-max">
                    {(preset.workers ?? []).map((w, idx) => {
                      const meta = workerRegistry.find((r) => r.slug === w.worker_id)
                      const persona = meta?.personaName ?? w.worker_id
                      const avatarSrc = `/images/marketing/workers-figma/${persona.toLowerCase()}.png`

                      return (
                        <div key={idx} className="flex items-center gap-1 shrink-0">
                          <div className="flex items-center gap-1 bg-white border border-zinc-300 rounded-md h-7 px-2 shrink-0">
                            <Image
                              src={avatarSrc}
                              alt={persona}
                              width={20}
                              height={20}
                              className="rounded-full object-cover border border-zinc-100 shrink-0"
                            />

                            <span className="text-sm text-zinc-700 whitespace-nowrap">
                              {persona}
                            </span>
                          </div>

                          {idx < preset.workers.length - 1 && (
                            <ArrowRight className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
