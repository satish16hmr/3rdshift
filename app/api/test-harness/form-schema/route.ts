/**
 * Test-only endpoint: returns real form schema for a worker.
 * Protected by CRON_SECRET. NOT exposed in production without the secret.
 * Used by the test harness to get accurate field names — zero regex, zero guessing.
 *
 * GET /api/__test/form-schema?worker=pricing-strategist
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getWorkerFormConfig } from '@/lib/workers/configs';
import { getWorkerBySlug } from '@/lib/workers/registry';

export const maxDuration = 10;

function tokensMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const providedBuffer = encoder.encode(provided);
  const expectedBuffer = encoder.encode(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  // Test-only guard: require CRON_SECRET so this never leaks in production
  const token = new URL(request.url).searchParams.get('token');
  if (!tokensMatch(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = new URL(request.url).searchParams.get('worker');
  if (!slug) {
    return NextResponse.json({ error: 'Missing worker param' }, { status: 400 });
  }

  const formConfig = getWorkerFormConfig(slug);
  const worker = getWorkerBySlug(slug);

  if (!formConfig) {
    return NextResponse.json({ error: `No form config for: ${slug}` }, { status: 404 });
  }

  // Flatten all fields across all sections (including More Options)
  const allFields = formConfig.sections.flatMap(section =>
    section.fields.map(f => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: f.required ?? false,
      defaultValue: (f as any).defaultValue ?? null,
      options: (f as any).options ?? null,
      showWhen: (f as any).showWhen ?? null,
    }))
  );

  const requiredFields = allFields.filter(f => f.required);
  const optionalFields = allFields.filter(f => !f.required);

  return NextResponse.json({
    slug,
    workerName: worker?.name ?? slug,
    personaName: worker?.personaName ?? null,
    subjectField: (worker as any)?.subjectField ?? null,
    submitLabel: formConfig.submitLabel ?? null,
    totalFields: allFields.length,
    requiredFields,
    optionalFields,
    allFields,
  });
}
