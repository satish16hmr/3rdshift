'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Worker {
  emoji: string;
  iconBg: string;
  category: string;
  catColor: string;
  workerName: string;
  name: string;
  desc: string;
  tags: string[];
}

const WORKERS: Worker[] = [
  { emoji: '✍️', iconBg: 'rgba(167,139,250,0.12)', category: 'Content & Writing', catColor: '#f97316', workerName: 'Ava', name: 'Article Writer', desc: 'Delivers a publish-ready blog post with headers, meta description, and SEO structure.', tags: ['blogs', 'emails', 'social'] },
  { emoji: '🙋', iconBg: 'rgba(251,191,36,0.12)', category: 'Admin & Ops', catColor: '#fbbf24', workerName: 'Alice', name: 'Virtual Assistant', desc: 'Delivers a clean inbox summary, formatted docs, and a prioritized task list.', tags: ['admin', 'email', 'documents'] },
  { emoji: '📱', iconBg: 'rgba(249,115,22,0.12)', category: 'Social Media', catColor: '#ec4899', workerName: 'Mira', name: 'Social Media Manager', desc: 'Delivers a week of ready-to-post content — captions, hashtags, and posting times.', tags: ['social', 'scheduling', 'posts'] },
  { emoji: '💰', iconBg: 'rgba(74,222,128,0.12)', category: 'Sales & Leads', catColor: '#22c55e', workerName: 'Lenny', name: 'Lead Generator', desc: 'Delivers a CSV of 50+ qualified leads — names, emails, company info — overnight.', tags: ['leads', 'prospecting', 'B2B'] },
  { emoji: '🎬', iconBg: 'rgba(251,113,133,0.12)', category: 'Video & Short-Form', catColor: '#ef4444', workerName: 'Ash', name: 'Hook & Script Writer', desc: 'Delivers 10 platform-formatted hooks with character counts + a full video script.', tags: ['hooks', 'scripts', 'TikTok'] },
];

const N = WORKERS.length;
const DESK_STEP = 260 + 24; // card + gap = 284px
// Extended array: 3 copies for seamless infinite loop
const EXT = [...WORKERS, ...WORKERS, ...WORKERS]; // 15 items

function WorkerCard({ worker }: { worker: Worker }) {
  return (
    <>
      <div className="hc-icon" style={{ background: worker.iconBg }}>{worker.emoji}</div>
      <div className="hc-category" style={{ color: worker.catColor }}>{worker.category.toUpperCase()}</div>
      <div className="hc-name">
        <span className="hc-worker-name">{worker.workerName}</span>
        <span className="hc-name-sep"> · </span>
        {worker.name}
      </div>
      <div className="hc-desc">{worker.desc}</div>
      <div className="hc-tags">
        {worker.tags.map(t => <span key={t} className="hc-tag">{t}</span>)}
      </div>
    </>
  );
}

