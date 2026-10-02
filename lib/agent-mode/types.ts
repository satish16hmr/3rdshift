// ── Agent Mode — Shared Types ─────────────────────────────────────────────────

import { getWorkerBySlug } from '@/lib/workers/registry';

export interface WorkerInChain {
  worker_id: string;       // slug e.g. "content-writer"
  position: number;        // 1-based
  form_settings: Record<string, string>;
  config?: Record<string, string>; // legacy/API alias; normalized to form_settings at save/execute time
}

export interface AgentChain {
  id: string;
  user_id: string;
  name: string;
  workers: WorkerInChain[];
  schedule_days: string[]; // ['monday','wednesday','friday'] or []
  status: 'active' | 'paused' | 'inactive';
  preset_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerRunResult {
  worker_id: string;
  position: number;
  status: 'completed' | 'failed' | 'skipped';
  output?: string;
  provider?: 'anthropic' | 'openai';
  error?: string;
  credits_consumed: { light: number; heavy: number };
  credits_refunded: { light: number; heavy: number };
  started_at?: string;
  completed_at?: string;
}

export interface AgentRun {
  id: string;
  chain_id: string;
  user_id: string;
  trigger_type: 'scheduled' | 'manual';
  status: 'running' | 'completed' | 'partial' | 'failed' | 'pending_rescue';
  rescue_attempts: number;
  provider_used: 'anthropic' | 'openai' | 'mixed';
  worker_results: WorkerRunResult[];
  total_light_consumed: number;
  total_heavy_consumed: number;
  total_light_refunded: number;
  total_heavy_refunded: number;
  started_at: string;
  completed_at?: string;
}

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  workers: WorkerInChain[];
  default_schedule_days: string[];
  heavy_credits_per_run: number;
  light_tasks_per_run: number;
  is_launch_preset: boolean;
  is_onboarding_preset: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface CreditProjection {
  light_per_run: number;
  heavy_per_run: number;
  schedule_days: string[];
  runs_per_month: number;
  monthly_light: number;
  monthly_heavy: number;
  allowance_light: number;
  allowance_heavy: number;
  remaining_light_after: number;
  remaining_heavy_after: number;
  over_50_percent_light: boolean;
  over_50_percent_heavy: boolean;
}

// Day of week names
export const DAYS_OF_WEEK = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Plan allowances
export const PLAN_ALLOWANCES = {
  starter: { light: 200, heavy: 10 },
  pro:     { light: 500, heavy: 50 },
  operator:{ light: 1250, heavy: 150 },
} as const;

// Heavy worker credit costs
export const HEAVY_WORKER_CREDITS: Record<string, number> = {
  'thumbnail-designer':       1,
  'seo-strategist':           1,
  'content-strategist':       1,
  'business-plan-writer':     1,
  'pitch-deck-writer':        1,
  'whitepaper-writer':        1,
  'email-marketing-strategist':1,
  'personal-brand-strategist':1,  // DEPRECATED — kept for legacy chains
  'website-builder':           2,  // Silas — Website Builder (2cr initial, 1cr section refinement)
  'funnel-strategist':        1,
  'brand-strategist':         1,
  'automation-blueprint-writer':1,
  'resume-screener':          1,
  'competitor-analyst':       2,
  'market-research-analyst':  2,
  // 'swot-analyst' cut Brief 1C — absorbed into market-research-analyst
  'legal-document-drafter':   2,
  'research-assistant':       2,
  'data-analyst':             2,
  'data-cleaner':             2,
  'bookkeeping-summarizer':   2,
  'kpi-dashboard-writer':     1,
  'spreadsheet-builder':      2,
  'logo-concept-generator':   3,
  'social-media-graphics-designer':    3,
  'lead-generator':           5,
  'presentation-builder':     5,
};

export interface WorkerCreditCostOptions {
  /** When true, mode-priced workers must include their canonical workerModeField. */
  requireMode?: boolean;
}

export interface MissingWorkerModeField {
  position: number;
  worker_id: string;
  field: string;
}

function isMissingModeValue(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^\[.*\]$/.test(trimmed) || /^\{.*\}$/.test(trimmed) || /^<.*>$/.test(trimmed);
}

function staticChainCost(workerSlug: string): { light: number; heavy: number } {
  const heavy = HEAVY_WORKER_CREDITS[workerSlug] ?? 0;
  return { light: heavy === 0 ? 1 : 0, heavy };
}

export function getMissingWorkerModeFields(workers: WorkerInChain[]): MissingWorkerModeField[] {
  return workers.flatMap((worker, index) => {
    const meta = getWorkerBySlug(worker.worker_id);
    if (!meta?.workerModeField) return [];
    const hasModes = !!(meta.workerModes?.length || (meta.modeCredits && Object.keys(meta.modeCredits).length > 0));
    if (!hasModes) return [];
    const settings = worker.form_settings ?? worker.config ?? {};
    const modeValue = settings[meta.workerModeField];
    const invalidMode = !!meta.modeCredits && typeof modeValue === 'string' && !isMissingModeValue(modeValue) && meta.modeCredits[modeValue] === undefined;
    return isMissingModeValue(modeValue) || invalidMode
      ? [{
        position: worker.position ?? index + 1,
        worker_id: worker.worker_id,
        field: meta.workerModeField,
      }]
      : [];
  });
}

export function getWorkerCreditCost(
  workerSlug: string,
  formSettings: Record<string, unknown> = {},
  options: WorkerCreditCostOptions = {}
): { light: number; heavy: number } {
  const worker = getWorkerBySlug(workerSlug);
  if (worker?.modeCredits && worker.workerModeField) {
    const modeValue = formSettings[worker.workerModeField];
    if (isMissingModeValue(modeValue)) {
      if (options.requireMode) {
        throw new Error('Choose a mode.');
      }
      // Legacy/no-settings callers keep the existing static chain behavior.
      return staticChainCost(workerSlug);
    }

    const mode = String(modeValue);
    const credits = worker.modeCredits[mode];
    if (credits === undefined) {
      if (options.requireMode) {
        throw new Error('Choose a mode.');
      }
      // Legacy/no-settings callers keep the existing static chain behavior.
      return staticChainCost(workerSlug);
    }
    return { light: credits > 0 ? 0 : 1, heavy: credits };
  }

  return staticChainCost(workerSlug);
}

export function calcChainCostPerRun(
  workers: WorkerInChain[],
  options: WorkerCreditCostOptions = {}
): { light: number; heavy: number } {
  let light = 0, heavy = 0;
  for (const w of workers) {
    const cost = getWorkerCreditCost(w.worker_id, w.form_settings ?? w.config ?? {}, options);
    light += cost.light;
    heavy += cost.heavy;
  }
  return { light, heavy };
}
