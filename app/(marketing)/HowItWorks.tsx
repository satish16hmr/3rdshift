// Place Visual.png, Visual__1_.png, Visual__2_.png in your /public folder
// and update the src paths below accordingly.

import Image from "next/image";
import { Badge, fadeInUp, staggerContainer } from "./_components/shared";
import { motion } from "framer-motion";


const howSteps = [
  {
    eyebrow: "STEP-1",
    title: "Pick a team member.",
    copy: "Choose from 70+ AI team members across content, sales, research, design, video, and more. Need an article, cold email sequence, or competitor research? Your team can do it all!",
    image: "/images/landing/automationTeam.png",
    alt: "Pick a team member",
  },
  {
    eyebrow: "STEP-2",
    title: "Describe the task.",
    copy: "Tell them what you need. Add context about your brand, your audience, your goals. They remember everything for next time.",
    image: "/images/landing/automationTask.png",
    alt: "Describe the task",
  },
  {
    eyebrow: "STEP-3",
    title: "Get the work.",
    copy: "Done in 60 seconds or less for most tasks. Structured, formatted, and ready to use. Blog posts. Email sequences. Lead lists. Social content. Presentations. Reports.",
    image: "/images/landing/automationWork.png",
    alt: "Get the work",
  },
];

export function HowItWorksSection() {

  return (
    <motion.section
      className="fh-section fh-light-panel fh-how-it-works border-0! lg:border! mt-10! rounded-4xl! md:p-10! pb-20! xl:p-20!"
      initial="initial"
      whileInView="whileInView"
      viewport={{ once: true }}
      variants={staggerContainer}
    >
      <span className="fh-how-ellipse fh-how-ellipse-left" aria-hidden="true" />
      <span className="fh-how-ellipse fh-how-ellipse-right" aria-hidden="true" />
      <motion.div className="text-center sm:text-left" variants={fadeInUp}>
        <Badge>HOW IT WORKS</Badge>
      </motion.div>
      <motion.h2 className='text-[36px]! md:text-[48px]! font-medium! leading-11! mb-10!' variants={fadeInUp}>Get results in three simple steps</motion.h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-[#F5F5F5]! p-2.5! rounded-4xl border border-zinc-200 relative! z-50!">
        {howSteps.map((step) => (
          <motion.article
            key={step.eyebrow}
            className="bg-white rounded-3xl border border-zinc-200 overflow-hidden z-50 group"
            variants={fadeInUp}
          >
            {/* Visual image area */}
            <div className="relative overflow-hidden w-full h-[306px] border-b border-[#CCCCCC]">
              <Image
                src={step.image}
                alt={step.alt}
                fill
                className="object-cover group-hover:scale-105 transition duration-200"
              />
            </div>
            {/* Copy area */}
            <div className="p-5! pt-5! sm:pt-8! bg-white">
              <div className="fh-badge flex! justify-start! text-zinc-500! mb-5! sm:mb-5! text-base! md:text-xs!">
                <span />
                {step.eyebrow}
              </div>
              <h3 className="text-2xl font-medium text-gray-950 mb-3! sm:mb-3! sm:mt-0! text-left group-hover:text-blue-500 transition duration-300">{step.title}</h3>
              <p className="text-base text-zinc-500! text-left">{step.copy}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}