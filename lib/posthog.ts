/**
 * PostHog analytics utility.
 * All event firing goes through here for consistent property hygiene.
 */
import posthog from 'posthog-js';

export { posthog };

/** Standard properties attached to every event */
function baseProps(extra?: Record<string, unknown>) {
  return {
    ...extra,
  };
}

// ─── User ────────────────────────────────────────────────────────────────────

export function identifyUser(user: {
  id: string;
  email?: string;
  plan?: string;
  workspaceId?: string;
  workspaceRole?: 'owner' | 'operator';
  signupDate?: string;
  isFoundingMember?: boolean;
}) {
  posthog.identify(user.id, {
    email: user.email,
    plan: user.plan,
    workspace_id: user.workspaceId,
    workspace_role: user.workspaceRole,
    signup_date: user.signupDate,
    is_founding_member: user.isFoundingMember,
  });
}

export function resetPostHog() {
  posthog.reset();
}

// ─── Signup / Onboarding ─────────────────────────────────────────────────────

export const trackSignupStarted = () => posthog.capture('signup_started', baseProps());
export const trackSignupCompleted = () => posthog.capture('signup_completed', baseProps());
export const trackOnboardingStarted = () => posthog.capture('onboarding_started', baseProps());
export const trackOnboardingCompleted = () => posthog.capture('onboarding_completed', baseProps());

// ─── Workers ─────────────────────────────────────────────────────────────────

export const trackWorkerViewed = (workerSlug: string, category: string) =>
  posthog.capture('worker_viewed', baseProps({ worker_slug: workerSlug, category }));

export const trackWorkerChatted = (workerSlug: string, mode?: string) =>
  posthog.capture('worker_chatted', baseProps({ worker_slug: workerSlug, mode }));

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const trackTaskSubmitted = (params: {
  workerSlug: string;
  mode?: string;
  taskType: string;
  creditsCharged: number;
}) =>
  posthog.capture('task_submitted', baseProps({
    worker_slug: params.workerSlug,
    mode: params.mode,
    task_type: params.taskType,
    credits_charged: params.creditsCharged,
  }));

export const trackTaskViewedResult = (params: {
  workerSlug: string;
  taskId: string;
  timeToViewMs?: number;
}) =>
  posthog.capture('task_viewed_result', baseProps({
    worker_slug: params.workerSlug,
    task_id: params.taskId,
    time_to_view_ms: params.timeToViewMs,
  }));

export const trackOutputDownloaded = (workerSlug: string, format: 'pdf' | 'docx' | 'xlsx' | 'pptx') =>
  posthog.capture('output_downloaded', baseProps({ worker_slug: workerSlug, format }));

// ─── Billing / Upgrade ───────────────────────────────────────────────────────

export const trackUpgradeClicked = (params: { fromPlan: string; toPlan: string; source: string }) =>
  posthog.capture('upgrade_clicked', baseProps({
    from_plan: params.fromPlan,
    to_plan: params.toPlan,
    source: params.source,
  }));

export const trackBillingViewed = () => posthog.capture('billing_viewed', baseProps());

// ─── Cancellation ────────────────────────────────────────────────────────────

export const trackPlanCancelled = (plan: string) =>
  posthog.capture('plan_cancelled', baseProps({ plan }));

export const trackPlanDowngraded = (fromPlan: string, toPlan: string) =>
  posthog.capture('plan_downgraded', baseProps({ from_plan: fromPlan, to_plan: toPlan }));
