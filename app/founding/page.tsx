'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /founding redirects to /pricing
// Single-page pricing strategy — all plan info lives at /pricing
export default function FoundingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/pricing');
  }, [router]);
  return null;
}
