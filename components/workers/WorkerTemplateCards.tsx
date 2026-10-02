// @ts-nocheck
'use client'

import React, { useState } from 'react'
import { UpgradeModal } from '@/components/upgrade-modal'
import { ArrowRight } from 'lucide-react'

/**
 * WorkerTemplateCards
 *
 * Props:
 *   templates    – array of { id, title, description, prefill }
 *   userPlan     – 'starter' | 'pro' | 'operator' | undefined
 *   onSelect     – (prefill: Record<string, any>) => void
 *   gridCols     – optional override, e.g. 'repeat(4, 1fr)' for Blair's 8-card layout
 *   requiresPro  – if false, templates are free for all plans (no badge, no gate). Default true.
 */
export default function WorkerTemplateCards({ templates, userPlan, onSelect, gridCols, requiresPro = true }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [flashedId, setFlashedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)

  if (!templates || templates.length === 0) return null

  const isActive = !requiresPro || userPlan === 'pro' || userPlan === 'operator'
  const isStarter = !isActive

  const handleCardClick = (template) => {
    if (isStarter) {
      setUpgradeOpen(true)
      return
    }
    // Flash effect on pre-filled fields
    setFlashedId(template.id)
    setTimeout(() => setFlashedId(null), 300)
    onSelect?.(template.prefill, template.id)
    setTimeout(() => {
      const formEl = document.getElementById('worker-form-card')
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const defaultGrid = gridCols || 'repeat(auto-fit, minmax(180px, 1fr))'

  return (
    <>
      <div className="p-4 pb-0">
        <details
          className="border border-zinc-200 rounded-lg overflow-hidden"
          style={{ borderRadius: '8px' }}
          open // Set to false if you want it collapsed by default
        >
          <summary className="cursor-pointer list-none select-none flex items-center justify-between gap-2 px-4 py-3 bg-[#F5F5F5] hover:bg-zinc-100 transition-colors">
            <div className="flex flex-col items-start">
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111113' }}>Skip the blank page</span>
            </div>
            <div className="flex gap-2">
              <p style={{ fontSize: 13, color: '#71717a' }}>
                {templates.length} templates available
              </p>
              <svg
                className="section-chevron w-5 h-5 text-black transition-transform"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </summary>

          <div className="px-4 pt-4 pb-5 border-t border-zinc-200">
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-2.5'>
              {templates.map((t) => {
                const isHovered = hoveredId === t.id
                const isFlashed = flashedId === t.id

                return (
                  <div
                    key={t.id}
                    onClick={() => handleCardClick(t)}
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    title={isStarter ? 'Upgrade to Pro to use templates' : undefined}
                    style={{
                      position: 'relative',
                      textAlign: 'left',
                      border: '0.5px solid',
                      borderColor: isFlashed ? '#2563eb' : '#e4e4e7',
                      borderRadius: 8,
                      background: isHovered
                        ? '#2563EB'
                        : 'linear-gradient(288.34deg, #FFFFFF -2.66%, #E6EEFF 90.19%)',
                      cursor: 'pointer',
                      opacity: isStarter ? 0.45 : 1,
                      filter: isStarter ? 'grayscale(0.4)' : 'none',
                      transition: 'all 0.2s ease-in-out',
                    }}
                    className='hover:border-blue-300'
                  >
                    <div className="p-3">
                      {
                        !isHovered && (
                          <>
                            {requiresPro && (
                              <span style={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                fontSize: 12,
                                fontWeight: 500,
                                color: '#414651',
                                background: 'white',
                                border: '1px solid #D5D7DA',
                                borderRadius: 6,
                                padding: '2px 6px',
                                letterSpacing: '0.04em',
                                lineHeight: 1,
                              }}>
                                PRO+
                              </span>
                            )}
                          </>
                        )
                      }

                      {
                        isHovered && (
                          <div className="flex items-center gap-2 absolute right-4 top-4 text-white text-xs font-medium">
                            <span>Use this</span>
                            <ArrowRight className='size-4' />
                          </div>
                        )
                      }


                      <p className={`text-base font-semibold transition-colors duration-200 max-w-[65%] break-all ${!isHovered ? 'text-blue-600' : 'text-white'}`}>
                        {t.title}
                      </p>
                    </div>
                    <div className="p-1">
                      <div className={`rounded-xl border text-sm transition-all duration-200 bg-white border-zinc-200 text-[#71717A] p-3`}>
                        <div className="max-w-[70%]">
                          {t.description}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </details>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlan="starter"
        requiredTier="pro"
      />
    </>
  )
}