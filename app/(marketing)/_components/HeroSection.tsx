'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { marketingImage, staggerContainer, fadeInUp } from './shared';
import HeroUserPng from '@/public/images/marketing/banner/heroUser.png';
import HeroUserCardPng from '@/public/images/marketing/banner/heroUserCard.png';

export function HeroSection() {
    const router = useRouter();
    return (
        <motion.section
            className="fh-hero max-w-[calc(100%-24px)]! mx-auto! 2xl:max-w-348!"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={staggerContainer}
        >
            <img src={marketingImage('hero-background')} alt="" className="fh-hero-bg rounded-2xl! h-[659px]! lg:h-auto!" aria-hidden="true" />
            <span className="fh-hero-burst fh-hero-burst-top opacity-[0.3]! hidden! xl:flex!" aria-hidden="true" />
            <span className="fh-hero-burst fh-hero-burst-left hidden! xl:flex!" aria-hidden="true" />
            <span className="fh-hero-clover opacity-[0.3]! hidden! xl:flex!" aria-hidden="true" />
            <motion.div
                variants={{
                    initial: { opacity: 0, x: -50 },
                    whileInView: { opacity: 1, x: 0, transition: { duration: 0.8, delay: 0.2 } }
                }}
                className='absolute top-[23%] left-[6%] z-10 hidden! xl:flex!'
            >
                <Image src={HeroUserPng} alt='hero-user' width={180} height={232} />
            </motion.div>
            <motion.div
                variants={{
                    initial: { opacity: 0, x: 50 },
                    whileInView: { opacity: 1, x: 0, transition: { duration: 0.8, delay: 0.4 } }
                }}
                className='absolute top-[23%] right-[1%] z-10 hidden! xl:flex!'
            >
                <Image src={HeroUserCardPng} alt='hero-user-card' height={147} width={244} />
            </motion.div>
            <div className="fh-hero-content">
                <motion.div
                    className="fh-hero-pill overflow-auto! mb-4!"
                    style={{ maxWidth: '-webkit-fill-available' }}
                    variants={{
                        initial: { opacity: 0, scale: 0.8 },
                        whileInView: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
                    }}
                >
                    <span>Limited spots</span>
                    <p className='text-xs'>Now accepting founding members.</p>
                </motion.div>
                <motion.h1
                    className='text-6xl font-medium max-w-xl mx-auto leading-[72px]'
                    variants={fadeInUp}
                >
                    Your entire team, for $29 a month.
                </motion.h1>
                <motion.p
                    className='mt-2 text-sm text-[#F2F2F2]'
                    variants={fadeInUp}
                >
                    Billed annually ($348/yr)
                </motion.p>
                <motion.p
                    className='text-xl leading-[30] text-[#F2F2F2]'
                    variants={{
                        initial: { opacity: 0, y: 20 },
                        whileInView: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.2 } }
                    }}
                >
                    70+ AI-powered team members. Content, sales, research, design, admin, and more. Each one trained for a single job. Results in 60 seconds. No managing required.
                </motion.p>
                <motion.div
                    variants={{
                        initial: { opacity: 0, y: 20 },
                        whileInView: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.3 } }
                    }}
                >
                    <Button variant='primary' onClick={() => router.push('/pricing#pricing-plans')} className='px-4! border-0! mt-15! sm:mt-10! mb-6! sm:mb-2.5! h-10!'>Become a Founding Member <span>→</span></Button>
                </motion.div>
                <motion.small
                    className='text-[#F2F2F2] mt-0!'
                    variants={{
                        initial: { opacity: 0 },
                        whileInView: { opacity: 1, transition: { duration: 0.6, delay: 0.5 } }
                    }}
                >
                    Replaces $2,000+/mo in freelancers and virtual assistants.
                </motion.small>
            </div>
            <motion.div
                className='p-1.5! md:p-4! border border-[#E4E7EC] rounded-[20px] bg-white/28 max-w-[calc(100%-16px)] sm:max-w-[calc(100%-48px)] xl:max-w-[1184px]! mx-auto! mt-12! sm:mt-[63px]! relative! z-20'
                variants={{
                    initial: { opacity: 0, y: 40 },
                    whileInView: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.4 } }
                }}
            >
                <img src={marketingImage('dashboard-mockup')} alt="3rdShift dashboard mockup" className="rounded-xl xl:max-w-[1150px]! m-auto!" />
                <div className="bg-white h-[98px] w-[130%] blur-[30px] z-30 absolute -bottom-10 -left-[70px] sm:hidden"></div>
                <div className="bg-white h-[118px] w-[130%] blur-[30px] z-30 absolute -bottom-10 -left-[70px] hidden sm:flex"></div>
            </motion.div>
            <span className="fh-dashboard-fade" aria-hidden="true" />
        </motion.section>
    );
}
