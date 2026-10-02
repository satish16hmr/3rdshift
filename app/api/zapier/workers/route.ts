import { NextRequest, NextResponse } from 'next/server';
import { requireZapierAuth } from '@/lib/zapier/helpers';
import { workers } from '@/lib/workers/registry';

export async function GET(req: NextRequest) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;

  const activeWorkers = workers
    .filter((w) => w.active)
    .map((w) => ({
      slug: w.slug,
      name: w.name,
      persona_name: w.personaName,
      emoji: w.emoji,
      category: w.category,
      task_type: w.taskType,
      credit_cost: w.taskType === 'heavy' ? (w.creditCost ?? 1) : 0,
      // F5: include modeCredits so Zapier integrators see accurate per-mode cost ranges
      mode_credits: w.modeCredits ?? null,
      worker_mode_field: w.workerModeField ?? null,
      output_format: w.outputFormat,
      description: w.description,
    }));

  // Return flat array for Zapier dynamic dropdown compatibility
  // Zapier expects [{id, label, ...}] not a wrapped object
  const zapierFormatted = activeWorkers.map(w => ({
    id: w.slug,
    label: `${w.persona_name} · ${w.name}`,
    ...w,
  }));

  return NextResponse.json(zapierFormatted);
}
