'use client';

import { useMemo, useRef, useState } from 'react';
import { Search, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { Pagination } from '@/components/pagination';
import { FaqSection } from '../_components/FaqSection';
import { workers as WORKER_REGISTRY, type WorkerConfig } from '@/lib/workers/registry';
import { Button } from '@/components/ui/button';

const ASSET_BASE = '/images/marketing/workers-figma';
const WORKER_COUNT = '70+';
const ALL_CATEGORY = 'All';

const featuredSlugs = ['content-writer', 'lead-generator', 'competitor-analyst'];
const CARD_AVATAR_SIZE = 64;

const figmaWorkerDescriptions: Record<string, string> = {
  Alice: 'Builds your full marketing funnel from first click to paying customer.',
  Ash: 'Writes scroll-stopping scripts for TikTok, Reels, and Shorts with 19 hook frameworks.',
  Ava: 'Gives you a finished, publish-ready articles on any topic in 60 seconds.',
  Beck: 'Your full career toolkit — resumes, cover letters, job search strategy, salary negotiation.',
  Bella: 'Creates a clean financial summary from messy transactions you can actually use.',
  Blair: 'Builds a compelling investor pitch deck. Structured, persuasive, ready to present.',
  Bree: 'Turns your idea into a clear creative brief — objectives, audience, tone, and deliverables.',
  Brody: 'Builds the Key Performance Indicators (KPIs) framework and dashboard your team actually needs.',
  Cade: 'Takes your messy spreadsheet and returns it clean, standardized, and sorted.',
  Cara: 'Writes support replies, FAQ articles, help docs, and refund templates. Ready to paste and use.',
  Case: 'Ghostwrites tweets, threads, and reply strategies that actually get engagement.',
  Clay: 'Turns your text into studio-quality voiceovers. Paste a script, get a professional MP3 back.',
  Charlie: 'Builds complete course packages — modules, lessons, quizzes, sales page, and more.',
  Cruz: 'Builds a pricing strategy based on your market, costs, and competitors.',
  Dale: 'Interview questions, compensation strategy, and interview process design.',
  Darcy: 'Creates short video ads for Meta, TikTok, and YouTube.',
  Dex: 'Writes product descriptions that convert. Platform-tuned for Shopify, Amazon, Etsy, etc.',
  Dina: 'Turns meeting recordings into structured notes with action items and speaker labels.',
  Duncan: 'Delivers a full market research report on any industry or niche.',
  Elliot: 'Ghostwrites LinkedIn posts that sound exactly like you.',
  Ellis: 'Maps out your full email strategy and automation sequence.',
  Ember: 'Removes backgrounds, objects, and watermarks. Upscales and color corrects.',
  Emma: 'Audits your e-commerce store and delivers a clear optimization plan.',
  Eve: 'Writes job descriptions that attract qualified, diverse candidates. Optimized, ready to post.',
  Flynn: 'Writes Standard Operating Procedures (SOPs) teams actually follow. Step-by-step procedures your team can use.',
  Gus: 'Creates scroll-stopping social graphics for posts, stories, and ads.',
  Heath: 'Handles the full podcast lifecycle — show notes, audiogram scripts, and guest pitches.',
  Holly: 'Takes one piece of content and turns it into posts for every platform.',
  Iris: 'Writes polished business reports — quarterly reviews, status updates, and strategy memos.',
  Ivy: 'Writes training materials your team actually learns from. Quick references or full programs.',
  Jett: 'Spots emerging trends in your industry and tells you what to do about them.',
  Joe: 'Digs through the web and delivers clean, organized research on any topic. Source-cited.',
  Joss: 'Generates custom b-roll video clips from a text description. No camera needed.',
  Jude: 'Drafts NDAs, contracts, and policies ready for legal review.',
  Jules: 'Writes scripts for YouTube, podcasts, explainers, and ads. Production notes included.',
  Kai: 'SEO briefs for the AI Overview era. Keyword research, topic clusters, and competitor gaps.',
  Knox: 'Screens your applicant pool and ranks candidates by fit.',
  Koa: 'Generates custom sound effects — UI chimes, ambient loops, foley, and cinematic impacts.',
  Lane: 'Builds full content strategies with editorial calendars and channel plans tailored to you.',
  Lena: 'Writes the buttons, tooltips, and onboarding flows that make your product feel right.',
  Lenny: 'Delivers a list of qualified leads with verified emails and contact info. Ready to outreach.',
  Lyra: 'Builds a keyword-driven Pinterest strategy that turns pins into traffic.',
  Mack: 'Builds a complete presentation with slides, structure, and speaker notes.',
  Marlo: 'Writes a complete business plan - financials, market analysis, strategy, all of it.',
  Mira: 'Writes marketing emails and drip sequences that actually get opened.',
  Naru: 'Writes whitepapers and press releases. Research-backed, citation-ready.',
  Nash: 'Audits your website for speed, SEO, and mobile issues with prioritized fixes.',
  Nico: 'Translates your content across 90+ languages. Fast and natural.',
  Nora: 'Builds detailed audience personas — pain points, buying triggers, and messaging angles.',
  Opal: 'Converts any text into natural-sounding audio. Pick a voice, get an MP3.',
  Oscar: 'Writes newsletters that sound like you, not a brand. Four styles, ready for any platform.',
  Paul: 'Turns your product photo into a cinematic video clip. Up to 10 seconds, any aspect ratio.',
  Penn: 'Builds the full blueprint for your ebook — chapters, marketing copy, and launch plan.',
  Pete: 'Turns your hourly service work into a sellable product with fixed pricing and clear scope.',
  Peyton: 'Produces Instagram content calendars, carousels, story sequences, and profile audits.',
  Piper: 'Develops your full brand strategy — positioning, messaging, and identity.',
  Quinn: 'Writes landing pages that convert — hero, benefits, objections, social proof, and calls to action.',
  Reed: 'Designs eye-catching YouTube thumbnails that get clicks.',
  Remy: 'Takes your rough drafts and messy notes and turns them into polished, structured content.',
  Ren: 'Builds a community engagement playbook your team can use and platform specific.',
  Rio: 'Matches the style and mood of any video you reference. Upload a clip, describe your scene.',
  Sage: "Writes compelling grant applications tailored to the funder's priorities.",
  Sam: 'Writes scroll-stopping hooks for any platform — video, email, ads, articles.',
  Shay: 'Generates original logo concepts based on your brand and vision.',
  Sienna: 'Builds custom spreadsheets with formulas, formatting, and structure — ready to use.',
  Silas: 'Builds single-page websites that convert — landing pages, coming soon, and lead capture.',
  Sully: 'Generates product and brand names — 25 options with domain and trademark checklist.',
  Tala: "Dubs your audio or video into 30+ languages. Preserves the original speakers' voices.",
  Tate: 'Writes ad copy for Meta, Google, LinkedIn, and TikTok — ready to launch.',
  Tess: 'Analyzes your data and surfaces the insights that actually matter.',
  Thea: 'Writes case studies that convert — real numbers, customer voice, clear results.',
  Trey: 'Plans your full ad campaign — targeting, budget, creative, and messaging.',
  Vera: 'Writes proposals that win business. Scope, deliverables, pricing — ready to send.',
  Vince: 'Designs membership sites from scratch: tiers, content calendar, retention strategy, and more.',
  Wes: 'Designs automation workflows for Zapier, Make, and n8n — step by step.',
  Wilma: 'Writes cold outreach emails that sound personal and actually get replies.',
  Zane: "Analyzes your competitors' pricing, positioning, and weak spots so you know where to win.",
  Zeke: 'Builds a complete onboarding package so new hires hit the ground running.',
};

const heroTags = [
  { label: 'All', category: ALL_CATEGORY },
  { label: 'Design & Creative', category: 'Design & Creative' },
  { label: 'Data & Analytics', category: 'Data & Analytics' },
  { label: 'Sales & Lead Gen', category: 'Sales & Lead Gen' },
  { label: 'Admin & Ops', category: 'Admin & Ops' },
  { label: 'Research & Strategy', category: 'Research & Strategy' },
  { label: 'Audio & Voice', category: 'Audio & Voice' },
  { label: 'Content Writing', category: 'Content Writing' },
  { label: 'Documents & Reports', category: 'Documents & Reports' },
  { label: 'Copywriting', category: 'Copywriting' },
  { label: 'Digital Products', category: 'Digital Products' },
  { label: 'Marketing', category: 'Marketing' },
  { label: 'Recruiting & HR', category: 'Recruiting & HR' },
  { label: 'AI Services', category: 'AI Services' },
  { label: 'Social Media', category: 'Social Media' },
  { label: 'Video', category: 'Video' },
];

const avatarNames = new Set([
  'alice', 'ash', 'ava', 'beck', 'bella', 'blair', 'bree', 'brody', 'cade', 'cara', 'case', 'charlie',
  'clay', 'cruz', 'dale', 'darcy', 'dex', 'dina', 'duncan', 'elliot', 'ellis', 'ember', 'emma', 'eve',
  'flynn', 'gus', 'heath', 'holly', 'iris', 'ivy', 'jett', 'joe', 'joss', 'jude', 'jules', 'kai',
  'knox', 'koa', 'lane', 'lena', 'lenny', 'lyra', 'mack', 'marlo', 'mira', 'naru', 'nash', 'nico',
  'nora', 'opal', 'oscar', 'paul', 'penn', 'pete', 'peyton', 'piper', 'quinn', 'reed', 'remy', 'ren',
  'rio', 'sage', 'sam', 'shay', 'sienna', 'silas', 'sully', 'tala', 'tate', 'tess', 'thea', 'trey',
  'vera', 'vince', 'wes', 'wilma', 'zane', 'zeke',
]);

const faqs = [
  {
    question: 'What exactly are "AI team members"?',
    answer: 'Specialized AI team members, each trained for one specific job. You describe what you need, they deliver finished work in 60 seconds.',
  },
  {
    question: 'How is this different from ChatGPT or other AI tools?',
    answer: 'ChatGPT gives you a blank box. 3rdShift gives you specialists who already know what to ask, what to deliver, and how to format it.',
  },
  {
    question: 'What are light tasks vs. heavy credits?',
    answer: 'Most tasks are light and included in your plan. Heavy credits cover resource-intensive work like image generation, presentations, and video.',
  },
  {
    question: 'What does "founding member" mean?',
    answer: "You lock in the lowest price we'll offer. If prices go up, yours stays the same as long as you remain subscribed.",
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. No contracts, no cancellation fees. Cancel anytime from your billing page.',
  },
  {
    question: 'Is my data safe?',
    answer: "Yes. Your data stays in your account. We don't train on your data or sell your information.",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.1
    }
  },
  viewport: { once: true }
};

