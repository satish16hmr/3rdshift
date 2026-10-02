'use client';

/**
 * PushNotificationRegistrar
 * Registers Capacitor push notification tokens with the backend.
 * Only runs on native iOS/Android (Capacitor). No-ops on web.
 * Must be mounted inside an authenticated context.
 */
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PushNotificationRegistrar() {
  useEffect(() => {
    registerPush();
  }, []);

  return null; // renders nothing
}

async function registerPush() {
  // Only run in Capacitor native context
  if (typeof window === 'undefined') return;

  // Check if Capacitor is available (native app)
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return;

  try {
    // Dynamic import to avoid SSR issues
    // PushNotifications accessed via global Capacitor plugins (native context)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PushNotifications = (window as any)?.Capacitor?.Plugins?.PushNotifications;
    if (!PushNotifications) return;

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.log('Push permission not granted');
      return;
    }

    // Register with platform push service
    await PushNotifications.register();

    // Listen for token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PushNotifications.addListener('registration', async (pushToken: any) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Detect platform
      const platform = capacitor?.isNativePlatform?.()
        ? (window.navigator.userAgent.toLowerCase().includes('android') ? 'android' : 'ios')
        : 'web';

      // Register token with backend
      try {
        await fetch('/api/push-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token: pushToken.value, platform }),
        });
        console.log(`Push token registered (${platform})`);
      } catch (err) {
        console.error('Failed to register push token:', err);
      }
    });

    // Handle push received while app is open (show in-app)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      console.log('Push received:', notification.title, notification.body);
      // Dispatch custom event so the notification bell can update
      window.dispatchEvent(new CustomEvent('team-update-received'));
    });

    // Handle tap on push notification (app was in background)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
      const data = action.notification.data as { worker_slug?: string };
      if (data?.worker_slug) {
        window.location.href = `/dashboard/team/${data.worker_slug}?tab=chat`;
      }
    });
  } catch (err) {
    // Capacitor not available or push not supported — silent fail
    console.log('Push notifications not available:', err);
  }
}
