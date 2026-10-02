import { NextRequest, NextResponse } from 'next/server';
import { requireZapierAuth } from '@/lib/zapier/helpers';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { getWorkerFormConfig } from '@/lib/workers/configs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireZapierAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { slug } = await params;
  const worker = getWorkerBySlug(slug);

  if (!worker) {
    return NextResponse.json({ error: `Worker "${slug}" not found` }, { status: 404 });
  }

  const formConfig = getWorkerFormConfig(slug);

  if (!formConfig) {
    return NextResponse.json({ error: `No form config found for worker "${slug}"` }, { status: 404 });
  }

  // Flatten all fields from all sections
  const fields = formConfig.sections.flatMap((section) =>
    section.fields.map((field) => ({
      key: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options || null,
      placeholder: field.placeholder || null,
      default_value: field.defaultValue || null,
    }))
  );

  return NextResponse.json({
    worker_slug: slug,
    worker_name: worker.name,
    persona_name: worker.personaName,
    fields,
  });
}
