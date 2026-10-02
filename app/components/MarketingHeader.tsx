'use client';

import { useState, type CSSProperties, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { becomeFoundingMember } from '@/lib/pricing';

export default function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAboutActive, setIsAboutActive] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') { setIsAboutActive(false); return; }

    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;

    const attach = (el: Element) => {
      io = new IntersectionObserver(([e]) => setIsAboutActive(e.isIntersecting), { threshold: 0.15 });
      io.observe(el);
    };

    const el = document.getElementById('about');
    if (el) {
      attach(el);
    } else {
      mo = new MutationObserver(() => { const e = document.getElementById('about'); if (e) { mo!.disconnect(); attach(e); } });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => { io?.disconnect(); mo?.disconnect(); };
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 left-0 bg-white z-[99999]! w-full">
      <div className="w-full max-w-348 mx-auto">
        <div className="h-17 md:h-20 flex justify-between items-center px-5 min-[390px]:px-7.5 xl:px-6 xl:grid md:grid-cols-[1fr_auto_1fr]">
          {/* Left section - logo */}
          <div className="flex justify-start">
            <Link href="/" aria-label="3rdShift home" className="flex items-center">
              <Image
                src="/images/logo.png"
                alt="3rdShift"
                width={92}
                height={40}
                className="h-9 min-[390px]:h-11 md:h-10 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - hidden on mobile */}
          <nav
            className="hidden md:flex items-center justify-center"
            aria-label="Marketing navigation"
          >
            <div className="flex items-center gap-8 navbar-item">
              <Link
                className={`fromLeft transition duration-200 hover:text-blue-500! ${isAboutActive ? 'active-nav' : ''}`}
                href="/#about"
                style={navLinkStyle}
              >
                About
              </Link>
              <Link
                className={`fromLeft transition duration-200 hover:text-blue-500! ${pathname === '/workers' ? 'active-nav' : ''
                  }`}
                href="/workers"
                style={navLinkStyle}
              >
                Team
              </Link>
              <Link
                className={`fromLeft transition duration-200 hover:text-blue-500! ${pathname === '/pricing' ? 'active-nav' : ''
                  }`}
                href="/pricing"
                style={navLinkStyle}
              >
                Pricing
              </Link>
            </div>
          </nav>

          {/* Desktop CTA Button - hidden on mobile */}
          <div className="hidden md:flex justify-end items-center gap-5">
            <div className="navbar-item">
              <Link
                className="transition duration-200 hover:text-blue-500! fromLeft"
                href="/login"
                style={navLinkStyle}
              >
                Log In
              </Link>
            </div>
            <Button
              variant="primary"
              className="w-62.25 h-10"
              onClick={() => becomeFoundingMember(router, pathname)}
            >
              Become a Founding Member →
            </Button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="md:hidden flex items-center justify-end ml-auto cursor-pointer"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu className='size-6 text-black' />
          </button>
        </div>
      </div>

      {/* Mobile Slide-in Drawer */}
      <div
        className={`
          fixed inset-0 z-40 md:hidden
          transition-all duration-300 ease-in-out
          ${menuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
        onClick={() => setMenuOpen(false)}
      >
        {/* Backdrop */}
        <div
          className={`
            absolute inset-0 bg-black/50
            transition-opacity duration-300
            ${menuOpen ? 'opacity-100' : 'opacity-0'}
          `}
        />

        {/* Drawer */}
        <div
          className={`
            absolute right-0 top-0 h-full w-[300px] bg-white shadow-2xl
            transition-transform duration-300 ease-in-out
            ${menuOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <Image
              src="/images/logo.png"
              alt="3rdShift"
              width={80}
              height={35}
              className="h-9 w-auto cursor-pointer"
              onClick={() => {
                setMenuOpen(false);
                router.push("/");
              }}
            />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition cursor-pointer"
            >
              <X className='size-6 text-black' />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col p-4 space-y-1 mt-4" aria-label="Mobile marketing navigation">
            <Link
              className={`text-lg font-medium py-1.5 px-4 flex items-center rounded-md hover:bg-gray-100 transition duration-300 ${isAboutActive ? 'text-blue-500' : 'text-gray-600 hover:text-blue-500'}`}
              href="/#about"
              onClick={() => setMenuOpen(false)}
            >
              About
            </Link>
            <Link
              className="text-gray-600 hover:text-blue-500 text-lg font-medium py-1.5 px-4 flex items-center rounded-md hover:bg-gray-100 transition duration-300"
              href="/workers"
              onClick={() => setMenuOpen(false)}
            >
              Team
            </Link>
            <Link
              className="text-gray-600 hover:text-blue-500 text-lg font-medium py-1.5 px-4 flex items-center rounded-md hover:bg-gray-100 transition duration-300"
              href="/pricing"
              onClick={() => setMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              className="text-gray-600 hover:text-blue-500 text-lg font-medium py-1.5 px-4 flex items-center rounded-md hover:bg-gray-100 transition duration-300"
              href="/login"
              onClick={() => setMenuOpen(false)}
            >
              Log In
            </Link>

            {/* CTA in Drawer */}
            <Button
              variant="primary"
              className="w-full mt-2 h-10!"
              onClick={() => {
                setMenuOpen(false);
                becomeFoundingMember(router, pathname);
              }}
            >
              Become a Founding Member →
            </Button>

            {/* Background decorative element from Figma */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-50 to-transparent opacity-50 pointer-events-none" />
          </nav>
        </div>
      </div>
    </header>
  );
}

const navLinkStyle: CSSProperties = {
  color: '#71717A',
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '20px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};