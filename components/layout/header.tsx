'use client';

import React, { useEffect, useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from './NotificationBell';

interface UserMeta {
  email: string;
  fullName: string;
  plan: string;
  heavyCreditsRemaining: number;
  heavyCreditsResetAt: string | null;
  workerSlotsUsed: number;
}

export default function Header({ user }: { user: UserMeta }) {
  const [session, setSession] = useState<{ access_token: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 transition-[width,height] ease-linear">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 text-gray-500 hover:text-gray-900" />
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell session={session} key={session?.access_token || 'no-session'} />
        <span className="text-sm text-gray-500 hidden sm:block">{user.fullName}</span>
      </div>
    </header>
  );
}
