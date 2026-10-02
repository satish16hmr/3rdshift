'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge, fadeInUp, staggerContainer } from './shared';

const comparisonRows = [
    ['Blog posts', 'Freelancer: $150/each', 'Included.'],
    ['Email sequences', 'Agency: $2,000/mo', 'Included.'],
    ['Lead research', 'VA: $1,500/mo', 'Included.'],
    ['Social content', 'Freelancer: $500/mo', 'Included.'],
    ['Presentations', 'Agency: $300/each', 'Automatic'],
    ['Turnaround time', '2–5 business days', '60 seconds.'],
    ['Revisions', 'Extra charges', 'Instant re-runs.'],
    ['Availability', 'Business hours only', '24/7/365.'],
];

export function PricingSection() {
    const router = useRouter();

    return (
        <motion.section
            className="fh-section fh-pricing pt-1! pb-11.5! sm:pb-15! sm:pt-25! bg-white!"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={staggerContainer}
        >
            <motion.div variants={fadeInUp}>
                <Badge>PRICING</Badge>
            </motion.div>
            <motion.h2 className='text-[36px]! sm:text-[40px]! md:text-[48px]! font-medium! text-zinc-950! mb-10! leading-15!' variants={fadeInUp}>The math is simple.</motion.h2>
            <div className="w-full! max-w-207! mx-auto!">
                {/* Main table card */}
                <motion.div className="bg-[#F5F5F5]! p-2.5! rounded-4xl border border-[#E4E7EC]" variants={fadeInUp}>
                    <div className="rounded-2xl border border-zinc-300 overflow-hidden bg-white">
                        {/* Header row */}
                        <div className="grid grid-cols-3 border-b border-zinc-300">
                            <div className="px-2! py-6! md:p-6! h-16 sm:h-23.5" />
                            <div className="px-2! py-6! md:p-6! h-16 sm:h-23.5 border-l border-zinc-300 flex items-center justify-center">
                                <span className="text-base font-semibold text-zinc-900">Before</span>
                            </div>
                            <div className="px-2! py-6! md:p-6! h-16 sm:h-23.5 border-l border-zinc-300 flex items-center justify-center bg-[#F5F8FF]">
                                {/* 3rdShift Logo */}
                                <Image src="/images/logo.png" alt="3rdShift" width={92} height={40} className='h-7! sm:h-8! md:h-9! lg:h-10! w-auto!' />
                            </div>
                        </div>

                        {/* Data rows */}
                        {comparisonRows.map(([task, before, after], index) => (
                            <div
                                key={task}
                                className={`grid grid-cols-3 ${index < comparisonRows.length - 1 && 'border-b border-zinc-300'}`}
                            >
                                <div className="px-2! md:px-6! py-3.5! md:py-4! flex items-center min-w-0">
                                    <span className="text-xs sm:text-sm md:text-base font-medium text-zinc-950 whitespace-normal break-all">{task}</span>
                                </div>
                                <div className="px-2! md:px-6! py-3.5! md:py-4! border-l border-zinc-300 flex items-center justify-center min-w-0">
                                    <span className="text-xs sm:text-sm md:text-base text-[#525252] sm:text-zinc-950 text-center whitespace-normal break-all">
                                        {before}
                                    </span>
                                </div>
                                <div className="px-2! md:px-6! py-4.50! border-l border-zinc-300 flex items-center justify-center bg-[#F5F8FF] min-w-0">
                                    <span className="text-xs sm:text-sm md:text-base font-medium text-blue-500 whitespace-normal break-all">{after}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* CTA footer card */}
                    <div className="mt-2.5! rounded-3xl border border-zinc-200 bg-white p-5! sm:p-6! flex flex-wrap items-center justify-between gap-7.5 sm:gap-4">
                        <div>
                            <p className="text-lg sm:text-xl font-medium text-zinc-950 mb-1.5! text-left!">Starting at $29/mo.</p>
                            <p className="text-sm sm:text-base text-zinc-500 text-left!">
                                Most customers replace $2,000 to $8,000<br />in monthly freelancer and VA costs.
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => { router.push("/pricing") }}
                            className="w-[123px]! md:w-47.75! h-10!"
                        >
                            <div className="md:hidden block">Try it now</div> <div className="hidden md:block">Get Founder Pricing</div> →
                        </Button>
                    </div>
                </motion.div>
            </div>
        </motion.section>
    );
}
