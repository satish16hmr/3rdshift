'use client';

import { useEffect } from 'react';

export default function CounterAnimation() {
  useEffect(() => {
    const counters = document.querySelectorAll('[data-count]');

    function animateCounter(el: HTMLElement) {
      const target = parseInt(el.dataset.count || '0');
      const duration = 1500;
      const start = performance.now();
      const suffix = el.querySelector('small')?.textContent || '';
      // Find or create a text node for the number, keeping <small> child intact
      let textNode = el.firstChild as Text | null;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        textNode = document.createTextNode('');
        el.insertBefore(textNode, el.firstChild);
      }
      function update(now: number) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = p < 1 ? Math.round(target * eased) : target;
        textNode!.textContent = String(val);
        if (p < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    }

    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target as HTMLElement);
          counterObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10px 0px' });

    counters.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        animateCounter(el as HTMLElement);
      } else {
        counterObs.observe(el);
      }
    });

    return () => counterObs.disconnect();
  }, []);

  return null;
}
