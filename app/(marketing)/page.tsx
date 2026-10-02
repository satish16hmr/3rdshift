'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { HowItWorksSection } from './HowItWorks';

// New extracted components
import { HeroSection } from './_components/HeroSection';
import { ProblemSection } from './_components/ProblemSection';
import { SolutionSection } from './_components/SolutionSection';
import { TeamSection } from './_components/TeamSection';
// import { MobileWorkflowConnectedSection } from './_components/MobileWorkflowConnectedSection';
import { WorkflowSection } from './_components/WorkflowSection';
import { PricingSection } from './_components/PricingSection';
import { DifferentiatorSection } from './_components/DifferentiatorSection';
import { FounderSection } from './_components/FounderSection';
import { FaqSection } from './_components/FaqSection';

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const didScrollRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/dashboard');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  useEffect(() => {
    if (checking || didScrollRef.current) return;
    const hash = window.location.hash;
    if (!hash) return;
    didScrollRef.current = true;
    const id = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(id);
  }, [checking]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <main className="fh-page pb-0!">
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <TeamSection />
      {/* <MobileWorkflowConnectedSection /> */}
      <WorkflowSection />
      <PricingSection />
      <DifferentiatorSection />
      <FounderSection />
      <FaqSection />
    </main>
  );
}
