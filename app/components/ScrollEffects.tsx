'use client';

import { useEffect } from 'react';

export default function ScrollEffects() {
  useEffect(() => {
    // Scroll reveal
    const sections = document.querySelectorAll('[data-reveal]');

    const revealInViewport = () => {
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight + 100) {
          section.classList.add('visible');
        }
      });
    };

    // Run immediately, on next frame, and after short delay to catch all cases
    revealInViewport();
    requestAnimationFrame(revealInViewport);
    setTimeout(revealInViewport, 100);
    setTimeout(revealInViewport, 400);

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });
    sections.forEach(section => revealObserver.observe(section));

    // Sticky mobile CTA
    const hero = document.querySelector('.hero');
    const closingCta = document.querySelector('.cta-band');
    const stickyCta = document.getElementById('stickyCta');
    if (hero && stickyCta) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.target === hero) stickyCta.classList.toggle('visible', !e.isIntersecting);
          if (e.target === closingCta && e.isIntersecting) stickyCta.classList.remove('visible');
        });
      }, { threshold: 0 });
      obs.observe(hero);
      if (closingCta) obs.observe(closingCta);
    }

    return () => {
      revealObserver.disconnect();
    };
  }, []);

  return null;
}
