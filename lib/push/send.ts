/**
 * lib/push/send.ts
 * FCM HTTP v1 push notification sender using firebase-admin SDK.
 *
 * Setup (in Vercel env vars — never commit these values):
 *   FIREBASE_SERVICE_ACCOUNT  = full service account JSON (stringified)
 *   FIREBASE_PROJECT_ID       = e.g. "3rdshift-prod"
 *
 * How to get the service account JSON:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   Paste the entire JSON object as a string in Vercel env.
 *
 * Legacy FIREBASE_SERVER_KEY is NOT used — FCM Legacy API was shut down July 2024.
 */

import * as admin from 'firebase-admin';

// Singleton — Next.js may hot-reload in dev, guard against re-initialisation
let _app: admin.app.App | null = null;

function getApp(): admin.app.App | null {
  if (_app) return _app;

  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!serviceAccountStr || !projectId) {
    // Env vars not yet set — push silently disabled
    return null;
  }

  try {
    // Avoid "app already exists" error across hot reloads
    if (admin.apps.length > 0) {
      _app = admin.apps[0]!;
      return _app;
    }

    const serviceAccount = JSON.parse(serviceAccountStr);
    _app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    return _app;
  } catch (err) {
    console.error('[push] Failed to initialise firebase-admin:', err);
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a single FCM token.
 * Returns true if sent successfully, false otherwise (never throws).
 */
export async function sendPush(
  token: string,
  payload: PushPayload
): Promise<boolean> {
  const app = getApp();
  if (!app) return false; // Env vars not configured yet — silent no-op

  try {
    await admin.messaging(app).send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'team_updates',
        },
      },
    });
    return true;
  } catch (err: unknown) {
    // Unregister stale tokens silently — caller should delete them from DB
    const errCode = (err as { code?: string }).code;
    if (
      errCode === 'messaging/registration-token-not-registered' ||
      errCode === 'messaging/invalid-registration-token'
    ) {
      return false;
    }
    console.error('[push] send error:', err);
    return false;
  }
}

/**
 * Send to multiple tokens, return list of stale tokens that should be deleted.
 */
export async function sendPushToMany(
  tokens: Array<{ token: string; platform: string }>,
  payload: PushPayload
): Promise<string[]> {
  const staleTokens: string[] = [];

  await Promise.allSettled(
    tokens.map(async ({ token }) => {
      const ok = await sendPush(token, payload);
      if (!ok) staleTokens.push(token);
    })
  );

  return staleTokens;
}
