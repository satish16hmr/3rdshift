'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Badge, fadeInUp, staggerContainer } from './shared';

export function WorkflowSection() {
    return (
        <motion.section
            className="fh-section fh-light-panel fh-workflow-section bg-cover! bg-bottom-right! bg-no-repeat! hidden! xl:block!"
            style={{ backgroundImage: "url('/images/landing/workflowBg.png')" }}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
        >
            <motion.div variants={fadeInUp}>
                <Badge>WORKFLOW &amp; INTEGRATION</Badge>
            </motion.div>
            <motion.h2 variants={fadeInUp}>Your Workflow, Fully Connected</motion.h2>
            <div className="bg-[#F5F5F5]! p-2.5! rounded-4xl border border-[#E4E7EC]">

                {/* Top — Workflow hero card */}
                <motion.div
                    className="fh-workflow-asset text-white rounded-3xl! h-134! p-10! flex flex-col justify-center relative overflow-hidden bg-top!"
                    style={{ backgroundImage: "url('/images/landing/workflowInnerBg.png')" }}
                    variants={fadeInUp}
                >
                    {/* Gradient overlay */}
                    <div
                        className="absolute -right-20 -bottom-20 z-10 w-[591px] h-[230px] blur-2xl!"
                        style={{
                            background: "linear-gradient(238.02deg, #0F19A800, #091155)",
                            transform: "rotate(180deg)"
                        }}
                    />

                    {/* Content */}
                    <div className="relative z-20">
                        <p className='text-[30px]! font-medium! mb-3!'>
                            Your Workflow, Set It Once.<br /> Let Your AI Team Run It.
                        </p>
                        <p className='text-base! text-[#F2F2F2]!'>
                            Schedule your tasks and let your AI team keep things moving 24/7,<br />
                            collaborating and executing even while you sleep.
                        </p>
                    </div>

                    {/* Workflow image */}
                    <Image
                        src="/images/landing/workflowSider.png"
                        alt='workflowSider'
                        width={600}
                        height={600}
                        className='absolute right-0 bottom-0 z-5'
                    />
                </motion.div>

                {/* Bottom — Two cards side by side */}
                <div className="flex gap-2.5 mt-2.5!">

                    {/* Left — Connect Once */}
                    <motion.div
                        className="bg-white border border-zinc-200 rounded-3xl px-5! py-10! flex flex-col gap-4 overflow-hidden w-105.5 h-134 relative"
                        variants={fadeInUp}
                    >
                        <div
                            className="absolute right-0 -top-10 z-10 w-100 h-100 blur-2xl!"
                            style={{
                                background: "linear-gradient(238.02deg, #FFFFFF80, #FFFFFF80)",
                                transform: "rotate(180deg)"
                            }}
                        />
                        <div className='relative z-50'>
                            <h3 className="text-[29px] font-medium text-zinc-950 leading-snug mb-3">
                                Connect Once, Stop<br /> Switching Between Tools
                            </h3>
                            <p className="text-base text-zinc-500">
                                Connect everything once and let your AI team handle the work across apps for you.
                            </p>
                        </div>

                        <Image
                            src="/images/landing/connect.png"
                            alt="Integration tools"
                            fill
                            className="object-contain object-bottom-left absolute bottom-0 left-0 px-2!"
                        />
                    </motion.div>

                    {/* Right — AI Team */}
                    <motion.div
                        className="bg-white border border-zinc-200 rounded-3xl p-10! flex flex-col gap-4 overflow-hidden h-134 relative w-[calc(100%-422px)]"
                        variants={fadeInUp}
                    >
                        {/* Avatars background */}
                        <Image
                            src="/images/landing/aiTeam.png"
                            alt="70+ AI specialists"
                            fill
                            className="object-cover object-bottom-right z-1"
                        />

                        {/* Dark gradient fade from left so text is readable */}
                        <div
                            className="absolute -left-65 -bottom-17.5 z-10 w-147.75 h-125 blur-3xl"
                            style={{
                                background: "radial-gradient(circle, #FFFFFF95, #FFFFFF95)",
                            }}
                        />

                        <div
                            className="absolute -right-95 bottom-5 z-10 w-147.75 h-125 blur-3xl"
                            style={{
                                background: "radial-gradient(circle, #FFFFFF90, #FFFFFF90",
                            }}
                        />

                        {/* Text */}
                        <div className="relative z-20">
                            <p className='text-[30px]! font-medium! mb-3!'>
                                Your 70+ AI Team,<br /> Ready When You Are
                            </p>
                            <p className='text-base! text-zinc-500!'>
                                Pick from 70+ AI team members across marketing, writing, and more.<br />
                            </p>
                        </div>
                    </motion.div>

                </div>
            </div>
        </motion.section>
    );
}
