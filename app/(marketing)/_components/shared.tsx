'use client';

import React from 'react';
import { motion } from 'motion/react';

export const marketingImage = (name: string) => `/images/marketing/${name}.png`;

export const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
};

export const staggerContainer = {
    initial: {},
    whileInView: {
        transition: {
            staggerChildren: 0.1
        }
    },
    viewport: { once: true }
};

export function AnimateIn({
    children,
    delay = 0,
    duration = 0.6,
    y = 20,
    x = 0,
    className,
    style
}: {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    y?: number;
    x?: number;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y, x }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    );
}

export function AnimateStagger({
    children,
    className,
    delay = 0,
    style
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    style?: React.CSSProperties;
}) {
    return (
        <motion.div
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
                initial: {},
                whileInView: {
                    transition: {
                        staggerChildren: 0.1,
                        delayChildren: delay
                    }
                }
            }}
            className={className}
            style={style}
        >
            {children}
        </motion.div>
    );
}

export function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`fh-badge ${className}`}>
            <span />
            {children}
        </div>
    );
}

