'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge, fadeInUp, staggerContainer } from './shared';

import { becomeFoundingMember } from '@/lib/pricing';

const faqs = [
    {
        question: 'What exactly are "AI-powered team members"?',
        answer: 'Specialized AI team members, each trained for one specific job. Ava writes articles. Lenny finds leads. Reed designs thumbnails. You describe what you need, they deliver finished work in 60 seconds. Not a chatbot — a team that does the work for you.',
    },
    {
        question: 'How is this different from ChatGPT or other AI tools?',
        answer: 'ChatGPT gives you a blank box. 3rdShift gives you 70+ AI team members who already know what to ask, what to deliver, and how to format it. They remember your brand, your voice, and what worked last time. And they deliver directly to Google Docs, Sheets, and Buffer — not a chat window.',
    },
    {
        question: "What's included in each plan?",
        answer: 'Starter ($39/mo, or $29/mo billed annually): 200 light tasks/mo, 40 team members. Pro ($99/mo, or $79/mo billed annually): 500 light tasks, 50 heavy credits, all 70+ team members, 3 workspaces. Operator ($249/mo, or $199/mo billed annually): 1,250 light tasks, 150 heavy credits, 2 seats, 10 workspaces.',
    },
    {
        question: 'What does "founding member" mean?',
        answer: "You lock in the lowest price we'll ever offer. If prices go up, yours stays the same forever. Cancel and the founding rate is gone permanently.",
    },
    {
        question: 'Can I cancel anytime?',
        answer: 'Yes. No contracts, no fees. Cancel in two clicks from your billing page. Your plan stays active through the end of your billing period.',
    },
    {
        question: 'Is my data safe?',
        answer: "Yes. We don't train on your data. Your inputs and outputs are yours. Encryption in transit and at rest. No third-party data sharing.",
    },
];

export function FaqSection() {
    const router = useRouter();
    const pathname = usePathname();
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <motion.section
            className="fh-section fh-faq py-0! sm:pt-14! pb-3! sm:pb-16!"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={staggerContainer}
        >
            <div id="faq" className="fh-faq-card p-0! lg:p-20! inline-block!">
                <div className="bg-[#F5F5F5]! p-2.5! rounded-4xl border border-[#E4E7EC] relative grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    <motion.div className="fh-faq-intro bg-white! border! border-zinc-200! rounded-2xl! h-full! py-10! sm:py-[55px]!" variants={fadeInUp}>
                        <Badge>FAQ</Badge>
                        <h2 className='text-left! text-[32px] sm:text-[36px]! md:text-[40px]! lg:text-[48px]! font-medium! text-zinc-950! leading-11! sm:leading-13! md:leading-15!'>Questions<br /> you probably have.</h2>
                        <p className='text-zinc-500! text-base! mb-5!'>No contracts, Cancel anytime.</p>
                        <Button onClick={() => becomeFoundingMember(router, pathname)} className="fh-faq-contact mt-0! text-xs! sm:text-sm!">
                            <span>Become a Founding Member</span>
                            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                        </Button>
                    </motion.div>
                    <div className="fh-faq-list gap-2.5! mt-0! lg:mt-2.5!">
                        {faqs.map((faq, index) => {
                            const isOpen = openIndex === index;
                            return (
                                <motion.div
                                    className={`fh-faq-item hover:shadow-md! transition! duration-300! min-h-17.5! ${isOpen ? 'is-open' : ''}`}
                                    key={faq.question}
                                    variants={fadeInUp}
                                >
                                    <button
                                        type="button"
                                        className="fh-faq-question rounded-3xl! p-5! min-h-17.5!"
                                        aria-expanded={isOpen}
                                        aria-controls={`fh-faq-answer-${index}`}
                                        onClick={() => setOpenIndex(isOpen ? -1 : index)}
                                    >
                                        <span className='text-base! sm:text-lg! md:text-xl! font-medium!'>{faq.question}</span>
                                        <svg className="fh-faq-chevron" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                    <div id={`fh-faq-answer-${index}`} className="fh-faq-answer -mt-2! text-base! text-[#0A0A0A]!" aria-hidden={!isOpen}>
                                        <div>
                                            <p>{faq.answer}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.section>
    );
}
