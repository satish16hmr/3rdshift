import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { calcChainCostPerRun, getMissingWorkerModeFields, PLAN_ALLOWANCES, type WorkerInChain } from '@/lib/agent-mode/types';
import { getAvailableCredits } from '@/lib/billing/available-credits';

function createAdminClient() {
  return supabaseAdmin;
}

// POST /api/agent-mode/credit-projection
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const availableCredits = await getAvailableCredits(supabase, userId);

  const { workers, schedule_days } = await request.json() as {
    workers: WorkerInChain[];
    schedule_days: string[];
  };

  const missingModes = getMissingWorkerModeFields(workers ?? []);
  if (missingModes.length > 0) {
    return NextResponse.json({ error: 'Choose a mode.', missing_modes: missingModes }, { status: 400 });
  }

  const costPerRun = calcChainCostPerRun(workers, { requireMode: true });
  const runsPerMonth = schedule_days.length > 0 ? Math.round(schedule_days.length * 4.33) : 0;

  const plan = profile.plan as keyof typeof PLAN_ALLOWANCES;
  const allowances = PLAN_ALLOWANCES[plan] ?? PLAN_ALLOWANCES.operator;
  const monthlyLight = costPerRun.light * runsPerMonth;
  const monthlyHeavy = costPerRun.heavy * runsPerMonth;

  // Estimate remaining allowance from the canonical available balance (plan + active top-ups).
  const remainingHeavy = availableCredits.availableCreditsRemaining;
  const remainingHeavyAfter = remainingHeavy - monthlyHeavy;

  // 50% warning threshold
  const over50PercentLight = monthlyLight > allowances.light * 0.5;
  const over50PercentHeavy = monthlyHeavy > allowances.heavy * 0.5;

  return NextResponse.json({
    light_per_run: costPerRun.light,
    heavy_per_run: costPerRun.heavy,
    schedule_days,
    runs_per_month: runsPerMonth,
    monthly_light: monthlyLight,
    monthly_heavy: monthlyHeavy,
    allowance_light: allowances.light,
    allowance_heavy: allowances.heavy,
    remaining_heavy: remainingHeavy,
    remaining_heavy_after: remainingHeavyAfter,
    over_50_percent_light: over50PercentLight,
    over_50_percent_heavy: over50PercentHeavy,
  });
}
