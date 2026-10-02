// @ts-nocheck
'use client'

import { Coins } from 'lucide-react'
import React from 'react'

/**
 * ModeSelectionCards
 *
 * Renders mode cards for workers with modeCredits (Charlie pattern).
 * Shows ROI math per mode, tier-aware CTAs.
 *
 * Props:
 *   worker         – registry entry (has modeCredits map)
 *   userPlan       – 'starter' | 'pro' | 'operator'
 *   heavyCredits   – number of heavy credits remaining
 *   planLoading    – bool
 *   onSelectMode   – (modeValue: string) => void — called when user can access the mode
 *   onUpgradeMode  – (modeValue: string) => void — called when Starter clicks heavy mode
 */

const MODE_META = {
  mini_course: {
    emoji: '🎯',
    label: 'Mini-course / Lead magnet',
    duration: '1–3 hours of content',
    price: 'Free or $27–$47',
    roiStarter: 'Sell to one customer at $47 — you\'ve paid for Starter for 2 months.',
    roPro: 'Perfect lead magnet to grow your list.',
    creditLabel: 'Free · All plans',
    isFree: true,
  },
  workshop: {
    emoji: '🎓',
    label: 'Workshop',
    duration: '60–90 minute single session',
    price: '$27–$97 or free (live)',
    roiStarter: '10 attendees at $47 = $470. Starter paid for the year.',
    roPro: 'Run live or package as evergreen.',
    creditLabel: 'Free · All plans',
    isFree: true,
  },
  signature: {
    emoji: '🚀',
    label: 'Signature course',
    duration: '4–8 hours of content · Your flagship product',
    price: '$197–$997',
    roiStarter: 'ONE sale at $297 = your Pro subscription paid for a full year.',
    roPro: 'Your flagship offer.',
    creditLabel: '2 credits · Pro or Operator',
    isFree: false,
    upgradeTarget: 'Pro',
    upgradeSource: 'charlie-signature',
  },
  premium: {
    emoji: '💎',
    label: 'Premium transformation / Cohort',
    duration: '10+ hours of content + live elements',
    price: '$1,000–$5,000',
    roiStarter: 'ONE cohort sale at $1,997 = Operator subscription paid for over 2 years.',
    roPro: 'Premium positioning with live support.',
    creditLabel: '2 credits · Pro or Operator',
    isFree: false,
    upgradeTarget: 'Pro',
    upgradeSource: 'charlie-premium',
  },
  certification: {
    emoji: '🎖️',
    label: 'Certification / Credential prep',
    duration: 'Varies · Exam preparation',
    price: '$97–$997',
    roiStarter: 'ONE sale at $297 = your Pro subscription paid for a full year.',
    roPro: 'Helps students pass exams or earn credentials.',
    creditLabel: '2 credits · Pro or Operator',
    isFree: false,
    upgradeTarget: 'Pro',
    upgradeSource: 'charlie-certification',
  },
}

export default function ModeSelectionCards({ worker, userPlan, heavyCredits, planLoading, onSelectMode, onUpgradeMode }) {
  if (!worker?.modeCredits) return null

  const isStarter = !planLoading && (userPlan === 'starter' || userPlan === 'none' || !userPlan)
  const isPro = !planLoading && (userPlan === 'pro' || userPlan === 'operator')

  const modes = Object.keys(worker.modeCredits)

  return (
    <div className="mb-2">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#111113] mb-1.5">
          What do you want to build?
        </h2>
        <p className="text-sm text-[#71717a]">
          Charlie builds complete course packages. Pick the format that fits your goal.
        </p>
      </div>

      {/* Card grid */}
      <div className="grid gap-y-4 gap-x-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {modes.map(modeKey => {
          const meta = MODE_META[modeKey]
          if (!meta) return null

          const isFree = meta.isFree
          const canUse = isFree || isPro
          const creditsForMode = worker.modeCredits[modeKey]

          const badgeLabel = isFree ? 'Free' : 'PRO+'

          const tierLine = isFree
            ? 'Free'
            : isPro && heavyCredits !== null
              ? `${creditsForMode} credits`
              : `${creditsForMode} credits`

          return (
            <div
              key={modeKey}
              onClick={() => canUse ? onSelectMode(modeKey) : onUpgradeMode(modeKey)}
              className={`bg-[#F5F5F5] border border-zinc-200 rounded-xl hover:border-blue-500 transition duration-200 group cursor-pointer ${!canUse && 'opacity-85'}`}
            >
              {/* Top card content */}
              <div className="relative rounded-t-xl border-b border-zinc-200 overflow-hidden text-left px-4 py-5 bg-white rounded-xl">

                {/* Emoji icon */}
                <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-zinc-200 text-xl">
                  {meta.emoji}
                </div>

                {/* Label */}
                <p
                  className="text-base font-medium text-blue-500 mb-1 overflow-hidden text-ellipsis"
                  style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}
                >
                  {meta.label}
                </p>

                {/* Duration + price */}
                <p className="text-sm text-[#09090B] line-clamp-2 h-10">
                  {meta.duration} · {meta.price}
                </p>

                {/* ROI insight */}
                <div className="pt-3 mt-3 border-t border-zinc-200 text-sm text-[#71717A] line-clamp-2 h-[53px]">
                  💡 {isStarter ? meta.roiStarter : meta.roPro}
                </div>
              </div>

              {/* Bottom bar: badge + credits */}
              <div className="flex justify-between items-center px-4 py-2 gap-2">
                <span className="rounded-md border border-[#D5D7DA] py-0.5 px-1.5 text-xs font-medium text-[#414651] bg-white shrink-0">
                  {badgeLabel}
                </span>
                <div className="flex items-start justify-end gap-1.5 min-w-0">
                  <Coins className="size-3.5 text-[#71717A] shrink-0 mt-0.5" />
                  <span className="text-sm text-[#71717A] text-right break-words">{tierLine}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}