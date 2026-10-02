import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { logDerivationRejection, extractRejectedFields } from '@/lib/derivation-log';
import { callAI } from '@/lib/ai/callAI';
import SILAS_SYSTEM_PROMPT from '@/lib/workers/website-builder/prompt';
import { injectSharedPromptRules } from '@/lib/workers/configs';
import { resolveImage, defaultQueryForSection } from '@/lib/workers/website-builder/images';
import { debitCredits, refundCredits } from '@/lib/credits/ledger';

// Phase 4 — R6: strict input schema. All derivable fields read from task DB record.
const RefineSectionSchema = z.object({
  taskId:            z.string().uuid(),
  sectionId:         z.string().min(1),
  refinementRequest: z.string().min(1).max(2000),
}).strict();

// POST /api/website-builder/refine-section
// Refines a single section of a Silas website artifact. Costs 1 credit.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RefineSectionSchema.safeParse(rawBody);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    await logDerivationRejection({
      userId,
      workspaceId,
      route: '/api/website-builder/refine-section',
      rejectedFields: extractRejectedFields(flat),
    });
    return NextResponse.json({ error: 'Invalid request body', details: flat }, { status: 400 });
  }

  const { taskId, sectionId, refinementRequest } = parsed.data;

  // ── Credit check: 1 credit ───────────────────────────────────────────────
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
    return NextResponse.json({ error: 'Section refinement requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  // F3 fix (Phase 13): removed racy read-time credits check.
  // Debit happens atomically via RPC before any AI work below.

  // ── Fetch task — derive all content fields server-side ───────────────────
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, workspace_id, status, input, output')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.workspace_id !== workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed' }, { status: 400 });

  // Server-derive all fields from task record — never trust client for these
  const taskInput  = (task.input  as Record<string, unknown>) ?? {};
  const taskOutput = (task.output as Record<string, unknown>) ?? {};

  const pageType           = String(taskInput.page_type          ?? '');
  const businessName       = String(taskInput.business_name      ?? '');
  const businessDescription= String(taskInput.business_description?? businessName);
  const sections           = (taskOutput.sections as Record<string, unknown>) ?? {};
  const shared             = (taskOutput.shared   as Record<string, unknown>) ?? {};

  // Resolve the specific section being refined
  const currentSection = sections[sectionId] as { type: string; order: number; label?: string; html: string; css: string } | undefined;
  if (!currentSection) {
    return NextResponse.json({ error: 'Section not found in task output' }, { status: 404 });
  }

  // ── Build business theme keywords for image query construction ────────────
  const businessTheme = buildBusinessTheme(businessName, businessDescription, pageType);

  // F3 fix: debit BEFORE Claude call. If debit fails, return 402 — no Claude call.
  const refineSectionRefId = `${taskId}-refine-${sectionId}-${Date.now()}`;
  const preDebitResult = await debitCredits({
    userId: creditOwnerId,
    amount: 1,
    referenceId: refineSectionRefId,
    referenceType: 'website_section',
  });
  if (!preDebitResult.ok) {
    const msg = preDebitResult.errorCode === 'insufficient_credits'
      ? 'Not enough credits for section refinement (requires 1 credit).'
      : 'Credit reservation failed. Please try again.';
    return NextResponse.json({ error: msg, upgrade_required: preDebitResult.errorCode === 'insufficient_credits' }, { status: 402 });
  }

  // ── Call Claude for section refinement ───────────────────────────────────
  const refinementPrompt = `You are refining a single section of a website for ${businessName} (page type: ${pageType}).
Business context: ${businessDescription || businessName}

## USER INPUT INTERPRETATION (mandatory — read before processing the request)
Users type on phones. Input will be messy. Your job is to interpret intent, not enforce clean writing.

Rules:
- **Tolerate typos and autocorrect errors** — "hires" means "shows", "their" → "there", "cna" → "can", "fo" → "for", etc. Read for meaning, not spelling.
- **Handle multiple instructions in one message** — "add an image and make the headline bolder" = do both. Treat comma/and-separated instructions as a list.
- **Infer intent from incomplete or casual language** — examples:
  - "more like a real person wrote it" → less corporate, more conversational, shorter sentences
  - "make it pop" → increase visual contrast, bolder typography, stronger CTA color
  - "clean it up" → reduce clutter, improve whitespace, simplify copy
  - "add something about results" → add a social proof element or outcome stat
  - "it looks broken" → fix layout/spacing issues
  - "image on the right" / "add a picture" / "more like content" → add or reposition a contextual image
- **When intent is genuinely ambiguous** — make your best interpretation AND note it in refinement_summary. Never refuse.

## IMAGE QUERY RULES (critical — read every time you add or change an image)
When adding or changing an image, the query MUST be built from business context, NOT the user's words.

Business theme for this site: "${businessTheme}"
Section type: ${currentSection.type}

**Query formula:** [business theme] + [section visual purpose] — 4-6 nouns/adjectives, no verbs
**Good:** "AI technology workspace laptop modern minimal" (for a tech company About section)
**Bad:** "content" (user's word, returns wheat fields)
**Bad:** "work" (too generic)
**Bad:** Copy-pasting the user's request words into the query

CURRENT SECTION:
Type: ${currentSection.type}
Label: ${currentSection.label || currentSection.type}
Order: ${currentSection.order}

Current HTML:
${currentSection.html}

Current CSS:
${currentSection.css || '(none)'}

REFINEMENT REQUEST (interpret generously — user typed this on mobile):
${refinementRequest}

Apply all requested changes. Keep everything not mentioned identical.

Return a JSON object ONLY (no markdown, no preamble, no text after the closing brace):
{
  "section_id": "${sectionId}",
  "type": "${currentSection.type}",
  "label": "${currentSection.label || currentSection.type}",
  "html": "[complete updated section HTML, Picsum URLs for any images]",
  "css": "[complete updated section CSS]",
  "refinement_summary": "[1 sentence: what changed and how you interpreted any unclear input]",
  "images": [
    {
      "id": "[unique_image_id]",
      "type": "unsplash",
      "query": "[4-6 business-context keywords — NOT user's words]",
      "seed": [integer matching Picsum seed in HTML],
      "width": [width px],
      "height": [height px],
      "alt": "[descriptive alt text]",
      "section_id": "${sectionId}"
    }
  ]
}

If this section has no images, return: "images": []`;

  let responseRaw = '';
  try {
    const aiResponse = await callAI({
      model_tier: 'sonnet',
      system: injectSharedPromptRules('website-builder', SILAS_SYSTEM_PROMPT),
      messages: [{ role: 'user', content: refinementPrompt }],
      max_tokens: 6000,
    });
    responseRaw = aiResponse.content || '';
  } catch (err) {
    // Claude failed — refund pre-debited credit
    await refundCredits({ userId: creditOwnerId, amount: 1, referenceId: refineSectionRefId, referenceType: 'website_section' });
    const msg = err instanceof Error ? err.message : 'AI call failed';
    console.error('[Silas refine] Claude error:', msg);
    return NextResponse.json({ error: 'Refinement failed. Please try again.' }, { status: 500 });
  }

  // ── Parse response ────────────────────────────────────────────────────────
  type RefinedImage = { id: string; type: string; query?: string; seed?: number; width?: number; height?: number; url?: string; alt?: string; section_id?: string };
  let refined: { html: string; css: string; refinement_summary?: string; images?: RefinedImage[] };
  try {
    const jsonStart = responseRaw.indexOf('{');
    const jsonEnd = responseRaw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');
    refined = JSON.parse(responseRaw.slice(jsonStart, jsonEnd + 1));
  } catch {
    await refundCredits({ userId: creditOwnerId, amount: 1, referenceId: refineSectionRefId, referenceType: 'website_section' });
    console.error('[Silas refine] JSON parse failed, raw:', responseRaw.slice(0, 300));
    return NextResponse.json({ error: 'Refinement produced invalid output. Please try again.' }, { status: 500 });
  }

  if (!refined.html) {
    await refundCredits({ userId: creditOwnerId, amount: 1, referenceId: refineSectionRefId, referenceType: 'website_section' });
    return NextResponse.json({ error: 'No HTML in refinement response.' }, { status: 500 });
  }

  // ── Resolve images via Unsplash (replace Picsum placeholders in HTML) ─────
  let resolvedHtml = refined.html;
  const resolvedImages: RefinedImage[] = [];

  if (refined.images && refined.images.length > 0) {
    await Promise.all(refined.images.map(async (img) => {
      const w = img.width || 1200;
      const h = img.height || 600;
      const seed = img.seed || Math.floor(Math.random() * 1000);

      const claudeQuery = (img.query || '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
      const queryWords = claudeQuery.split(/\s+/).filter((w: string) => w.length > 2).length;
      const query = (claudeQuery && queryWords >= 4)
        ? `${businessTheme} ${claudeQuery}`.slice(0, 120)
        : `${businessTheme} ${defaultQueryForSection(currentSection.type, pageType)}`;

      try {
        const resolved = await resolveImage(query, w, h, seed);
        resolvedImages.push({ ...img, url: resolved.url, type: resolved.source });

        if (resolved.source === 'unsplash') {
          const picsumPattern = new RegExp(`https://picsum\\.photos/${w}/${h}\\?random=${seed}`, 'g');
          resolvedHtml = resolvedHtml.replace(picsumPattern, resolved.url);
        }
      } catch {
        resolvedImages.push({ ...img, type: 'picsum' });
      }
    }));
  }

  // Credit already debited before Claude call — success path.
  return NextResponse.json({
    html: resolvedHtml,
    css: refined.css || '',
    refinement_summary: refined.refinement_summary || 'Section updated.',
    images: resolvedImages,
  });
}

