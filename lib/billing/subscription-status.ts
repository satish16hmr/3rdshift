export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(String(status ?? '').toLowerCase());
}