const activeWorkers = WORKER_REGISTRY.filter((worker) => worker.active);

function avatarKey(worker: WorkerConfig) {
  return worker.personaName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function avatarSrc(worker: WorkerConfig) {
  const key = avatarKey(worker);
  return avatarNames.has(key) ? `${ASSET_BASE}/${key}.png` : null;
}

function workerTitle(worker: WorkerConfig) {
  if (worker.personaName === 'Ava') return 'Article Writer';
  if (worker.personaName === 'Lenny') return 'Lead Generator';
  if (worker.personaName === 'Zane') return 'Competitor Analyst';
  if (worker.personaName === 'Sam') return 'Hook Specialist';
  if (worker.personaName === 'Jules') return 'Script Writer';
  return worker.name;
}

function planLabel(worker: WorkerConfig) {
  if (worker.minPlan === 'operator') return 'Operator+';
  if (worker.minPlan === 'pro') return 'Pro+';
  return 'Starter+';
}

function shortDescription(worker: WorkerConfig) {
  return figmaWorkerDescriptions[worker.personaName] ?? worker.description;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <span className="h-3 w-3 bg-blue-500" />
      <span className="text-xs font-normal leading-[18px]! text-[#71717a]">{children}</span>
    </div>
  );
}

function WorkerAvatar({ worker, size = CARD_AVATAR_SIZE }: { worker: WorkerConfig; size?: number }) {
  const src = avatarSrc(worker);
  const intrinsicSize = size * 2;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-[#e9eaeb] bg-white"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          width={intrinsicSize}
          height={intrinsicSize}
          quality={100}
          className="h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

function PopularCard({ worker }: { worker: WorkerConfig }) {
  return (
    <motion.div variants={fadeInUp} className="w-full!">
      <Link
        className="flex! w-full! flex-col! gap-3! overflow-hidden! border! border-[#e9eaeb]! rounded-[24px]! bg-white! p-5! box-border! no-underline! hover:shadow-md transition-shadow duration-300"
        href="/pricing"
      >
        {/* Header row: avatar + name/title + "Popular" badge */}
        <div className="flex! w-full! items-start! gap-3!">
          <WorkerAvatar worker={worker} size={CARD_AVATAR_SIZE} />
          <div className="min-w-0! flex-1!">
            <h3 className="m-0! text-blue-600! font-[Inter,sans-serif]! text-lg! font-semibold! leading-7! tracking-normal! truncate!">
              {worker.personaName}
            </h3>
            <p className="mt-1! m-0! text-[#09090b]! font-[Inter,sans-serif]! text-base! font-normal! leading-6! tracking-normal! truncate!">
              {workerTitle(worker)}
            </p>
          </div>
          <span className="shrink-0! rounded-lg! bg-[#F7F7F7]! px-4! py-2! text-[#71717a]! font-[Inter,sans-serif]! text-base! font-normal! leading-[18px]! tracking-normal!">
            Popular
          </span>
        </div>

        <p className="m-0! text-[#71717a]! font-[Inter,sans-serif]! text-base! font-normal! leading-[24px]! tracking-normal! line-clamp-2!">
          {shortDescription(worker)}
        </p>

        {/* Plan badge */}
        <div className="flex! gap-3! overflow-hidden!">
          <span className="shrink-0! rounded-lg! bg-[#f5f5f5]! px-4! py-2! text-[#525252]! font-[Inter,sans-serif]! text-base! font-normal! leading-6! tracking-normal!">
            {planLabel(worker)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function WorkerCard({ worker }: { worker: WorkerConfig }) {
  return (
    <motion.div variants={fadeInUp} className="w-full!">
      <Link
        className="flex! w-full! flex-col! gap-3! overflow-hidden! border! border-[#e9eaeb]! rounded-[24px]! bg-white! p-5! box-border! no-underline! hover:shadow-md transition-shadow duration-300"
        href="/pricing"
      >
        {/* Header row: avatar + name/title */}
        <div className="flex! w-full! items-start! gap-3!">
          <WorkerAvatar worker={worker} size={CARD_AVATAR_SIZE} />
          <div className="min-w-0! flex-1!">
            <h3 className="m-0! text-blue-600! font-[Inter,sans-serif]! text-lg! font-semibold! leading-7! tracking-normal! truncate!">
              {worker.personaName}
            </h3>
            <p className="mt-1! m-0! text-[#09090b]! font-[Inter,sans-serif]! text-base! font-normal! leading-6! tracking-normal! truncate!">
              {workerTitle(worker)}
            </p>
          </div>
        </div>

        {/* Description — 2-line clamp */}
        <p className="m-0! text-[#71717a]! font-[Inter,sans-serif]! text-base! font-normal! leading-[24px]! tracking-normal! line-clamp-2!">
          {shortDescription(worker)}
        </p>

        {/* Plan badge */}
        <div className="flex! gap-3! overflow-hidden!">
          <span className="shrink-0! rounded-lg! bg-[#f5f5f5]! px-4! py-2! text-[#525252]! font-[Inter,sans-serif]! text-base! font-normal! leading-6! tracking-normal!">
            {planLabel(worker)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function Hero({
  query,
  category,
  setQuery,
  onCategorySelect,
}: {
  query: string;
  category: string;
  setQuery: (value: string) => void;
  onCategorySelect: (value: string) => void;
}) {
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const mobileCategoryLabel = (tag: (typeof heroTags)[number]) => (tag.category === ALL_CATEGORY ? 'All Categories' : tag.label);
  const selectedCategoryLabel = category === ALL_CATEGORY ? 'All Categories' : heroTags.find((tag) => tag.category === category)?.label ?? 'All Categories';
  const selectCategory = (value: string) => {
    onCategorySelect(value);
    setIsMobileCategoryOpen(false);
  };

  return (
    <>
      {/* ── Hero section ── */}
      <motion.section
        className="workers-hero-section w-full! lg:h-[751px]! px-6! box-border! max-sm:px-3!"
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        <div className="workers-hero-shell relative! w-full! max-w-[1392px]! h-[751px]! mx-auto! overflow-hidden! rounded-2xl! border! border-[#f1f1f1]! box-border! max-sm:max-w-none! max-sm:rounded-3xl!">

          {/* Background image */}
          <motion.img
            className="workers-hero-bg absolute! inset-0! z-0! w-full! h-full! object-cover! object-center! pointer-events-none! block! rotate-180! lg:rotate-0!"
            src={`${ASSET_BASE}/hero-bg.png`}
            alt=""
            aria-hidden="true"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />

          {/* Left ellipse */}
          <motion.div
            className="absolute! z-[1]! pointer-events-none!"
            style={{ left: 109, top: -317, width: 559, height: 457 }}
            initial={{ opacity: 0, x: -100 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          >
            <img src={`${ASSET_BASE}/ellipse-left.svg`} alt="" aria-hidden="true" className="max-w-none! pointer-events-none!" style={{ width: 559, height: 457 }} />
          </motion.div>

          {/* Right ellipse */}
          <motion.div
            className="absolute! z-[1] pointer-events-none!"
            style={{ left: 1288, top: -11, width: 335, height: 442 }}
            initial={{ opacity: 0, x: 100 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, delay: 0.4 }}
          >
            <img src={`${ASSET_BASE}/ellipse-right.svg`} alt="" aria-hidden="true" className="max-w-none! pointer-events-none!" style={{ width: 335, height: 442 }} />
          </motion.div>

          {/* Hero content */}
          <div
            className="workers-hero-content relative! z-50! max-sm:flex! max-sm:flex-col! max-sm:items-center! py-17.5!"
          >
            {/* Copy block */}
            <div
              className="workers-hero-copy text-center! relative! z-50! max-sm:left-0! max-sm:top-0! max-sm:w-full! max-sm:h-auto! px-4!"
            >
              <motion.h1
                className="relative! z-50! m-0! text-white! font-[Inter,sans-serif]! text-[36px]! sm:text-[44px]! md:text-[52px]! lg:text-[60px]! font-medium! leading-11! sm:leading-13! md:leading-15! lg:leading-18! tracking-[-2px]! text-center!"
                variants={fadeInUp}
              >
                Your team.
                <br />
                Ready to work.
              </motion.h1>
              <motion.p
                className="workers-hero-description m-0! text-[#f2f2f2]! font-[Inter,sans-serif]! text-sm! sm:text-base! md:text-lg! xl:text-xl! font-normal! leading-5! sm:leading-6! md:leading-7.5! tracking-normal! text-center! mt-4! mb-7.5! sm:mb-9! md:mb-10!"
                variants={fadeInUp}
              >
                {WORKER_COUNT} AI-powered team members. Content, sales, research, design, video, admin, and more.
                <br />
                Each one trained for a single job. Results in 60 seconds. No managing required.
              </motion.p>
            </div>

            {/* Filter panel */}
            <motion.div
              className="rounded-[16px]! sm:rounded-[24px]! md:rounded-[32px]! border! border-[#E4E7EC]! bg-[#FFFFFF21]! backdrop-blur-md! w-full! max-w-[calc(100%-32px)]! mx-auto! p-2.5! pb-1! xl:max-w-229!"
              variants={fadeInUp}
            >
              <label
                className="flex! items-start! gap-2! rounded-[16px]! sm:rounded-[24px]! bg-white! p-4! sm:p-5! h-14! sm:h-15! md:h-16! mb-2.5!"
              >
                <Search className="w-5! h-5! shrink-0! text-[#0A0D12]!" />
                <input
                  className="w-full! border-0! p-0! outline-none! bg-transparent! text-[#0a0d12]! placeholder:text-[#525252]! font-[Inter,sans-serif]! text-base! font-normal!"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search team members..."
                />
              </label>

              <div className="overflow-auto!">
                <div
                  className="flex! gap-2!"
                >
                  {heroTags.map((tag) => (
                    <button
                      key={tag.label}
                      className={`shrink-0! rounded-md! sm:rounded-3xl! bg-white! px-3! sm:px-4! py-2! sm:py-2.25! text-[#181818]! font-[Inter,sans-serif]! text-sm! sm:text-xs! font-normal! cursor-pointer! ${category === tag.category ? 'is-active text-blue-600! font-semibold!' : ''}`}
                      type="button"
                      onClick={() => selectCategory(tag.category)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Mobile category dropdown trigger */}
            {/* <div className={`workers-mobile-category-menu hidden max-sm:block! absolute! left-0! top-[74px]! z-[14]! w-full! font-[Inter,sans-serif]!${isMobileCategoryOpen ? ' is-open' : ''}`}>
                <button
                  className={`workers-mobile-category-trigger inline-flex! h-9! min-w-24! items-center! justify-between! gap-[10px]! border! border-[#e9eaeb]! rounded-[20px]! bg-white! px-[14px]! py-2! text-[#171717]! font-[Inter,sans-serif]! text-[13px]! font-normal! leading-5! tracking-normal! shadow-[0_14px_34px_rgba(15,23,42,0.12)]!${isMobileCategoryOpen ? ' is-open border-blue-600! shadow-[0_0_0_3px_rgba(37,99,235,0.18),0_14px_34px_rgba(15,23,42,0.12)]!' : ''}`}
                  type="button"
                  aria-expanded={isMobileCategoryOpen}
                  aria-haspopup="listbox"
                  onClick={() => setIsMobileCategoryOpen((open) => !open)}
                >
                  <span>{selectedCategoryLabel}</span>
                  <span className={`workers-mobile-category-chevron inline-flex! translate-y-[-1px]! text-[#171717]! text-base! leading-4!${isMobileCategoryOpen ? ' translate-y-[1px]! rotate-180!' : ''}`} aria-hidden="true">⌄</span>
                </button>
              </div> */}
          </div>

          {/* Butterfly decor */}
          <motion.div
            className="absolute! z-[1]! mix-blend-overlay! pointer-events-none! rotate-[5deg]! hidden! xl:flex!"
            style={{ left: 1218.617, top: 483, width: 107.113, height: 107.113 }}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <img src={`${ASSET_BASE}/decor-butterfly.svg`} alt="" aria-hidden="true" style={{ width: 107.113, height: 107.113 }} className="pointer-events-none!" />
          </motion.div>

          {/* Left decor */}
          <motion.img
            src={`${ASSET_BASE}/decor-left.svg`}
            alt=""
            aria-hidden="true"
            className="absolute! z-[1]! mix-blend-overlay! pointer-events-none! hidden! xl:flex!"
            style={{ left: -34, top: 296, width: 285, height: 285 }}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
          />

          {/* Right decor */}
          <motion.img
            src={`${ASSET_BASE}/decor-right.svg`}
            alt=""
            aria-hidden="true"
            className="absolute! z-[1]! mix-blend-overlay! pointer-events-none! hidden! xl:flex!"
            style={{ left: 1264, top: 17, width: 200, height: 200 }}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
          />
        </div>
      </motion.section>

      {/* Mobile category overlay / sheet */}
      {isMobileCategoryOpen ? (
        <div
          className="workers-mobile-category-overlay fixed! inset-0! z-[9999]! flex! items-center! justify-center! bg-[rgba(9,9,11,0.46)]! p-4! box-border!"
          role="presentation"
          onClick={() => setIsMobileCategoryOpen(false)}
        >
          <div
            className="workers-mobile-category-sheet relative! flex! w-[min(100%,358px)]! max-w-[calc(100vw-32px)]! flex-col! gap-0! overflow-visible! border! border-[rgba(233,234,235,0.95)]! rounded-3xl! bg-white! pt-[52px]! px-[10px]! pb-[10px]! box-border! shadow-[0_24px_64px_rgba(15,23,42,0.32)]!"
            role="listbox"
            aria-label="Team member categories"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Close button */}
            <button
              className="workers-mobile-category-close absolute! top-[10px]! right-[10px]! flex! w-9! h-9! items-center! justify-center! border! border-[#e9eaeb]! rounded-full! bg-white! text-[#171717]! font-[Inter,sans-serif]! text-2xl! font-normal! leading-6!"
              type="button"
              aria-label="Close category menu"
              onClick={() => setIsMobileCategoryOpen(false)}
            >
              ×
            </button>

            {heroTags.map((tag) => (
              <button
                key={tag.label}
                className={`workers-mobile-category-option flex! w-full! min-h-11! items-center! justify-start! border! border-transparent! rounded-2xl! bg-white! px-[14px]! py-[10px]! text-[#171717]! font-[Inter,sans-serif]! text-[13px]! font-normal! leading-5! text-left! whitespace-nowrap!${category === tag.category ? ' is-active border-blue-600! bg-blue-600! text-white!' : ''}`}
                type="button"
                role="option"
                aria-selected={category === tag.category}
                onClick={() => selectCategory(tag.category)}
              >
                {mobileCategoryLabel(tag)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PopularSection({ workers }: { workers: WorkerConfig[] }) {
  return (
    <motion.section
      className="workers-popular-section relative! z-20! w-full! -mt-[275px]! sm:-mt-[180px]! sm:px-6!"
      initial="initial"
      whileInView="whileInView"
      viewport={{ once: true }}
      variants={staggerContainer}
    >
      <div
        className="workers-popular-shell w-full! max-w-348! mx-auto! border! border-[#F1F1F1]! rounded-[32px]! sm:px-4! xl:px-20! py-[60px]! box-border! overflow-hidden! bg-[radial-gradient(54.77%_54.77%_at_50%_17.94%,rgba(250,250,250,0)_0%,#F7F7F7_48.09%,rgba(255,255,255,0.38)_100%),linear-gradient(0deg,#FAFAFA,#FAFAFA)] max-sm:max-w-none! max-sm:h-auto! max-sm:rounded-3xl! max-sm:px-3! max-sm:py-10!"
      >
        {/* Inner positioning wrapper */}
        <div
          className="relative! space-y-10! lg:space-y-15!"
        >
          {/* "Most popular" label */}
          <motion.div
            className="flex! items-center! justify-center! gap-2! whitespace-nowrap!"
            variants={fadeInUp}
          >
            <span className="w-3! h-3! bg-blue-600! shrink-0!" />
            <span className="shrink-0! whitespace-nowrap! text-[#71717a]! font-[Inter,sans-serif]! text-xs! font-normal! leading-[18px]! tracking-normal! max-sm:w-auto!">
              MOST POPULAR
            </span>
          </motion.div>

          {/* Popular cards panel */}
          <div
            className="rounded-[32px]! border! border-[#e4e7ec]! bg-[#f5f5f5]! p-[10px]! backdrop-blur-md!"
          >
            <div
              className="grid! gap-2.5! max-sm:w-full! max-sm:h-auto! max-sm:grid-cols-1! sm:grid-cols-2! lg:grid-cols-3!"
            >
              {workers.map((worker) => (
                <PopularCard key={worker.slug} worker={worker} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function WorkersGrid({
  workers,
  gridRef,
  category,
  query,
  onClearFilter,
  currentPage,
  totalPages,
  onPageChange,
}: {
  workers: WorkerConfig[];
  gridRef: React.RefObject<HTMLElement | null>;
  category: string;
  query: string;
  onClearFilter: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const isInView = useInView(gridRef as React.RefObject<Element>, { once: true });
  const showPopular = category === ALL_CATEGORY && query.trim() === '';

  return (
    <motion.section
      ref={gridRef}
      className={`workers-grid-section w-full! sm:px-6! lg:pt-[60px]! ${!showPopular ? "relative! z-20! -mt-[275px]! sm:-mt-[180px]! lg:-mt-[240px]! px-0!" : "px-3!"}`}
      initial="initial"
      animate={isInView ? "whileInView" : "initial"}
      variants={staggerContainer}
    >
      <div
        className="workers-grid-shell w-full! max-w-348! mx-auto! rounded-[32px]! sm:px-4! xl:px-20! pt-[60px]! pb-11! box-border! overflow-hidden! bg-white! max-sm:max-w-none! max-sm:h-auto! max-sm:rounded-3xl! px-0! max-sm:py-10!"
      >
        <div
          className="relative! space-y-15!"
        >
          <motion.div
            className="flex! items-center! justify-center! gap-2! whitespace-nowrap!"
            variants={fadeInUp}
          >
            <span className="w-3! h-3! bg-blue-600! shrink-0!" />
            <span className="shrink-0! whitespace-nowrap! text-[#71717a]! font-[Inter,sans-serif]! text-xs! font-normal! leading-[18px]! tracking-normal! max-sm:w-auto!">
              ALL TEAM MEMBERS
            </span>
          </motion.div>

          {/* Grid panel */}
          <div className={`${workers.length > 0 ? "px-0!" : "px-4! sm:px-6!"}`}>
            <div
              className="rounded-[32px]! border! border-[#e4e7ec]! bg-[#f5f5f5]! p-[10px]! backdrop-blur-md!"
            >
              {workers.length > 0 ? (
                <div
                  className="grid! gap-2.5! max-sm:w-full! max-sm:h-auto! max-sm:grid-cols-1! sm:grid-cols-2! lg:grid-cols-3!"
                >
                  {workers.map((worker) => (
                    <WorkerCard key={worker.slug} worker={worker} />
                  ))}
                </div>
              ) : (
                <motion.div
                  variants={fadeInUp}
                  className="flex! flex-col! items-center! justify-center! text-center! py-10! sm:py-13! md:py-16! px-6! mx-auto!"
                >
                  <Search className="size-7! sm:size-8! md:size-9! text-blue-600! mb-4!" />
                  <h3 className="text-2xl! font-semibold! text-[#09090b]! font-[Inter,sans-serif]! mb-2!">
                    No team members found
                  </h3>
                  <p className="text-sm! sm:text-base! text-[#71717a]! font-[Inter,sans-serif]! mb-6! leading-6!">
                    We couldn&apos;t find any AI team members matching your search.<br /> Try resetting your search query or choosing another category.
                  </p>
                  <Button
                    type="button"
                    onClick={onClearFilter}
                    variant="primary"
                    className="px-4! hover:scale-100!"
                  >
                    Clear all filters
                  </Button>
                </motion.div>
              )}
            </div>

            {totalPages > 1 && workers.length > 0 && (
              <motion.div variants={fadeInUp} className="w-full">
                <div className="flex gap-2 sm:gap-4 items-center justify-between border-t border-zinc-200 pt-3! sm:pt-4! md:pt-5.5! bg-white mt-12! sm:mt-14! md:mt-16! sm:mb-8! lg:mb-0! px-4! lg:px-6!">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="w-9! sm:w-[111px]!"
                  >
                    <span className='flex'><ArrowLeft className='h-4' /></span>
                    <span className='hidden sm:flex'>Previous</span>
                  </Button>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    className="justify-center!"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="w-9! sm:w-[84px]!"
                  >
                    <span className='hidden sm:flex'>Next</span>
                    <span className='flex'><ArrowRight className='h-4' /></span>
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default function WorkersPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [currentPage, setCurrentPage] = useState(1);
  const [, forceAllReset] = useState(0);
  const workersGridRef = useRef<HTMLElement | null>(null);

  const WORKERS_PER_PAGE = 18;

  const handleCategorySelect = (value: string) => {
    const isAll = value === ALL_CATEGORY;
    setCategory(isAll ? ALL_CATEGORY : value);
    setQuery('');
    setCurrentPage(1);
    if (isAll) {
      forceAllReset((key) => key + 1);
    }
    setTimeout(() => {
      if (isAll) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        workersGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const featuredWorkers = useMemo(
    () =>
      featuredSlugs
        .map((slug) => activeWorkers.find((worker) => worker.slug === slug))
        .filter(Boolean) as WorkerConfig[],
    []
  );

  const filteredWorkers = useMemo(() => {
    const sortByPersonaName = (workers: WorkerConfig[]) =>
      [...workers].sort((a, b) => a.personaName.localeCompare(b.personaName, undefined, { sensitivity: 'base' }));
    const isAllCategory = category.trim().toLowerCase() === ALL_CATEGORY.toLowerCase();
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = (worker: WorkerConfig) => {
      if (!normalizedQuery) return true;
      return [worker.personaName, workerTitle(worker), worker.name, worker.category, worker.description, ...worker.tags].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );
    };

    if (isAllCategory) {
      const allList = activeWorkers.filter(matchesQuery);
      return sortByPersonaName(query ? allList : allList.filter(w => !featuredSlugs.includes(w.slug)));
    }

    return sortByPersonaName(
      activeWorkers.filter((worker) => {
        if (worker.category !== category) return false;
        return matchesQuery(worker);
      })
    );
  }, [category, query]);

  const setQueryAndResetPage = (q: string) => {
    setQuery(q);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setTimeout(() => {
      workersGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 10);
  };

  const totalPages = Math.max(1, Math.ceil(filteredWorkers.length / WORKERS_PER_PAGE));
  const paginatedWorkers = filteredWorkers.slice((currentPage - 1) * WORKERS_PER_PAGE, currentPage * WORKERS_PER_PAGE);

  return (
    <main
      className={`workers-figma relative! bg-white! font-sans! text-[#09090b]! max-sm:overflow-x-hidden! pb-0! lg:pb-20!${category === ALL_CATEGORY && query.trim() === '' ? ' is-default-all' : ''}`}
    >
      <style jsx global>{`
        /* Hide scrollbar on category tab strip (desktop) */
        .category-tabs-scroll::-webkit-scrollbar {
          display: none;
        }

        /* FAQ question button base */
        .workers-faq-question {
          display: flex;
          width: 100%;
          flex: 1 1 auto;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          border: 0;
          background: transparent;
          padding: 0;
          color: #09090b;
          font-family: Inter, sans-serif;
          font-size: 20px;
          font-weight: 500;
          line-height: 30px;
          text-align: left;
          cursor: pointer;
        }

        .workers-faq-question span {
          flex: 1 1 auto;
        }

        .workers-faq-arrow {
          flex: 0 0 auto;
          transition: transform 160ms ease;
        }

        .workers-faq-answer {
          display: none;
        }

        /* ── Mobile scrollbar on category strip ── */
        @media (max-width: 640px) {
          .category-tabs-scroll::-webkit-scrollbar {
            display: block !important;
            width: 8px !important;
            height: 8px !important;
            -webkit-appearance: none !important;
            background: rgba(255, 255, 255, 0.34) !important;
          }

          .category-tabs-scroll::-webkit-scrollbar-track {
            display: block !important;
            border-radius: 999px !important;
            background: rgba(255, 255, 255, 0.46) !important;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22) !important;
          }

          .category-tabs-scroll::-webkit-scrollbar-thumb {
            display: block !important;
            min-width: 56px !important;
            border: 1px solid rgba(255, 255, 255, 0.9) !important;
            border-radius: 999px !important;
            background: rgba(255, 255, 255, 0.96) !important;
            background-clip: padding-box !important;
            box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18) !important;
          }

          .category-tabs-scroll::-webkit-scrollbar-corner {
            background: transparent !important;
          }

          /* FAQ mobile overrides */
          .workers-faq-section {
            height: auto !important;
            padding: 40px 12px 0 !important;
          }

          .workers-faq-shell {
            height: auto !important;
            max-width: none !important;
            justify-content: flex-start !important;
            border-radius: 24px !important;
            padding: 10px !important;
          }

          .workers-faq-panel {
            height: auto !important;
            border-radius: 24px !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
          }

          .workers-faq-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            grid-template-rows: none !important;
            gap: 10px !important;
            overflow: visible !important;
          }

          .workers-faq-intro {
            grid-row: auto !important;
            min-height: 360px !important;
            justify-content: center !important;
          }

          .workers-faq-intro h2 {
            font-size: 44px !important;
            line-height: 44px !important;
            letter-spacing: -0.88px !important;
          }

          .workers-faq-item {
            height: auto !important;
            min-height: 70px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }

          .workers-faq-question {
            font-size: 16px !important;
            line-height: 24px !important;
          }

          .workers-faq-answer {
            display: none !important;
            color: #71717a !important;
            font-family: Inter, sans-serif !important;
            font-size: 14px !important;
            line-height: 21px !important;
          }

          .workers-faq-item.is-open .workers-faq-answer {
            display: block !important;
          }

          .workers-faq-answer p {
            margin: 0 !important;
            color: #71717a !important;
            font-size: 14px !important;
            line-height: 21px !important;
          }

          .workers-faq-item.is-open .workers-faq-arrow {
            transform: rotate(0deg) !important;
          }

          /* Hide duplicate cards from grid when showing default "All" view */
          .workers-figma.is-default-all .workers-grid-card:nth-child(n + 19),
          .workers-figma.is-default-all .workers-grid-card[data-worker-slug="content-writer"],
          .workers-figma.is-default-all .workers-grid-card[data-worker-slug="lead-generator"],
          .workers-figma.is-default-all .workers-grid-card[data-worker-slug="competitor-analyst"] {
            display: none !important;
          }
        }
      `}</style>

      <Hero query={query} category={category} setQuery={setQueryAndResetPage} onCategorySelect={handleCategorySelect} />
      {category === ALL_CATEGORY && query.trim() === '' ? <PopularSection workers={featuredWorkers} /> : null}
      <WorkersGrid
        workers={paginatedWorkers}
        gridRef={workersGridRef}
        category={category}
        query={query}
        onClearFilter={() => { setQueryAndResetPage(''); setCategory(ALL_CATEGORY); }}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
      <FaqSection />
    </main>
  );
}