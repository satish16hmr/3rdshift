'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Badge, fadeInUp, staggerContainer } from './shared';

export function FounderSection() {
    return (
        <motion.section
            className="fh-section fh-founder"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={staggerContainer}
        >
            <motion.div variants={fadeInUp}>
                <Badge>FOUNDER</Badge>
            </motion.div>
            <motion.h2 className='text-[36px]! sm:text-[40px]! md:text-[48px]! font-medium! text-zinc-950! mb-7! sm:mb-8! md:mb-10! leading-12! sm:leading-13! md:leading-15!' variants={fadeInUp}>Built by a founder<br /> who runs two companies with zero employees.</motion.h2>
            <motion.div className="bg-[#F5F5F5]! p-2.5! rounded-4xl border border-[#E4E7EC] relative" variants={fadeInUp}>
                <div className="bg-white! p-5! sm:p-6! md:p-7! lg:p-8! rounded-3xl border border-[#E4E7EC]">
                    <p className='text-[#0A0A0A]! sm:text-zinc-950! text-[20px]! sm:text-[22px]! md:text-[24px]! lg:text-[30px]! mb-10! text-left! font-medium! sm:font-normal!'>"I replaced a $2,000/month VA and three freelancers with 3rdShift.<br />I run two companies with zero employees."</p>
                    <p className='text-[#0A0A0A]! sm:text-zinc-950! text-xs! sm:text-base! md:text-xl! mb-0.5! text-left font-medium! sm:font-normal!'>Josh Rager</p>
                    <p className='text-zinc-500! text-xs! sm:text-sm! md:text-base! text-left'>Founder</p>
                </div>
                <Image src="/images/landing/quote.png" alt="quote" width={128} height={128} className='absolute right-4 bottom-4 sm:right-6 sm:bottom-6' />
            </motion.div>
        </motion.section>
    );
}
