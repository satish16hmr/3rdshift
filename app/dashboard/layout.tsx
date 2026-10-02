'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApplicationLayout } from '../../components/application-layout';
import PushNotificationRegistrar from '@/components/pwa/PushNotificationRegistrar';
import { RoleDeniedToast } from '@/components/role-denied-toast';
import { createClient } from '@/lib/supabase/client';
import { clearStoredWorkspaceId, getStoredWorkspaceId } from '@/lib/workspace-client';
import { setSentryUser, clearSentryUser } from '@/lib/sentry';
import { identifyUser, resetPostHog } from '@/lib/posthog';

const LAST_DASHBOARD_USER_KEY = '3rdshift_last_dashboard_user';

declare global {
  interface Window {
    __workspaceFetchPatched?: boolean;
  }
}
function syncStoredWorkspaceForUser(userId: string) {
  if (typeof window === 'undefined') return;

  const lastUserId = window.localStorage.getItem(LAST_DASHBOARD_USER_KEY);
  if (lastUserId && lastUserId !== userId) {
    clearStoredWorkspaceId();
  }
  window.localStorage.setItem(LAST_DASHBOARD_USER_KEY, userId);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Patch global fetch to inject x-workspace-id on all /api/ calls
    if (!window.__workspaceFetchPatched) {
      const originalFetch = window.fetch.bind(window);
      window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        if (url.startsWith('/api/') || url.includes('3rdshift.ai/api/')) {
          const workspaceId = getStoredWorkspaceId();
          if (workspaceId) {
            const headers = new Headers((init?.headers as HeadersInit) || {});
            if (!headers.has('x-workspace-id')) {
              headers.set('x-workspace-id', workspaceId);
            }
            return originalFetch(input, { ...init, headers });
          }
        }
        return originalFetch(input, init);
      };
      window.__workspaceFetchPatched = true;
    }

    const supabase = createClient();

    // Listen for auth state changes first — catches OAuth callback SIGNED_IN event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearStoredWorkspaceId();
        window.localStorage.removeItem(LAST_DASHBOARD_USER_KEY);
        clearSentryUser();
        resetPostHog();
        router.replace('/login');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session) {
          // Identify user in Sentry + PostHog
          const userId = session.user.id;
          const email = session.user.email;
          syncStoredWorkspaceForUser(userId);
          setSentryUser({ id: userId, email });
          // Fetch workspace/plan context for richer identification
          const supabaseClient = createClient();
          supabaseClient
            .from('profiles')
            .select('plan, is_founding_member')
            .eq('id', userId)
            .single()
            .then((result) => {
              const data = result.data;
              setSentryUser({ id: userId, email, plan: data?.plan });
              identifyUser({
                id: userId,
                email,
                plan: data?.plan,
                isFoundingMember: data?.is_founding_member,
              });
            }, () => {
              // Profile fetch failed — still identify with basic info
              identifyUser({ id: userId, email });
            });
          setAuthReady(true);
        } else {
          router.replace('/login');
        }
      }
    });

    // Also check existing session immediately (for normal page loads)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Don't redirect immediately — wait for onAuthStateChange in case OAuth is mid-flight
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) router.replace('/login');
          });
        }, 500);
      } else {
        syncStoredWorkspaceForUser(session.user.id);
        setAuthReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <ApplicationLayout>
      <PushNotificationRegistrar />
      <RoleDeniedToast />
      {children}
    </ApplicationLayout>
  );
}
