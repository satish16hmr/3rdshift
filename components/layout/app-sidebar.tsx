'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Users, CheckCircle, Settings, LogOut, CreditCard, Zap, Gift } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from './NotificationBell';

interface UserMeta {
  email: string;
  fullName: string;
  plan: string;
  heavyCreditsRemaining: number;
  heavyCreditsResetAt: string | null;
  workerSlotsUsed: number;
  isFoundingMember?: boolean;
}

const navItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
  { title: 'Team', href: '/dashboard/team', icon: Users },
  { title: 'My Tasks', href: '/dashboard/tasks', icon: CheckCircle },
  { title: 'Workflows', href: '/dashboard/agent-mode', icon: Zap, operatorOnly: true },
  { title: 'Settings', href: '/dashboard/settings', icon: Settings },
  { title: 'Billing', href: '/dashboard/settings/billing', icon: CreditCard },
  { title: 'Refer & Earn', href: '/dashboard/referrals', icon: Gift },
];

const planLabels: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  operator: 'Operator',
  enterprise: 'Enterprise',
  none: 'Free',
};

export default function AppSidebar({ user }: { user: UserMeta }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const [session, setSession] = useState<{ access_token: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const isLowCredits = user.heavyCreditsRemaining < 5;
  const planLabel = planLabels[user.plan] ?? 'Free';

  const daysUntilReset = user.heavyCreditsResetAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(user.heavyCreditsResetAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-gray-200 bg-white">
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="group-data-[collapsible=icon]:hidden">
            <img alt="3rdShift" src="/logo-hq.png" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
              {user.isFoundingMember && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  ⚡ Founding
                </span>
              )}
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                {planLabel}
              </span>
            </div>
            {/* Bell always visible — outside the collapsed-hide wrapper */}
            <NotificationBell session={session} />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500">Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const active = isActive(item.href);
              const isOperatorOnly = (item as any).operatorOnly;
              const isReferral = item.href === '/dashboard/referrals';
              const isOperator = user.plan === 'operator';
              if (isReferral && user.plan === 'none') return null;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={active}
                    className={
                      active
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  >
                    <Link href={item.href}>
                      <item.icon
                        className={active ? 'text-blue-600' : 'text-gray-400'}
                      />
                      <span className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                        {item.title}
                        {isOperatorOnly && !isOperator && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700">
                            Operator
                          </span>
                        )}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Credits section */}
        {(user.plan === 'pro' || user.plan === 'operator') && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="mx-2 rounded-lg bg-gray-50 px-4 py-3">
              <p
                className={`text-sm font-semibold ${
                  isLowCredits ? 'text-red-600' : 'text-gray-700'
                }`}
              >
                {user.heavyCreditsRemaining} credits left
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {daysUntilReset !== null
                  ? `Resets in ${daysUntilReset}d`
                  : 'each task uses 1'}
              </p>
            </div>
          </SidebarGroup>
        )}

        {user.plan === 'starter' && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="mx-2 rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-700">
                {user.workerSlotsUsed} / 5 team member slots
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Starter plan</p>
            </div>
          </SidebarGroup>
        )}

        {user.plan === 'none' && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <div className="mx-2">
              <Link
                href="/dashboard/settings"
                className="block rounded-md bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-500"
              >
                Get started →
              </Link>
            </div>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-x-3 px-2 py-2 group-data-[collapsible=icon]:justify-center">
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
