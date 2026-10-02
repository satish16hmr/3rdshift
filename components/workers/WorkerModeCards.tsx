// @ts-nocheck
'use client'

import { Coins } from 'lucide-react'
import React from 'react'

/**
 * WorkerModeCards
 *
 * Reusable mode/page-type card picker. Renders identically to ModeSelectionCards (Charlie pattern)
 * but accepts an explicit modes array instead of reading from worker.modeCredits.
 *
 * Use for free-tier workers like Heath and Quinn where all modes are light/free.
 * For credit-gated workers (Charlie), use the existing ModeSelectionCards component.
 *
 * Props:
 *   header        – H2 heading text
 *   subtitle      – subheading text
 *   modes         – array of mode definition objects (see shape below)
 *   selectedId    – currently highlighted mode id (default: first mode)
 *   userPlan      – 'starter' | 'pro' | 'operator' | undefined
 *   onModeSelect  – (modeId: string) => void — called when user clicks a card
 *
 * Mode definition shape:
 *   {
 *     id: string,          // form field value
 *     icon: string,        // emoji
 *     title: string,
 *     spec: string,        // e.g. "Full episode package / SEO-ready"
 *     useCase: string,     // business value sentence shown in callout box
 *     badge: 'free' | 'pro' | 'operator',
 *     credits: number | null,
 *     tierLine: string,    // e.g. "Free · All plans"
 *   }
 */
const PLAN_LEVEL = { none: 0, starter: 1, pro: 2, operator: 3 }

export default function WorkerModeCards({ header, subtitle, modes, selectedId, userPlan, onModeSelect }) {
  if (!modes || modes.length === 0) return null

  const userLevel = PLAN_LEVEL[userPlan] ?? 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111113', margin: '0 0 6px' }}>
          {header}
        </h2>
        <p style={{ fontSize: 14, color: '#71717a', margin: 0 }}>
          {subtitle}
        </p>
      </div>

      {/* Card grid — 3-col desktop, 2-col tablet, 1-col mobile */}
      <div className='gap-y-4 gap-x-3.5' style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      }}>
        {modes.map(mode => {
          const isFree = mode.badge === 'free'
          const isPro = mode.badge === 'pro'
          const isSelected = mode.id === selectedId
          const requiredLevel = mode.badge === 'operator' ? PLAN_LEVEL.operator : mode.badge === 'pro' ? PLAN_LEVEL.pro : PLAN_LEVEL.starter
          const isLocked = !isFree && userLevel < requiredLevel

          // Badge styling
          const badgeStyle = isFree
            ? { color: '#16a34a', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }
            : isPro
              ? { color: '#2563eb', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)' }
              : { color: '#7c3aed', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }

          const badgeLabel = isFree ? 'Free' : isPro ? 'PRO+' : 'OPERATOR'

          return (
            <div key={mode.id}
              onClick={() => {
                if (!isLocked) onModeSelect(mode.id)
              }}
              aria-pressed={isSelected}
              className={`bg-[#F5F5F5] border rounded-xl transition duration-200 group ${isLocked ? 'border-zinc-200 cursor-default opacity-85' : 'cursor-pointer hover:border-blue-500'} ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50' : 'border-zinc-200'}`}>
              <button
                type="button"
                aria-pressed={isSelected}
                className={`
    relative rounded-2xl group border-b overflow-hidden cursor-pointer transition-all text-left px-4 py-5 w-full ${isSelected ? 'border-blue-200 bg-blue-50' : 'border-zinc-200 bg-white'}`}
              >

                {/* Icon */}
                <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-zinc-200 text-xl">
                  {mode.icon}
                </div>

                {/* Title */}
                <p className="text-base font-medium text-blue-500 mb-1" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {mode.title}
                </p>

                {/* Spec */}
                <p className="text-sm text-[#09090B] line-clamp-2 h-10">
                  {mode.spec}  {/* Temporarily show raw content */}
                </p>

                <div className="pt-3 mt-3 border-t border-zinc-200 text-sm text-[#71717A] line-clamp-2 h-[53px]">
                  💡 {mode.useCase}
                </div>
                {/* CTA */}
                {/* <div
                className={`inline-flex items-center gap-1 text-[13px] font-semibold ${isLocked ? 'text-gray-400' : 'text-blue-600'
                  }`}
              >
                {isLocked
                  ? mode.badge === 'operator'
                    ? 'Upgrade to Operator →'
                    : 'Upgrade to Pro →'
                  : 'Start building →'}
              </div> */}
              </button>
              <div className='flex justify-between items-center px-4 py-2 gap-6'>
                <span
                  className="rounded-md border border-[#D5D7DA] py-0.5 px-1.5 text-xs font-medium text-[#414651] bg-white shrink-0"
                >
                  {badgeLabel}
                </span>
                <div className="flex items-start justify-end gap-1.5 min-w-0">
                  <Coins className="size-3.5 text-[#71717A] shrink-0 mt-0.5" />
                  <span className="text-sm text-[#71717A] break-all line-clamp-2">
                    {mode.tierLine}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div >
  )
}
