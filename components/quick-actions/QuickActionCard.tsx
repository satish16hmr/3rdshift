'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { QuickAction } from '@/lib/quick-actions'
import { QUICK_ACTION_GOAL_COLORS } from '@/lib/quick-actions'
import { getWorkerAvatarSrcBySlug } from '@/lib/worker-avatars'
import { ArrowUpRight } from 'lucide-react'

const QUICK_ACTION_IMAGE_BASE = '/images/quick-actions'

const QUICK_ACTION_IMAGES_BY_SLUG: Record<string, string> = {
  'ad-campaign-strategist': 'quick-ad-creative.png',
  'ad-copywriter': 'quick-copywriter.png',
  'ad-creative-generator': 'quick-ad-creative.png',
  'audience-persona-builder': 'quick-audience.png',
  'automation-blueprint-writer': 'quick-automation.png',
  'brand-strategist': 'quick-position-brand.png',
  'business-plan-writer': 'quick-business-plan.png',
  'case-study-writer': 'quick-case-study-writer.png',
  'competitor-analyst': 'quick-competion.png',
  'content-repurposer': 'quick-content-repurposer.png',
  'content-strategist': 'quick-strategist.png',
  'content-writer': 'quick-content-writer.png',
  'course-outline-builder': 'quick-design-course.png',
  'creative-brief-writer': 'quick-brief-writer.png',
  'customer-support-writer': 'quick-faq.png',
  'data-analyst': 'quick-data-cleaner.png',
  'ecommerce-strategist': 'quick-strategist.png',
  'email-copywriter': 'quick-email-copywriter.png',
  'email-marketing-strategist': 'quick-email-campagin.png',
  'faq-writer': 'quick-faq.png',
  'funnel-strategist': 'quick-funnel.png',
  'hook-specialist': 'quick-optimizer.png',
  'instagram-strategist': 'quick-insta.png',
  'interview-question-writer': 'quick-question.png',
  'job-description-writer': 'quick-description-writer.png',
  'landing-page-copywriter': 'quick-landing-page.png',
  'lead-generator': 'quick-leads.png',
  'legal-document-drafter': 'quick-docs.png',
  'linkedin-ghostwriter': 'quick-linkedin.png',
  'logo-concept-generator': 'quick-concept-generator.png',
  'market-research-analyst': 'quick-strategist.png',
  'meeting-notes-writer': 'quick-meeting.png',
  'newsletter-writer': 'quick-newsletter.png',
  'pitch-deck-writer': 'quick-pitch-deck.png',
  'presentation-builder': 'quick-deck.png',
  'pricing-strategist': 'quick-pricing-strategist.png',
  'product-description-writer': 'quick-product-description.png',
  'product-naming-specialist': 'quick-namin-specialist.png',
  'report-writer': 'quick-docs.png',
  'resume-writer': 'quick-resumes.png',
  'sales-outreach-writer': 'quick-sales-outreach.png',
  'seo-strategist': 'quick-google.png',
  'social-media-graphics-designer': 'quick-media-graphics.png',
  'spreadsheet-builder': 'quick-spreadsheet.png',
  'standard-operating-procedure-writer': 'quick-sop.png',
  'website-builder': 'quick-website-builder.png',
  'x-twitter-ghostwriter': 'quick-twitter.png',
}

const QUICK_ACTION_IMAGES_BY_ACTION: Record<string, string> = {
  'Build a landing page': 'quick-landing-page.png',
  'Build a launch email sequence': 'quick-sequence.png',
  'Design an ad campaign': 'quick-podcast.png',
  'Position my brand': 'quick-position-brand.png',
  'Research my market': 'quick-strategist.png',
  'Write a sales page': 'quick-landingpage-writer.png',
  'Write ad copy': 'quick-copywriter.png',
  'Write an email sequence': 'quick-email-copywriter.png',
}

function quickActionImageSrc(action: QuickAction) {
  const imageName = QUICK_ACTION_IMAGES_BY_ACTION[action.action] ?? QUICK_ACTION_IMAGES_BY_SLUG[action.slug]
  return imageName ? `${QUICK_ACTION_IMAGE_BASE}/${imageName}` : null
}

export function QuickActionCard({ action }: { action: QuickAction }) {
  const src = getWorkerAvatarSrcBySlug(action.slug)
  const actionImageSrc = quickActionImageSrc(action)
  const tagColor = QUICK_ACTION_GOAL_COLORS[action.goal]
  const showTag = action.goal !== 'Just Exploring'

  return (
    <Link
      href={`/dashboard/team/${action.slug}`}
      className="group relative flex min-h-[142px] flex-col gap-3 2xl:gap-0 rounded-xl border border-[#E9EAEB] bg-gradient-to-b from-white to-[#F3F7FF] p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-zinc-950/15 hover:shadow-md"
    >
      
  {actionImageSrc && (
        <Image
          src={actionImageSrc}
          alt=""
          aria-hidden="true"
          width={44}
          height={44}
          className="pointer-events-none absolute bottom-2 right-2 size-10 object-contain opacity-95"
        />
      )}
      <div className="flex 2xl:items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E9EAEB] bg-zinc-50">
          {src ? (
            <Image src={src} alt="" aria-hidden="true" width={40} height={40} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-zinc-500">{action.worker.charAt(0)}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-zinc-800 2xl:max-w-50">{action.action}</span>
          <span className="block truncate text-sm text-neutral-500 2xl:max-w-50">
            <span className="text-neutral-500">{action.worker}</span> · {action.role}
          </span>
        </span>
        </div>
        <span className="shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500">
        <ArrowUpRight className='text-[#71717A] size-6' />
      </span>
      </div>

      {showTag && (
        <span
          className="py-0.5 px-1.75 rounded-md border border-[#D5D7DA] w-fit bg-transparent mt-auto text-zinc-700 text-xs flex items-center gap-1"
        >
          <span className={`rounded-full inline-block size-1.5 shrink-0`} style={{ backgroundColor: tagColor }}></span>
          {action.goal}
        </span>
      )}
    </Link>
  )
}
