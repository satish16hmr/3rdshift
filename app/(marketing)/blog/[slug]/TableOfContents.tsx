'use client';

import { useEffect, useState, useRef } from 'react';

interface Heading {
    id: string;
    text: string;
}

interface TableOfContentsProps {
    headings: Heading[];
    className?: string;
    ariaLabelledBy?: string;
    titleId?: string;
}

export default function TableOfContents({
    headings,
    className,
    ariaLabelledBy,
    titleId,
}: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>('');
    const tocRef = useRef<HTMLDivElement>(null);

    const getTargetElement = (id: string) => {
        if (!tocRef.current) return null;
        const container = tocRef.current.closest('.blog-article-shell, .blog-article-mobile-main');
        if (container) {
            const target = container.querySelector(`[id="${id}"]`);
            if (target) return target as HTMLElement;
        }
        const targets = Array.from(document.querySelectorAll(`[id="${id}"]`));
        const visibleTarget = targets.find((el) => (el as HTMLElement).offsetParent !== null);
        return (visibleTarget || targets[0] || null) as HTMLElement | null;
    };

    useEffect(() => {
        if (headings.length === 0) return;

        const elements = headings
            .map((h) => getTargetElement(h.id))
            .filter((el): el is HTMLElement => el !== null);

        if (elements.length === 0) return;

        // Track intersection state of all headers
        const elementVisibilityMap: Record<string, boolean> = {};

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    elementVisibilityMap[entry.target.id] = entry.isIntersecting;
                });

                // Try to find the heading currently intersecting near top of viewport
                const visibleHeading = headings.find((h) => elementVisibilityMap[h.id]);
                if (visibleHeading) {
                    setActiveId(visibleHeading.id);
                } else {
                    // If no heading is directly intersecting, find the heading closest to top but above viewport
                    let lastActive = headings[0].id;
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        // A buffer value of 120px checks if the element is near or above header offset
                        if (rect.top <= 120) {
                            lastActive = el.id;
                        } else {
                            break;
                        }
                    }
                    setActiveId(lastActive);
                }
            },
            {
                rootMargin: '-80px 0px -60% 0px',
                threshold: 0,
            }
        );

        elements.forEach((el) => observer.observe(el));

        return () => {
            observer.disconnect();
        };
    }, [headings]);

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const target = getTargetElement(id);
        if (target) {
            const headerOffset = 100;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div ref={tocRef} role="navigation" className={className} aria-labelledby={ariaLabelledBy}>
            <p id={titleId} className="blog-toc-title">Table of contents</p>
            <ol className="blog-toc-list">
                {headings.map((heading) => (
                    <li key={heading.id}>
                        <a
                            href={`#${heading.id}`}
                            className={activeId === heading.id ? 'active' : ''}
                            onClick={(e) => handleLinkClick(e, heading.id)}
                        >
                            {heading.text}
                        </a>
                    </li>
                ))}
            </ol>
        </div>
    );
}
