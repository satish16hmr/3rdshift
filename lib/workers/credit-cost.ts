export interface CreditCostWorker {
  slug?: string;
  creditCost?: number;
  workerModeField?: string;
  modeCredits?: Record<string, number>;
}

export function deriveEffectiveCreditCost(
  worker: CreditCostWorker,
  input: Record<string, unknown>,
): number {
  if (worker.modeCredits && worker.workerModeField) {
    const canonicalMode = input[worker.workerModeField] as string | undefined;
    if (canonicalMode !== undefined) {
      if (worker.modeCredits[canonicalMode] === undefined) {
        throw new Error(`Invalid mode '${canonicalMode}' for this worker.`);
      }
      return worker.modeCredits[canonicalMode];
    }
    return worker.creditCost ?? 0;
  }

  if (worker.modeCredits && !worker.workerModeField) {
    throw new Error('Worker registry misconfiguration: workerModeField is required when modeCredits is set. Contact support.');
  }

  return worker.creditCost ?? 0;
}
