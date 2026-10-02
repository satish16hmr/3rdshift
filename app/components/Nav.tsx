'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <nav className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/" className="nav-logo">
            <img src="/logo-wordmark.png" alt="3rdShift" />
          </Link>
          <div className="nav-links-desktop">
            <Link href="/#about" className={pathname === '/about' ? 'nav-link-active' : ''}>About</Link>
            <Link href="/workers" className={pathname === '/workers' ? 'nav-link-active' : ''}>Workers</Link>
            <Link href="/pricing" className={pathname === '/pricing' ? 'nav-link-active' : ''}>Pricing</Link>
          </div>
          <Link href="/pricing" className="nav-cta">Become a Founding Member &#8594;</Link>
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="nav-mobile-menu">
            <Link href="/#about" onClick={() => setMenuOpen(false)}>About</Link>
            <Link href="/workers" onClick={() => setMenuOpen(false)}>Team Members</Link>
            <Link href="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <Link href="/pricing" onClick={() => setMenuOpen(false)} className="nav-mobile-cta">Become a Founding Member →</Link>
            <Link href={isLoggedIn ? '/dashboard' : '/login'} onClick={() => setMenuOpen(false)} className="nav-mobile-auth">
              {isLoggedIn ? 'Dashboard' : 'Log in'}
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}
