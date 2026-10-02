'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, BarChart3, Check, ChevronDown, PenTool, Search, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { FaqSection } from '../_components/FaqSection';
import { fadeInUp, staggerContainer } from '../_components/shared';
import { formatPlanAnnualBilling } from '@/lib/marketing-facts';

const marketingImage = (name: string) => `/images/marketing/${name}.png`;

const plans = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'For creators who want content on autopilot.',
    oldPrice: '$59',
    monthly: '$39',
    annual: '$29',
    monthlySavings: 'Founding member savings: $20/month',
    annualSavings: 'Save $120/year',
    features: ['40 team members', '200 light tasks/month', 'Light tasks only — add heavy credits on Pro (top-ups never expire)', '1 workspace', 'Jarvis Chat Support'],
    featured: false,
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'For businesses running lead, research, and admin weekly',
    oldPrice: '$159',
    monthly: '$99',
    annual: '$79',
    monthlySavings: 'Founding member savings: $60/month',
    annualSavings: 'Save $240/year',
    features: ['70+ team members', '500 light tasks/month', '50 heavy credits/month', '3 workspaces', 'Jarvis Chat Support'],
    featured: true,
  },
  {
    slug: 'operator',
    name: 'Operator',
    description: 'For operators and agencies running at scale.',
    oldPrice: '$399',
    monthly: '$249',
    annual: '$199',
    monthlySavings: 'Founding member savings: $150/month',
    annualSavings: 'Save $600/year',
    features: ['70+ team members', '1,250 light tasks/month', '150 heavy credits/month', '2 seats', '10 workspaces', 'Jarvis chat support'],
    featured: false,
  },
];

const benefits = [
  {
    Icon: PenTool,
    text: 'Replace your freelance writer → Ava writes articles in 60 seconds',
  },
  {
    Icon: UserPlus,
    text: 'Replace your lead gen VA → Lenny finds and qualifies leads instantly',
  },
  {
    Icon: Search,
    text: 'Replace your SEO consultant → Kai builds keyword briefs and topic clusters in 60 seconds',
  },
  {
    Icon: BarChart3,
    text: 'Replace your data analyst → Tess analyzes your data and delivers trends for your business',
  },
];

const faqs = [
  {
    question: "What exactly are 'AI team members'?",
    answer:
      'Specialized AI team members, each trained for one specific job. Ava writes articles. Lenny finds leads. Reed designs thumbnails. You describe what you need, they deliver finished work in 60 seconds. Not a chatbot - a team that does the work for you.',
  },
  {
    question: 'How is this different from ChatGPT or other AI tools?',
    answer:
      'ChatGPT gives you a blank box. 3rdShift gives you 70+ team members who already know what to ask, what to deliver, and how to format it. They remember your brand, your voice, and what worked last time. And they deliver directly to Google Docs, Sheets, and Buffer - not a chat window.',
  },
  {
    question: 'What are light tasks vs. heavy credits?',
    answer:
      "Light tasks cover writing, research, social content, email sequences, and more. Starter includes 200 light tasks/month. Pro includes 500 light tasks/month and 50 heavy credits/month. Operator includes 1,250 light tasks/month and 150 heavy credits/month.",
  },
  {
    question: "What does 'founding member' mean?",
    answer:
      "You lock in the lowest price we'll ever offer. If prices go up, yours stays the same forever. Cancel and the founding rate is gone permanently.",
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. No contracts, no fees. Cancel in two clicks from your billing page. Your plan stays active through the end of your billing period.',
  },
  {
    question: 'Is my data safe?',
    answer:
      "Yes. We don't train on your data. Your inputs and outputs are yours. Encryption in transit and at rest. No third-party data sharing.",
  },
];

function ArrowLink({
  href,
  children,
  className = '',
  arrowRight = true,
  onClick
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  arrowRight?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link href={href} onClick={onClick} className={`inline-flex items-center justify-center gap-1 ${className}`}>
      <span>{children}</span>
      {
        arrowRight && (
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        )
      }
    </Link>
  );
}

function Badge({ children, inverse = false, className }: { children: React.ReactNode; inverse?: boolean; className?: string }) {
  return (
    <div
      className={`inline-flex items-center justify-center gap-2 text-xs font-normal leading-4 ${className} ${inverse ? 'text-white' : 'text-zinc-500'
        }`}
    >
      <span className="h-3 w-3 rounded-[2px] bg-blue-600" />
      <span>{children}</span>
    </div>
  );
}

// Local staggerContainer was here, moving to shared and removing it to avoid conflict or just keeping shared one


