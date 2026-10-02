'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Plan {
  id: string;
  name: string;
  anchorPrice: string;
  annualPrice: string;
  monthlyPrice: string;
  annualSavings: string;
  monthlySavings: string;
  description: string;
  features: string[];
  featured?: boolean;
}

interface PlanCardProps {
  plan: Plan;
  billingCycle: string;
  loadingPlan: string | null;
  startCheckout: (planId: string, billingCycle: string) => void;
}

const PlanCard = ({
  plan,
  billingCycle,
  loadingPlan,
  startCheckout,
}: PlanCardProps) => {
  const price =
    billingCycle === 'annual'
      ? plan.annualPrice
      : plan.monthlyPrice;

  const savings =
    billingCycle === 'annual'
      ? plan.annualSavings
      : plan.monthlySavings;

  const priceNum = price.replace('$', '');

  const cardBg = plan.featured
    ? 'bg-gradient-to-b from-[#E0F2FE]/40 via-[#F0F9FF]/20 to-white/10'
    : 'bg-white';

  return (
    <div
      className={`flex-1 p-5 flex flex-col rounded-3xl border border-zinc-200 ${cardBg} relative overflow-hidden z-20`}
      style={
        plan.featured
          ? {
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4), rgba(255,255,255,0.7)), url("/images/onboarding/planBg.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }
          : undefined
      }
    >
      {plan.featured && (
        <div className="absolute -left-24 top-32 size-[600px] rounded-full bg-white blur-2xl z-10" />
      )}

      <div className="relative z-20">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-medium text-zinc-950">
            {plan.name}
          </h2>

          {plan.featured && (
            <span className="bg-white text-blue-600 px-2.5 h-9 rounded-md font-medium border border-sky-100 text-sm sm:text-base flex items-center">
              Best Seller
            </span>
          )}
        </div>

        <p className="mt-4 text-base text-zinc-500 min-h-10 leading-relaxed">
          {plan.description}
        </p>

        <div className="mt-6 flex items-baseline">
          <span className="text-base font-bold text-zinc-400 line-through mr-2">
            {plan.anchorPrice}
          </span>

          <span className="text-4xl xl:text-5xl font-medium text-zinc-950">
            ${priceNum}
          </span>

          <span className="text-base text-zinc-400 ml-1">
            /month
          </span>
        </div>

        <p className="mt-3 text-xs font-medium text-blue-500">
          {billingCycle === 'annual' ? `Annual billing savings: ${savings}` : 'Billed monthly via Stripe. Cancel anytime.'}
        </p>
        {billingCycle === 'annual' && (
          <p className="mt-1 text-xs text-zinc-500">
            Billed annually (${Number(priceNum.replace(/,/g, '')) * 12}/yr)
          </p>
        )}
      </div>

      <div className={`relative z-20 ${plan.featured ? '-mt-1' : ''}`}>
        <Button
          variant={plan.featured ? 'primary' : 'outline'}
          onClick={() => startCheckout(plan.id, billingCycle)}
          disabled={!!loadingPlan}
          className="my-8 w-full min-w-50! h-10!"
        >
          {loadingPlan === plan.id
            ? 'Opening checkout...'
            : 'Become a Founding Member'}
        </Button>
      </div>

      <div className="relative z-20">
        <div className="flex items-center gap-4">
          <div className="h-px bg-zinc-400 flex-1" />

          <span className="text-xs tracking-wider text-zinc-500 font-medium whitespace-nowrap">
            What you will get
          </span>

          <div className="h-px bg-zinc-400 flex-1" />
        </div>

        <ul className="mt-4 space-y-3.5 text-sm">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-3"
            >
              <span className="flex items-center justify-center size-5 rounded-full bg-blue-500 text-white flex-shrink-0">
                <Check className="size-3" />
              </span>

              <span className="text-zinc-500 font-normal text-base">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PlanCard;