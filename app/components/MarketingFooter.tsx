'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const primaryLinks = [
  { label: 'Team Members', href: '/workers' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
];

const legalLinks = [
  { label: 'Terms', href: '/terms' },
  { label: 'Refund Policy', href: '/terms#refund-policy', anchor: 'refund-policy' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'AI Transparency', href: '/transparency' },
];
 
const pagesWithFaq = ['/', '/workers', '/pricing', '/blog'];

export default function MarketingFooter() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/terms' && typeof window !== 'undefined' && window.location.hash) {
      const anchor = window.location.hash.replace('#', '');
      const el = document.getElementById(anchor);
      if (el) {
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname]);

  const getFaqHref = () => {
    if (pagesWithFaq.includes(pathname)) {
      return `${pathname === '/' ? '' : pathname}/#faq`;
    }
    return '/#faq';
  };

  const faqLink = {
    label: 'FAQ',
    href: getFaqHref()
  };

  const primaryLinksWithFaq = [
    { label: 'Team Members', href: '/workers' },
    { label: 'Pricing', href: '/pricing' },
    faqLink,
    { label: 'Blog', href: '/blog' },
  ];

  return (
    <footer className="marketing-footer bg-linear-to-b from-[#121212] to-[#1A1A1A] w-[112%]! -left-[6%]! lg:w-full! lg:left-0! rounded-2xl! lg:rounded-[22px]! mt-0!" aria-label="Site footer">
      <div className="marketing-footer-nav p-13! lg:px-20! lg:py-17.25! min-h-0! gap-6! md:gap-10! grid-cols-1! sm:grid-cols-5!">
        <div className="marketing-footer-brand sm:col-span-3!">
          <Link href="/" aria-label="3rdShift home" className="marketing-footer-logo-link">
            <Image src="/logo-white.png" alt="3rdShift" className="marketing-footer-logo" width={92} height={40} />
          </Link>
          <a href="https://x.com/Rager" target="_blank" rel="noopener noreferrer" className="marketing-footer-twitter hidden! lg:flex!">
            Twitter/X
          </a>
        </div>

        <nav className="marketing-footer-link-column mb-[35px]!" aria-label="Footer product links">
          <h2>PRODUCT</h2>
          {primaryLinksWithFaq.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="marketing-footer-link-column" aria-label="Footer legal links">
          <h2>LEGAL</h2>
          {legalLinks.map((link) => {
            if (link.anchor) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    if (pathname === '/terms') {
                      e.preventDefault()
                      history.pushState(null, '', `#${link.anchor}`)
                      document.getElementById(link.anchor!)?.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                >
                  {link.label}
                </Link>
              )
            }
            return (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            )
          })}
          <a href="https://x.com/Rager" target="_blank" rel="noopener noreferrer" className="marketing-footer-twitter lg:hidden!">
            Twitter/X
          </a>
        </nav>
      </div>

      <div className="px-10!">
        <div className="marketing-footer-divider my-6! w-full!" aria-hidden="true" />
      </div>

      <div className="marketing-footer-bottom p-10!">
        <p>© 2026 3rdShift. All rights reserved.</p>
      </div>
    </footer>
  );
}