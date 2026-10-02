import { getWorkerBySlug } from '@/lib/workers/registry';
import type { WorkerInChain } from './types';

export interface ChainIncompatibleWorker {
  position: number;
  worker_id: string;
  name?: string;
  personaName?: string;
}

export function getChainIncompatibleWorkers(workers: WorkerInChain[]): ChainIncompatibleWorker[] {
  return workers.flatMap((worker, index) => {
    const registryWorker = getWorkerBySlug(worker.worker_id);
    if (registryWorker?.chainCompatible !== false) return [];

    return [{
      position: worker.position ?? index + 1,
      worker_id: worker.worker_id,
      name: registryWorker.name,
      personaName: registryWorker.personaName,
    }];
  });
}

export function formatChainIncompatibleWorkerError(incompatibleWorkers: ChainIncompatibleWorker[]): string {
  if (incompatibleWorkers.length === 0) return '';
  if (incompatibleWorkers.length === 1) {
    const worker = incompatibleWorkers[0];
    const label = worker.personaName && worker.name
      ? `${worker.personaName} (${worker.name})`
      : worker.worker_id;
    return `Invalid worker in chain: "${worker.worker_id}". ${label} cannot be used in Agent Mode chains.`;
  }

  const slugs = incompatibleWorkers.map(worker => `"${worker.worker_id}"`).join(', ');
  return `Invalid workers in chain: ${slugs}. These team members cannot be used in Agent Mode chains.`;
}
