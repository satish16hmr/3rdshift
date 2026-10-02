'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';

interface UserMeta {
  email: string;
  fullName: string;
  plan: string;
  heavyCreditsRemaining: number;
  heavyCreditsResetAt: string | null;
  workerSlotsUsed: number;
}

export default function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserMeta;
}) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <Header user={user} />
        <main className="flex-1 overflow-auto bg-[#f5f5f7]">
          <div className="mx-auto max-w-[960px] p-6 pb-24 lg:pb-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
