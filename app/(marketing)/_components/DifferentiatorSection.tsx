'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { fadeInUp, staggerContainer } from './shared';

const differentiators = [
    {
        title: 'Specialists, not a generalist',
        copy: 'ChatGPT gives you a blank box. 3rdShift gives you 70+ AI team members who already know what to ask, what to deliver, and how to make it good. You describe the goal. They do the work.',
        image: "/images/landing/bot.png",
    },
    {
        title: 'Your team remembers you',
        copy: 'Every time you use ChatGPT, you start over. Your 3rdShift team remembers your brand, your voice, and what worked last time. No re-explaining. No starting from scratch. Every project is better than the last.',
        image: "/images/landing/brain.png",
    },              
    {
        title: 'Real deliverables, not chat text',
        copy: 'ChatGPT makes you copy, paste, and organize everything yourself. 3rdShift delivers finished work directly to Google Docs, Google Sheets, and Buffer. Articles, lead lists, thumbnails, presentations — ready to use, already where you need them.',
        image: "/images/landing/branch.png",
    },
    {
        title: "Work gets done while you're offline",
        copy: "Your 3rdShift team works around the clock. Content gets written, leads get pulled, reports get built — even at 3am. No waiting on freelancers. No time zones. Just work, done.",
        mobileCopy:
            "Your 3rdShift team is available 24/7. Set a schedule and your content gets written, leads get pulled, reports get built — all while you're offline. No waiting on freelancers. No time zones. Just work, done.",
        image: "/images/landing/work.png",
    },
];

export function DifferentiatorSection() {
    return (
        <motion.section
            className="fh-section fh-dark-panel bg-cover! bg-no-repeat! pt-8.5! pb-10! sm:py-15! lg:bg-[url('/images/landing/workflowInnerBg.png')]"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
        >
            <motion.div className="fh-badge text-[#3D3D3D]! lg:text-white!" variants={fadeInUp}>
                <span />
                WHY 3RDSHIFT
            </motion.div>
            <motion.h2 className='text-[36px]! sm:text-[40px]! md:text-[48px]! font-medium! text-black! lg:text-white! mb-4! lg:mb-15! leading-11! sm:leading-13! md:leading-15! text-center! max-w-none!' variants={fadeInUp}>This is not ChatGPT with a logo on it.</motion.h2>
            <motion.p className="fh-mobile-values-subtitle text-base! flex! lg:hidden! mb-10! text-[#3D3D3D]! text-center!" variants={fadeInUp}>From automation to insights, everything works seamlessly in</motion.p>
            <div className="bg-[#F5F5F5]! lg:bg-[#F2F2F280]! border border-[#E4E7EC80]! p-2.5! rounded-4xl!">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {differentiators.map(({ title, copy, mobileCopy, image }) => (
                        <motion.article
                            key={title}
                            className="bg-white! p-5! border! border-zinc-200! rounded-3xl! group hover:shadow-md transition duration-300"
                            variants={fadeInUp}
                        >
                            <Image
                                className="mb-10! group-hover:scale-110 transition duration-300"
                                src={image}
                                alt={title}
                                width={40}
                                height={40}
                            />

                            <h3 className="text-2xl! text-zinc-950! text-left! group-hover:text-blue-500! transition duration-300">
                                {title}
                            </h3>

                            {/* Desktop */}
                            <p className="hidden sm:block mt-1! text-base! sm:text-lg! text-zinc-500! text-left!">
                                {copy}
                            </p>

                            {/* Mobile */}
                            <p className="block sm:hidden mt-1! text-base! text-zinc-500! text-left!">
                                {mobileCopy || copy}
                            </p>
                        </motion.article>
                    ))}
                </div>
            </div>
        </motion.section>
    );
}
