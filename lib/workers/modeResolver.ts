/**
 * modeResolver.ts — centralized mode + credit cost resolution for all workers.
 *
 * Single source of truth for "what mode is the user in" and "how many credits does it cost."
 * All dashboard and server-side reads MUST use these helpers instead of ad-hoc field lookups.
 *
 * Priority order for getSelectedMode:
 *   1. URL search param ?mode=xxx
 *   2. formValues[worker.workerModeField] (preferred — covers all mixed workers)
 *   3. Legacy hardcoded field names (backwards compat for Mira/Remy/Oscar/Quinn/Silas/Heath/Charlie)
 *   4. null
 */

export interface ModeResolverWorker {
  workerModeField?: string;
  modeCredits?: Record<string, number>;
  creditCost?: number;
}

/**
 * Get the currently selected mode for a worker.
 * Returns the mode key as a string, or null if no mode is selected.
 */
export function getSelectedMode(
  worker: ModeResolverWorker,
  formValues: Record<string, unknown>,
  searchParams?: URLSearchParams | null
): string | null {
  // 1. URL param override
  const urlMode = searchParams?.get('mode')
  if (urlMode) return urlMode

  // 2. Preferred: worker's declared mode field
  if (worker.workerModeField && formValues[worker.workerModeField]) {
    return formValues[worker.workerModeField] as string
  }

  // 3. Legacy hardcoded fields (backwards compat — Mira/Remy/Oscar/Quinn/Silas/Heath/Charlie)
  const legacyFields = ['mode', 'course_mode', 'page_type', 'email_type', 'newsletter_style']
  for (const field of legacyFields) {
    if (formValues[field]) return formValues[field] as string
  }

  return null
}

/**
 * Get the credit cost for a worker's currently selected mode.
 * Returns 0 for free modes, the mode's cost for paid modes, or worker.creditCost as fallback.
 */
export function getCreditCost(
  worker: ModeResolverWorker,
  selectedMode: string | null
): number {
  if (worker.modeCredits && selectedMode && selectedMode in worker.modeCredits) {
    return worker.modeCredits[selectedMode]
  }
  return worker.creditCost ?? 0
}
