'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function NotFound() {
  // Add a body class so ConditionalShell can detect and skip its marketing wrapper
  useEffect(() => {
    document.body.setAttribute('data-page', '404');
    return () => document.body.removeAttribute('data-page');
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col font-sans text-[#111113] bg-white overflow-hidden">
      <div
        className="absolute inset-0 bg-no-repeat bg-top opacity-70"
        style={{ backgroundImage: "url('/images/404bg.png')" }}
      />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-15 text-center">
        <Button
          variant="outline"
          className="flex items-center justify-center h-14 w-14 p-0! mb-6 bg-white rounded-2xl!"
        >
          <Search className="w-7! h-7! text-[#414651]" />
        </Button>

        <h1 className="mb-5 text-6xl font-semibold text-zinc-800">
          Page not found.
        </h1>

        <p className="mb-12 max-w-103 text-xl text-neutral-500">
          The page you are looking for doesn't exist.
          <br />
          Here are some helpful links:
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button variant="outline" className="bg-white">
              Back
            </Button>
          </Link>

          <Link href="/dashboard">
            <Button variant="primary">
              Take me home
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}