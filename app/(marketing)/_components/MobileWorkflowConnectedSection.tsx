'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge, fadeInUp, staggerContainer } from './shared';

export function MobileWorkflowConnectedSection() {
    return (
        <motion.section
            className="fh-mobile-workflow-connected"
            aria-labelledby="mobile-workflow-heading"
            style={{ backgroundImage: "url('/images/landing/workflow.png')" }}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
        >
            <motion.div variants={fadeInUp}>
                <Badge>WORKFLOW &amp; INTEGRATION</Badge>
            </motion.div>
            <motion.h2 id="mobile-workflow-heading" variants={fadeInUp}>Your Workflow,<br />Fully Connected</motion.h2>

            <div className="fh-mobile-workflow-stack">
                <motion.article className="fh-mobile-workflow-schedule-card" variants={fadeInUp}>
                    <div className="fh-mobile-workflow-lines" aria-hidden="true" />
                    <div className="fh-mobile-workflow-card-copy">
                        <h3>Your Workflow,<br />Set It Once.<br />Let Your AI Team Run It.</h3>
                        <p>Schedule your tasks and let your AI team keep things moving 24/7, collaborating and executing even while you sleep.</p>
                    </div>
                    <img src="/images/marketing/workflow-cards.png" alt="" className="fh-mobile-workflow-cards-image" aria-hidden="true" />
                </motion.article>

                <motion.article className="fh-mobile-integrations-card" variants={fadeInUp}>
                    <h3>Connect Once, Stop<br />Switching Between<br />Tools</h3>
                    <p>Connect everything once and let your AI team handle the work across apps for you.</p>
                    <img src="/images/marketing/integration-logos.png" alt="Buffer, Zapier, Mailchimp, Gmail, Notion, and WordPress integrations" className="fh-mobile-integration-logos-image" />
                </motion.article>

                <motion.article className="fh-mobile-ready-team-card" variants={fadeInUp}>
                    <h3>Your 70+ AI Team,<br />Ready When You Are</h3>
                    <p>Pick from 70+ AI team members across marketing, writing, and more. Just choose, assign, and get things done.</p>
                    <img src="/images/marketing/team-avatars.png" alt="" className="fh-mobile-team-avatars-image" aria-hidden="true" />
                </motion.article>
            </div>
        </motion.section>
    );
}