// ── Business theme keyword extractor ─────────────────────────────────────────
function buildBusinessTheme(businessName: string, businessDescription: string, pageType: string): string {
  const combined = `${businessName} ${businessDescription}`.toLowerCase();

  if (/\bai\b|artificial intelligence|machine learning|automation|ai-powered|saas|\bsoftware\b|\bplatform\b|\bdashboard\b/.test(combined)) {
    return 'AI technology software dashboard professional';
  }
  if (/fitness|health|wellness|workout|gym|nutrition|diet/.test(combined)) {
    return 'fitness health active lifestyle professional';
  }
  if (/finance|fintech|investment|money|banking|payment|crypto/.test(combined)) {
    return 'finance professional business modern office';
  }
  if (/real estate|property|housing|home|mortgage/.test(combined)) {
    return 'real estate professional modern architecture';
  }
  if (/food|restaurant|cafe|cooking|chef|culinary/.test(combined)) {
    return 'food restaurant professional kitchen culinary';
  }
  if (/education|course|learning|training|coaching|teach/.test(combined)) {
    return 'education learning professional workshop modern';
  }
  if (/marketing|agency|creative|design|brand/.test(combined)) {
    return 'marketing creative agency professional workspace';
  }
  if (/ecommerce|store|shop|product|retail/.test(combined)) {
    return 'ecommerce product business modern professional';
  }
  if (/legal|law|attorney|consulting|advisory/.test(combined)) {
    return 'legal professional office formal business';
  }
  if (/startup|founder|entrepreneur|bootstrapped|indie/.test(combined)) {
    return 'startup founder laptop workspace professional';
  }

  return 'professional business workspace laptop minimal';
}