// Local overrides for better scroll-triggering and smoother feel on this specific page
const localViewport = { once: true, amount: 0.2 };
const localStaggerViewport = { once: true, amount: 0.1 };
const localTransition = { duration: 0.8, ease: [0.22, 1, 0.36, 1] } as const;
const localStaggerTransition = { staggerChildren: 0.15 };


function HeroSection() {
  return (
    <motion.section
      className="workers-hero-section w-full! box-border! px-3! sm:px-6!"
      initial="initial"
      whileInView="whileInView"
      viewport={localStaggerViewport}
      variants={staggerContainer}
      transition={localStaggerTransition}
    >
      <div className="workers-hero-shell px-0! relative! w-full! max-w-[1392px]! mx-auto! overflow-hidden! rounded-2xl! border! border-[#f1f1f1]! box-border! max-sm:max-w-none! max-sm:rounded-3xl! min-h-[650px]">

        {/* Background image */}
        <motion.img
          className="workers-hero-bg absolute! -top-7.5! sm:-top-30! inset-0! z-0! w-full! h-full! object-cover! object-center! pointer-events-none! block! rotate-180! lg:rotate-0!"
          src={`/images/marketing/workers-figma/hero-bg.png`}
          alt=""
          aria-hidden="true"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <div className="pricing-hero-content relative z-10 mx-auto flex max-w-none! flex-col items-center px-6 text-center py-[93px]! sm:py-20!">
          <motion.div
            className="pricing-hero-offer mb-0! inline-flex flex-nowrap! overflow-auto! justify-start! items-center gap-2 rounded-lg bg-[#E9EAEB52] p-1 shadow-[0px_2px_12px_rgba(0,0,0,0.08)] max-w-[90%]!"
            variants={fadeInUp}
            transition={localTransition}
          >
            <span className="pricing-hero-price-pill rounded-md bg-white p-1.5! text-xs! font-normal leading-4 text-zinc-950">
              Only $29/month
            </span>
            <span className="pricing-hero-limited-copy pl-0! text-xs font-normal leading-4 text-white">
              Limited spots! Now accepting founding members.
            </span>
          </motion.div>
          <motion.h1
            className="my-4! text-[36px]! sm:text-[44px]! md:text-[52px]! lg:text-[60px]! font-medium leading-11! sm:leading-13! md:leading-15! lg:leading-18! tracking-normal text-white"
            variants={fadeInUp}
            transition={localTransition}
          >
            Simple pricing.
            <br />
            Serious results.
          </motion.h1>
          <motion.p
            className="m-0! text-sm! sm:text-base! md:text-lg! lg:text-xl! font-normal text-[#F2F2F2] px-4!"
            variants={fadeInUp}
            transition={localTransition}
          >
            70+ AI team members. Content, sales, research, design, video, admin, and more.<br />
            Each one trained for a single job. Results in 60 seconds. No managing required.
          </motion.p>
        </div>

        {/* Left decor */}
        <motion.img
          src={`/images/marketing/workers-figma/decor-left.svg`}
          alt=""
          aria-hidden="true"
          className="absolute! z-[1]! mix-blend-overlay! pointer-events-none! hidden! xl:flex!"
          style={{ left: -34, top: 266, width: 285, height: 285 }}
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
        />

        {/* Right decor */}
        <motion.img
          src={`/images/marketing/workers-figma/decor-right.svg`}
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
  );
}

