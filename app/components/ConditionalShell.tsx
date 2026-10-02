'use client';

import { usePathname } from 'next/navigation';
import MarketingHeader from './MarketingHeader';
import CTAFooterSection from './CTAFooterSection';
import MarketingFooter from './MarketingFooter';

const MARKETING_PATHS = [
  '/',
  '/workers',
  '/pricing',
  '/terms',
  '/privacy',
  '/transparency',
  '/data-deletion',
];

const MARKETING_BOTTOM_PATHS = ['/', '/workers', '/pricing', '/terms', '/privacy', '/transparency'];

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');
  const isAuth = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password' || pathname?.startsWith('/auth/');
  const isStandalone = pathname?.startsWith('/founding');
  const isWorkerDetail = pathname?.startsWith('/workers/');
  const isBlog = pathname === '/blog' || pathname?.startsWith('/blog/');
  const isMarketing = MARKETING_PATHS.includes(pathname ?? '');
  const hasMarketingBottom = MARKETING_BOTTOM_PATHS.includes(pathname ?? '') || isBlog;

  if (isDashboard || isAuth || isStandalone) {
    return <>{children}</>;
  }

  if (isMarketing || isWorkerDetail || isBlog) {
    return (
      <>
        <MarketingHeader />
        <div className="marketing-shell">
          {children}
          {hasMarketingBottom ? (
            <div className="marketing-bottom-combo mt-0! pt-[107px]! pb-0! lg:pb-6! rounded-2xl! lg:rounded-[22px]!">
              <img src="/images/marketing/workers-figma/footer-decor-left.svg" alt="" aria-hidden="true" className="marketing-bottom-decor marketing-bottom-decor-left" />
              <img src="/images/marketing/workers-figma/footer-decor-right.svg" alt="" aria-hidden="true" className="marketing-bottom-decor marketing-bottom-decor-right" />
              <CTAFooterSection />
              <MarketingFooter />
            </div>
          ) : (
            <MarketingFooter />
          )}
        </div>
      </>
    );
  }

  return <>{children}</>;
}
