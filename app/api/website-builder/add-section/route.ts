import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { logDerivationRejection, extractRejectedFields } from '@/lib/derivation-log';
import { callAI } from '@/lib/ai/callAI';
import SILAS_SYSTEM_PROMPT from '@/lib/workers/website-builder/prompt';
import { injectSharedPromptRules } from '@/lib/workers/configs';
import { debitCredits, refundCredits } from '@/lib/credits/ledger';

// Phase 4 — R5: strict input schema. All derivable fields read from task DB record.
const AddSectionSchema = z.object({
  taskId:           z.string().uuid(),
  sectionType:      z.string().min(1),
  insertAfterOrder: z.number().int().min(0),
}).strict();

// POST /api/website-builder/add-section
// Adds a new section to an existing website. Costs 1 credit.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = AddSectionSchema.safeParse(rawBody);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    await logDerivationRejection({
      userId,
      workspaceId,
      route: '/api/website-builder/add-section',
      rejectedFields: extractRejectedFields(flat),
    });
    return NextResponse.json({ error: 'Invalid request body', details: flat }, { status: 400 });
  }

  const { taskId, sectionType, insertAfterOrder } = parsed.data;

  // Credit check: 1 credit
  let creditOwnerId = userId;
  if (workspaceId) {
    const { data: ws } = await supabaseAdmin.from('workspaces').select('owner_id').eq('id', workspaceId).single();
    if (ws?.owner_id) creditOwnerId = ws.owner_id;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, heavy_credits_remaining, is_founding_member, founding_tier')
    .eq('id', creditOwnerId)
    .single();

  const effectivePlan = profile?.is_founding_member ? (profile.founding_tier || 'starter') : (profile?.plan || 'starter');
  if (effectivePlan === 'starter') {
    return NextResponse.json({ error: 'Adding sections requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  // F3 fix (Phase 13): removed racy read-time credits check.
  // Debit happens atomically via RPC before any AI work below.

  // ── Fetch task — derive all content fields server-side ───────────────────
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, workspace_id, input, output')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.workspace_id !== workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  // Server-derive all fields from task record
  const taskInput  = (task.input  as Record<string, unknown>) ?? {};
  const taskOutput = (task.output as Record<string, unknown>) ?? {};

  const pageType     = String(taskInput.page_type    ?? '');
  const businessName = String(taskInput.business_name ?? '');
  const sections     = (taskOutput.sections as Record<string, { type: string; label?: string; order: number }>) ?? {};
  const shared       = (taskOutput.shared   as { head_html?: string; global_css?: string; tailwind_cdn?: boolean }) ?? {};

  const existingSectionList = Object.values(sections)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(s => `- ${s.label || s.type} (${s.type})`)
    .join('\n');

  // F3 fix: debit BEFORE any AI work. If debit fails, return 402 — no Claude call.
  const addSectionRefId = `${taskId}-add-${sectionType}-${Date.now()}`;
  const preDebitResult = await debitCredits({
    userId: creditOwnerId,
    amount: 1,
    referenceId: addSectionRefId,
    referenceType: 'website_section',
  });
  if (!preDebitResult.ok) {
    const msg = preDebitResult.errorCode === 'insufficient_credits'
      ? 'Not enough credits to add a section (requires 1 credit).'
      : 'Credit reservation failed. Please try again.';
    return NextResponse.json({ error: msg, upgrade_required: preDebitResult.errorCode === 'insufficient_credits' }, { status: 402 });
  }

  const addPrompt = `You are adding a new "${sectionType}" section to an existing website for ${businessName} (page type: ${pageType}).

EXISTING SECTIONS (already on the page — do NOT duplicate them):
${existingSectionList || '(none yet)'}

GLOBAL CSS VARIABLES AND BRAND:
${shared?.global_css?.slice(0, 500) || '(standard blue/white minimal theme)'}

Generate ONLY the new "${sectionType}" section. Make it visually consistent with the existing page's style (Tailwind classes, same color palette, same font/spacing approach).

Apply the appropriate conversion patterns for this section type and this page type.

Return a JSON object ONLY (no markdown, no preamble):
{
  "section_id": "${sectionType}_${Date.now()}",
  "type": "${sectionType}",
  "label": "[Human-readable label, e.g. 'Testimonials']",
  "order": ${insertAfterOrder + 1},
  "html": "[complete section HTML, self-contained, Tailwind classes]",
  "css": "[section-scoped CSS, use unique class prefix like .s-${sectionType.replace(/_/g, '-')}-new]",
  "addition_summary": "[1 sentence: what was built]"
}`;

  let responseRaw = '';
  try {
    const aiResponse = await callAI({
      model_tier: 'sonnet',
      system: injectSharedPromptRules('website-builder', SILAS_SYSTEM_PROMPT),
      messages: [{ role: 'user', content: addPrompt }],
      max_tokens: 4000,
    });
    responseRaw = aiResponse.content || '';
  } catch (err) {
    // AI failed — refund pre-debited credit
    await refundCredits({ userId: creditOwnerId, amount: 1, referenceId: addSectionRefId, referenceType: 'website_section' });
    const msg = err instanceof Error ? err.message : 'AI call failed';
    return NextResponse.json({ error: `Section generation failed: ${msg}` }, { status: 500 });
  }

  let newSection: { section_id?: string; type?: string; label?: string; order?: number; html: string; css?: string; addition_summary?: string };
  try {
    const jsonStart = responseRaw.indexOf('{');
    const jsonEnd = responseRaw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');
    newSection = JSON.parse(responseRaw.slice(jsonStart, jsonEnd + 1));
  } catch {
    await refundCredits({ userId: creditOwnerId, amount: 1, referenceId: addSectionRefId, referenceType: 'website_section' });
    return NextResponse.json({ error: 'Section generation produced invalid output.' }, { status: 500 });
  }

  if (!newSection.html) {
    await refundCredits({ userId: creditOwnerId, amount: 1, referenceId: addSectionRefId, referenceType: 'website_section' });
    return NextResponse.json({ error: 'No HTML in section response.' }, { status: 500 });
  }

  // Credit already debited before AI work — success path.
  return NextResponse.json({
    section_id: newSection.section_id || `${sectionType}_${Date.now()}`,
    type: newSection.type || sectionType,
    label: newSection.label || sectionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    order: newSection.order || insertAfterOrder + 1,
    html: newSection.html,
    css: newSection.css || '',
    addition_summary: newSection.addition_summary || 'New section added.',
  });
}
