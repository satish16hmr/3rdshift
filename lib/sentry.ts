/**
 * Sentry utility — centralized error capture with context.
 * Import this instead of @sentry/nextjs directly so we have one place
 * to control context attachment.
 */
import * as Sentry from '@sentry/nextjs';

export { Sentry };

/** Set user context after login */
export function setSentryUser(user: {
  id: string;
  email?: string;
  plan?: string;
  workspaceId?: string;
  isFoundingMember?: boolean;
}) {
  Sentry.setUser({
    id: user.id,
    // Scrub email in production if privacy is a concern — keeping for now for debugging
    email: user.email,
  });
  Sentry.setContext('workspace', {
    workspace_id: user.workspaceId,
    plan: user.plan,
    is_founding_member: user.isFoundingMember,
  });
}

/** Clear user context on logout */
export function clearSentryUser() {
  Sentry.setUser(null);
  Sentry.setContext('workspace', null);
}

/** Set task context for AI worker calls */
export function setSentryTaskContext(ctx: {
  taskId?: string;
  workerSlug?: string;
  taskType?: string;
  mode?: string;
  creditsCharged?: number;
}) {
  Sentry.setContext('task', {
    task_id: ctx.taskId,
    worker_slug: ctx.workerSlug,
    task_type: ctx.taskType,
    mode: ctx.mode,
    credits_charged: ctx.creditsCharged,
  });
}

/** Capture an error with optional extra context */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'error'
) {
  Sentry.withScope(scope => {
    scope.setLevel(level);
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/** Tag billing errors as P0 */
export function captureBillingError(error: unknown, context?: Record<string, unknown>) {
  Sentry.withScope(scope => {
    scope.setTag('category', 'billing');
    scope.setLevel('fatal');
    if (context) Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(error);
  });
}

/** Tag auth errors as P0 */
export function captureAuthError(error: unknown, context?: Record<string, unknown>) {
  Sentry.withScope(scope => {
    scope.setTag('category', 'auth');
    scope.setLevel('fatal');
    if (context) Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(error);
  });
}

/** Tag AI/task errors */
export function captureTaskError(
  error: unknown,
  workerSlug: string,
  taskId?: string,
  extra?: Record<string, unknown>
) {
  Sentry.withScope(scope => {
    scope.setTag('category', 'task');
    scope.setTag('worker_slug', workerSlug);
    if (taskId) scope.setExtra('task_id', taskId);
    if (extra) Object.entries(extra).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(error);
  });
}