export default function HeroCarousel() {
  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Shared track index — starts at N so initial view is workers[0,1,2]
  const [trackIdx, setTrackIdx] = useState(N);
  // When snapping=true, suppress CSS transition for the silent position reset
  const [snapping, setSnapping] = useState(false);

  // Mobile container ref for pixel-based transform
  const mobRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(300);
  useEffect(() => {
    const update = () => { if (mobRef.current) setCardW(mobRef.current.offsetWidth); };
    update();
    const obs = new ResizeObserver(update);
    if (mobRef.current) obs.observe(mobRef.current);
    return () => obs.disconnect();
  }, []);

  // Infinite loop: when we drift into 3rd copy, silently snap back to 2nd copy
  useEffect(() => {
    if (trackIdx < 2 * N) return;
    const t = setTimeout(() => {
      setSnapping(true);
      setTrackIdx(p => p - N);
    }, 520);
    return () => clearTimeout(t);
  }, [trackIdx]);

  useEffect(() => {
    if (!snapping) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSnapping(false)));
    return () => cancelAnimationFrame(id);
  }, [snapping]);

  // Timer
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startedRef = useRef(false);
  const hoverRef = useRef(false);

  const advance = useCallback(() => {
    if (prefersReduced.current) return;
    setSnapping(false);
    setTrackIdx(p => p + 1);
  }, []);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, 3500);
  }, [advance]);

  const stopTimer = useCallback(() => clearInterval(timerRef.current), []);

  useEffect(() => {
    // First slide at 1.5s — immediate signal that cards rotate
    // Then settle into 3.5s interval
    const firstSlide = setTimeout(() => {
      if (!hoverRef.current && !prefersReduced.current) {
        advance();
      }
      setTimeout(() => {
        startedRef.current = true;
        if (!hoverRef.current) startTimer();
      }, 300);
    }, 1500);
    const onVis = () => {
      if (document.hidden) stopTimer();
      else if (startedRef.current && !hoverRef.current) startTimer();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(firstSlide); stopTimer(); document.removeEventListener('visibilitychange', onVis); };
  }, [startTimer, stopTimer, advance]);

  // Navigate to a specific worker
  const goTo = useCallback((workerIdx: number) => {
    stopTimer();
    const cur = trackIdx % N;
    const steps = (workerIdx - cur + N) % N;
    if (steps > 0) {
      setSnapping(false);
      setTrackIdx(p => p + steps);
    }
    if (startedRef.current) startTimer();
  }, [trackIdx, stopTimer, startTimer]);

  const goBack = useCallback(() => {
    stopTimer();
    if (trackIdx <= N) return; // don't go before second copy
    setSnapping(false);
    setTrackIdx(p => p - 1);
    if (startedRef.current) startTimer();
  }, [trackIdx, stopTimer, startTimer]);

  const goForward = useCallback(() => {
    stopTimer();
    setSnapping(false);
    setTrackIdx(p => p + 1);
    if (startedRef.current) startTimer();
  }, [stopTimer, startTimer]);

  // Touch swipe
  const touchX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const d = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(d) < 50) return;
    stopTimer();
    setSnapping(false);
    setTrackIdx(p => d > 0 ? p + 1 : Math.max(N, p - 1));
    if (startedRef.current) startTimer();
  };

  const transition = snapping || prefersReduced.current ? 'none' : undefined;
  const deskTransform = `translateX(${-(trackIdx * DESK_STEP)}px)`;
  const mobTransform = `translateX(${-(trackIdx * cardW)}px)`;

  // Active dots: desktop = center card (trackIdx+1), mobile = current card (trackIdx)
  const deskActive = (trackIdx + 1) % N;
  const mobActive = trackIdx % N;

  return (
    <>
      <p className="hero-carousel-label">70+ team members ready to hire — starting at $29/mo</p>

      {/* ── DESKTOP CAROUSEL ── */}
      <div
        className="hero-carousel"
        onMouseEnter={() => { hoverRef.current = true; stopTimer(); }}
        onMouseLeave={() => { hoverRef.current = false; if (startedRef.current) startTimer(); }}
      >
        <button className="hc-arrow hc-arrow-left" onClick={goBack} aria-label="Previous worker">‹</button>
        <div className="hero-carousel-overflow">
          <div
            className="hero-carousel-track"
            style={{
              transform: deskTransform,
              transition: transition ?? 'transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            }}
          >
            {EXT.map((w, i) => (
              <div key={i} className="hc-card">
                <WorkerCard worker={w} />
              </div>
            ))}
          </div>
        </div>
        <button className="hc-arrow hc-arrow-right" onClick={goForward} aria-label="Next worker">›</button>

        <div className="hc-dots">
          {WORKERS.map((w, i) => (
            <button
              key={i}
              className={`hc-dot${deskActive === i ? ' active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={w.name}
            />
          ))}
        </div>
        <Link href="/workers" className="hero-carousel-link">See all team members →</Link>
      </div>

      {/* ── MOBILE CAROUSEL ── */}
      <div
        className="hero-carousel-mobile"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="hero-carousel-mobile-overflow" ref={mobRef}>
          <div
            className="hero-carousel-track-mobile"
            style={{
              transform: mobTransform,
              transition: transition ?? 'transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            }}
          >
            {EXT.map((w, i) => (
              <div key={i} className="hc-card-mobile" style={{ width: cardW }}>
                <WorkerCard worker={w} />
              </div>
            ))}
          </div>
        </div>
        <div className="hc-dots hc-dots-mobile">
          {WORKERS.map((w, i) => (
            <button
              key={i}
              className={`hc-dot${mobActive === i ? ' active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={w.name}
            />
          ))}
        </div>
        <Link href="/workers" className="hero-carousel-link">See all team members →</Link>
      </div>
    </>
  );
}
