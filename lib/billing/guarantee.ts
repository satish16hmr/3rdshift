export const GUARANTEE_DAYS = 7;
export const GUARANTEE_LIGHT_TASK_THRESHOLD = 25;
export const GUARANTEE_HEAVY_CREDIT_THRESHOLD = 5;
export const TOPUP_CENTS_PER_25_CREDITS = 3700;

export const WEEK_ONE_HEAVY_CAPS: Record<string, number> = {
  starter: 3,
  pro: 8,
  operator: 15,
};

export const WEEK_ONE_HEAVY_CAP_MESSAGE =
  'Heavy credit access ramps up after your first week — this protects new accounts.';

export type GuaranteeUsage = {
  lightTasksUsed: number;
  heavyCreditsConsumed: number;
};

export type GuaranteeEligibility = GuaranteeUsage & {
  firstPurchaseAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  isInWindow: boolean;
  underCleanRefundThreshold: boolean;
  heavyCreditNetOutCents: number;
};

type SupabaseLike = {
  from(table: string): any;
};

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getGuaranteeWindow(firstPurchaseAt?: string | null) {
  if (!firstPurchaseAt) return null;
  const start = new Date(firstPurchaseAt);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: addDays(start, GUARANTEE_DAYS) };
}

export function isWithinGuaranteeWindow(firstPurchaseAt: string | null | undefined, now = new Date()) {
  const window = getGuaranteeWindow(firstPurchaseAt);
  return Boolean(window && now >= window.start && now < window.end);
}

export function getWeekOneHeavyCap(plan?: string | null) {
  return WEEK_ONE_HEAVY_CAPS[(plan ?? '').toLowerCase()] ?? 0;
}

export function isGuaranteeCapLifted(profile: { guarantee_heavy_cap_lifted_at?: string | null }) {
  return Boolean(profile.guarantee_heavy_cap_lifted_at);
}

export function isUnderCleanRefundThreshold(usage: GuaranteeUsage) {
  return usage.lightTasksUsed <= GUARANTEE_LIGHT_TASK_THRESHOLD
    && usage.heavyCreditsConsumed <= GUARANTEE_HEAVY_CREDIT_THRESHOLD;
}

export function calculateHeavyCreditNetOutCents(heavyCreditsConsumed: number) {
  return Math.max(0, Math.ceil((heavyCreditsConsumed * TOPUP_CENTS_PER_25_CREDITS) / 25));
}

export async function getGuaranteeUsage(
  db: SupabaseLike,
  params: { userId: string; windowStart: string; windowEnd: string },
): Promise<GuaranteeUsage> {
  const { data: tasks, error: tasksError } = await db
    .from('tasks')
    .select('id')
    .eq('user_id', params.userId)
    .eq('task_type', 'light')
    .gte('created_at', params.windowStart)
    .lt('created_at', params.windowEnd)
    .in('status', ['completed', 'processing']);

  if (tasksError) throw new Error(`Failed to query light tasks: ${tasksError.message ?? String(tasksError)}`);

  const { data: creditRows, error: creditError } = await db
    .from('credit_transactions')
    .select('amount')
    .eq('user_id', params.userId)
    .gt('amount', 0)
    .gte('created_at', params.windowStart)
    .lt('created_at', params.windowEnd);

  if (creditError) throw new Error(`Failed to query heavy credits: ${creditError.message ?? String(creditError)}`);

  const heavyCreditsConsumed = (creditRows ?? []).reduce(
    (sum: number, row: { amount?: number | null }) => sum + Math.max(Number(row.amount ?? 0), 0),
    0,
  );

  return {
    lightTasksUsed: tasks?.length ?? 0,
    heavyCreditsConsumed,
  };
}

export async function getGuaranteeEligibility(
  db: SupabaseLike,
  params: { userId: string; now?: Date },
): Promise<GuaranteeEligibility> {
  const { data: profile, error } = await db
    .from('profiles')
    .select('first_purchase_at')
    .eq('id', params.userId)
    .single();

  if (error) throw new Error(`Failed to query profile: ${error.message ?? String(error)}`);

  const window = getGuaranteeWindow(profile?.first_purchase_at ?? null);
  if (!window) {
    return {
      firstPurchaseAt: null,
      windowStart: null,
      windowEnd: null,
      isInWindow: false,
      lightTasksUsed: 0,
      heavyCreditsConsumed: 0,
      underCleanRefundThreshold: false,
      heavyCreditNetOutCents: 0,
    };
  }

  const usage = await getGuaranteeUsage(db, {
    userId: params.userId,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
  });

  return {
    firstPurchaseAt: profile.first_purchase_at,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    isInWindow: (params.now ?? new Date()) >= window.start && (params.now ?? new Date()) < window.end,
    ...usage,
    underCleanRefundThreshold: isUnderCleanRefundThreshold(usage),
    heavyCreditNetOutCents: calculateHeavyCreditNetOutCents(usage.heavyCreditsConsumed),
  };
}

export async function checkWeekOneHeavyCap(
  db: SupabaseLike,
  params: { userId: string; plan: string; attemptedAmount: number; now?: Date },
): Promise<{ allowed: true } | { allowed: false; status: number; error: string; cap: number; consumed: number }> {
  const amount = params.attemptedAmount ?? 0;
  if (amount <= 0) return { allowed: true };

  const cap = getWeekOneHeavyCap(params.plan);
  if (cap <= 0) return { allowed: true };

  const { data: profile, error } = await db
    .from('profiles')
    .select('first_purchase_at, guarantee_heavy_cap_lifted_at')
    .eq('id', params.userId)
    .single();

  if (error || !profile) return { allowed: true };
  if (isGuaranteeCapLifted(profile)) return { allowed: true };
  if (!isWithinGuaranteeWindow(profile.first_purchase_at, params.now ?? new Date())) return { allowed: true };

  const window = getGuaranteeWindow(profile.first_purchase_at);
  if (!window) return { allowed: true };

  const usage = await getGuaranteeUsage(db, {
    userId: params.userId,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
  });

  if (usage.heavyCreditsConsumed + amount > cap) {
    return {
      allowed: false,
      status: 402,
      error: WEEK_ONE_HEAVY_CAP_MESSAGE,
      cap,
      consumed: usage.heavyCreditsConsumed,
    };
  }

  return { allowed: true };
}
