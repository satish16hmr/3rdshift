'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
    BarChart3,
    Briefcase,
    DollarSign,
    FileSpreadsheet,
    FileText,
    Headphones,
    Megaphone,
    Palette,
    PenTool,
    Search,
    Users,
    Video,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from './shared';

const categories = [
    { title: 'Content', copy: 'Articles, newsletters, social posts, and scripts all written in your voice, ready to publish.', Icon: FileText },
    { title: 'Research & Strategy', copy: 'Market research, competitor analysis, trend reports, and pricing strategies. The data behind your decisions.', Icon: Search },
    { title: 'Video', copy: 'Product videos, b-roll, ad creatives, and scene direction. Ready-to-post clips in minutes.', Icon: Video },
    { title: 'Writing & Copy', copy: 'Marketing emails, ad copy, landing pages, and proposals. Words that convert.', Icon: PenTool },
    { title: 'Data & Analytics', copy: 'Reports, dashboards, spreadsheets, and data analysis. Your numbers, organized and clear.', Icon: BarChart3 },
    { title: 'Sales and Lead Gen', copy: 'Qualified leads, outreach emails, and sales copy. Your pipeline, filled.', Icon: DollarSign },
    { title: 'Social Media', copy: 'Posts, threads, captions, and content calendars. Every platform, consistent.', Icon: Users },
    { title: 'Documents & Reports', copy: 'Case studies, press releases, proposals, and formal documents. Structured and professional.', Icon: FileSpreadsheet },
    { title: 'Audio and Voice', copy: 'Voiceovers, transcription, dubbing, and sound effects. Studio-quality audio, no studio needed.', Icon: Headphones },
    { title: 'Marketing', copy: 'Ad campaigns, brand voice, review responses, and e-commerce strategy. Growth, handled.', Icon: Megaphone },
    { title: 'Design & Creative', copy: 'Logos, thumbnails, social graphics, and product visuals. Scroll-stopping creative.', Icon: Palette },
    { title: 'Recruiting & HR', copy: 'Job descriptions, interview questions, resumes, cover letters, and onboarding docs. Hiring, simplified.', Icon: Briefcase },
];

export function TeamSection() {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(0);

    return (
        <motion.section
            className="fh-section fh-team xl:border xl:border-[#F1F1F1] rounded-4xl px-3! xl:p-20! xl:my-20!"
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={staggerContainer}
        >
            <div className="bg-[#F5F5F5]! p-2.5! rounded-4xl border border-[#E4E7EC]">
                <motion.div
                    className="p-4! sm:px-11! sm:py-[55px]! text-white rounded-3xl bg-no-repeat relative text-left! bg-cover bg-center bg-[url('/images/landing/solutionMobileBg.png')] lg:bg-[url('/images/landing/teamBg.png')] "
                    variants={fadeInUp}
                >
                    <div className="fh-team-label">
                        <span aria-hidden="true" />
                        <span>AI Team Members</span>
                    </div>
                    <h2 className='my-4! text-[36px]! font-medium! text-white! text-left!'>70+ team members. 14 categories. One platform.</h2>
                    <p className='mb-4! sm:mb-6! md:mb-8! lg:mb-10! text-sm! sm:text-base! md:text-lg! lg:text-xl! xl:text-2xl! text-left!'>Plus: HR, admin, finance, marketing, technical, and more.</p>
                    <Button variant="primary" className='h-7! sm:h-9! px-2! sm:px-0! w-fit! sm:w-54! border-blue-500! text-[11px]! sm:text-sm!' onClick={() => router.push("/workers")}>See all 70+ team members →</Button>
                    <Image src="/images/landing/teamSider.png" alt="" className="fh-team-hero-cluster right-10! hidden! xl:flex!" aria-hidden="true" width={344} height={180} />
                </motion.div>
                <div className="fh-category-grid grid-cols-1! min-[390px]:grid-cols-2! md:grid-cols-3! my-2.5! md:mt-3! md:mb-0! p-0!">
                    {categories.map(({ title, copy, Icon }, index) => {
                        const isHiddenOnMobile =
                            (currentPage === 0 && index >= 6) ||
                            (currentPage === 1 && index < 6);

                        return (
                            <motion.article
                                className={`fh-category-card hover:shadow-md transition duration-300 group rounded-2xl! sm:rounded-3xl! px-3! py-4! border-0! ${isHiddenOnMobile ? 'hidden md:block!' : 'block'
                                    }`}
                                key={title}
                                variants={fadeInUp}
                            >
                                <Icon className="mb-7.5! sm:mb-8.5! md:mb-10! group-hover:scale-110 transition duration-300 size-6! sm:size-8! text-blue-500" aria-hidden="true" strokeWidth={2.4} />
                                <h3 className='text-base! sm:text-lg! md:text-xl! lg:text-2xl! text-zinc-950! font-normal! mb-0.5! sm:mb-1!'>{title}</h3>
                                <p className='text-sm! sm:text-base! text-zinc-500! font-normal! mt-0!'>{copy}</p>
                            </motion.article>
                        );
                    })}
                </div>

                <div className="grid! md:hidden! grid-cols-3! gap-1.5!">
                    <button
                        type="button"
                        onClick={() => setCurrentPage(0)}
                        className={`bg-white rounded-lg h-10! flex items-center justify-center hover:bg-zinc-50 transition active:scale-98 ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        disabled={currentPage === 0}
                    >
                        <span className="text-[#111113] text-lg">←</span>
                    </button>

                    <div className="bg-white rounded-lg h-10! flex items-center justify-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-sm transition-all duration-200 ${currentPage === 0 ? 'bg-[#BABABA] scale-110' : 'bg-[#EFEFEF]'}`} />
                        <span className={`h-2.5 w-2.5 rounded-sm transition-all duration-200 ${currentPage === 1 ? 'bg-[#BABABA] scale-110' : 'bg-[#EFEFEF]'}`} />
                    </div>

                    <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        className={`bg-white rounded-lg h-10! flex items-center justify-center hover:bg-zinc-50 transition active:scale-98 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        disabled={currentPage === 1}
                    >
                        <span className="text-[#111113] text-lg">→</span>
                    </button>
                </div>
            </div>
        </motion.section>
    );
}