function BillingToggle({
  billing,
  setBilling,
}: {
  billing: 'monthly' | 'annual';
  setBilling: (billing: 'monthly' | 'annual') => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[10px] border border-zinc-200 bg-[#F5F5F5] p-1 w-fit! max-w-none!" aria-label="Billing cycle">
      <button
        type="button"
        onClick={() => setBilling('monthly')}
        className={`flex cursor-pointer h-9 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold leading-5 ${billing === 'monthly' ? 'bg-white text-zinc-700 shadow-sm' : 'text-tertiary'
          }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => setBilling('annual')}
        className={`flex cursor-pointer h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold leading-5 ${billing === 'annual' ? 'bg-white text-zinc-700 shadow-sm' : 'text-tertiary'
          }`}
      >
        Annual
        <span className="pricing-save-pill rounded-full border border-[#B2DDFF] bg-[#EFF8FF] px-2! py-0.5! text-xs font-medium leading-4 text-[#175CD3] text-nowrap">
          Save 50%
        </span>
      </button>
    </div>
  );
}

function PricingSection() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

  return (
    <motion.section
      className="pricing-plans-section relative z-20 -mt-[240px]! w-full pb-0! px-0! md:px-6! rounded-[32px]"
      aria-labelledby="pricing-plans"
      initial="initial"
      whileInView="whileInView"
      viewport={localStaggerViewport}
      variants={staggerContainer}
      transition={localStaggerTransition}
    >
      <div className="pricing-plans-shell mx-auto w-full max-w-[1392px] rounded-[32px]">
        <div
          className="flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl sm:rounded-[32px] border border-zinc-100 px-3! py-10! sm:py-13! md:py-15! sm:px-6! lg:px-20!"
        >
          <div id="pricing-plans" className="flex w-full flex-col items-center gap-10! sm:gap-15!">
            <motion.div variants={fadeInUp} transition={localTransition}>
              <BillingToggle billing={billing} setBilling={setBilling} />
            </motion.div>
            <div className="pricing-plans-grid grid w-full grid-cols-1 items-stretch justify-center gap-5! sm:grid-cols-2! xl:grid-cols-3!">
              {plans.map((plan) => {
                const price = billing === 'monthly' ? plan.monthly : plan.annual;
                const savings = billing === 'monthly' ? 'Billed monthly via Stripe. Cancel anytime.' : plan.annualSavings;

                return (
                  <motion.article
                    className={`flex min-w-0 flex-col items-center justify-start gap-2.5 overflow-hidden rounded-[32px] border border-[#E4E7EC] p-2.5 backdrop-blur-md! ${plan.featured ? 'bg-blue-500 xl:h-[105%]! xl:-mt-[15px]!' : 'bg-zinc-100'
                      }`}
                    key={plan.name}
                    variants={fadeInUp}
                    transition={localTransition}
                  >
                    {plan.featured ? (
                      <div className="w-full text-center text-base font-semibold leading-6 text-white">Best Seller</div>
                    ) : null}
                    <div className="flex w-full flex-1 flex-col justify-between gap-4! sm:gap-6! md:gap-8! overflow-hidden rounded-3xl border border-gray-200 bg-white p-5!">
                      <div className={`flex flex-col items-start gap-8!`}>
                        <div className="flex min-h-20 w-full flex-col items-start gap-4">
                          <h2 className="text-2xl! font-medium leading-8 text-zinc-950">{plan.name}</h2>
                          <p className="text-base! font-normal leading-6 text-zinc-500">{plan.description}</p>
                        </div>
                      </div>
                      <div className="flex w-full flex-col items-start gap-8 overflow-hidden">
                        <div className="flex w-full flex-col items-start gap-2.5">
                          <div className="flex items-end gap-1 leading-none">
                            <p className="-mt-0.5! text-base! font-bold! leading-6! text-zinc-400! line-through!">
                              {plan.oldPrice}
                            </p>
                            <p className="text-5xl! font-normal! leading-[60px]! text-zinc-950! -mb-2!">{price}</p>
                            <p className="-mt-0.5! text-base! font-normal! leading-6! text-zinc-400!">/month</p>
                          </div>
                          <p className="pricing-savings-line text-xs! font-semibold! leading-[18px] text-blue-500!">{savings}</p>
                          {billing === 'annual' && (
                            <p className="text-xs! font-normal! leading-[18px] text-zinc-500!">{formatPlanAnnualBilling(plan.slug as 'starter' | 'pro' | 'operator')}</p>
                          )}
                        </div>
                        <ArrowLink
                          arrowRight={false}
                          href={`/signup?plan=${plan.slug}&billing=${billing}`}
                          className={`w-full h-10! rounded-lg px-3.5 py-2.5 text-sm font-semibold leading-5 transition duration-300 ${plan.featured
                            ? 'bg-blue-500! text-white border border-blue-500 hover:bg-blue-500/85!'
                            : 'bg-white! text-zinc-700 border border-[#6290F2] hover:bg-blue-50/50!'
                            }`}
                        >
                          Become a Founding Member
                        </ArrowLink>
                        <p className="text-center text-xs text-zinc-500">Billed {billing === 'annual' ? 'annually' : 'monthly'} via Stripe. Cancel anytime.</p>
                        <div className="space-y-3! w-full">
                          <div className="flex w-full items-center justify-center gap-4">
                            <div className="h-px flex-1 bg-zinc-400" />
                            <p className="pricing-feature-label text-xs font-normal leading-[18px] text-zinc-500">What you will get</p>
                            <div className="h-px flex-1 bg-zinc-400" />
                          </div>
                          <ul className="flex w-full flex-col gap-3">
                            {plan.features.map((feature) => (
                              <li className="flex items-start gap-2.5 overflow-hidden" key={feature}>
                                <span className="mt-[1.5px] flex h-5 w-5 shrink-0 items-center justify-center rounded-[50px] bg-blue-600 p-1">
                                  <Check size={12} color="white" strokeWidth={3} aria-hidden="true" />
                                </span>
                                <span className="flex-1 text-base! font-normal leading-6 text-zinc-500">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
            <motion.div
              className="mt-5! flex w-full flex-col items-center justify-center gap-1.5 text-center"
              variants={fadeInUp}
              transition={localTransition}
            >
              <p className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3! py-0.5! text-sm font-semibold text-blue-600 shadow-sm mb-2!">
                7-day money-back guarantee
              </p>
              <Link href="/terms#refund-policy" className="text-xs font-medium text-zinc-500 underline-offset-4 hover:text-blue-500 hover:underline">
                Terms
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function BenefitsSection() {
  return (
    <motion.section
      className="w-full py-10! px-3! sm:px-6! order-2! sm:order-1!"
      initial="initial"
      whileInView="whileInView"
      viewport={localStaggerViewport}
      variants={staggerContainer}
      transition={localStaggerTransition}
    >
      <div className="mx-auto! w-full max-w-[1392px] px-0!">
        <div className="pricing-benefits-panel relative flex w-full flex-col items-center overflow-hidden rounded-[32px] border border-zinc-100 px-6 py-0! sm:px-10 lg:px-20">
          <img
            src="/images/marketing/pricing-figma/benefits-fluted-glass.png"
            alt=""
            className="absolute max-w-none h-full w-full opacity-85"
            aria-hidden="true"
          />
          <img
            src="/images/marketing/pricing-figma/benefits-ellipse-left.svg"
            alt=""
            className="pricing-benefits-ellipse pricing-benefits-ellipse-left absolute max-w-none"
            aria-hidden="true"
          />
          <img
            src="/images/marketing/pricing-figma/benefits-ellipse-right.svg"
            alt=""
            className="pricing-benefits-ellipse pricing-benefits-ellipse-right absolute max-w-none"
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-full flex-col items-center px-3! py-10! lg:p-20! ">
            <motion.div variants={fadeInUp} transition={localTransition}>
              <Badge className="text-[#09090B]!">BENEFITS</Badge>
            </motion.div>
            <motion.h2
              className="mt-5! mb-10! text-center text-[36px]! sm:text-[40px]! md:text-[48px]! font-medium leading-11! sm:leading-13! md:leading-15! text-zinc-950"
              variants={fadeInUp}
              transition={localTransition}
            >
              What You Can Replace
            </motion.h2>
            <div className="grid! w-full! grid-cols-1! sm:grid-cols-2! gap-2.5! rounded-[32px]! border! border-[#E4E7EC]! p-2.5! backdrop-blur-md! bg-[#F5F5F5]! max-w-none!">
              {benefits.map(({ Icon, text }) => (
                <motion.article
                  key={text}
                  className="flex! flex-col! items-start! justify-between! gap-10! rounded-3xl! border! border-zinc-200! bg-white! p-5!"
                  variants={fadeInUp}
                  transition={localTransition}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-blue-600 text-white">
                    <Icon size={24} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <p className="text-2xl font-normal leading-8 text-zinc-950">{text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function CrewAvatar({
  src,
  size,
  innerSize,
  padding,
  left,
  top,
  name,
}: {
  src: string;
  size: number;
  innerSize: number;
  padding: number;
  left: number;
  top: number;
  name: string;
}) {
  return (
    <div
      className="absolute! z-[3]! inline-flex! items-center! justify-center! overflow-hidden! rounded-full! bg-[rgba(233,234,235,0.32)]! box-border!"
      data-crew-avatar={name}
      style={{
        left,
        top,
        width: size,
        height: size,
        padding,
      }}
    >
      <img
        src={src}
        alt=""
        className="rounded-full! object-cover! shrink-0!"
        style={{
          width: innerSize,
          height: innerSize,
        }}
      />
    </div>
  );
}

function CrewLabel({
  children,
  left,
  top,
  height,
  fontSize,
  radius,
  paddingLeft,
  paddingRight,
  width,
}: {
  children: React.ReactNode;
  left: number;
  top: number;
  height: number;
  fontSize: number;
  radius: number;
  paddingLeft: number;
  paddingRight: number;
  width?: number;
}) {
  return (
    <div
      className="absolute! z-[2]! inline-flex! items-center! justify-center! whitespace-nowrap! text-white! shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]! bg-[rgba(255,255,255,0.29)]! box-border!"
      data-crew-label={typeof children === 'string' ? children : undefined}
      style={{
        left,
        top,
        height,
        width,
        borderRadius: radius,
        paddingTop: 0,
        paddingRight,
        paddingBottom: 0,
        paddingLeft,
        fontSize,
        lineHeight: 1,
        fontWeight: 400,
      }}
    >
      <span className="relative! z-[1]! whitespace-nowrap!">
        {children}
      </span>
    </div>
  );
}

function CrewConstellation({
  className = "",
  productLabel = 'Product Architect',
  creativeLabel = 'Creative Editor',
}: {
  className?: string;
  productLabel?: string;
  creativeLabel?: string;
} = {}) {
  return (
    <img
      src="/images/marketing/crew-sider.png"
      alt=""
      aria-hidden="true"
      className="object-contain min-[580px]:object-cover! object-center lg:object-right order-1 min-[580px]:order-2 z-20 w-auto h-[240px]! min-[390px]:h-[300px]! min-[580px]:h-[230px]! md:h-[250px]! lg:h-[300px]! xl:h-[384px]!"
    />
  );
}

export function CrewSection({ className = '' }: { className?: string }) {
  const pathname = usePathname();

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === '/pricing') {
      e.preventDefault();
      const el = document.getElementById('pricing-plans');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };
  return (
    <section className={`w-full px-3! sm:px-6! pt-20! pb-10! sm:py-0! order-1 min-[580px]:order-2 ${className}`}>
      <div className="mx-auto! w-full max-w-[1392px] px-0!">
        <motion.div
          className="pricing-desktop-crew-panel relative flex justify-center min-[580px]:justify-between flex-wrap! min-[580px]:flex-nowrap! overflow-hidden rounded-[32px] bg-[#04005a]"
          initial="initial"
          whileInView="whileInView"
          viewport={localViewport}
          variants={fadeInUp}
          transition={localTransition}
        >
          {/* <div className="pricing-mobile-crew-card hidden" aria-label="Your AI crew works 24/7, even while you sleep.">
          <img
            src={marketingImage('hero-pricing-background')}
            alt=""
            className="pricing-mobile-crew-bg"
            aria-hidden="true"
          />
          <div className="pricing-mobile-crew-overlay" aria-hidden="true" />
          <img
            src="/images/marketing/pricing-figma/crew-decor-left.svg"
            alt=""
            className="pricing-mobile-crew-decor pricing-mobile-crew-decor-left"
            aria-hidden="true"
          />
          <img
            src="/images/marketing/pricing-figma/crew-decor-top.svg"
            alt=""
            className="pricing-mobile-crew-decor pricing-mobile-crew-decor-top"
            aria-hidden="true"
          />
          <img
            src="/images/marketing/pricing/mobile-crew-team-layer.png"
            alt=""
            className="pricing-mobile-crew-team-layer"
            aria-hidden="true"
          />
          <div className="pricing-mobile-crew-copy">
            <h2>Your AI crew works 24/7, even while you sleep.</h2>
            <ArrowLink href="/pricing" className="pricing-mobile-crew-card-cta">
              Become a Founding Member
            </ArrowLink>
          </div>
        </div> */}
          <img
            src={marketingImage('hero-pricing-background')}
            alt=""
            className="absolute inset-0 h-full w-full object-cover pointer-events-none hidden! sm:flex!"
            aria-hidden="true"
          />
          <img
            src={marketingImage('hero-pricing-background-mobile')}
            alt=""
            className="absolute inset-0 h-full w-full object-cover pointer-events-none sm:hidden!"
            aria-hidden="true"
          />
          <img
            src="/images/marketing/pricing-figma/crew-decor-left.svg"
            alt=""
            className="absolute left-[-78px] top-[120px] h-[276px] w-[276px] mix-blend-overlay hidden! sm:flex!"
            aria-hidden="true"
          />
          <img
            src="/images/marketing/pricing-figma/crew-decor-top.svg"
            alt=""
            className="absolute right-[747px] top-[-158px] h-[230px] w-[230px] mix-blend-overlay"
            aria-hidden="true"
          />
          <div className="pricing-crew-copy relative z-10 space-y-10! min-[580px]:space-y-7! sm:space-y-12! md:space-y-10! lg:space-y-14! xl:space-y-20! px-4! py-8! sm:py-6! md:pl-12! lg:pl-16! xl:pl-20! lg:py-10! xl:py-15! order-2 min-[580px]:order-1">
            <h2 className="text-[36px]! min-[580px]:text-[30px]! min-[768px]:text-[40px]! min-[1024px]:text-[44px]! min-[1280px]:text-[52px]! min-[1440px]:text-[60px]! font-medium leading-11! min-[580px]:leading-10! min-[768px]:leading-13! min-[1024px]:leading-14! min-[1280px]:leading-18! tracking-[-1.2px] text-white min-[390px]:max-w-[90%] sm:max-w-none">
              Your AI crew works 24/7, <div className="hidden xl:inline"><br /></div>
              even while you sleep.
            </h2>
            <ArrowLink
              href="/pricing#pricing-plans"
              onClick={handleScroll}
              className="rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold leading-5 text-white shadow-sm w-[249px] h-10!"
            >
              Become a Founding Member
            </ArrowLink>
          </div>
          <CrewConstellation />
        </motion.div>
      </div>
    </section>
  );
}

export default function PricingPage() {
  useEffect(() => {
    if (window.location.hash === '#pricing-plans') {
      const el = document.getElementById('pricing-plans');
      if (el) {
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  return (
    <main className="fh-page pricing-figma">
      <style>{`
        .marketing-shell main.pricing-figma {
          width: 100%;
          overflow-x: hidden;
          background: #ffffff;
          color: #09090b;
        }
        .marketing-shell main.pricing-figma nav {
          position: static;
          height: 80px;
          padding: 0 24px;
          border: 0;
          background: #ffffff;
          backdrop-filter: none;
        }
        .marketing-shell main.pricing-figma nav > div {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          width: 100%;
          max-width: 1392px;
          min-height: 80px;
          margin: 0 auto;
          padding: 0 24px;
          gap: 32px;
        }
        .marketing-shell main.pricing-figma a {
          text-decoration: none;
        }
        .marketing-shell main.pricing-figma nav a.inline-flex,
        .marketing-shell main.pricing-figma a.inline-flex {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px 14px;
          border-radius: 8px;
          line-height: 20px;
        }
        .marketing-shell main.pricing-figma > section {
          width: 100%;
          box-sizing: border-box;
        }
        .marketing-shell main.pricing-figma .pricing-hero-card {
          min-height: 606px;
          width: 100%;
          max-width: 1392px;
          margin-left: auto;
          margin-right: auto;
          padding-top: 104px;
          padding-bottom: 104px; 
          padding-left: 0;
          padding-right: 0;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          box-sizing: border-box;
        }
        .marketing-shell main.pricing-figma .pricing-hero-striped-bg {
          width: 1476px;
          height: 1107px;
          max-width: none;
          left: calc(50% - 749px);
          top: calc(50% - 707.5px);
          pointer-events: none;
        }
        .marketing-shell main.pricing-figma .pricing-hero-sunburst {
          pointer-events: none;
          z-index: 1;
        }
        .marketing-shell main.pricing-figma .pricing-hero-sunburst-left {
          width: 285px;
          height: 285px;
          left: -34px;
          top: 277px;
        }
        .marketing-shell main.pricing-figma .pricing-hero-sunburst-right {
          width: 200px;
          height: 200px;
          left: min(1264px, calc(100% - 128px));
          top: 17px;
        }
        .marketing-shell main.pricing-figma .pricing-hero-content {
          max-width: 704px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .marketing-shell main.pricing-figma h1 {
          margin: 0;
          font-size: 48px;
          line-height: 60px;
          font-weight: 500;
          color: #ffffff;
          text-align: center;
        }
        .marketing-shell main.pricing-figma .pricing-hero-content > p {
          margin-top: 16px;
          font-size: 16px;
          line-height: 24px;
          color: rgba(255,255,255,0.9);
          text-align: center;
        }
        .marketing-shell main.pricing-figma .pricing-hero-offer {
          min-height: 38px;
          padding: 4px;
          gap: 8px;
          border: 0;
          border-radius: 8px;
          background: rgba(233,234,235,0.32);
          box-shadow: 0px 2px 12px rgba(0,0,0,0.08);
          scrollbar-width: none !important;
        }
        .marketing-shell main.pricing-figma .pricing-hero-offer span {
          margin: 0;
          display: inline-flex;
          min-height: 30px;
          align-items: center;
          border-radius: 6px;
          font-size: 12px;
          line-height: 18px;
          white-space: nowrap;
        }
        .marketing-shell main.pricing-figma .pricing-hero-price-pill {
          padding-left: 12px;
          padding-right: 12px;
        }
        .marketing-shell main.pricing-figma .pricing-hero-limited-copy {
          padding-right: 10px;
        }
        .marketing-shell main.pricing-figma .pricing-save-pill {
          padding-left: 12px;
          padding-right: 12px;
        }
        .marketing-shell main.pricing-figma > section > div {
          width: 100%;
          max-width: 1392px;
          margin-left: auto;
          margin-right: auto;
          padding-left: 24px;
          padding-right: 24px;
          box-sizing: border-box;
        }
        .marketing-shell main.pricing-figma .pricing-plans-shell {
          position: relative;
          z-index: 1;
          max-width: 1392px;
          padding-left: 0;
          padding-right: 0;
        }
        .marketing-shell main.pricing-figma .pricing-plans-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -1;
          background: #ffffff;
          border-radius: 32px;
        }
        .marketing-shell main.pricing-figma .pricing-plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          width: 100%;
        }
        .marketing-shell main.pricing-figma [aria-label='Billing cycle'] {
          min-height: 46px;
          padding: 4px;
          gap: 4px;
          border-radius: 10px;
        }
        .marketing-shell main.pricing-figma [aria-label='Billing cycle'] button {
          min-height: 36px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
          line-height: 20px;
        }
        .marketing-shell main.pricing-figma #pricing-plans article {
          padding: 10px;
          border-radius: 32px;
          box-sizing: border-box;
        }
        .marketing-shell main.pricing-figma #pricing-plans article > div:last-child {
          padding: 20px;
          border-radius: 24px;
          box-sizing: border-box;
        }
        .marketing-shell main.pricing-figma #pricing-plans h2 {
          font-size: 24px;
          line-height: 32px;
          font-weight: 500;
        }
        .marketing-shell main.pricing-figma #pricing-plans p,
        .marketing-shell main.pricing-figma #pricing-plans li span:last-child {
          font-size: 16px;
          line-height: 24px;
        }
        .marketing-shell main.pricing-figma #pricing-plans .pricing-savings-line,
        .marketing-shell main.pricing-figma #pricing-plans .pricing-feature-label {
          font-size: 12px;
          line-height: 18px;
        }
        .marketing-shell main.pricing-figma .pricing-benefits-fluted-bg {
          width: 2300px;
          height: 1533px;
          left: calc(50% - 1150px);
          top: calc(50% - 512px);
          max-width: none;
          pointer-events: none;
          z-index: 0;
        }
        .marketing-shell main.pricing-figma .pricing-benefits-ellipse {
          width: 1300px;
          height: 941px;
          max-width: none;
          pointer-events: none;
          z-index: 1;
        }
        .marketing-shell main.pricing-figma .pricing-benefits-ellipse-left {
          left: calc(50% - 910px);
          top: calc(50% - 317px);
        }
        .marketing-shell main.pricing-figma .pricing-benefits-ellipse-right {
          left: calc(50% - 170px);
          top: calc(50% - 767px);
        }
        .marketing-shell main.pricing-figma .pricing-footer-cta-content {
          display: flex;
          width: 100%;
          max-width: 704px;
          margin-left: auto;
          margin-right: auto;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .marketing-shell main.pricing-figma .pricing-footer-cta-content h2,
        .marketing-shell main.pricing-figma .pricing-footer-cta-content p {
          width: 100%;
          text-align: center;
        }
        @media (max-width: 640px) {
          .marketing-shell main.pricing-figma {
            background: #ffffff;
            padding-bottom: 0;
          }
          .marketing-shell main.pricing-figma nav {
            height: 64px;
            min-height: 64px;
            padding: 0 16px;
          }
          .marketing-shell main.pricing-figma nav > div {
            min-height: 64px;
            padding: 0;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }
          .marketing-shell main.pricing-figma .pricing-hero-card {
            min-height: 390px;
            padding: 58px 20px 142px;
            border-radius: 24px;
          }
          .marketing-shell main.pricing-figma .pricing-hero-striped-bg {
            width: 950px;
            height: 713px;
            left: calc(50% - 475px);
            top: -212px;
          }
          .marketing-shell main.pricing-figma .pricing-hero-sunburst-left {
            width: 176px;
            height: 176px;
            left: -57px;
            top: 270px;
          }
          .marketing-shell main.pricing-figma .pricing-hero-sunburst-right {
            width: 156px;
            height: 156px;
            left: auto;
            right: -34px;
            top: -22px;
          }
          .marketing-shell main.pricing-figma .pricing-hero-content {
            max-width: 342px;
            padding: 0;
          }
          .marketing-shell main.pricing-figma .pricing-hero-offer {
            flex-wrap: wrap;
            justify-content: center;
            max-width: 310px;
            gap: 4px;
            margin-bottom: 18px;
            padding: 4px;
            scrollbar-width: none !important;
          }
          .marketing-shell main.pricing-figma .pricing-hero-offer span {
            min-height: 28px;
            font-size: 11px;
            line-height: 16px;
          }
          .marketing-shell main.pricing-figma .pricing-hero-limited-copy {
            padding-left: 8px;
            padding-right: 8px;
          }
          .marketing-shell main.pricing-figma h1 {
            font-size: 36px;
            line-height: 42px;
            letter-spacing: -0.72px;
          }
          .marketing-shell main.pricing-figma .pricing-hero-content > p {
            margin-top: 14px;
            font-size: 15px;
            line-height: 22px;
          }
          .marketing-shell main.pricing-figma .pricing-plans-shell {
            padding: 0;
          }
          .marketing-shell main.pricing-figma .pricing-plans-shell::before {
            inset: -1px;
            border-radius: 25px;
          }
          .marketing-shell main.pricing-figma [aria-label='Billing cycle'] {
            width: 100%;
            max-width: 334px;
            justify-content: center;
          }
          .marketing-shell main.pricing-figma [aria-label='Billing cycle'] button {
            flex: 1;
            padding-left: 10px;
            padding-right: 10px;
          }
          .marketing-shell main.pricing-figma .pricing-save-pill {
            padding-left: 8px;
            padding-right: 8px;
          }
          .marketing-shell main.pricing-figma .pricing-plans-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .marketing-shell main.pricing-figma #pricing-plans article {
            border-radius: 24px;
            padding: 8px;
          }
          .marketing-shell main.pricing-figma #pricing-plans article > div:last-child {
            gap: 24px;
            padding: 18px;
            border-radius: 20px;
          }
          .marketing-shell main.pricing-figma #pricing-plans article > div:last-child > div:first-child {
            gap: 22px;
          }
          .marketing-shell main.pricing-figma #pricing-plans h2 {
            font-size: 22px;
            line-height: 30px;
          }
          .marketing-shell main.pricing-figma #pricing-plans p,
          .marketing-shell main.pricing-figma #pricing-plans li span:last-child {
            font-size: 15px;
            line-height: 22px;
          }
          .marketing-shell main.pricing-figma #pricing-plans article span.text-5xl {
            font-size: 44px !important;
            line-height: 52px !important;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-card {
            position: relative;
            display: block !important;
            width: 100%;
            max-width: 366px;
            height: 590px;
            margin: 0 auto;
            padding: 0 !important;
            border: 1px solid #f1f1f1;
            border-radius: 24px;
            overflow: hidden;
            background: #04005a;
            box-shadow: 0 12px 28px rgba(5, 21, 112, 0.16);
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-bg {
            position: absolute;
            inset: 0;
            z-index: 0;
            width: 100%;
            height: 100%;
            max-width: none !important;
            object-fit: cover;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-overlay {
            position: absolute;
            inset: 0;
            z-index: 1;
            background: linear-gradient(180deg, rgba(5, 0, 98, 0.42) 0%, rgba(7, 45, 188, 0.22) 46%, rgba(221, 246, 255, 0.28) 100%);
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-decor {
            position: absolute;
            z-index: 2;
            pointer-events: none;
            mix-blend-mode: overlay;
            max-width: none !important;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-decor-left {
            left: -104px;
            top: 164px;
            width: 224px;
            height: 224px;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-decor-top {
            right: -70px;
            top: -86px;
            width: 206px;
            height: 206px;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-team-layer {
            position: absolute;
            left: -9px;
            top: -30px;
            z-index: 4;
            display: block;
            width: 389px;
            height: auto;
            max-width: none !important;
            pointer-events: none;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-copy {
            position: absolute;
            left: 24px;
            right: 24px;
            bottom: 50px;
            z-index: 5;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 24px;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-copy h2 {
            max-width: 302px;
            margin: 0;
            color: #fff !important;
            font-size: 36px !important;
            font-weight: 500 !important;
            line-height: 44px !important;
            letter-spacing: -0.72px !important;
          }
          .marketing-shell main.pricing-figma .pricing-mobile-crew-card-cta {
            display: inline-flex;
            min-height: 40px;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 8px;
            background: #2563eb;
            padding: 10px 14px !important;
            color: #fff !important;
            font-size: 14px;
            font-weight: 600;
            line-height: 20px;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
          }
          .marketing-shell:has(main.pricing-figma) .marketing-bottom-combo {
            margin-top: 12px;
            padding-top: 32px;
          }
        }
      `}</style>
      <HeroSection />
      <PricingSection />
      <div className="flex flex-col w-full">
        <BenefitsSection />
        <CrewSection />
      </div>
      <FaqSection />
    </main>
  );
}
