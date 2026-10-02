'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { Badge, fadeInUp, staggerContainer } from './shared';

const solutionCheckCards = [
    'Results that match your business. Not cookie-cutter AI.',
    'Not just writing. Audio, video, and design too.',
];

export function SolutionSection() {
    return (
        <motion.section
            className="fh-section fh-solution lg:px-20! lg:border! lg:border-[#F1F1F1]! lg:rounded-4xl!"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={staggerContainer}
        >
            <motion.div variants={fadeInUp}>
                <Badge>SOLUTION</Badge>
            </motion.div>
            <motion.h2
                className='text-zinc-950! text-4xl! sm:text-5xl! mx-auto! text-center! leading-[50px]! sm:leading-[60px]! font-medium! mb-10! sm:mb-[60px]!'
                variants={fadeInUp}
            >
                What if the work just... got done?
            </motion.h2>
            <motion.div className='bg-[#F5F5F5] p-2.5! rounded-4xl border border-zinc-200' variants={fadeInUp}>
                <div
                    className="
           px-1.5! sm:px-5! py-10!
            flex flex-col items-center justify-center
            text-white rounded-3xl
            bg-no-repeat bg-cover bg-center
            bg-[url('/images/landing/solutionMobileBg.png')]
            md:bg-[url('/images/landing/solutionBg.png')]
          "
                >
                    <p className='text-2xl! md:text-[30px]! font-medium mb-4! text-center'>You describe the task. A trained AI team member picks it up. The work is done in 60 seconds or less. Formatted. Ready to use.</p>
                    <div className="flex gap-4 items-center">
                        <p className='text-2xl sm:text-[30px] font-medium'>That's</p>
                        <Image src="/logo-white.png" width={92} height={40} alt='white logo image' />
                    </div>
                </div>
                <div className="fh-solution-check-grid grid-cols-1! md:grid-cols-2!" aria-label="3rdShift removes common freelancer and assistant friction">
                    {solutionCheckCards.map((copy) => (
                        <motion.div
                            className=" fh-solution-check-card
                  flex-wrap! min-[390px]:flex-nowrap!
                  min-h-0!
                  group
                  items-start! sm:items-center!
                  rounded-2xl! md:rounded-3xl!
                  transition-all duration-300 ease-out
                  hover:bg-white
                  hover:shadow-lg
                  hover:-translate-y-1
                  hover:border-zinc-300"
                            key={copy}
                            variants={fadeInUp}
                        >
                            <span className="  fh-solution-check-icon
                  flex-none!
                  transition-all duration-300
                  size-6! sm:size-8! md:size-11!
                  group-hover:scale-105
                  group-hover:bg-green-500" aria-hidden="true">
                                <Check className=" size-4! sm:size-5! md:size-6!
    transition-colors duration-300
    group-hover:text-white" strokeWidth={2} />
                            </span>
                            <span className='text-zinc-950! text-lg! mdlg:text-xl! xl:text-[23px]! '>{copy}</span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </motion.section>
    );
}
