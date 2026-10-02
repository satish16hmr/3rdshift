'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge, fadeInUp, staggerContainer } from './shared';

const problemRows = [
    ['Doing It Yourself', "You're the marketer, the designer, the copywriter, the social media manager, and the CEO. Everything gets started. Nothing gets finished."],
    ['ChatGPT', 'You tried AI. Generic text, no voice, no structure. You still did all the work.'],
    ['Freelancers & Agencies', '$3,000 minimum. Someone else did the work. The invoice was higher than the quote.'],
];

export function ProblemSection() {
    return (
        <motion.section
            id="about"
            className="fh-section pt-28! pb-20! sm:py-[60px]!"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={staggerContainer}
        >
            <motion.div variants={fadeInUp}>
                <Badge>THE PROBLEM</Badge>
            </motion.div>
            <motion.h2
                className='text-zinc-950! text-4xl! sm:text-5xl! max-w-lg! mx-auto! text-center! sm:leading-[60px]! font-medium!'
                variants={fadeInUp}
            >
                You already know the old way <span className='text-[#F04438]!'>isn't working.</span>
            </motion.h2>
            <div className="fh-problem-list">
                {problemRows.map(([label, copy]) => (
                    <motion.div
                        className="fh-problem-row px-0! sm:px-2!"
                        key={label}
                        variants={fadeInUp}
                    >
                        <strong className='text-xl! md:text-2xl!'>{label}:</strong>
                        <span className='text-xl! md:text-2xl!'>{copy}</span>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    );
}
