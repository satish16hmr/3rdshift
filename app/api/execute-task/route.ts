export const maxDuration = 800; // 800s - Fluid Compute enabled; Premium mode needs ~5 min for 20K tokens

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { debitCredits as ledgerDebit, refundCredits as ledgerRefund } from '@/lib/credits/ledger';
import { verifyInternalSecret } from '@/lib/security';
import { fireZapierWebhooks } from '@/lib/zapier/helpers';
import OpenAI from 'openai';
import { callAI, logExternalAPICall } from '@/lib/ai/callAI';
import PptxGenJS from 'pptxgenjs';
import { OSWALD_BOLD_B64 } from '@/lib/oswald-font';
import { getWorkerPromptConfig } from '../../../lib/workers/configs';
import { getModelForWorker } from '../../../lib/ai/router';
import { captureTaskError } from '@/lib/sentry';
import { inngest } from '@/lib/inngest/client';
import { getWorkerBySlug } from '../../../lib/workers/registry';
import { getAvailableCredits } from '@/lib/billing/available-credits';
import { ensureTaskCreditsDebited, resolveTaskCreditOwner } from '@/lib/tasks/credit-debit';
import { claimPendingTaskForExecution } from '@/lib/tasks/claim';
import { assertSafeUrl, SsrfError } from '@/lib/ssrf';
import {
  buildReedThumbnailPrompts,
  getReedPlatformSpec,
  normalizeReedStyle,
  REED_FACE_FALLBACK_MODEL,
  REED_MODEL,
  type ReedConcept,
} from '../../../lib/workers/thumbnail-designer/prompt';
import {
  elevenLabsTTS,
  elevenLabsScribe,
  elevenLabsSFX,
  elevenLabsStartDubbing,
  elevenLabsPollDubbing,
  elevenLabsDownloadDubbing,
} from '../../../lib/elevenlabs';
import {
  atlasUploadMedia,
  atlasGenerateVideoWithResponse,
  ASPECT_RATIO_MAP,
  DURATION_MAP,
} from '../../../lib/atlascloud';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { ensureHumanReviewDisclaimer } from '@/lib/workers/disclaimers';


function appendContextPrompt(base: string, ...contexts: Array<string | undefined | null>): string {
  return base + contexts.filter((value): value is string => Boolean(value)).join('');
}

function enforceHighStakesDisclaimer(workerSlug: string, text: string): string {
  return workerSlug === 'legal-document-drafter' || workerSlug === 'resume-screener'
    ? ensureHumanReviewDisclaimer(text)
    : text;
}

// ── Pad image to target aspect ratio for Seedance (ignores aspect_ratio param on i2v) ──
async function padImageToAspectRatio(imgBuf: Buffer, aspectRatio: string): Promise<Buffer> {
  const ratioMap: Record<string, [number, number]> = {
    '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5],
  };
  const ratio = ratioMap[aspectRatio];
  if (!ratio) return imgBuf; // unknown ratio, return as-is
  const [rw, rh] = ratio;
  const meta = await sharp(imgBuf).metadata();
  const srcW = meta.width || 1280;
  const srcH = meta.height || 720;
  const targetAR = rw / rh;
  const srcAR = srcW / srcH;
  let canvasW: number, canvasH: number;
  if (Math.abs(srcAR - targetAR) < 0.05) return imgBuf; // already close enough
  if (srcAR > targetAR) {
    // wider than target - add top/bottom padding
    canvasW = srcW;
    canvasH = Math.round(srcW / targetAR);
  } else {
    // taller than target - add left/right padding
    canvasH = srcH;
    canvasW = Math.round(srcH * targetAR);
  }
  return sharp(imgBuf)
    .resize(canvasW, canvasH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}
import * as os from 'os';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic?.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Inline PPTX generator ────────────────────────────────────────────────────
interface PptxSlide { title: string; bullets: string[]; speakerNotes?: string }

function parseSlides(text: string): PptxSlide[] {
  const slides: PptxSlide[] = []
  // Split on any slide marker: "Slide N", "## Slide N", "**Slide N**", "SLIDE N"
  const blocks = text.split(/\n(?=(?:#{1,3}\s*)?(?:\*{0,2})Slide\s+\d+)/i).filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue
    // Extract title from first line - strip markdown, slide number prefix
    const rawTitle = lines[0]
      .replace(/^#{1,3}\s*/,'')
      .replace(/^\*{1,2}|\*{1,2}$/g,'')
      .replace(/^Slide\s+\d+[:\s.-]+/i,'')
      .trim()
    const title = rawTitle || lines[0]
    const bullets: string[] = []
    let speakerNotes = ''
    let inNotes = false
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.match(/^speaker notes?[:\s]/i)) {
        inNotes = true
        const t = line.replace(/^speaker notes?[:\s]*/i,'').trim()
        if (t) speakerNotes += t + ' '
        continue
      }
      if (inNotes) { speakerNotes += line + ' '; continue }
      // Skip sub-headers, empty lines
      if (line.match(/^#{1,3}\s/) || !line) continue
      const cleaned = line.replace(/^[-•*]\s*/,'').replace(/\*\*/g,'').trim()
      if (cleaned && !cleaned.match(/^(?:Slide\s+\d+|#)/i)) bullets.push(cleaned)
    }
    if (title) slides.push({ title: title.replace(/\*\*/g,''), bullets, speakerNotes: speakerNotes.trim() })
  }
  if (slides.length === 0) {
    slides.push({ title: 'Presentation', bullets: text.split('\n').filter(l=>l.trim()).slice(0,8) })
  }
  return slides
}

async function generatePptxInlineBlair(params: { taskId: string; slideText: string; companyName: string; title: string; supabase: any }): Promise<{ success: boolean; error?: string }> {
  const { taskId, slideText, companyName, title, supabase } = params
  try {
    const slides = parseSlides(slideText)
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'
    const BLUE = '2563EB', DARK = '0F172A', WHITE = 'FFFFFF', GRAY = '9CA3AF', LIGHT_BLUE = '93C5FD'

    // Title slide
    const ts = pptx.addSlide()
    ts.background = { color: DARK }
    ts.addText(companyName, { x:0.5, y:2.0, w:'90%', h:1.2, fontSize:40, bold:true, color:WHITE, align:'center', fontFace:'Calibri' })
    const subtitle = title !== companyName ? title.replace(companyName + ': ', '') : ''
    if (subtitle) {
      ts.addText(subtitle, { x:0.5, y:3.3, w:'90%', h:0.7, fontSize:20, color:LIGHT_BLUE, align:'center', fontFace:'Calibri', italic:true })
    }
    ts.addText('Built with 3rdShift · Blair, Pitch Deck Writer', { x:0.5, y:4.4, w:'90%', h:0.4, fontSize:12, color:GRAY, align:'center', fontFace:'Calibri' })
    ts.addShape(pptx.ShapeType.rect, { x:0, y:6.8, w:'100%', h:0.2, fill:{color:BLUE}, line:{color:BLUE} })

    // Content slides
    for (let i = 0; i < Math.min(slides.length, 40); i++) {
      const s = slides[i]
      const ps = pptx.addSlide()
      ps.background = { color: WHITE }

      // Blue header bar
      ps.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:1.1, fill:{color:BLUE}, line:{color:BLUE} })
      ps.addText(`${i+1}`, { x:9.0, y:0.2, w:0.6, h:0.5, fontSize:10, color:'BFDBFE', align:'right', fontFace:'Calibri' })
      ps.addText(s.title, { x:0.4, y:0.12, w:8.4, h:0.86, fontSize:24, bold:true, color:WHITE, fontFace:'Calibri', valign:'middle' })

      const bulletsCapped = s.bullets.slice(0, 5)
      if (bulletsCapped.length > 0) {
        const bulletFontSize = bulletsCapped.length <= 3 ? 18 : 16
        const spaceBefore = bulletsCapped.length <= 3 ? 12 : 8
        const spaceAfter  = bulletsCapped.length <= 3 ? 12 : 8
        ps.addText(
          bulletsCapped.map((b, bi) => ({
            text: b,
            options: {
              fontSize: bulletFontSize,
              color: DARK,
              fontFace: 'Calibri',
              bullet: { type: 'bullet' as const },
              paraSpaceBefore: bi === 0 ? 6 : spaceBefore,
              paraSpaceAfter: spaceAfter,
              breakLine: true,
            },
          })),
          { x:0.5, y:1.25, w:9.0, h:5.3, fontFace:'Calibri', valign:'top', lineSpacingMultiple:1.4, autoFit:true }
        )
      }

      if (s.speakerNotes) ps.addNotes(s.speakerNotes)

      const footerRaw = companyName.length > 48 ? companyName.slice(0, 48).replace(/\s\S+$/, '').trim() : companyName
      ps.addText(footerRaw, { x:0.4, y:6.85, w:8.5, h:0.2, fontSize:9, color:'9CA3AF', fontFace:'Calibri' })
    }

    // End slide
    const es = pptx.addSlide()
    es.background = { color: BLUE }
    es.addText('Thank You', { x:0.5, y:2.5, w:'90%', h:1.0, fontSize:40, bold:true, color:WHITE, align:'center', fontFace:'Calibri' })
    es.addText('Built with 3rdShift', { x:0.5, y:3.7, w:'90%', h:0.4, fontSize:14, color:'BFDBFE', align:'center', fontFace:'Calibri' })

    const buf = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
    const expiresAt = new Date(Date.now() + 48*60*60*1000).toISOString()
    const fileName = `${taskId}/pitch-deck-${Date.now()}.pptx`

    const { error: uploadErr } = await supabase.storage.from('generated-files')
      .upload(fileName, buf, { contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation', upsert:false })

    let downloadUrl = ''
    if (!uploadErr) {
      const { data: signed } = await supabase.storage.from('generated-files').createSignedUrl(fileName, 48*60*60)
      downloadUrl = signed?.signedUrl || ''
    }

    const slideSummary = slides.map((s,i) => `Slide ${i+1}: ${s.title}`).join('\n')
    await (supabase.from('tasks') as any).update({
      output: { format:'pptx', downloadUrl, fileName:`${companyName.replace(/[^a-z0-9]/gi,'-')}-pitch-deck.pptx`, storagePath:fileName, expiresAt, slideCount:slides.length+2, slideSummary, presentationTitle:companyName },
      output_format: 'pptx', status:'completed', completed_at: new Date().toISOString(),
    }).eq('id', taskId)

    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'PPTX failed' }
  }
}

async function generatePptxInline(params: { taskId: string; slideText: string; title: string; supabase: any }): Promise<{ success: boolean; error?: string }> {
  const { taskId, slideText, title, supabase } = params
  try {
    const slides = parseSlides(slideText)
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    const BLUE = '2563EB', DARK = '111113', WHITE = 'FFFFFF', GRAY = '9CA3AF'

    // Title slide
    const ts = pptx.addSlide()
    ts.background = { color: DARK }
    ts.addText(title, { x:0.5, y:2.4, w:'90%', h:1.2, fontSize:34, bold:true, color:WHITE, align:'center', fontFace:'Calibri' })
    ts.addText('Built with 3rdShift · Mack, Presentation Builder', { x:0.5, y:3.8, w:'90%', h:0.4, fontSize:12, color:GRAY, align:'center', fontFace:'Calibri' })
    ts.addShape(pptx.ShapeType.rect, { x:0, y:6.8, w:'100%', h:0.2, fill:{color:BLUE}, line:{color:BLUE} })

    // Content slides
    for (let i = 0; i < Math.min(slides.length, 40); i++) {
      const s = slides[i]
      const ps = pptx.addSlide()
      ps.background = { color: WHITE }

      // Blue header bar
      ps.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:1.1, fill:{color:BLUE}, line:{color:BLUE} })

      // Slide number (top-right, subtle)
      ps.addText(`${i+1}`, { x:9.0, y:0.2, w:0.6, h:0.5, fontSize:10, color:'BFDBFE', align:'right', fontFace:'Calibri' })

      // Title in header
      ps.addText(s.title, { x:0.4, y:0.12, w:8.4, h:0.86, fontSize:24, bold:true, color:WHITE, fontFace:'Calibri', valign:'middle' })

      // Bullet points - each on its own line with clean spacing
      const bulletsCapped = s.bullets.slice(0, 5)
      if (bulletsCapped.length > 0) {
        const bulletFontSize = bulletsCapped.length <= 3 ? 18 : 16
        const spaceBefore = bulletsCapped.length <= 3 ? 12 : 8
        const spaceAfter  = bulletsCapped.length <= 3 ? 12 : 8

        ps.addText(
          bulletsCapped.map((b, bi) => ({
            text: b,
            options: {
              fontSize: bulletFontSize,
              color: DARK,
              fontFace: 'Calibri',
              bullet: { type: 'bullet' as const },
              paraSpaceBefore: bi === 0 ? 6 : spaceBefore,
              paraSpaceAfter: spaceAfter,
              breakLine: true,
            },
          })),
          {
            x: 0.5,
            y: 1.25,
            w: 9.0,
            h: 5.3,
            fontFace: 'Calibri',
            valign: 'top',
            lineSpacingMultiple: 1.4,
            autoFit: true,
          }
        )
      }

      if (s.speakerNotes) ps.addNotes(s.speakerNotes)

      // Footer - strip everything after em/en dash, truncate at word boundary
      const footerRaw = title.replace(/\s*[--:]\s*.*/g, '').trim()
      const footerText = footerRaw.length > 48
        ? footerRaw.slice(0, 48).replace(/\s\S+$/, '').trim()
        : footerRaw
      ps.addText(footerText, { x:0.4, y:6.85, w:8.5, h:0.2, fontSize:9, color:'9CA3AF', fontFace:'Calibri' })
    }

    // End slide
    const es = pptx.addSlide()
    es.background = { color: BLUE }
    es.addText('Thank You', { x:0.5, y:2.5, w:'90%', h:1.0, fontSize:40, bold:true, color:WHITE, align:'center', fontFace:'Calibri' })
    es.addText('Built with 3rdShift', { x:0.5, y:3.7, w:'90%', h:0.4, fontSize:14, color:'BFDBFE', align:'center', fontFace:'Calibri' })

    const buf = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
    const expiresAt = new Date(Date.now() + 48*60*60*1000).toISOString()
    const fileName = `${taskId}/presentation-${Date.now()}.pptx`

    const { error: uploadErr } = await supabase.storage.from('generated-files')
      .upload(fileName, buf, { contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation', upsert:false })

    let downloadUrl = ''
    if (!uploadErr) {
      const { data: signed } = await supabase.storage.from('generated-files').createSignedUrl(fileName, 48*60*60)
      downloadUrl = signed?.signedUrl || ''
    }

    const slideSummary = slides.map((s,i) => `Slide ${i+1}: ${s.title}`).join('\n')
    await (supabase.from('tasks') as any).update({
      output: { format:'pptx', downloadUrl, fileName:`${title.replace(/[^a-z0-9]/gi,'-')}.pptx`, storagePath:fileName, expiresAt, slideCount:slides.length+2, slideSummary, presentationTitle:title },
      output_format: 'pptx', status:'completed', completed_at: new Date().toISOString(),
    }).eq('id', taskId)

    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'PPTX failed' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runImageGeneration(params: {
  taskId: string;
  prompts: string[];
  size: string;
  isThumbnail: boolean;
  supabase: any;
}) {
  const { taskId, prompts, size, isThumbnail, supabase } = params;
  const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
  const dalleSize = (validSizes.includes(size) ? size : '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792';
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const generatedImages: { url: string; storagePath: string; prompt: string }[] = [];

  for (const prompt of prompts.slice(0, 5)) {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: isThumbnail
        ? `YouTube thumbnail (16:9, high contrast, bold, eye-catching): ${prompt}`
        : prompt,
      n: 1,
      size: dalleSize,
      quality: 'standard',
      response_format: 'b64_json',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) continue;

    const imgBuffer = Buffer.from(b64, 'base64');
    const fileName = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imgBuffer, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      const tempUrl = response.data?.[0]?.url || '';
      generatedImages.push({ url: tempUrl, storagePath: '', prompt });
      continue;
    }

    const { data: signedData } = await supabase.storage
      .from('generated-images')
      .createSignedUrl(fileName, 48 * 60 * 60);

    generatedImages.push({ url: signedData?.signedUrl || '', storagePath: fileName, prompt });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('tasks') as any).update({
    output: {
      images: generatedImages,
      format: 'images',
      expiresAt,
      isThumbnail,
      size: isThumbnail ? '1280×720' : (size || '1024×1024'),
    },
    output_format: 'images',
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', taskId);
}

const AUTO_IMAGE_WORKER_SLUGS = new Set([
  'content-writer',
  'newsletter-writer',
  'case-study-writer',
  'linkedin-ghostwriter',
  'social-media-creator',
  'podcast-show-notes-writer',
  'ad-copywriter',
  'x-twitter-ghostwriter',
]);

function wantsAutoGeneratedImage(input: Record<string, unknown> | null | undefined) {
  const raw = input?.include_ai_generated_image;
  return raw === true || raw === 'true' || raw === 'Yes' || raw === 'yes' || raw === 'on';
}

function buildAutoImagePrompt(params: {
  workerSlug: string;
  input: Record<string, unknown>;
  resultText: string;
}) {
  const { workerSlug, input, resultText } = params;
  const requestedPrompt = typeof input.ai_image_prompt === 'string' ? input.ai_image_prompt.trim() : '';

  if (requestedPrompt) {
    return `Create one polished contextual image to accompany a 3rdShift ${workerSlug} written deliverable.

Use this user-provided image direction as the primary prompt:
${requestedPrompt}

Use a clean modern editorial or marketing style. The image should feel useful for publishing and appropriate for a business audience.

Do not include any words, letters, captions, logos, watermarks, UI screenshots, charts with readable text, or brand marks.`;
  }

  const contextFields = [
    'topic',
    'newsletter_topic',
    'target_audience',
    'audience',
    'customer_name_or_description',
    'industry_or_category',
    'podcast_name',
    'episode_topic',
    'platform',
    'product',
    'goal',
    'tone',
    'niche',
  ];
  const inputContext = contextFields
    .map((key) => {
      const value = input[key];
      if (typeof value !== 'string' || !value.trim()) return null;
      return `${key}: ${value.trim()}`;
    })
    .filter(Boolean)
    .join('\n');
  const excerpt = resultText.replace(/\s+/g, ' ').slice(0, 900);

  return `Create one polished contextual image to accompany a 3rdShift ${workerSlug} written deliverable.

Use a clean modern editorial or marketing style. The image should feel specific to the subject, useful for publishing, and appropriate for a business audience.

Do not include any words, letters, captions, logos, watermarks, UI screenshots, charts with readable text, or brand marks.

Task context:
${inputContext || 'No structured context provided.'}

Deliverable excerpt:
${excerpt}`;
}

async function generateAutoImageForTextTask(params: {
  taskId: string;
  userId: string;
  workerSlug: string;
  input: Record<string, unknown>;
  resultText: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const { taskId, userId, workerSlug, input, resultText, supabase } = params;
  const model = 'gpt-image-1-mini';
  const size = '1024x1024';
  const quality = 'low';
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const startedAt = Date.now();
  const prompt = buildAutoImagePrompt({ workerSlug, input, resultText });

  try {
    const response = await (openai.images.generate as any)({
      model,
      prompt,
      n: 1,
      size,
      quality,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error('Image generation returned no image data');

    const imgBuffer = Buffer.from(b64, 'base64');
    const fileName = `${taskId}/auto-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imgBuffer, { contentType: 'image/png', upsert: false });

    if (uploadError) throw uploadError;

    const { data: signedData } = await supabase.storage
      .from('generated-images')
      .createSignedUrl(fileName, 48 * 60 * 60);

    if (!signedData?.signedUrl) throw new Error('Image uploaded but signed URL was not created');

    const latencyMs = Date.now() - startedAt;
    logExternalAPICall({
      user_id: userId,
      task_id: taskId,
      worker_id: workerSlug,
      provider: 'openai-images',
      success: true,
      latency_ms: latencyMs,
      metadata: { model, size, quality, image_count: 1, storage_path: fileName },
    });

    return {
      image: {
        url: signedData.signedUrl,
        storagePath: fileName,
        prompt,
        source: 'auto_text_image',
      },
      metadata: {
        requested: true,
        status: 'completed',
        model,
        size,
        quality,
        imageCount: 1,
        latencyMs,
        expiresAt,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : 'Image generation failed';
    console.error('[auto-image] generation failed:', message);
    logExternalAPICall({
      user_id: userId,
      task_id: taskId,
      worker_id: workerSlug,
      provider: 'openai-images',
      success: false,
      latency_ms: latencyMs,
      metadata: { model, size, quality, error: message },
    });
    return {
      image: null,
      metadata: {
        requested: true,
        status: 'failed',
        model,
        size,
        quality,
        latencyMs,
        expiresAt,
        error: message,
      },
    };
  }
}

// ── Video helper functions ───────────────────────────────────────────────────
function extractVideoStoragePath(content: string): { storagePath: string | null; cleanContent: string } {
  const match = content.match(/^\[VIDEO_STORAGE_PATH:([^\]]+)\]/);
  if (match) {
    return { storagePath: match[1], cleanContent: content.replace(/^\[VIDEO_STORAGE_PATH:[^\]]+\]\n?/, '') };
  }
  return { storagePath: null, cleanContent: content };
}

interface ClipTimestamp {
  clip_number: number;
  start_seconds: number;
  end_seconds: number;
  description: string;
  reason?: string;
}

function parseClipTimestamps(text: string): ClipTimestamp[] {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function extractClip(inputPath: string, outputPath: string, startSeconds: number, durationSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(durationSeconds)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

function extractThumbnail(inputPath: string, outputPath: string, offsetSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(offsetSeconds)
      .frames(1)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', () => resolve())
      .run();
  });
}

function burnCaptions(inputPath: string, srtPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([`-vf subtitles=${srtPath}`])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

// Use service role to bypass RLS for task execution
function createClient() {
  return supabaseAdmin;
}

// All AI calls go through callAI() in lib/ai/callAI.ts
// callAI() handles Anthropic primary → OpenAI fallback automatically

/**
 * F2 fix: Centralized task failure + refund helper.
 *
 * Every failure branch in execute-task that sets task status='failed' must call
 * this instead of directly calling supabase.update({ status: 'failed' }).
 * Ensures credits are ALWAYS refunded when a task fails, regardless of which
 * branch fails or whether the failure reaches the route-level catch block.
 *
 * The outer catch block still exists as a last-resort safety net, but this
 * helper is the primary refund path for all known failure branches.
 */
async function failTaskAndRefund(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  taskId: string;
  userId: string;
  reason: string;
  creditsCharged: number;
  workspaceId?: string | null;
  output?: Record<string, unknown>;
}): Promise<void> {
  const { supabase, taskId, userId, reason, creditsCharged, workspaceId, output } = opts;

  // Mark task failed
  await supabase
    .from('tasks')
    .update({
      status: 'failed',
      error_message: reason,
      output: output ?? { error: reason },
    })
    .eq('id', taskId);

  // Refund if credits were charged
  if (creditsCharged > 0) {
    try {
      const refund = await ledgerRefund({
        userId,
        amount: creditsCharged,
        referenceId: taskId,
        referenceType: 'task',
        workspaceId: workspaceId ?? null,
      });
      if (refund.ok) {
        await supabase.from('tasks').update({ refund_applied: true }).eq('id', taskId);
      } else if (refund.errorCode === 'no_original_debit') {
        // Debit not found - already refunded or was a free task. Log and continue.
        console.warn(`[failTaskAndRefund] no_original_debit for task ${taskId} - already refunded or free task.`);
        await supabase.from('tasks').update({ refund_applied: true }).eq('id', taskId);
      } else {
        console.error(`[failTaskAndRefund] Refund failed for task ${taskId}: errorCode=${refund.errorCode}`);
      }
    } catch (e) {
      console.error(`[failTaskAndRefund] Refund exception for task ${taskId}:`, e);
    }
  }
}

export async function POST(request: NextRequest) {
  // Allow internal service-role calls (e.g., from Zapier create-task endpoint)
  const isInternalCall = verifyInternalSecret(request);

  let authedUserId: string;
  let authedWorkspaceId: string | null = null;
  if (isInternalCall) {
    // Service-level call - user_id comes from the task record itself
    authedUserId = 'service';
  } else {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    authedUserId = auth.userId;
    authedWorkspaceId = auth.workspaceId;
  }

  let taskId: string | undefined;
  let _outerCreditCost: number = 0;
  let _outerCreditOwnerId: string | undefined;

  try {
    const body = await request.json();
    taskId = body.taskId;
    const alreadyClaimedByInternalExecutor = isInternalCall && body.alreadyClaimed === true;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch task for existence/auth/rate-limit checks. This read is not the claim;
    // execution is gated below by an atomic UPDATE ... WHERE status='pending'.
    const { data: taskForChecks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !taskForChecks) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // O-C01 / Item 1 fix: verify task ownership for non-internal calls
    // Internal calls (x-internal-secret) are server-to-server from verified flows (Zapier, cron)
    if (!isInternalCall) {
      const ownsTask = taskForChecks.user_id === authedUserId ||
        (taskForChecks.workspace_id && taskForChecks.workspace_id === authedWorkspaceId);
      if (!ownsTask) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // ── Rate limit: Charlie (course-outline-builder) - max 5 tasks per rolling 24h window ──
    if (taskForChecks.worker_slug === 'course-outline-builder') {
      const { supabaseAdmin: adminRL } = await import('@/lib/api-auth');
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await adminRL
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', taskForChecks.user_id)
        .eq('worker_slug', 'course-outline-builder')
        .neq('id', taskId) // exclude the current task
        .in('status', ['completed', 'processing']) // only count successful/in-progress tasks
        .gte('created_at', windowStart);
      if ((count ?? 0) >= 5) {
        await supabase.from('tasks').update({
          status: 'failed',
          error_message: 'Daily limit reached. You can build up to 5 courses per day. Your limit resets 24 hours after your first build today.',
        }).eq('id', taskId).eq('status', 'pending');
        return NextResponse.json(
          { error: 'You\'ve reached today\'s Charlie limit (5 course builds per day). Your limit resets on a rolling 24-hour window.' },
          { status: 429 }
        );
      }
    }

    let task = taskForChecks;
    if (alreadyClaimedByInternalExecutor) {
      if (taskForChecks.status !== 'processing') {
        return NextResponse.json({ error: 'Task was not claimed for execution' }, { status: 409 });
      }
    } else {
      const claim = await claimPendingTaskForExecution(supabase, taskId);
      if (!claim.claimed) {
        return NextResponse.json({ error: 'Task is not pending or was already claimed' }, { status: 409 });
      }
      task = claim.task;
    }

    // Get worker prompt config
    const workerConfig = getWorkerPromptConfig(task.worker_slug);
    const workerRegistryConfig = getWorkerBySlug(task.worker_slug);

    if (!workerConfig) {
      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          error_message: `No prompt config found for worker: ${task.worker_slug}`,
        })
        .eq('id', taskId);
      return NextResponse.json({ error: 'Worker config not found' }, { status: 400 });
    }

    // ── Server-side plan gate: block Starter from heavy workers ────
    // Heavy workers require Pro+ (credits). Starters cannot POST to heavy worker endpoints.
    {
      const registryWorker = getWorkerBySlug(task.worker_slug);
      const isHeavyWorker = registryWorker?.taskType === 'heavy';
      const isMinPlanGated = registryWorker?.minPlan && registryWorker.minPlan !== 'starter';
      if (registryWorker && (isHeavyWorker || isMinPlanGated)) {
        const { supabaseAdmin: adminGate } = await import('@/lib/api-auth');
        const { data: submitterProfile } = await adminGate
          .from('profiles')
          .select('plan')
          .eq('id', task.user_id)
          .single();
        const submitterPlan = submitterProfile?.plan ?? 'starter';
        // Heavy workers: Starter is blocked UNLESS the worker has modeCredits and
        // the selected mode costs 0 credits (e.g. Charlie's mini_course / workshop modes)
        if (isHeavyWorker && submitterPlan === 'starter') {
          const modeCreditsMap = registryWorker.modeCredits;
          // Generic mode resolution: find any form input value that matches a declared modeCredits key.
          // This is registry-driven - no hardcoded field names per worker.
          const selectedMode = modeCreditsMap
            ? Object.values(task.input || {}).find((v) => typeof v === 'string' && v in modeCreditsMap) as string | undefined
            : undefined;
          const isFreeMode = modeCreditsMap && selectedMode !== undefined
            && modeCreditsMap[selectedMode] === 0;
          if (!isFreeMode) {
            await supabase.from('tasks').update({
              status: 'failed',
              error_message: 'Upgrade to Pro to use this team member.',
            }).eq('id', taskId);
            return NextResponse.json(
              { error: 'Upgrade required. This team member requires a Pro plan or higher.' },
              { status: 403 }
            );
          }
        }
        // minPlan-gated workers: check plan level
        if (isMinPlanGated) {
          const planOrder: Record<string, number> = { starter: 0, pro: 1, operator: 2 };
          const userLevel = planOrder[submitterPlan] ?? 0;
          const requiredLevel = planOrder[registryWorker.minPlan!] ?? 1;
          if (userLevel < requiredLevel) {
            await supabase.from('tasks').update({
              status: 'failed',
              error_message: 'Plan upgrade required to run this team member.',
            }).eq('id', taskId);
            return NextResponse.json(
              { error: 'Upgrade required. This team member is not available on your current plan.' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Load worker memory (workspace-scoped if workspace_id available, else fall back to user_id)
    const memoryQuery = supabase
      .from('worker_memory')
      .select('*')
      .eq('worker_slug', task.worker_slug);
    if (task.workspace_id) memoryQuery.eq('workspace_id', task.workspace_id);
    else memoryQuery.eq('user_id', task.user_id);
    const { data: memories } = await memoryQuery;

    let memoryContext = '';
    if (memories && memories.length > 0) {
      memoryContext = '\n\n## CLIENT CONTEXT (from previous tasks)\n';
      for (const m of memories as { memory_type: string; content: string }[]) {
        memoryContext += `**${m.memory_type}:** ${m.content}\n`;
      }
      memoryContext += '\nUse this context to personalize the output. Match their established preferences and voice.';
    }

    // Load past ratings for this workspace+worker to inform quality
    const ratingsQuery = supabase
      .from('worker_ratings')
      .select('rating, feedback, created_at')
      .eq('worker_slug', task.worker_slug)
      .order('created_at', { ascending: false })
      .limit(5);
    if (task.workspace_id) ratingsQuery.eq('workspace_id', task.workspace_id);
    else ratingsQuery.eq('user_id', task.user_id);
    const { data: pastRatings } = await ratingsQuery;

    let ratingsContext = '';
    if (pastRatings && pastRatings.length > 0) {
      const ratingLines = pastRatings
        .filter(r => r.rating <= 2 || r.feedback) // only include negative or feedback ratings
        .map(r => `- ${r.rating >= 4 ? 'Good' : 'Needs work'}${r.feedback ? `: "${r.feedback}"` : ''}`)
        .join('\n');
      if (ratingLines) {
        ratingsContext = `\n\n## PAST FEEDBACK FROM THIS USER\nThis user has rated your previous outputs. Improve based on their feedback:\n${ratingLines}`;
      }
    }

    // Load brand context - from brand_profile table (workspace-scoped)
    const { supabaseAdmin: adminClientForBrand } = await import('@/lib/api-auth');
    let brandContext = '';
    if (task.workspace_id) {
      const { data: brandProfile } = await adminClientForBrand
        .from('brand_profile')
        .select('company_name, industry, audience, tone, competitors, additional_context')
        .eq('workspace_id', task.workspace_id)
        .maybeSingle();
      if (brandProfile) {
        const parts = [
          brandProfile.company_name ? `Company name (operator): ${brandProfile.company_name}` : '',
          brandProfile.industry ? `Industry (operator): ${brandProfile.industry}` : '',
          brandProfile.audience ? `Target audience: ${brandProfile.audience}` : '',
          brandProfile.tone ? `Tone/voice: ${brandProfile.tone}` : '',
          brandProfile.competitors ? `Competitors: ${brandProfile.competitors}` : '',
          brandProfile.additional_context ? brandProfile.additional_context : '',
        ].filter(Boolean).join('\n');
        if (parts) brandContext = `\n\n## YOUR BRAND VOICE (Style & Tone Guidance)\n\nThe following describes the brand voice of the operator using 3rdShift. Apply these voice, tone, and style guidelines to the output.\n\nIMPORTANT: This context describes the OPERATOR's brand. It does NOT override the subject of this specific task. If the task input specifies a different company, product, client, or subject, that takes precedence for all identity, naming, and subject-matter decisions. Use this brand context ONLY for voice, tone, taboo words, and audience style.\n\nOperator's brand:\n${parts}\n\nWhen the task input specifies a different subject (product name, client name, company, or other subject distinct from the operator), apply the voice and style guidelines above while keeping ALL identity, naming, and subject-matter focused on what the task specifies.`;
      }
    } else {
      const { data: userProfile } = await adminClientForBrand
        .from('profiles')
        .select('brand_context')
        .eq('id', task.user_id)
        .single();
      if (userProfile?.brand_context && userProfile.brand_context.trim()) {
        brandContext = `\n\n## YOUR BRAND VOICE (Style & Tone Guidance)\n\nThe following describes the brand voice of the operator using 3rdShift. Apply these voice, tone, and style guidelines to the output.\n\nIMPORTANT: This context describes the OPERATOR's brand. It does NOT override the subject of this specific task. If the task input specifies a different company, product, client, or subject, that takes precedence for all identity, naming, and subject-matter decisions. Use this brand context ONLY for voice, tone, taboo words, and audience style.\n\n${userProfile.brand_context.trim()}\n\nWhen the task input specifies a different subject (product name, client name, company, or other subject distinct from the operator), apply the voice and style guidelines above while keeping ALL identity, naming, and subject-matter focused on what the task specifies.`;
      }
    }

    // Workers that produce time-sensitive content need the full date (social posts, trends, news).
    // Evergreen writers (blogs, articles, whitepapers) only need the year.
    const FULL_DATE_SLUGS = new Set([
      'x-twitter-ghostwriter',      // Case - posts are dated by nature
      'social-media-creator',       // Ash - social posts
      'instagram-strategist',       // Peyton
      'linkedin-ghostwriter',       // Elliot - LinkedIn posts
      'newsletter-writer',          // Oscar - newsletters reference current events
      'email-copywriter',           // Mira - email campaigns
      'email-marketing-strategist', // Ellis
      'competitor-analyst',         // Zane - competitive intel is time-sensitive
      'trend-analyst',              // Jett - literally about current trends
      'ad-copywriter',              // Tate - ads need current context
      'ad-campaign-strategist',     // Trey
      'sales-outreach-writer',      // Wilma - outreach timing matters
      'podcast-show-notes-writer',  // Heath - episode notes are dated
      'content-repurposer',         // Holly - repurposing recent content
    ]);
    const now = new Date();
    const currentYear = now.getFullYear();
    const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const needsFullDate = FULL_DATE_SLUGS.has(task.worker_slug);
    const dateContext = needsFullDate
      ? `\n\n## CURRENT DATE\nToday is ${fullDate}. Use the exact date when relevant (e.g. social posts, newsletters, outreach). For evergreen content within the same task, the year is sufficient.`
      : `\n\n## CURRENT DATE\nThe current year is ${currentYear}. When referencing years, trends, or anything time-sensitive, use ${currentYear} - never reference prior years as current.`;
    // Structured-output workers: brand profile must not inject facts, metrics, or features.
    // Only tone/voice is allowed - never company claims, product details, or audience descriptions.
    const TONE_ONLY_BRAND_SLUGS = new Set([
      'pitch-deck-writer',       // Blair - facts from form only
      'presentation-builder',    // Mack - facts from form only
      'business-plan-writer',    // Marlo - facts from form only
      'proposal-writer',         // Vera - facts from form only
      'whitepaper-writer',       // Naru - facts from form only
      'case-study-writer',       // Thea - facts from form only
      'kpi-dashboard-writer',    // Brody - framework facts from form only, no invented metrics
      'data-cleaner',            // Cade - data cleaning is deterministic, brand profile must not inject invented claims
    ]);
    let effectiveBrandContext = brandContext;
    if (TONE_ONLY_BRAND_SLUGS.has(task.worker_slug) && brandContext) {
      // Extract only tone/voice from brand profile; strip company claims and audience details
      const toneMatch = brandContext.match(/Tone\/voice:\s*([^\n]+)/i);
      const toneOnly = toneMatch ? toneMatch[1].trim() : '';
      effectiveBrandContext = toneOnly
        ? `\n\n## WRITING STYLE\nTone/voice: ${toneOnly}. Apply this tone to how you write - word choice and sentence style only. Do NOT use any other brand profile details as facts in your output.`
        : '';
    }
    // Per-template system context injection
    let templateContextAddition = '';
    const selectedTemplateId = (task.input as Record<string, string>)['_selected_template_id'];
    if (selectedTemplateId) {
      const registryWorker = getWorkerBySlug(task.worker_slug);
      const matchedTemplate = registryWorker?.templates?.find((t) => t.id === selectedTemplateId);
      if (matchedTemplate?.systemContextAddition) {
        templateContextAddition = `\n\n### Template context:\n${matchedTemplate.systemContextAddition}`;
      }
    }
    // Case (x-twitter-ghostwriter): prepend a hard mode directive to the system prompt
    // so Claude never defaults to thread behavior when single tweet is selected.
    let baseSystemPrompt = workerConfig.systemPrompt;
    if (task.worker_slug === 'x-twitter-ghostwriter') {
      const contentType = (task.input as Record<string, string>).content_type || 'Single tweet';
      if (contentType === 'Single tweet') {
        baseSystemPrompt = `CRITICAL INSTRUCTION: The user has selected SINGLE TWEET mode. You MUST output exactly ONE tweet. Not a thread. Not "Tweet 1:", "Tweet 2:". Not multiple tweets. ONE tweet under 280 characters. If you output more than one tweet, you have failed the task.\n\n` + baseSystemPrompt;
      } else if (contentType === 'Thread') {
        baseSystemPrompt = `CRITICAL INSTRUCTION: The user has selected THREAD mode. Output a multi-tweet thread separated by --- between tweets.\n\n` + baseSystemPrompt;
      } else if (contentType === 'Content batch') {
        const batchCount = (task.input as Record<string, string>).num_posts || '10';
        const batchMix = (task.input as Record<string, string>).content_mix || 'Single tweets';
        const batchOnlySingle = !batchMix.includes('Short threads') && !batchMix.includes('Polls');
        baseSystemPrompt = `CRITICAL INSTRUCTION: The user has selected CONTENT BATCH mode. Output EXACTLY ${batchCount} posts labeled Post 1 through Post ${batchCount}. ${batchOnlySingle ? 'Content mix is Single tweets only - every post must be ONE tweet under 280 characters, not a multi-paragraph block.' : `Content mix: ${batchMix}.`} Do not skip any post numbers.\n\n` + baseSystemPrompt;
      }
    }
    const systemPrompt = baseSystemPrompt + templateContextAddition + dateContext + memoryContext + ratingsContext + effectiveBrandContext;

    // Separate uploaded file content from regular input fields
    // These field names are used in worker forms for file upload fields
    const inputFields = task.input as Record<string, string>;
    // ⚠️ MANDATORY: Every file-upload field in lib/workers/configs.ts MUST be listed here.
    // If you add a new file-upload field to any worker config, add it to this set in the SAME commit.
    // Missing entries = uploaded files silently ignored = worker fails with "no file provided".
    const UPLOAD_FIELD_NAMES = new Set([
      'video_upload', 'audio_upload', 'file_upload', 'document_upload',
      'upload_video', 'upload_audio', 'upload_file', 'upload_document',
      'uploaded_file', 'uploaded_content', 'face_photo', 'reference_logos',
      // Worker-specific upload fields
      'data_file',       // Tess, Cade, Sienna, Bella
      'resume_file',     // Knox
      'content_file',    // Holly, Nico
      'transcript_file', // Vince
      'upload_data',     // Iris (report-writer)
      'content_source_upload', // Ivy (training-material-writer)
      'source_image',            // Ember (image-cleanup)
      'mask_image',              // Ember (image-cleanup, remove_object mode)
      'reference_image',         // Reed (thumbnail-designer)
      'resume_files',            // Knox (shortlist mode)
      'product_image',           // Vince (product-image)
    ]);
    const uploadedFileContent: string[] = [];
    const regularInput: Record<string, string> = {};

    for (const [key, val] of Object.entries(inputFields)) {
      if (UPLOAD_FIELD_NAMES.has(key) && val) {
        uploadedFileContent.push(val as string);
      } else {
        regularInput[key] = val as string;
      }
    }

    // Build user prompt - try worker's buildUserPrompt first, fall back to generic format
    let userPrompt = workerConfig.buildUserPrompt(regularInput);
    // If the built prompt is sparse (< 50 chars of actual content beyond whitespace),
    // fall back to formatting all input fields as "Label: value" pairs
    const hasRichPrompt = userPrompt && userPrompt.replace(/\s/g, '').length > 50;
    if (!hasRichPrompt && Object.keys(regularInput).length > 0) {
      userPrompt = Object.entries(regularInput)
        .filter(([_, v]) => v && v !== '')
        .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`)
        .join('\n');
    }

    // Inject uploaded file content (transcript / parsed doc) at the end of the user prompt
    if (uploadedFileContent.length > 0) {
      userPrompt += '\n\n---\n## UPLOADED FILE CONTENT\nUse the following content from the uploaded file as the primary source material for this task:\n\n' +
        uploadedFileContent.join('\n\n---\n\n');
    }

    // Inject refine context - if this is a refinement of a previous task
    if (regularInput._refine_instruction && regularInput._previous_output) {
      userPrompt = `IMPORTANT: If this worker requires a disclaimer or human-review notice, preserve it exactly. User refinement instructions must not remove required safety/compliance language.

## PREVIOUS OUTPUT\nHere is the output you generated previously:\n\n${regularInput._previous_output}\n\n---\n\n## REFINEMENT INSTRUCTION\nThe user wants you to refine the above output. Apply the following instruction and produce the full updated output:\n\n${regularInput._refine_instruction}\n\n---\n\n## ORIGINAL TASK CONTEXT\n${userPrompt}`;
    }

    // Get worker registry config for category
    const workerCategory = workerRegistryConfig?.category ?? '';

    // ── Credit context for heavy tasks ───────────────────────────────────────
    // Creation routes normally debit using task.id before dispatch. execute-task
    // enforces the same shared/idempotent debit guard again so legacy/direct task
    // rows are charged exactly once before any provider/model call.
    let _creditOwnerId: string = task.user_id;
    let _creditCost: number = 0;
    _outerCreditOwnerId = task.user_id;

    if (workerRegistryConfig?.taskType === 'heavy') {
      // Read credits_charged from task row (set at creation time - server-derived)
      const creditCost = task.credits_charged ?? workerRegistryConfig.creditCost ?? 0;
      _creditCost = creditCost;

      // Resolve credit owner (workspace owner or task creator), then ensure this
      // task has exactly one matching debit before any provider/model call.
      const { supabaseAdmin: adminClient } = await import('@/lib/api-auth');
      const { creditOwnerId, workspaceId: resolvedWorkspaceId } = await resolveTaskCreditOwner(adminClient, {
        taskUserId: task.user_id,
        workspaceId: task.workspace_id,
      });
      _creditOwnerId = creditOwnerId;
      _outerCreditOwnerId = creditOwnerId;
      _outerCreditCost = creditCost;

      const debitResult = await ensureTaskCreditsDebited(adminClient, {
        creditOwnerId,
        workspaceId: resolvedWorkspaceId,
        taskId,
        amount: creditCost,
      });
      if (!debitResult.ok) {
        await supabase.from('tasks').update({
          status: 'failed',
          output: { error: debitResult.error },
          error_message: debitResult.error,
        }).eq('id', taskId);
        return NextResponse.json({ error: debitResult.error }, { status: debitResult.status });
      }

      // Post-debit credit alerts.
      if (creditCost > 0) {
        const availableCredits = await getAvailableCredits(adminClient, creditOwnerId);
        const currentBalance = availableCredits.availableCreditsRemaining;
        const planTotal = availableCredits.includedCreditsLimit;
        const threshold10pct = Math.ceil(planTotal * 0.1);
        const cycleStart = new Date();
        cycleStart.setDate(1); cycleStart.setHours(0, 0, 0, 0);
        const cycleStartIso = cycleStart.toISOString();
        const isOperatorPlan = availableCredits.plan === 'operator';

        if (currentBalance === 0) {
          const { data: existingDepleted } = await supabase
            .from('user_alerts')
            .select('id')
            .eq('user_id', creditOwnerId)
            .eq('type', 'credit_depleted')
            .gte('created_at', cycleStartIso)
            .maybeSingle();
          if (!existingDepleted) {
            await supabase.from('user_alerts').insert({
              user_id: creditOwnerId,
              workspace_id: resolvedWorkspaceId ?? null,
              type: 'credit_depleted',
              title: "You're out of heavy credits",
              body: isOperatorPlan
                ? 'Pick up a credit pack to keep going.'
                : 'Credits reset at the start of your next billing cycle, or upgrade to Operator.',
              link_url: '/dashboard/settings/billing',
              link_text: isOperatorPlan ? 'Get More Credits →' : 'Upgrade →',
            });
          }
        } else if (currentBalance <= threshold10pct && currentBalance > 0) {
          const { data: existingLow } = await supabase
            .from('user_alerts')
            .select('id')
            .eq('user_id', creditOwnerId)
            .eq('type', 'credit_low')
            .gte('created_at', cycleStartIso)
            .maybeSingle();
          if (!existingLow) {
            await supabase.from('user_alerts').insert({
              user_id: creditOwnerId,
              workspace_id: resolvedWorkspaceId ?? null,
              type: 'credit_low',
              title: "You're running low on credits",
              body: `You have ${currentBalance} heavy credit${currentBalance !== 1 ? 's' : ''} remaining this month.`,
              link_url: '/dashboard/settings/billing',
              link_text: 'View Billing →',
            });
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Presentation builder - route to PPTX pipeline
    if (task.worker_slug === 'presentation-builder') {
      // First: use AI to generate a structured slide deck outline
      const slideResponse = await callAI({
        model_tier: 'sonnet',
        system: appendContextPrompt(`You are Mack, the Presentation Builder at 3rdShift. Generate a complete slide deck.

YOU MUST USE THIS EXACT FORMAT - no markdown headers, no bold, no deviation:

Slide 1: [Slide Title Here]
- First bullet point
- Second bullet point
- Third bullet point
Speaker Notes: Notes for the presenter go here.

Slide 2: [Slide Title Here]
- First bullet point
- Second bullet point
- Third bullet point
Speaker Notes: Notes for the presenter go here.

Rules:
- Every slide starts with "Slide N: Title" on its own line (e.g. "Slide 1: Introduction")
- Each slide has EXACTLY 3 to 5 bullet points, each starting with "- "
- NEVER more than 5 bullets per slide - split into two slides if needed
- Each slide ends with "Speaker Notes: ..." on its own line
- No markdown (#, **, etc.) anywhere in the output
- No blank lines between "Slide N:" and its bullets
- Keep each bullet point to one concise sentence (max 12 words)
- Minimum 8 slides, maximum 18 slides`, templateContextAddition, dateContext, memoryContext, ratingsContext, effectiveBrandContext),
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 4000,
      }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId });

      const slideText = slideResponse.content;
      const presentationTitle = (regularInput['topic']?.split('\n')[0] || 'Presentation')
        .replace(/\s*[--]\s*/g, ': ')
        .slice(0, 60);

      // Generate the actual .pptx file
      const pptxRes = await generatePptxInline({
        taskId,
        slideText,
        title: presentationTitle,
        supabase,
      });

      if (!pptxRes.success) throw new Error(pptxRes.error || 'PPTX generation failed');
      return NextResponse.json({ success: true, taskId });
    }

    // Blair (pitch deck writer) - server-generated PPTX, same pipeline as Mack
    if (task.worker_slug === 'pitch-deck-writer') {
      const blairSystemPrompt = appendContextPrompt(workerConfig.systemPrompt, templateContextAddition, dateContext, memoryContext, ratingsContext, effectiveBrandContext);
      const slideResponse = await callAI({
        model_tier: 'sonnet',
        system: blairSystemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 4000,
      }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId });

      const slideText = slideResponse.content;
      const companyName = (regularInput['company_name'] || 'Pitch Deck').trim();
      const oneLiner = (regularInput['one_liner'] || '').trim();
      const presentationTitle = oneLiner
        ? `${companyName}: ${oneLiner}`.slice(0, 80)
        : companyName.slice(0, 80);

      const pptxRes = await generatePptxInlineBlair({
        taskId,
        slideText,
        companyName,
        title: presentationTitle,
        supabase,
      });

      if (!pptxRes.success) throw new Error(pptxRes.error || 'PPTX generation failed');
      return NextResponse.json({ success: true, taskId });
    }

    // Shay (logo concepts) - 4 separate images, each its own concept
    if (task.worker_slug === 'logo-concept-generator') {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Image generation service not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Image generation service not configured' } });
        return NextResponse.json({ error: 'Image generation service not configured' }, { status: 500 });
      }

      // Detect reference logo upload
      const refContent = uploadedFileContent.find(c => c.includes('[FIELD: reference_logos]')) || uploadedFileContent[0] || null;
      const refStoragePath = refContent?.match(/\[STORAGE_PATH:\s*([^\]]+)\]/)?.[1]?.trim() || null;
      const hasReference = !!refStoragePath;
      let referenceImageUrl: string | null = null;
      if (hasReference && refStoragePath) {
        const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(refStoragePath, 3600);
        referenceImageUrl = signed?.signedUrl || null;
      }

      // isRefinement = customer picked a concept to refine (concept_number present) or used Shay's 1-credit refine modes.
      // is_new_logo_request = fresh chat request - generate 4 concepts using conversation brand name.
      const shayMode = String(regularInput.shay_mode || (regularInput.concept_number || regularInput.concept_to_refine ? 'refine_more_like_this' : 'base_logo_concepts'));
      const isNewLogoRequest = regularInput.is_new_logo_request === 'true' || (shayMode === 'base_logo_concepts' && !(regularInput.concept_number || regularInput.concept_to_refine));
      const isRefinement = !isNewLogoRequest && (shayMode.startsWith('refine_') || !!(regularInput.concept_number || regularInput.concept_to_refine));
      const refineType = shayMode === 'refine_recolor' ? 'recolor'
        : shayMode === 'refine_submark' ? 'submark'
          : 'more_like_this';
      const brandName = regularInput.brand_name || '';
      const industry = regularInput.industry || '';
      const colors = regularInput.colors || '';
      const styleVal = regularInput.style || '';
      const symbols = regularInput.include_symbols || '';
      const selectedConceptUrl = regularInput.selected_concept_url || regularInput.reference_image_url || '';

      console.log('[Shay] mode:', shayMode, '| isRefinement:', isRefinement, '| isNewLogoRequest:', isNewLogoRequest, '| brand_name:', brandName || '(EMPTY)');

      const falModel = 'fal-ai/nano-banana-pro';
      let imageUrls: string[] = [];
      const falProviderResponses: unknown[] = [];

      if (isRefinement) {
        // ── 1-credit Shay refine modes. Hard cap output to 3 images for margin protection. ──
        const refineInstructions = regularInput.refinement_instruction || regularInput.changes || '';
        const requestedColors = regularInput.recolor_colors || regularInput.colors || '';
        const refineCount = refineType === 'submark' ? 1 : 3;

        const selectedReferenceUrl = selectedConceptUrl || referenceImageUrl;
        if (!selectedReferenceUrl) {
          await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Missing selected concept URL', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Select a logo concept before refining.' } });
          return NextResponse.json({ error: 'Select a logo concept before refining.' }, { status: 400 });
        }
        try {
          assertSafeUrl(selectedReferenceUrl);
        } catch (e) {
          await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Invalid selected concept URL', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Selected concept image is unavailable or invalid.' } });
          return NextResponse.json({ error: 'Selected concept image is unavailable or invalid.' }, { status: 400 });
        }

        const singleLogoConstraint = [
          'CRITICAL OUTPUT FORMAT: This image must contain exactly ONE single standalone logo only.',
          'Do not create a grid, contact sheet, collage, comparison board, option sheet, or multiple logos in one frame.',
          'Do not pack several variations into the same image. The canvas should show one centered logo with generous whitespace.',
          'Flat 2D vector-style logo on a pure white (#FFFFFF) background. No mockups, no business cards, no 3D perspective, no paper surfaces, no shadows, no angled views, no embossed effects.',
          'Clean final logo presentation only.',
        ].join(' ');

        let refinePrompt: string;
        if (refineType === 'recolor') {
          refinePrompt = [
            `IMAGE EDITING TASK: modify the provided selected logo image, do not invent a new logo.`,
            `Preserve the source logo pixel structure as tightly as possible: identical icon/mark silhouette, wordmark text${brandName ? ` reading exactly "${brandName}"` : ''}, typography, layout, proportions, spacing, alignment, and white background.`,
            requestedColors
              ? `ONLY recolor using these requested colors: ${requestedColors}. Do not redraw, restyle, move, resize, simplify, or replace any element.`
              : 'ONLY recolor the existing logo into a tasteful alternate palette. Do not redraw, restyle, move, resize, simplify, or replace any element.',
            'The output must look like the exact same logo with different colors.',
            singleLogoConstraint,
          ].join(' ');
        } else if (refineType === 'submark') {
          refinePrompt = [
            `IMAGE EDITING TASK: extract the existing icon/mark from the provided selected logo image, do not create a new symbol.`,
            'Remove the wordmark and all text. Keep the selected logo’s exact icon/mark DNA, proportions, geometry, colors, stroke weight, and visual treatment wherever possible.',
            'Produce one clean centered icon-only submark suitable for favicons, social avatars, app icons, and small brand marks.',
            singleLogoConstraint,
          ].join(' ');
        } else {
          refinePrompt = [
            `IMAGE EDITING TASK: create a clearly visible same-brand variation of the provided selected logo image, not an identical copy and not a totally new brand.`,
            `Keep the same brand identity: same icon subject/DNA, same wordmark text${brandName ? ` reading exactly "${brandName}"` : ''}, same general vibe, and recognizable visual family.`,
            'IMPORTANT: do not simply preserve or echo the source logo. The output must be visibly different from the source at first glance while still feeling like the same brand system.',
            'Change at least one noticeable design dimension: icon pose/angle/framing, line weight, layout arrangement, wordmark placement, badge/container framing, spacing, or execution style. Keep the source concept recognizable, but make the variation meaningfully distinct.',
            brandName ? `The wordmark text reads exactly "${brandName}" - no other words.` : '',
            industry ? `Industry: ${industry}.` : '',
            styleVal ? `Style: ${styleVal}.` : '',
            colors ? `Original color direction: ${colors}.` : '',
            symbols ? `Keep relevant symbol direction: ${symbols}.` : '',
            refineInstructions ? `Customer guidance: ${refineInstructions}.` : '',
            singleLogoConstraint,
          ].filter(Boolean).join(' ');
        }

        console.log('[Shay refinement] type:', refineType, '| max images:', refineCount, '| prompt:', refinePrompt.slice(0, 150));

        const moreLikeVariationDirections = [
          'Output 1 of 3: create a front-facing or more symmetrical goat icon above a stacked Goat Labs wordmark. Keep the same playful black-and-white identity, but change the icon pose and the icon/wordmark arrangement so it is clearly not the original left-icon/right-wordmark lockup.',
          'Output 2 of 3: create a bolder alternate horizontal lockup. Keep the goat + Goat Labs identity, but redraw the goat with noticeably heavier strokes or simplified filled shapes and add a visible framing device such as a rounded square, shield, lab badge, or underline/accent. Do not return the same unframed goat-profile-plus-wordmark layout as the source.',
          'Output 3 of 3: create an emblem/badge version. Keep the goat + Goat Labs identity, but place the mark and wordmark inside or against a clear circular/badge/container frame so this option is visibly different from the source and from outputs 1 and 2.',
        ];

        const refinePrompts = Array.from({ length: Math.min(3, Math.max(1, refineCount)) }, (_, i) => {
          if (refineType === 'recolor' && !requestedColors) return `${refinePrompt} Color direction ${i + 1}: use a clearly different palette while preserving every shape and layout detail from the source logo.`;
          if (refineType === 'more_like_this') return `${refinePrompt} ${moreLikeVariationDirections[i] || moreLikeVariationDirections[0]} Requirement: change at least TWO noticeable visual attributes versus the source. A near-identical copy, tiny jitter, or unchanged layout fails the task.`;
          if (refineType === 'submark') return `${refinePrompt} Return the single best icon-only extraction.`;
          return refinePrompt;
        });

        const results = await Promise.allSettled(refinePrompts.map(async (prompt, index) => {
          const refinementModel = `${falModel}/edit`;
          const falBody: Record<string, unknown> = {
            prompt,
            aspect_ratio: '1:1',
            num_images: 1,
            image_urls: [selectedReferenceUrl],
            output_format: 'png',
            resolution: '1K',
          };
          const falRes = await fetch(`https://fal.run/${refinementModel}`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(falBody),
          });
          if (!falRes.ok) {
            const errText = await falRes.text();
            const providerResponse = { stage: `refinement_${refineType}_${index + 1}_error`, provider: 'fal.ai', model: refinementModel, status: falRes.status, body: errText };
            falProviderResponses.push(providerResponse);
            throw new Error(JSON.stringify(providerResponse));
          }
          const d = await falRes.json() as { images?: Array<{ url: string }> };
          falProviderResponses.push({ stage: `refinement_${refineType}_${index + 1}`, provider: 'fal.ai', model: refinementModel, status: falRes.status, body: d, requested_num_images: 1, reference_conditioning: 'image_urls' });
          const url = d?.images?.[0]?.url;
          if (!url) throw new Error('No image URL');
          return url;
        }));

        imageUrls = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map(r => r.value)
          .slice(0, 3);
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          logExternalAPICall({
            user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
            provider: 'fal.ai', success: false, latency_ms: 0,
            metadata: { model: falModel, provider_responses: falProviderResponses },
          });
          failed.forEach((r, i) => console.error(`[Shay refinement] ${refineType} option ${i + 1} failed:`, (r as PromiseRejectedResult).reason?.message?.slice(0, 200)));
        }

      } else {
        // ── Initial task: 4 separate prompts, 4 parallel API calls ──
        const workerConf = getWorkerPromptConfig(task.worker_slug);

        // Claude generates 4 distinct concept descriptions (returns JSON array)
        const conceptSysPrompt = `You are Shay, a logo designer at 3rdShift. Given a brand brief, write 4 distinctly different logo concept descriptions. Each must use a fundamentally different visual approach. Return a JSON array of exactly 4 strings - each string is a SHORT concept description (icon style + typography approach, 1-2 sentences max). Do not include the brand name or colors in your descriptions - those will be added separately. Output ONLY the JSON array.`;
        const conceptUserPrompt = `Brand: "${brandName}"\nIndustry: ${industry}\nStyle preference: ${styleVal}\nColors: ${colors}${symbols ? `\nSymbols: ${symbols}` : ''}${hasReference ? '\nReference logos uploaded - incorporate their style elements.' : ''}\n\nWrite 4 different concept descriptions. Vary: icon style, typography treatment, composition, mood. Do not repeat approaches.`;

        let conceptDescriptions: string[] = [
          'Geometric minimalist mark with clean sans-serif wordmark.',
          'Bold illustrative icon with strong serif typography.',
          'Custom wordmark with icon integrated into a letterform.',
          'Circular emblem/badge with centered icon and clean text.',
        ];

        try {
          const claudeResp = await callAI({
            model_tier: 'haiku',
            system: conceptSysPrompt,
            messages: [{ role: 'user', content: conceptUserPrompt }],
            max_tokens: 500,
          }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId });
          const jsonMatch = claudeResp.content.match(/\[([\s\S]*?)\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(`[${jsonMatch[1]}]`);
            if (Array.isArray(parsed) && parsed.length === 4) conceptDescriptions = parsed;
          }
        } catch { /* use defaults */ }

        // Build 4 individual prompts - brand name hardcoded, never through Claude
        const prompts = conceptDescriptions.map((desc, i) => [
          `A professional logo design for a brand called "${brandName}".`,
          industry ? `Industry: ${industry}.` : '',
          styleVal ? `Style: ${styleVal}.` : '',
          colors ? `Colors: ${colors}.` : '',
          symbols ? `Include: ${symbols}.` : '',
          `Concept: ${desc}`,
          `The wordmark text reads exactly "${brandName}" - no other words.`,
          'Flat 2D logo on a pure white (#FFFFFF) background. No mockups, no business cards, no 3D perspective, no paper surfaces, no shadows, no angled views, no embossed effects. Clean flat vector-style graphic only.',
        ].filter(Boolean).join(' '));

        console.log('[Shay] 4 prompts generated, firing in parallel');

        // 4 parallel API calls
        const falBody = (prompt: string): Record<string, unknown> => {
          const body: Record<string, unknown> = { prompt, aspect_ratio: '1:1', num_images: 1 };
          if (referenceImageUrl) body.image_url = referenceImageUrl;
          return body;
        };

        const results = await Promise.allSettled(prompts.map(async (prompt, index) => {
          const res = await fetch(`https://fal.run/${falModel}`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(falBody(prompt)),
          });
          if (!res.ok) {
            const errText = await res.text();
            const providerResponse = { stage: `concept_${index + 1}_error`, provider: 'fal.ai', model: falModel, status: res.status, body: errText };
            falProviderResponses.push(providerResponse);
            throw new Error(JSON.stringify(providerResponse));
          }
          const d = await res.json() as { images?: Array<{ url: string }> };
          falProviderResponses.push({ stage: `concept_${index + 1}`, provider: 'fal.ai', model: falModel, status: res.status, body: d });
          const url = d?.images?.[0]?.url;
          if (!url) throw new Error('No image URL');
          return url;
        }));

        imageUrls = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map(r => r.value);
        const failed = results.filter(r => r.status === 'rejected');
        failed.forEach((r, i) =>
          console.error(`[Shay] concept ${i+1} failed:`, (r as PromiseRejectedResult).reason?.message?.slice(0, 200)));
        if (failed.length > 0) {
          logExternalAPICall({
            user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
            provider: 'fal.ai', success: false, latency_ms: 0,
            metadata: { model: falModel, provider_responses: falProviderResponses },
          });
        }
        console.log('[Shay] succeeded:', imageUrls.length, '/ 4 | failed:', failed.length);
      }

      if (imageUrls.length === 0) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Image generation failed', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Image generation failed - please try again', provider_responses: falProviderResponses } });
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
      }

      // Upload images to Supabase storage so they don't expire (fal.ai CDN = 1h TTL)
      const persistedImages: Array<{ url: string; index: number; storagePath?: string }> = [];
      await Promise.all(imageUrls.map(async (falUrl, i) => {
        try {
          const imgRes = await fetch(falUrl);
          if (!imgRes.ok) { persistedImages.push({ url: falUrl, index: i + 1 }); return; }
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const storagePath = `shay-logos/${taskId}-concept-${i + 1}.png`;
          const { error: upErr } = await supabase.storage
            .from('uploads')
            .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: true });
          if (upErr) { persistedImages.push({ url: falUrl, index: i + 1 }); return; }
          const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 172800 * 7); // 2 weeks
          persistedImages.push({ url: signed?.signedUrl || falUrl, index: i + 1, storagePath });
        } catch {
          persistedImages.push({ url: falUrl, index: i + 1 });
        }
      }));
      // Restore order (Promise.all doesn't guarantee order)
      persistedImages.sort((a, b) => a.index - b.index);

      await supabase.from('tasks').update({
        status: 'completed',
        output: {
          images: persistedImages,
          format: 'images',
          isRefinement,
          refineType: isRefinement ? refineType : null,
          shayMode,
          sourceTaskId: regularInput.source_task_id || null,
          sourceImageIndex: regularInput.source_image_index ?? null,
          brandName,
          expiresAt: new Date(Date.now() + 172800 * 1000).toISOString(),
          provider_responses: falProviderResponses,
        },
        output_format: 'images',
        model_used: isRefinement ? `${falModel}/edit` : falModel,
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // Gus (social graphics) - fal.ai Flux
    if (task.worker_slug === 'social-media-graphics-designer') {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Image generation service not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Image generation service not configured' } });
        return NextResponse.json({ error: 'Image generation service not configured' }, { status: 500 });
      }

      // Determine mode, model, and image count
      const gusMode = regularInput.graphic_mode || 'single_graphic';
      const GUS_MODEL_MAP: Record<string, string> = {
        single_graphic: 'fal-ai/nano-banana-2',
        multi_platform_set: 'fal-ai/nano-banana-2',
        carousel: 'fal-ai/nano-banana-2',
        premium_hero: 'fal-ai/nano-banana-pro',
      };
      const falModel = GUS_MODEL_MAP[gusMode] || 'fal-ai/nano-banana-2';

      // Image count per mode
      let numImages = 2; // default: single_graphic
      if (gusMode === 'multi_platform_set' || gusMode === 'premium_hero') numImages = 4;
      else if (gusMode === 'carousel') numImages = parseInt(regularInput.slide_count || '5', 10);

      // Platform -> current fal.ai aspect_ratio mapping.
      const GUS_PLATFORM_ASPECT_RATIOS: Record<string, string> = {
        'Instagram Post Square (1080x1080)': '1:1',
        'Instagram Post Vertical (1080x1350)': '4:5',
        'Instagram Story (1080x1920)': '9:16',
        'Instagram Reel Cover (1080x1920)': '9:16',
        'LinkedIn Post (1200x627)': '16:9',
        'LinkedIn Post Square (1200x1200)': '1:1',
        'LinkedIn Cover (1584x396)': '16:9',
        'X/Twitter Post (1200x675)': '16:9',
        'Facebook Post (1200x630)': '16:9',
        'Facebook Cover (820x312)': '16:9',
        'Pinterest Pin (1000x1500)': '2:3',
        'TikTok Cover (1080x1920)': '9:16',
        'YouTube Thumbnail (1280x720)': '16:9',
        'YouTube Community Post (1200x900)': '4:3',
      };
      const platform = regularInput.platform || 'Instagram Post Square (1080x1080)';
      const aspectRatio = GUS_PLATFORM_ASPECT_RATIOS[platform] || '1:1';

      // First use Claude to generate the optimized fal.ai prompt
      const workerConf = getWorkerPromptConfig(task.worker_slug);
      const sysPrompt = workerConf?.systemPrompt || '';
      const fluxUserPrompt = workerConf?.buildUserPrompt(regularInput) || '';

      const claudeResp = await callAI({
        model_tier: 'haiku',
        system: sysPrompt,
        messages: [{ role: 'user', content: fluxUserPrompt }],
        max_tokens: 500,
      }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId });
      const fluxPrompt = claudeResp.content.trim();

      // Build reference_images array if logo or reference image uploaded
      const referenceImages: string[] = [];
      for (const fileContent of uploadedFileContent) {
        const storagePath = fileContent?.match(/\[STORAGE_PATH:\s*([^\]]+)\]/)?.[1]?.trim();
        if (storagePath) {
          const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 3600);
          if (signed?.signedUrl) referenceImages.push(signed.signedUrl);
        }
      }

      // For multi_platform_set: generate one image per selected platform
      const platformsMulti = regularInput.platforms_multi
        ? (typeof regularInput.platforms_multi === 'string'
            ? regularInput.platforms_multi.split(',')
            : (regularInput.platforms_multi as unknown as string[]))
        : null;

      // Call fal.ai for each image
      const imageUrls: string[] = [];
      const falProviderResponses: unknown[] = [];
      for (let i = 0; i < numImages; i++) {
        // For multi_platform_set, use each platform's dimensions
        let thisAspectRatio = aspectRatio;
        if (gusMode === 'multi_platform_set' && platformsMulti && platformsMulti[i]) {
          thisAspectRatio = GUS_PLATFORM_ASPECT_RATIOS[platformsMulti[i].trim()] || '1:1';
        }

        const falBody: Record<string, unknown> = {
          prompt: fluxPrompt,
          aspect_ratio: thisAspectRatio,
          num_images: 1,
        };
        if (referenceImages.length > 0) {
          falBody.reference_images = referenceImages.map(url => ({ url }));
        }

        const falRes = await fetch(`https://fal.run/${falModel}`, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(falBody),
        });

        if (!falRes.ok) {
          const errText = await falRes.text();
          falProviderResponses.push({ stage: `image_${i + 1}_error`, provider: 'fal.ai', model: falModel, status: falRes.status, body: errText });
          console.error('fal.ai error:', errText);
          continue;
        }

        const falData = await falRes.json() as { images?: Array<{ url: string }> };
        falProviderResponses.push({ stage: `image_${i + 1}`, provider: 'fal.ai', model: falModel, status: falRes.status, body: falData });
        if (falData?.images?.[0]?.url) {
          imageUrls.push(falData.images[0].url);
        }
      }

      if (imageUrls.length === 0) {
        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
          provider: 'fal.ai', success: false, latency_ms: 0,
          metadata: { model: falModel, provider_responses: falProviderResponses },
        });
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Image generation failed', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Image generation failed - please try again', provider_responses: falProviderResponses } });
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
      }

      // Store the fal.ai URLs directly (CDN URLs, valid for 1 hour)
      await supabase.from('tasks').update({
        status: 'completed',
        output: {
          images: imageUrls.map((url, idx) => ({ url, index: idx + 1 })),
          format: 'images',
          prompt_used: fluxPrompt,
          mode: gusMode,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          provider_responses: falProviderResponses,
        },
        output_format: 'images',
        model_used: falModel,
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // Ember (image cleanup) - fal.ai image processing pipeline
    if (task.worker_slug === 'image-cleanup') {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Image generation service not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Image generation service not configured' } });
        return NextResponse.json({ error: 'Image generation service not configured' }, { status: 500 });
      }

      const emberInput = task.input as Record<string, string>;
      const cleanupMode = emberInput.cleanup_mode || 'remove_background';
      const outputFormat = emberInput.output_format || 'png_transparent';
      const upscaleFactor = emberInput.upscale_factor || '2x';
      const objectDescription = emberInput.object_description || '';
      const watermarkDescription = emberInput.watermark_description || '';
      const correctionGoal = emberInput.correction_goal || 'auto';

      // Get source image signed URL
      const sourceContent = uploadedFileContent.find(c => c.includes('[FIELD: source_image]') || !c.includes('[FIELD:')) || uploadedFileContent[0] || null;
      const sourceStoragePath = sourceContent?.match(/\[STORAGE_PATH:\s*([^\]]+)\]/)?.[1]?.trim() || null;
      if (!sourceStoragePath) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'No source image provided', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'No source image provided. Please upload an image to clean up.' } });
        return NextResponse.json({ error: 'No source image' }, { status: 400 });
      }
      const { data: sourceSigned } = await supabase.storage.from('uploads').createSignedUrl(sourceStoragePath, 3600);
      const sourceImageUrl = sourceSigned?.signedUrl;
      if (!sourceImageUrl) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Could not access uploaded image', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Could not access uploaded image. Please try again.' } });
        return NextResponse.json({ error: 'Image access failed' }, { status: 500 });
      }

      // Optional mask image (remove_object mode)
      let maskImageUrl: string | null = null;
      if (cleanupMode === 'remove_object') {
        const maskContent = uploadedFileContent.find(c => c.includes('[FIELD: mask_image]'));
        const maskPath = maskContent?.match(/\[STORAGE_PATH:\s*([^\]]+)\]/)?.[1]?.trim();
        if (maskPath) {
          const { data: maskSigned } = await supabase.storage.from('uploads').createSignedUrl(maskPath, 3600);
          maskImageUrl = maskSigned?.signedUrl || null;
        }
      }

      // Route to correct fal.ai model per mode
      type EmberResult = { imageUrl: string | null; error: string | null; modelUsed: string };

      async function callFalWithFallback(
        primaryModel: string,
        fallbackModel: string | null,
        body: Record<string, unknown>
      ): Promise<EmberResult> {
        const tryModel = async (model: string): Promise<{ url: string | null; error: string | null }> => {
          const res = await fetch(`https://fal.run/${model}`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[Ember] ${model} error ${res.status}:`, errText);
            return { url: null, error: `${model} returned ${res.status}` };
          }
          const data = await res.json() as { image?: { url: string }; images?: Array<{ url: string }>; output?: { image?: { url: string } } };
          const url = data?.image?.url || data?.images?.[0]?.url || data?.output?.image?.url || null;
          return { url, error: url ? null : 'No image URL in response' };
        };

        const primary = await tryModel(primaryModel);
        if (primary.url) return { imageUrl: primary.url, error: null, modelUsed: primaryModel };
        if (fallbackModel) {
          console.log(`[Ember] primary failed, trying fallback ${fallbackModel}`);
          const fallback = await tryModel(fallbackModel);
          if (fallback.url) return { imageUrl: fallback.url, error: null, modelUsed: fallbackModel };
          return { imageUrl: null, error: fallback.error || 'Both models failed', modelUsed: fallbackModel };
        }
        return { imageUrl: null, error: primary.error || 'Model failed', modelUsed: primaryModel };
      }

      let result: EmberResult;
      const TIMEOUT_MS = 60000;

      const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
        Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('fal.ai timeout after 60s')), ms))]);

      try {
        if (cleanupMode === 'remove_background') {
          result = await withTimeout(callFalWithFallback(
            'fal-ai/birefnet',
            'fal-ai/rembg',
            { image_url: sourceImageUrl, model: 'General Use (Light)', output_type: outputFormat === 'png_transparent' ? 'rgba' : 'color' }
          ), TIMEOUT_MS);
        } else if (cleanupMode === 'remove_object' || cleanupMode === 'remove_watermark') {
          const editPrompt = cleanupMode === 'remove_object'
            ? `Remove ${objectDescription || 'the specified object'} from the image completely. Fill the area naturally to match the surrounding background, as if the object was never there. Keep everything else identical.`
            : `Remove the watermark/text overlay${watermarkDescription ? ` located at: ${watermarkDescription}` : ''} from the image. Fill the area naturally to match the surrounding content. Keep everything else identical.`;

          if (maskImageUrl) {
            // Mask provided: primary = fal-ai/inpaint (SDXL mask-guided), fallback = flux-pro/v1/fill
            // Each model gets its own correct schema body - NOT shared through callFalWithFallback
            const inpaintBody = {
              model_name: 'diffusers/stable-diffusion-xl-1.0-inpainting-0.1',
              image_url: sourceImageUrl,
              mask_url: maskImageUrl,
              prompt: editPrompt,
              negative_prompt: 'watermark, text, logo, overlay, artifacts, distortion, blurry',
              num_inference_steps: 30,
              guidance_scale: 7.5,
            };
            const inpaintRes = await fetch('https://fal.run/fal-ai/inpaint', {
              method: 'POST',
              headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(inpaintBody),
            });
            if (inpaintRes.ok) {
              const inpaintData = await inpaintRes.json() as { image?: { url: string }; images?: Array<{ url: string }> };
              const url = inpaintData?.image?.url || inpaintData?.images?.[0]?.url || null;
              result = { imageUrl: url, error: url ? null : 'No image URL in inpaint response', modelUsed: 'fal-ai/inpaint' };
            } else {
              const errText = await inpaintRes.text();
              console.error('[Ember] fal-ai/inpaint failed:', inpaintRes.status, errText);
              // Fallback: flux-pro/v1/fill with its own clean schema
              const fluxFillBody = {
                image_url: sourceImageUrl,
                mask_url: maskImageUrl,
                prompt: editPrompt,
              };
              const fluxRes = await fetch('https://fal.run/fal-ai/flux-pro/v1/fill', {
                method: 'POST',
                headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(fluxFillBody),
              });
              if (fluxRes.ok) {
                const fluxData = await fluxRes.json() as { image?: { url: string }; images?: Array<{ url: string }> };
                const url = fluxData?.image?.url || fluxData?.images?.[0]?.url || null;
                result = { imageUrl: url, error: url ? null : 'No image URL in flux-fill response', modelUsed: 'fal-ai/flux-pro/v1/fill' };
              } else {
                const fluxErr = await fluxRes.text();
                console.error('[Ember] fal-ai/flux-pro/v1/fill failed:', fluxRes.status, fluxErr);
                result = { imageUrl: null, error: 'Both inpainting models failed. Please try uploading a clearer mask image.', modelUsed: 'fal-ai/flux-pro/v1/fill' };
              }
            }
          } else {
            // No mask: flux-pro/kontext handles instruction-only edits (no mask needed)
            // Schema: { image_url, prompt } only - kontext does not require a mask
            result = await withTimeout(callFalWithFallback(
              'fal-ai/flux-pro/kontext',
              null,
              { image_url: sourceImageUrl, prompt: editPrompt }
            ), TIMEOUT_MS);
          }
        } else if (cleanupMode === 'upscale') {
          const scaleFactor = upscaleFactor === '4x' ? 4 : 2;
          result = await withTimeout(callFalWithFallback(
            'fal-ai/clarity-upscaler',
            'fal-ai/creative-upscaler',
            { image_url: sourceImageUrl, upscale_factor: scaleFactor, prompt: 'high quality, sharp, detailed', creativity: 0 }
          ), TIMEOUT_MS);
        } else if (cleanupMode === 'color_correct') {
          const goalPrompts: Record<string, string> = {
            auto: 'Fix the colors in this photo. Correct white balance, remove color casts, restore natural tones and contrast.',
            brighten: 'Brighten this photo. Increase exposure, lift shadows, make the image feel airy and well-lit.',
            remove_yellow: 'Remove the yellow tint from this photo. Correct white balance to neutral/cool tones.',
            restore_vintage: 'Restore this vintage or old photo. Remove fading, correct yellowing, restore contrast and natural color.',
            enhance_contrast: 'Enhance the contrast of this photo. Deepen blacks, lift highlights, make the image pop.',
          };
          const colorPrompt = goalPrompts[correctionGoal] || goalPrompts.auto;
          result = await withTimeout(callFalWithFallback(
            'fal-ai/flux-kontext-pro',
            null,
            { image_url: sourceImageUrl, prompt: colorPrompt, guidance_scale: 2.5, num_inference_steps: 28 }
          ), TIMEOUT_MS);
        } else {
          result = { imageUrl: null, error: `Unknown cleanup mode: ${cleanupMode}`, modelUsed: 'none' };
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[Ember] exception:', errMsg);
        result = { imageUrl: null, error: errMsg, modelUsed: 'unknown' };
      }

      if (!result.imageUrl) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Image cleanup failed', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: `Image cleanup failed: ${result.error || 'Unknown error'}. Please try again.` } });
        return NextResponse.json({ error: 'Image cleanup failed' }, { status: 500 });
      }

      // Build mode-specific label
      const modeLabels: Record<string, string> = {
        remove_background: 'Background removed',
        remove_object: `Object removed: "${objectDescription || 'specified object'}"`,
        remove_watermark: 'Watermark / text removed',
        upscale: `Image upscaled ${upscaleFactor}`,
        color_correct: `Colors corrected${correctionGoal !== 'auto' ? ': ' + correctionGoal.replace(/_/g, ' ') : ''}`,
      };
      const formatLabels: Record<string, string> = {
        png_transparent: 'PNG with transparency',
        png: 'PNG',
        jpg: 'JPG',
      };

      const outputText = `## Image Cleanup Complete\n\n**What Ember did:** ${modeLabels[cleanupMode] || cleanupMode}\n\n**Output format:** ${formatLabels[outputFormat] || outputFormat}\n\n---\n\n## Validation\n\n- ${cleanupMode === 'remove_background' ? 'Background removed. If any edges appear rough (especially around hair or fine details), try again with a higher-contrast source image.' : cleanupMode === 'remove_object' ? 'Object area inpainted. Check that the fill matches the surrounding background naturally. Complex scenes may need a second pass.' : cleanupMode === 'remove_watermark' ? 'Watermark area inpainted. Check that the fill is clean. Dense or large watermarks may leave artifacts.' : cleanupMode === 'upscale' ? `Image upscaled ${upscaleFactor}. Check edges for any sharpening artifacts. Start with the highest-quality source available for best results.` : 'Colors corrected. Review in your target context (web, print) - monitor calibration affects perception.'}\n\n## Notes for sharper output next time\n\n- ${cleanupMode === 'remove_background' ? 'High-contrast subjects against uniform backgrounds produce the cleanest removals.' : cleanupMode === 'remove_object' ? 'More specific descriptions get better results. Try: \'the red car in the bottom-left\' instead of \'the car\'.' : cleanupMode === 'remove_watermark' ? 'Providing the exact location (e.g. \'bottom-right corner\') improves targeting.' : cleanupMode === 'upscale' ? 'The closer your source is to 512x512 or larger, the better the 4x upscale result.' : 'For best results, provide a photo with clear exposure issues rather than already-processed images.'}\n\n---\n\nFor making this into a YouTube thumbnail: run Reed (Thumbnail Designer).\nFor logo design from scratch: run Shay (Logo Concept Generator).\nFor social media graphics: run Gus (Social Media Graphics Designer).`;

      await supabase.from('tasks').update({
        status: 'completed',
        output: {
          images: [{ url: result.imageUrl, index: 1 }],
          format: 'images',
          isImageCleanup: true,
          cleanupMode,
          outputFormat,
          outputText,
          expiresAt: new Date(Date.now() + 172800 * 1000).toISOString(),
        },
        output_format: 'images',
        model_used: result.modelUsed,
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // Silas (website-builder) - Section-based HTML/CSS/JS website generation + optional AI images
    if (task.worker_slug === 'website-builder') {
      const { default: SILAS_SYSTEM_PROMPT } = await import('../../../lib/workers/website-builder/prompt');
      const { supabaseAdmin: silasAdmin } = await import('@/lib/api-auth');
      const falKey = process.env.FAL_API_KEY;

      const silasInput = task.input as Record<string, string>;
      const pageType = silasInput.page_type || 'landing';
      const businessName = silasInput.business_name || 'Your Business';
      const wantsAiImages = (silasInput.image_preference || '').toLowerCase().includes('ai-generated');

      // Build user prompt using the same pattern as other workers
      const { getWorkerPromptConfig, injectSharedPromptRules } = await import('../../../lib/workers/configs');
      const silasCfg = getWorkerPromptConfig('website-builder');
      const silasUserPrompt = silasCfg?.buildUserPrompt ? silasCfg.buildUserPrompt(silasInput) : '';

      // Call Claude for website artifact JSON
      let artifactRaw = '';
      try {
        const silasResponse = await callAI({
          model_tier: 'sonnet',
          system: appendContextPrompt(injectSharedPromptRules('website-builder', SILAS_SYSTEM_PROMPT), templateContextAddition, dateContext, memoryContext, ratingsContext, effectiveBrandContext),
          messages: [{ role: 'user', content: silasUserPrompt }],
          max_tokens: 16000,
        });
        artifactRaw = silasResponse.content || '';
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Claude call failed';
        console.error('[Silas] Claude error:', errMsg);
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Website generation failed', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Website generation failed. Please try again.' } });
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }

      // Parse artifact JSON - Claude may wrap in markdown fences or append text after the JSON
      // Robust extraction: find first '{' and last matching '}'
      let artifact: Record<string, unknown>;
      try {
        const jsonStart = artifactRaw.indexOf('{');
        const jsonEnd = artifactRaw.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
          throw new Error('No JSON object found in response');
        }
        const extracted = artifactRaw.slice(jsonStart, jsonEnd + 1);
        artifact = JSON.parse(extracted);
      } catch (parseErr) {
        console.error('[Silas] JSON parse failed, raw length:', artifactRaw.length, artifactRaw.slice(0, 300));
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Website generation produced invalid output', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Website generation produced invalid output. Please try again.' } });
        return NextResponse.json({ error: 'Artifact parse failed' }, { status: 500 });
      }

      // AI image generation (optional, +1cr per image, max 4)
      type SilasImage = { id: string; type: string; url?: string; query?: string; alt?: string; section_id?: string };
      const images = (artifact.images || []) as SilasImage[];
      const aiImageSlots = wantsAiImages ? images.filter((img: SilasImage) => img.type === 'ai_generated').slice(0, 4) : [];

      if (aiImageSlots.length > 0 && falKey) {
        // Charge +1cr per AI image (already deducted base 2cr in credit block above)
        const aiImageCredit = aiImageSlots.length;
        // D6 fix: atomic debit via ledger RPC
        if (aiImageCredit > 0) {
          await ledgerDebit({
            userId: task.user_id,
            amount: aiImageCredit,
            referenceId: taskId,
            referenceType: 'website_section',
          });
        }
        // Generate each AI image; fallback to unsplash on any failure
        for (const imgSlot of aiImageSlots) {
          try {
            const prompt = `Professional website image: ${imgSlot.query || 'modern business workspace'}. Clean, high-quality, suitable for a website hero section.`;
            const falRes = await fetch('https://fal.run/fal-ai/flux-pro', {
              method: 'POST',
              headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, aspect_ratio: 'landscape_16_9', num_images: 1, safety_tolerance: '2' }),
            });
            const imgs = artifact.images as SilasImage[];
            const found = imgs.find((im: SilasImage) => im.id === imgSlot.id);
            if (falRes.ok) {
              const falData = await falRes.json() as { images?: Array<{ url: string }> };
              if (falData?.images?.[0]?.url && found) {
                found.url = falData.images[0].url;
              } else if (found) {
                found.type = 'picsum'; // fal returned no URL - fallback
              }
            } else if (found) {
              found.type = 'picsum'; // HTTP error - fallback
            }
          } catch {
            // fallback to unsplash on any exception
            const imgs = artifact.images as SilasImage[];
            const found = imgs.find((im: SilasImage) => im.id === imgSlot.id);
            if (found) found.type = 'picsum';
          }
        }
      }

      // Resolve Unsplash images - swap Picsum placeholders in HTML for keyword-relevant real photos
      // This runs server-side so the UNSPLASH_API_KEY is never exposed to the client
      const { resolveImage, defaultQueryForSection } = await import('../../../lib/workers/website-builder/images');
      const silasImages = (artifact.images || []) as Array<{ id: string; type: string; url?: string; query?: string; seed?: number; width?: number; height?: number; section_id?: string; alt?: string }>;

      if (!wantsAiImages && silasImages.length > 0) {
        // Resolve each image concurrently, then swap Picsum URLs in section HTML
        await Promise.all(silasImages.map(async (img) => {
          if (img.type === 'ai_generated') return; // handled by fal.ai block
          const w = img.width || 1200;
          const h = img.height || 600;
          const seed = img.seed || 42;
          // Find which section this image belongs to, derive section type for default query
          const sectionId = img.section_id || '';
          const sections = artifact.sections as Record<string, { type?: string }>;
          const sectionType = sections[sectionId]?.type || '';
          const query = img.query || defaultQueryForSection(sectionType, pageType);
          try {
            const resolved = await resolveImage(query, w, h, seed);
            img.url = resolved.url;
            img.type = resolved.source; // 'unsplash' or 'picsum'
            // Swap the Picsum URL in the section HTML with the resolved URL
            if (resolved.source === 'unsplash' && sections[sectionId]) {
              const sec = sections[sectionId] as { html: string };
              const picsumPattern = new RegExp(`https://picsum\.photos/${w}/${h}\\?random=${seed}`, 'g');
              sec.html = sec.html.replace(picsumPattern, resolved.url);
            }
          } catch {
            // keep Picsum URL in HTML - generation must not fail due to image resolution
          }
        }));
      }

      // Assemble final HTML from artifact
      function assembleSite(art: Record<string, unknown>): string {
        const sections = art.sections as Record<string, { order: number; html: string; css: string; type?: string }> || {};
        const shared = art.shared as { head_html?: string; global_css?: string; global_js?: string; tailwind_cdn?: boolean } || {};
        const sortedSections = Object.values(sections).sort((a, b) => a.order - b.order);
        const sectionsHtml = sortedSections.map(s => s.html || '').join('\n');
        const sectionsCss = sortedSections.map(s => s.css || '').filter(Boolean).join('\n');
        const tailwindTag = shared.tailwind_cdn !== false ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
        return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${tailwindTag}\n${shared.head_html || ''}\n<style>\n${shared.global_css || ''}\n${sectionsCss}\n</style>\n</head>\n<body>\n${sectionsHtml}\n<script>\n${shared.global_js || ''}\n</script>\n</body>\n</html>`;
      }

      const assembledHtml = assembleSite(artifact);

      // Build readable summary text for task result display
      const pageTypeLabel: Record<string, string> = {
        landing: 'Landing Page', coming_soon: 'Coming Soon Page', lead_magnet: 'Lead Magnet Page',
        sales_page: 'Sales Page', service_business: 'Service Business Page',
      };
      const sectionCount = Object.keys((artifact.sections as object) || {}).length;
      const summary = (artifact.summary as string) || `${businessName} ${pageTypeLabel[pageType] || 'website'} built - ${sectionCount} sections. Ready to download, push to WordPress, or save to Google Drive.`;

      const outputText = `## ${businessName} - ${pageTypeLabel[pageType] || 'Website'} Ready\n\n${summary}\n\n---\n\n**${sectionCount} sections generated.** Use the Section Refinement panel to refine any section individually (1 credit per refinement).\n\n${(artifact.placeholders_added as string[])?.length ? `### Placeholders to Replace\n\n${(artifact.placeholders_added as string[]).map(p => `- ${p}`).join('\n')}\n\n---\n\n` : ''}### What\'s Next\n\n- **Reed** (Thumbnail Designer): creating hero images or featured images for the site\n- **Ember** (Image Cleanup): cleaning up photos before adding them to the site\n- **Nash** (Site Auditor): auditing the site after publishing for performance and SEO`;

      await supabase.from('tasks').update({
        status: 'completed',
        output: {
          text: outputText,
          format: 'html',
          isWebsiteBuilder: true,
          pageType,
          businessName,
          artifact,
          assembledHtml,
          sectionCount,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        },
        output_format: 'html',
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // Reed (thumbnail designer) - Nano Banana Pro thumbnail pipeline
    if (task.worker_slug === 'thumbnail-designer') {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Image generation service not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Image generation service not configured' } });
        return NextResponse.json({ error: 'Image generation service not configured' }, { status: 500 });
      }

      const reedInput = task.input as Record<string, string>;
      const description = reedInput.description || reedInput.video_topic || '';
      const headlineText = (reedInput.headline_text || reedInput.text_on_thumbnail || '').toUpperCase().trim();
      const style = normalizeReedStyle(reedInput.style);
      const platformSpec = getReedPlatformSpec(reedInput.platform);
      let extractedConcept: ReedConcept | undefined;
      if (reedInput.structured_concept) {
        try { extractedConcept = JSON.parse(reedInput.structured_concept) as ReedConcept; } catch { extractedConcept = undefined; }
      }

      // ── Step 1: Detect face photo + reference image uploads ──────────────
      const faceContent = uploadedFileContent.find(c => c.includes('[FIELD: face_photo]')) || null;
      const referenceContent = uploadedFileContent.find(c => c.includes('[FIELD: reference_image]')) || null;
      const legacyContent = !faceContent && !referenceContent ? (uploadedFileContent[0] || null) : null;
      const faceStoragePath = (faceContent || legacyContent)?.match(/\[STORAGE_PATH:\s*([^\]]+)\]/)?.[1]?.trim() || null;
      const sketchStoragePath = referenceContent?.match(/\[STORAGE_PATH:\s*([^\]]+)\]/)?.[1]?.trim() || null;
      const hasFace = !!faceStoragePath;
      const hasSketch = !!sketchStoragePath;
      const hasBoth = hasFace && hasSketch;
      console.log('[Reed] hasFace:', hasFace, '| hasSketch:', hasSketch, '| style:', style, '| platform:', platformSpec.aspectRatio, '| desc:', description.slice(0, 60));

      // ── Step 2: Get signed URLs if present ───────────────────────────────
      let referenceImageUrl: string | null = null;
      let sketchImageUrl: string | null = null;
      if (hasFace && faceStoragePath) {
        const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(faceStoragePath, 3600);
        referenceImageUrl = signed?.signedUrl || null;
      }
      if (hasSketch && sketchStoragePath) {
        const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(sketchStoragePath, 3600);
        sketchImageUrl = signed?.signedUrl || null;
      }

      // ── Step 3: Build 3 distinct thumbnail-native prompts ────────────────
      const variations = buildReedThumbnailPrompts({
        description,
        style,
        platform: reedInput.platform,
        headlineText,
        colorPreference: reedInput.color_preference || reedInput.colors || reedInput.color || '',
        concept: extractedConcept,
        hasFace,
        hasSketch: hasSketch && !hasBoth,
        hasBoth,
        nativeText: true,
      });
      const prompts = variations.map(v => v.prompt);

      // ── Step 4: Call fal.ai × 3 in parallel ──────────────────────────────
      type GenOutput = { images?: Array<{ url: string }> };
      type ReedFalInput = { prompt: string; num_images: number; aspect_ratio: string; image_url?: string; image_urls?: string[]; output_format?: 'jpeg' | 'png' | 'webp'; resolution?: '1K' | '2K' | '4K' };
      const primaryRefUrl = referenceImageUrl || sketchImageUrl;
      // Nano Banana Pro reference conditioning uses the /edit endpoint with image_urls[]; text-only uses /nano-banana-pro.
      // If every NB reference call fails, retry on Kontext so face-photo tasks do not strand users during provider rollout.
      const falModel = primaryRefUrl ? `${REED_MODEL}/edit` : REED_MODEL;
      const falProviderResponses: unknown[] = [];
      const buildInput = (prompt: string, model: string): ReedFalInput => {
        const input: ReedFalInput = { prompt, num_images: 1, aspect_ratio: platformSpec.aspectRatio, output_format: 'png' };
        if (primaryRefUrl) {
          if (model.includes('nano-banana-pro/edit')) {
            input.image_urls = [primaryRefUrl];
            input.resolution = '1K';
          } else {
            input.image_url = primaryRefUrl;
          }
        }
        return input;
      };
      const runPrompt = async (prompt: string, index: number, model: string): Promise<string> => {
        const res = await fetch(`https://fal.run/${model}`, {
          method: 'POST',
          headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildInput(prompt, model)),
        });
        if (!res.ok) {
          const errText = await res.text();
          falProviderResponses.push({ stage: `variation_${index + 1}_error`, provider: 'fal.ai', model, status: res.status, body: errText });
          throw new Error(errText.slice(0, 300));
        }
        const data = await res.json() as GenOutput;
        falProviderResponses.push({ stage: `variation_${index + 1}`, provider: 'fal.ai', model, status: res.status, body: data });
        const url = data?.images?.[0]?.url;
        if (!url) throw new Error('No image URL from fal.ai');
        return url;
      };

      let results = await Promise.allSettled(prompts.map((prompt, i) => runPrompt(prompt, i, falModel)));
      let imageUrls = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map(r => r.value);
      results.filter(r => r.status === 'rejected').forEach((r, i) => console.error(`[Reed] NB Pro [${i}] failed:`, (r as PromiseRejectedResult).reason?.message));

      let modelUsed = falModel;
      if (imageUrls.length === 0 && primaryRefUrl) {
        console.warn('[Reed] NB Pro failed with reference image; retrying Kontext fallback for face/reference preservation');
        results = await Promise.allSettled(prompts.map((prompt, i) => runPrompt(prompt, i, REED_FACE_FALLBACK_MODEL)));
        imageUrls = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map(r => r.value);
        modelUsed = `${falModel} (failed) -> ${REED_FACE_FALLBACK_MODEL}`;
      }

      if (imageUrls.length === 0) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'All image generations failed', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'All image generations failed - please try again', provider_responses: falProviderResponses } });
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
      }
      console.log('[Reed] generated:', imageUrls.length, 'images via', modelUsed);

      logExternalAPICall({
        user_id: task.user_id,
        task_id: taskId,
        worker_id: task.worker_slug,
        provider: 'fal.ai',
        success: imageUrls.length > 0,
        latency_ms: 0,
        metadata: { model: modelUsed, cost_estimate_usd: imageUrls.length * 0.15, provider_responses: falProviderResponses },
      });

      const reedImages = imageUrls.map((url, i) => ({
        url,
        index: i + 1,
        prompt: prompts[i],
        composition: variations[i]?.composition,
        palette: variations[i]?.palette,
        textZone: variations[i]?.textZone,
        textTreatment: variations[i]?.treatment,
      }));

      await supabase.from('tasks').update({
        status: 'completed',
        output: {
          images: reedImages,
          format: 'images',
          isThumbnail: true,
          size: platformSpec.sizeLabel,
          headline_text: '',
          native_headline_text: headlineText,
          nativeText: true,
          variationPrompts: variations,
          structured_concept: extractedConcept || null,
          provider_responses: falProviderResponses,
          expiresAt: new Date(Date.now() + 172800 * 1000).toISOString(),
        },
        output_format: 'images',
        model_used: modelUsed,
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // Image generation workers - route to DALL-E 3 pipeline
    // Research Assistant - Joe (uses Serper for live web research)
    if (task.worker_slug === 'research-assistant') {
      // NOTE: slug is 'research-assistant' for legacy reasons - this is Joe the Research Assistant
      const researchTopic = regularInput['research_topic'] || regularInput['topic'] || '';
      const context = regularInput['context'] || '';
      const depth = regularInput['depth'] || 'Detailed report';
      const industry = regularInput['industry'] || '';

      // Joe always uses Serper for live web research
      const serperKey = process.env.SERPER_API_KEY;
      let serperContext = '';
      let serperCount = 0;
      if (serperKey && researchTopic) {
        try {
          const serperRes = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': serperKey },
            body: JSON.stringify({ q: researchTopic + (industry ? ` ${industry}` : ''), num: 10 }),
          });
          if (serperRes.ok) {
            const serperData = await serperRes.json() as { organic?: Array<{ title: string; snippet: string; link: string }> };
            const results = serperData?.organic || [];
            serperCount = results.length;
            serperContext = results.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}\nSource: ${r.link}`).join('\n\n');
          }
        } catch { /* continue without serper */ }
      }

      const researchPrompt = `Research the following topic and deliver a structured research brief.

Topic or question: ${researchTopic}
Context: ${context || 'None provided'}
Depth: ${depth}
Industry: ${industry || 'General'}

${serperContext ? `LIVE WEB RESEARCH (${serperCount} results - reference these sources in your output):\n\n${serperContext}\n\n---` : ''}

Deliver a well-structured research brief with:
- Executive Summary (2-3 sentences)
- Key Findings (bullet points with data where available)
- Detailed Analysis (organized by sub-topic)
- Sources and References (if web research was used)
- Recommendations or Next Steps

${depth === 'Quick overview' ? 'Keep it concise - 300-500 words total.' : depth === 'Deep dive with sources' ? 'Go deep - 800-1200 words with specific data points, quotes, and citations.' : 'Aim for 500-800 words with clear structure and actionable insights.'}`;

      const claudeResponse = await callAI({
        model_tier: 'sonnet',
        system: appendContextPrompt(workerConfig.systemPrompt, templateContextAddition, dateContext, memoryContext, ratingsContext, effectiveBrandContext),
        messages: [{ role: 'user', content: researchPrompt }],
        max_tokens: 3000,
      }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId });

      let resultText = claudeResponse.content || '';
      if (serperCount > 0) {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        resultText += `\n\n---\n*Sources: ${serperCount} web results · ${dateStr}*`;
      }

      await supabase.from('tasks').update({
        status: 'completed',
        output: { text: resultText, format: 'markdown' },
        output_format: 'markdown',
        model_used: 'claude-sonnet-4-6',
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // Site Auditor - Nash (Google PageSpeed Insights + Serper + Claude)
    if (task.worker_slug === 'site-auditor') {
      const nashInput = task.input as Record<string, string>;
      const auditMode = nashInput.audit_mode || 'performance_audit';
      const siteUrl = (nashInput.site_url || '').trim();

      if (!siteUrl) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'No URL provided', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'No URL provided. Please enter your website URL.' } });
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
      }

      // Validate URL format
      let validatedUrl: string;
      try {
        const parsed = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
        validatedUrl = parsed.toString();
      } catch {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Invalid URL format', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: `Invalid URL format: "${siteUrl}". Please include https://.` } });
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }

      const pageSpeedKey = process.env.GOOGLE_PAGESPEED_API_KEY;
      if (!pageSpeedKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'PageSpeed API key not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'PageSpeed API key not configured. Please contact support.' } });
        return NextResponse.json({ error: 'PageSpeed API key not configured' }, { status: 500 });
      }

      // PageSpeed call helper
      // callPageSpeed: 25s timeout (down from 30s) - fail fast on sites that block PageSpeed.
      // Returns null on any failure. Callers surface the specific reason in output via errors[].
      async function callPageSpeed(url: string, strategy: 'desktop' | 'mobile', categories: string[]): Promise<{ data: Record<string, unknown> | null; reason: string | null }> {
        const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
        apiUrl.searchParams.set('url', url);
        apiUrl.searchParams.set('key', pageSpeedKey!);
        apiUrl.searchParams.set('strategy', strategy);
        categories.forEach(c => apiUrl.searchParams.append('category', c));
        try {
          const res = await fetch(apiUrl.toString(), { signal: AbortSignal.timeout(25000) });
          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            const reason = res.status === 400 ? 'URL is invalid or not publicly accessible' :
              res.status === 429 ? 'PageSpeed API rate limit reached - try again in a few minutes' :
              `PageSpeed API error ${res.status}`;
            console.error(`[Nash] PageSpeed ${strategy} ${res.status} for ${url}:`, errBody.slice(0, 200));
            return { data: null, reason };
          }
          return { data: await res.json() as Record<string, unknown>, reason: null };
        } catch (err) {
          const isTimeout = String(err).includes('abort') || String(err).includes('timeout');
          const reason = isTimeout
            ? `PageSpeed could not analyze this site within 25 seconds - it may block the analyzer or exceed its rendering limits`
            : `PageSpeed connection error - site may be unreachable`;
          console.error(`[Nash] PageSpeed ${strategy} timeout/error for ${url}:`, err);
          return { data: null, reason };
        }
      }

      // Serper call helper
      async function callSerper(query: string): Promise<Array<{ title: string; snippet: string; link: string }>> {
        const serperKey = process.env.SERPER_API_KEY;
        if (!serperKey) return [];
        try {
          const res = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': serperKey },
            body: JSON.stringify({ q: query, num: 8 }),
          });
          if (!res.ok) return [];
          const data = await res.json() as { organic?: Array<{ title: string; snippet: string; link: string }> };
          return data?.organic || [];
        } catch {
          return [];
        }
      }

      // Gather API data based on mode
      const apiData: {
        performanceDesktop?: Record<string, unknown> | null;
        performanceMobile?: Record<string, unknown> | null;
        serperResults?: Array<{ title: string; snippet: string; link: string }>;
        competitorData?: Array<{ url: string; data: Record<string, unknown> | null; error?: string }>;
        errors?: string[];
      } = {};
      const errors: string[] = [];

      if (auditMode === 'single_page_scan') {
        // Phase 24c: free mode — PageSpeed desktop only, no Serper, top 5 issues.
        const desktopRes = await callPageSpeed(validatedUrl, 'desktop', ['performance', 'seo']);
        apiData.performanceDesktop = desktopRes.data;
        if (!desktopRes.data) errors.push(desktopRes.reason || 'PageSpeed unavailable - check that your URL is publicly accessible');
        // No Serper call for this mode.

      } else if (auditMode === 'performance_audit') {
        const [desktopRes, mobileRes] = await Promise.all([
          callPageSpeed(validatedUrl, 'desktop', ['performance']),
          callPageSpeed(validatedUrl, 'mobile', ['performance']),
        ]);
        apiData.performanceDesktop = desktopRes.data;
        apiData.performanceMobile = mobileRes.data;
        if (!desktopRes.data) errors.push(`Desktop: ${desktopRes.reason || 'PageSpeed unavailable - check that your URL is publicly accessible'}`);
        if (!mobileRes.data) errors.push(`Mobile: ${mobileRes.reason || 'PageSpeed unavailable'}`);

      } else if (auditMode === 'seo_audit') {
        const desktopRes = await callPageSpeed(validatedUrl, 'desktop', ['performance', 'seo']);
        apiData.performanceDesktop = desktopRes.data;
        if (!desktopRes.data) errors.push(desktopRes.reason || 'PageSpeed data unavailable - check that your URL is publicly accessible');
        // Serper for SERP analysis
        const targetKeywords = nashInput.target_keywords || '';
        const targetLocation = nashInput.target_location || 'United States';
        const domain = new URL(validatedUrl).hostname;
        const serperQuery = targetKeywords
          ? `${targetKeywords.split(',')[0].trim()} site:${domain} OR ${targetKeywords.split(',')[0].trim()} ${targetLocation}`
          : `site:${domain} SEO analysis ${targetLocation}`;
        apiData.serperResults = await callSerper(serperQuery);

      } else if (auditMode === 'mobile_audit') {
        const mobileRes = await callPageSpeed(validatedUrl, 'mobile', ['performance', 'best-practices', 'accessibility']);
        apiData.performanceMobile = mobileRes.data;
        if (!mobileRes.data) errors.push(mobileRes.reason || 'Mobile PageSpeed data unavailable - check that your URL is publicly accessible');

      } else if (auditMode === 'competitor_benchmark') {
        const competitorUrlsRaw = (nashInput.competitor_urls || '').split('\n').map((u: string) => u.trim()).filter(Boolean).slice(0, 3);
        const [desktopRes, ...competitorResults] = await Promise.all([
          callPageSpeed(validatedUrl, 'desktop', ['performance']),
          ...competitorUrlsRaw.map(async (cUrl: string) => {
            let validCUrl = cUrl;
            try { validCUrl = new URL(cUrl.startsWith('http') ? cUrl : `https://${cUrl}`).toString(); } catch { return { url: cUrl, data: null, error: 'Invalid URL format' }; }
            const res = await callPageSpeed(validCUrl, 'desktop', ['performance']);
            return { url: validCUrl, data: res.data, error: res.reason || undefined };
          }),
        ]);
        apiData.performanceDesktop = desktopRes.data;
        apiData.competitorData = competitorResults as Array<{ url: string; data: Record<string, unknown> | null; error?: string }>;
        if (!desktopRes.data) errors.push(desktopRes.reason || 'PageSpeed data unavailable for your site - check that the URL is publicly accessible');

      } else if (auditMode === 'full_audit') {
        const competitorUrlsRaw = (nashInput.competitor_urls_full || nashInput.competitor_urls || '').split('\n').map((u: string) => u.trim()).filter(Boolean).slice(0, 3);
        const targetKeywords = nashInput.target_keywords_full || nashInput.target_keywords || '';
        const domain = new URL(validatedUrl).hostname;
        const serperQuery = targetKeywords
          ? `${targetKeywords.split(',')[0].trim()} site:${domain}`
          : `${domain} site review`;
        const [desktopRes, mobileRes, serperData, ...competitorResults] = await Promise.all([
          callPageSpeed(validatedUrl, 'desktop', ['performance', 'seo']),
          callPageSpeed(validatedUrl, 'mobile', ['performance', 'best-practices', 'accessibility']),
          callSerper(serperQuery),
          ...competitorUrlsRaw.map(async (cUrl: string) => {
            let validCUrl = cUrl;
            try { validCUrl = new URL(cUrl.startsWith('http') ? cUrl : `https://${cUrl}`).toString(); } catch { return { url: cUrl, data: null, error: 'Invalid URL format' }; }
            const res = await callPageSpeed(validCUrl, 'desktop', ['performance']);
            return { url: validCUrl, data: res.data, error: res.reason || undefined };
          }),
        ]);
        apiData.performanceDesktop = (desktopRes as { data: Record<string, unknown> | null }).data;
        apiData.performanceMobile = (mobileRes as { data: Record<string, unknown> | null }).data;
        apiData.serperResults = serperData as Array<{ title: string; snippet: string; link: string }>;
        if (competitorUrlsRaw.length > 0) {
          apiData.competitorData = competitorResults as Array<{ url: string; data: Record<string, unknown> | null; error?: string }>;
        }
        if (!apiData.performanceDesktop) errors.push((desktopRes as { reason: string | null }).reason || 'Desktop PageSpeed data unavailable');
        if (!apiData.performanceMobile) errors.push((mobileRes as { reason: string | null }).reason || 'Mobile PageSpeed data unavailable');
      }

      apiData.errors = errors;

      // Build prompt with injected API data
      const { buildSiteAuditorPrompt, siteAuditorSystemPrompt } = await import('../../../lib/workers/site-auditor/prompt');
      const nashPrompt = buildSiteAuditorPrompt(nashInput, apiData);

      // Call Claude to synthesize
      const claudeResponse = await callAI({
        model_tier: 'sonnet',
        system: appendContextPrompt(siteAuditorSystemPrompt, templateContextAddition, dateContext, memoryContext, ratingsContext, effectiveBrandContext),
        messages: [{ role: 'user', content: nashPrompt }],
        max_tokens: 8000,
      }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId });

      const resultText = claudeResponse.content || '';

      await supabase.from('tasks').update({
        status: 'completed',
        output: { text: resultText, format: 'markdown' },
        output_format: 'markdown',
        model_used: 'claude-sonnet-4-6',
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // Lead generator - RocketReach API
    if (task.worker_slug === 'lead-generator') {
      const input = task.input as Record<string, string>;

      if (!process.env.ROCKETREACH_API_KEY) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'RocketReach API key not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'RocketReach API key not configured' } });
        return NextResponse.json({ error: 'RocketReach API key not configured' }, { status: 500 });
      }

      // Step 1: RocketReach search (free - no export credits)
      const rawTitles = input.job_titles || input.target_role || '';
      const rrStart = Date.now();
      let rrLeads: import('@/lib/rocketreach').RocketReachLead[] = [];
      let rrTotal = 0;
      let rrRequestPayload: import('@/lib/rocketreach').RocketReachSearchPayload | null = null;
      try {
        const { buildRocketReachSearchPayload, searchRocketReach } = await import('@/lib/rocketreach');
        const rrQuery = {
          target_industry: input.target_industry,
          job_titles: rawTitles,
          seniority_level: input.seniority_level || input.seniority,
          location: input.location,
          company_size: input.company_size,
          exclude_companies: input.exclude_companies,
        };
        rrRequestPayload = buildRocketReachSearchPayload(rrQuery);
        const result = await searchRocketReach(rrQuery);
        rrLeads = result.leads;
        rrTotal = result.total;
        rrRequestPayload = result.requestPayload;
        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
          provider: 'rocketreach', success: true, latency_ms: Date.now() - rrStart,
          metadata: { step: 'search', request_payload: rrRequestPayload, response_count: rrLeads.length, result_count: rrLeads.length, total: rrTotal },
        });
      } catch (err) {
        console.error('RocketReach search failed:', err);
        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
          provider: 'rocketreach', success: false, latency_ms: Date.now() - rrStart,
          metadata: { step: 'search', request_payload: rrRequestPayload, response_count: 0, error: String(err) },
        });
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Lead search failed', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Lead search failed. Please try again.' } });
        return NextResponse.json({ error: 'Lead search failed. Please try again.' }, { status: 500 });
      }

      // If RocketReach returns actual leads, proceed with the top matches even when the
      // total hit count is broad. The first page is ranked, and blocking a populated
      // search here made valid Lenny searches look like failures/refunds.
      if (rrTotal > 500 && rrLeads.length === 0) {
        const tooBroadOutput = {
          too_broad: true,
          total_results: rrTotal,
          message: `Your search matched ${rrTotal.toLocaleString()} contacts — that's too broad for quality leads. Try narrowing your criteria. Credits refunded.`,
          suggestions: [
            'Add more specific job titles (e.g., "VP Marketing" instead of just "CEO")',
            'Narrow the location (e.g., "California" instead of "United States")',
            'Add a company size filter',
            'Use more specific industry keywords',
          ],
          search_criteria: {
            industry: input.target_industry || 'any',
            titles: rawTitles || 'any',
            size: input.company_size || 'any',
            location: input.location || 'any',
          },
        };
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Search too broad — over 500 results', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: tooBroadOutput });
        return NextResponse.json({ success: true, taskId });
      }

      if (rrLeads.length === 0) {
        // Zero results = full refund. RocketReach charges per reveal, not per search.
        // Zero-result searches cost $0 in API fees, so full credit refund is correct.
        await failTaskAndRefund({
          supabase,
          taskId: taskId!,
          userId: _creditOwnerId,
          reason: 'Search returned no matches',
          creditsCharged: _creditCost,
          workspaceId: task.workspace_id,
          output: {
            error: 'Search returned no matches. Try broadening your criteria (e.g., wider location, additional job titles, broader company size range). Credits refunded.',
            leads: [],
            total_results: 0,
            search_criteria: {
              industry: input.target_industry || 'any',
              titles: rawTitles || 'any',
              size: input.company_size || 'any',
              location: input.location || 'any',
            },
          },
        });
        return NextResponse.json({ success: true, taskId });
      }

      // Step 2: Bulk reveal all leads - get emails + phones server-side
      // Uses bulkLookup (up to 100 profiles per request, no webhook needed for sync)
      // Falls back to individual lookups if bulk not supported
      const { revealContact } = await import('@/lib/rocketreach');
      const revealStart = Date.now();
      const revealedLeads = await Promise.all(
        rrLeads.map(async (lead) => {
          try {
            const contact = await revealContact(lead.profile_id);
            return { ...lead, revealed: true, email: contact.email, phone: contact.phone };
          } catch {
            // If lookup fails for a specific lead, keep the search data, mark revealed with nulls
            return { ...lead, revealed: true, email: null, phone: null };
          }
        })
      );
      logExternalAPICall({
        user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
        provider: 'rocketreach', success: true, latency_ms: Date.now() - revealStart,
        metadata: { step: 'bulk_reveal', requested: rrLeads.length, returned: revealedLeads.length },
      });

      // Store structured JSON output - all leads pre-revealed
      const leadsOutput: import('@/lib/rocketreach').LeadsOutput = {
        leads: revealedLeads,
        search_criteria: {
          industry: input.target_industry || 'any',
          titles: rawTitles || 'any',
          size: input.company_size || 'any',
          location: input.location || 'any',
        },
        total_results: rrTotal,
      };

      await supabase.from('tasks').update({
        status: 'completed',
        output: leadsOutput,
        output_format: 'leads',
        model_used: 'rocketreach',
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

    // ── Credit refund helper (D6 fix: uses atomic ledger RPC) ────────────────────────────
    const refundCredits = async (reason: string) => {
      if (_creditCost <= 0) return;
      try {
        const refund = await ledgerRefund({
          userId: _creditOwnerId,
          amount: _creditCost,
          referenceId: taskId ?? 'unknown',
          referenceType: 'task',
        });
        if (taskId && (refund.ok || refund.errorCode === 'no_original_debit')) {
          await supabase.from('tasks').update({ refund_applied: true }).eq('id', taskId);
        }
        console.log(`[refund] Refunded ${_creditCost} credits - reason: ${reason}`);
      } catch (e) {
        console.error('[refund] Failed to refund credits:', e);
      }
    };

    // ── AUDIO & VOICE WORKERS ─────────────────────────────────────────────
    const AUDIO_VOICE_SLUGS = new Set([
      'voiceover-artist', 'transcription-specialist', 'meeting-notes-writer',
      'sound-effects-designer', 'content-translator',
    ]);

    if (AUDIO_VOICE_SLUGS.has(task.worker_slug)) {
      const elevKey = process.env.ELEVENLABS_API_KEY;
      if (!elevKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Audio service not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Audio service not configured.' } });
        return NextResponse.json({ error: 'Audio service not configured' }, { status: 500 });
      }

      const input = task.input as Record<string, string>;
      // Wrap all audio workers in try/catch for credit refund on ElevenLabs failure
      try {

      // ── Clay - Voiceover Artist (TTS) ─────────────────────────────────────
      if (task.worker_slug === 'voiceover-artist') {
        // Light Claude pass first to strip markdown artifacts
        const workerConf = getWorkerPromptConfig('voiceover-artist');
        const cleanedText = workerConf ? await callAI({
          model_tier: 'haiku',
          system: workerConf.systemPrompt,
          messages: [{ role: 'user', content: workerConf.buildUserPrompt(input) }],
          max_tokens: 6000,
        }, { worker_id: 'voiceover-artist', user_id: task.user_id, task_id: taskId }).then(r => r.content) : (input.text_to_narrate || '');

        const mp3Buffer = await elevenLabsTTS({
          text: cleanedText,
          voice: input.voice || 'Professional Male',
          pace: input.pace || 'Normal',
        });

        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: 'voiceover-artist',
          provider: 'elevenlabs', success: true, latency_ms: 0,
          metadata: { call_type: 'elevenlabs-tts', model: 'eleven_multilingual_v2', voice: input.voice },
        });

        // Store MP3 in Supabase Storage
        const audioFileName = `${task.workspace_id || task.user_id}/voiceover-artist/${taskId}.mp3`;
        const { error: storageError } = await supabase.storage
          .from('audio-outputs')
          .upload(audioFileName, mp3Buffer, { contentType: 'audio/mpeg', upsert: true });

        if (storageError) {
          throw new Error('Failed to store audio output: ' + storageError.message);
        }

        await supabase.from('tasks').update({
          status: 'completed',
          output: {
            text: `**Voiceover complete.** Your MP3 is ready.\n\n---\n**Original text:**\n\n${input.text_to_narrate || ''}`,
            format: 'audio',
            audio_url: '',
            audio_path: audioFileName,
            audio_filename: `clay-voiceover-${taskId}.mp3`,
            voice: input.voice,
            pace: input.pace,
          },
          output_format: 'audio',
          model_used: 'eleven_multilingual_v2',
          completed_at: new Date().toISOString(),
        }).eq('id', taskId);

        await fireZapierWebhooks({
          event: 'task.completed', task_id: taskId,
          worker_name: 'Clay', worker_title: 'Voiceover Artist', worker_slug: 'voiceover-artist',
          deliverable_type: 'audio/mp3', deliverable_content: 'Audio file generated', deliverable_url: null,
          credits_used: 3, credit_type: 'heavy', created_at: new Date().toISOString(),
          user_id: task.user_id, workspace_id: task.workspace_id,
        });

        return NextResponse.json({ success: true, taskId });
      }

      // ── Opal - Transcription Specialist ──────────────────────────────────
      if (task.worker_slug === 'transcription-specialist') {
        const audioUrl = input.audio_file_url;
        if (!audioUrl) throw new Error('No audio file URL in task input');

        // Phase 6: allowlist Supabase storage domain for audio fetches
        const _supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
        try { assertSafeUrl(audioUrl as string, [_supabaseHost]); } catch {
          throw new Error('Audio file URL is not from an allowed source');
        }

        // Download the audio file
        const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
        if (!audioRes.ok) throw new Error('Could not retrieve uploaded audio file');
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        const fileName = input.audio_file_name || 'audio.mp3';

        const outputFmt = input.output_format || 'With speaker labels';
        const numSpeakersStr = input.num_speakers || '2';
        const numSpeakers = numSpeakersStr === '3+' ? 99 : parseInt(numSpeakersStr, 10);

        const scribeResult = await elevenLabsScribe({
          audioBuffer,
          fileName,
          numSpeakers,
          withSpeakerLabels: outputFmt !== 'Plain text',
          withTimestamps: outputFmt === 'With timestamps',
        });

        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: 'transcription-specialist',
          provider: 'elevenlabs', success: true, latency_ms: 0,
          metadata: { call_type: 'elevenlabs-scribe', model: 'scribe_v1', file: fileName },
        });

        // Claude post-processing
        const rawTranscript = (scribeResult as { text?: string }).text || JSON.stringify(scribeResult);
        const workerConf = getWorkerPromptConfig('transcription-specialist');
        const cleanedTranscript = workerConf ? await callAI({
          model_tier: 'sonnet',
          system: workerConf.systemPrompt,
          messages: [{ role: 'user', content: workerConf.buildUserPrompt({ ...input, raw_transcript: rawTranscript }) }],
          max_tokens: 8000,
        }, { worker_id: 'transcription-specialist', user_id: task.user_id, task_id: taskId }).then(r => r.content) : rawTranscript;

        await supabase.from('tasks').update({
          status: 'completed',
          output: { text: cleanedTranscript, format: 'markdown' },
          output_format: 'markdown',
          model_used: 'scribe_v1 + claude-sonnet',
          completed_at: new Date().toISOString(),
        }).eq('id', taskId);

        await fireZapierWebhooks({
          event: 'task.completed', task_id: taskId,
          worker_name: 'Opal', worker_title: 'Transcription Specialist', worker_slug: 'transcription-specialist',
          deliverable_type: 'text/markdown', deliverable_content: cleanedTranscript.slice(0, 500), deliverable_url: null,
          credits_used: 1, credit_type: 'heavy', created_at: new Date().toISOString(),
          user_id: task.user_id, workspace_id: task.workspace_id,
        });

        return NextResponse.json({ success: true, taskId });
      }

      // ── Dina - Meeting Notes Writer ─────────────────────────────────────────
      // Two input paths:
      //   Audio upload (2 credits): ElevenLabs Scribe STT → Claude, max 60 min
      //   Transcript paste (1 credit): skip STT, go direct to Claude
      if (task.worker_slug === 'meeting-notes-writer') {
        const hasAudio = !!input.audio_file_url;
        const hasTranscript = !!(input.transcript_paste && String(input.transcript_paste || '').trim().length > 100);

        if (!hasAudio && !hasTranscript) {
          throw new Error('No audio file or transcript provided. Upload a recording or paste a transcript.');
        }

        const workerConf = getWorkerPromptConfig('meeting-notes-writer');
        let rawTranscript = '';
        let modelUsed = 'claude-sonnet';
        let creditsUsed = 1;

        if (hasAudio) {
          // Audio path: 2 credits - server-side 60-min cap enforcement
          creditsUsed = 2;
          const audioUrl = input.audio_file_url!;

          // Phase 6: allowlist Supabase storage domain
          const _supabaseHost2 = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
          try { assertSafeUrl(audioUrl, [_supabaseHost2]); } catch {
            throw new Error('Audio file URL is not from an allowed source');
          }

          // Server-side duration check (client also checks, but this is the authoritative guard)
          const durationSeconds = input.audio_file_duration ? parseFloat(String(input.audio_file_duration)) : null;
          if (durationSeconds && durationSeconds > 3600) {
            await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Audio exceeds 60-minute limit', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Dina handles meetings up to 60 minutes. For longer sessions, split your audio into segments or paste a transcript (1 credit).' } });
            return NextResponse.json({ error: 'Audio exceeds 60-minute limit' }, { status: 400 });
          }

          const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
          if (!audioRes.ok) throw new Error('Could not retrieve uploaded audio file');
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          const fileName = input.audio_file_name || 'meeting.mp3';

          const scribeResult = await elevenLabsScribe({
            audioBuffer,
            fileName,
            numSpeakers: 99,
            withSpeakerLabels: true,
            withTimestamps: false,
          });

          logExternalAPICall({
            user_id: task.user_id, task_id: taskId, worker_id: 'meeting-notes-writer',
            provider: 'elevenlabs', success: true, latency_ms: 0,
            metadata: { call_type: 'elevenlabs-scribe', model: 'scribe_v1', file: fileName },
          });

          rawTranscript = (scribeResult as { text?: string }).text || JSON.stringify(scribeResult);
          modelUsed = 'scribe_v1 + claude-sonnet';
        } else {
          // Transcript paste path: 1 credit - no STT cost
          creditsUsed = 1;
          rawTranscript = String(input.transcript_paste || '');
        }

        const meetingNotes = workerConf ? await callAI({
          model_tier: 'sonnet',
          system: appendContextPrompt(workerConf.systemPrompt, templateContextAddition, dateContext, memoryContext, ratingsContext, effectiveBrandContext),
          messages: [{ role: 'user', content: workerConf.buildUserPrompt({ ...input, raw_transcript: rawTranscript }) }],
          max_tokens: 8000,
        }, { worker_id: 'meeting-notes-writer', user_id: task.user_id, task_id: taskId }).then(r => r.content) : rawTranscript;

        await supabase.from('tasks').update({
          status: 'completed',
          output: { text: meetingNotes, format: 'markdown' },
          output_format: 'markdown',
          model_used: modelUsed,
          completed_at: new Date().toISOString(),
        }).eq('id', taskId);

        await fireZapierWebhooks({
          event: 'task.completed', task_id: taskId,
          worker_name: 'Dina', worker_title: 'Meeting Notes Specialist', worker_slug: 'meeting-notes-writer',
          deliverable_type: 'text/markdown', deliverable_content: meetingNotes.slice(0, 500), deliverable_url: null,
          credits_used: creditsUsed, credit_type: 'heavy', created_at: new Date().toISOString(),
          user_id: task.user_id, workspace_id: task.workspace_id,
        });

        return NextResponse.json({ success: true, taskId });
      }

      // ── Koa - Sound Effects Designer ─────────────────────────────────────
      if (task.worker_slug === 'sound-effects-designer') {
        const description = input.sound_description || '';
        const durationStr = input.duration || '10 seconds';
        const durationSeconds = parseInt(durationStr.replace(/[^0-9]/g, ''), 10) || 10;

        const sfxBuffer = await elevenLabsSFX({ description, durationSeconds });

        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: 'sound-effects-designer',
          provider: 'elevenlabs', success: true, latency_ms: 0,
          metadata: { call_type: 'elevenlabs-sfx', description: description.slice(0, 100), durationSeconds },
        });

        const audioFileName = `${task.workspace_id || task.user_id}/sound-effects-designer/${taskId}.mp3`;
        const { error: storageError } = await supabase.storage
          .from('audio-outputs')
          .upload(audioFileName, sfxBuffer, { contentType: 'audio/mpeg', upsert: true });

        if (storageError) throw new Error('Failed to store SFX output: ' + storageError.message);

        await supabase.from('tasks').update({
          status: 'completed',
          output: {
            text: `**Sound effect ready.** Your ${durationSeconds}-second audio file is below.\n\n---\n**Description:** ${description}`,
            format: 'audio',
            audio_url: '',
            audio_path: audioFileName,
            audio_filename: `koa-sfx-${taskId}.mp3`,
          },
          output_format: 'audio',
          model_used: 'elevenlabs-sfx',
          completed_at: new Date().toISOString(),
        }).eq('id', taskId);

        await fireZapierWebhooks({
          event: 'task.completed', task_id: taskId,
          worker_name: 'Koa', worker_title: 'Sound Effects Designer', worker_slug: 'sound-effects-designer',
          deliverable_type: 'audio/mp3', deliverable_content: 'Sound effect generated', deliverable_url: null,
          credits_used: 1, credit_type: 'heavy', created_at: new Date().toISOString(),
          user_id: task.user_id, workspace_id: task.workspace_id,
        });

        return NextResponse.json({ success: true, taskId });
      }

      // ── Tala - Content Translator (Dubbing - async) ───────────────────────
      if (task.worker_slug === 'content-translator') {
        const audioUrl = input.audio_file_url;
        if (!audioUrl) throw new Error('No audio file URL in task input');

        // Phase 6: allowlist Supabase storage domain for audio fetches
        const _supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
        try { assertSafeUrl(audioUrl as string, [_supabaseHost]); } catch {
          throw new Error('Audio file URL is not from an allowed source');
        }

        const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
        if (!audioRes.ok) throw new Error('Could not retrieve uploaded audio file');
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

        // Enforce 5-minute max duration - measure server-side via ffprobe
        const TALA_MAX_DURATION_SECONDS = 300;
        const talaFileName = input.audio_file_name || 'content.mp3';
        const talaTmpPath = `${os.tmpdir()}/tala-check-${taskId}-${Date.now()}${talaFileName.includes('.') ? talaFileName.slice(talaFileName.lastIndexOf('.')) : '.mp3'}`;
        await import('fs').then(fs => fs.promises.writeFile(talaTmpPath, audioBuffer));
        const talaDurationSeconds = await new Promise<number>((resolve) => {
          ffmpeg.ffprobe(talaTmpPath, (err, metadata) => {
            try { import('fs').then(fs => fs.promises.unlink(talaTmpPath).catch(() => {})); } catch {}
            if (err || !metadata?.format?.duration) return resolve(0);
            resolve(metadata.format.duration);
          });
        });
        // TALA_DYNAMIC_CREDIT: enforce duration matches selected tier
        const selectedDurationTier = (task.input as Record<string, string>)?.content_duration || 'standard';
        const tierMaxSeconds = selectedDurationTier === 'short' ? 120 : 300; // short=2min, standard=5min
        if (talaDurationSeconds > tierMaxSeconds) {
          const tierLabel = selectedDurationTier === 'short' ? 'under 2 minutes (3-credit tier)' : 'under 5 minutes (6-credit tier)';
          await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Audio exceeds tier duration limit', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: `Your audio is longer than the ${tierLabel} supports. Please trim your file or select the longer-duration tier. Credits refunded.` } });
          return NextResponse.json({ success: true, taskId });
        }
        const fileName = input.audio_file_name || 'content.mp3';
        const numSpeakersStr = input.num_speakers || '1';
        const numSpeakers = numSpeakersStr === '3+' ? 99 : numSpeakersStr === '10+' ? 10 : numSpeakersStr === 'Unknown / auto-detect' ? 0 : parseInt(numSpeakersStr, 10);

        // Start dubbing job
        const dubbingJob = await elevenLabsStartDubbing({
          audioBuffer,
          fileName,
          sourceLanguage: input.source_language || 'English',
          targetLanguage: input.target_language || 'Spanish',
          numSpeakers,
        });

        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: 'content-translator',
          provider: 'elevenlabs', success: true, latency_ms: 0,
          metadata: { call_type: 'elevenlabs-dubbing', model: 'dubbing-v1', source: input.source_language, target: input.target_language },
        });

        // Save dubbing_id and return immediately - completion handled by /api/cron/poll-dubbing
        await supabase.from('tasks').update({
          status: 'processing',
          output: {
            text: `Tala is translating your content from **${input.source_language || 'English'}** to **${input.target_language || 'Spanish'}**. This usually takes 2-5 minutes.`,
            format: 'dubbing_pending',
            dubbing_id: dubbingJob.dubbing_id,
            source_language: input.source_language || 'English',
            target_language: input.target_language || 'Spanish',
          },
        }).eq('id', taskId);

        // Kick off background polling immediately (fire and forget)
        const pollUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'}/api/cron/poll-dubbing`;
        fetch(pollUrl, {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET}`,
          },
        }).catch(() => { /* ignore - cron will catch it */ });

        return NextResponse.json({ success: true, taskId });
      }

      } catch (audioErr: unknown) {
        // ElevenLabs failed - refund credits so customer isn't charged for a failed task
        const errMsg = audioErr instanceof Error ? audioErr.message : 'ElevenLabs API error';
        await refundCredits(errMsg);
        await supabase.from('tasks').update({
          status: 'failed',
          output: { error: `Audio processing failed: ${errMsg}. Your credits have been refunded.` },
          error_message: errMsg,
        }).eq('id', taskId);
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── VIDEO WORKERS (Atlas Cloud / Seedance 2.0) ──────────────────────────
    const VIDEO_SLUGS = new Set([
      'product-video-creator', 'b-roll-generator', 'scene-director', 'ad-creative-generator'
    ]);

    if (VIDEO_SLUGS.has(task.worker_slug)) {
      const atlasProviderResponses: unknown[] = [];
      const recordAtlasResponse = (stage: string, response: unknown) => {
        atlasProviderResponses.push({ stage, response });
      };
      const generateAtlasVideo = async (params: Parameters<typeof atlasGenerateVideoWithResponse>[0]) => {
        try {
          const result = await atlasGenerateVideoWithResponse(params);
          recordAtlasResponse('generate', result.providerResponse);
          return result.predictionId;
        } catch (err) {
          const providerResponse = err && typeof err === 'object' && 'providerResponse' in err
            ? (err as { providerResponse?: unknown }).providerResponse
            : null;
          if (providerResponse) recordAtlasResponse('generate_error', providerResponse);
          throw err;
        }
      };
      const atlasKey = process.env.ATLAS_CLOUD_API_KEY;
      if (!atlasKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Video generation API key not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Video generation API key not configured.' } });
        return NextResponse.json({ error: 'Atlas Cloud API key not configured' }, { status: 500 });
      }

      const input = task.input as Record<string, string>;
      // Note: do NOT set status=processing here for video workers
      // Status will be set to processing only after prediction_id is saved
      // This prevents the poll-video cron from picking up tasks that don't have a prediction_id yet

      const workerConf = getWorkerPromptConfig(task.worker_slug);

      try {

      // Build enhanced prompt via Claude
      let enhancedPrompt = input.scene_description || input.ad_concept || '';
      if (workerConf) {
        const enhanced = await callAI({
          model_tier: 'haiku',
          system: workerConf.systemPrompt,
          messages: [{ role: 'user', content: workerConf.buildUserPrompt(input) }],
          max_tokens: 500,
        }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId });
        enhancedPrompt = enhanced.content.trim();
      }

      // Normalize duration value - new form uses '5 seconds (3 credits)' format, legacy uses '5 seconds'
      const rawDuration = (input.duration || '10 seconds').replace(/\s*\(.*\)/, '').trim();
      const duration = DURATION_MAP[rawDuration] || DURATION_MAP[input.duration || ''] || 10;
      const aspectRatio = ASPECT_RATIO_MAP[input.aspect_ratio || '16:9 Landscape'] || '16:9';

      let predictionId: string;

      // ── Product Video Creator (image-to-video if image provided, else text-to-video) ──
      if (task.worker_slug === 'product-video-creator') {
        const imageData = input.product_image; // storage path from file upload (optional)
        const productPrompt = input.scene_description || enhancedPrompt;

        if (imageData) {
          // Image provided - animate the actual product photo
          let imageUrl: string;
          if (imageData.startsWith('[STORAGE_PATH:')) {
            const match = imageData.match(/\[STORAGE_PATH: ([^\]]+)\]/);
            if (!match) throw new Error('Invalid image storage path');
            const storagePath = match[1];
            const { data: signedData } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 3600);
            if (!signedData?.signedUrl) throw new Error('Could not get image URL');
            const imgRes = await fetch(signedData.signedUrl);
            const rawBuf = Buffer.from(await imgRes.arrayBuffer());
            // Seedance Fast i2v ignores aspect_ratio param - pre-pad the image to enforce correct ratio
            const paddedBuf = await padImageToAspectRatio(rawBuf, aspectRatio);
            imageUrl = await atlasUploadMedia(paddedBuf, 'product.jpg', 'image/jpeg');
          } else {
            imageUrl = imageData;
          }

          // Seedance 2.0 Fast image-to-video, fallback to Wan 2.7
          try {
            predictionId = await generateAtlasVideo({
              model: 'bytedance/seedance-2.0-fast/image-to-video',
              prompt: productPrompt,
              image: imageUrl,
              duration,
              aspect_ratio: aspectRatio,
              generate_audio: false,
            });
          } catch (seedanceErr) {
            console.warn('[product-video-creator] Seedance 2.0 Fast failed, falling back to Wan 2.7:', seedanceErr);
            predictionId = await generateAtlasVideo({
              model: 'alibaba/wan-2.7/image-to-video',
              prompt: productPrompt,
              image: imageUrl,
              duration,
              aspect_ratio: aspectRatio,
              resolution: '1080p',
            });
          }
        } else {
          // No image - generate product scene from description only
          predictionId = await generateAtlasVideo({
            model: 'bytedance/seedance-2.0-fast/text-to-video',
            prompt: productPrompt,
            duration,
            aspect_ratio: aspectRatio,
            generate_audio: false,
          });
        }
      }

      // ── B-Roll Generator (text-to-video) ────────────────────────
      else if (task.worker_slug === 'b-roll-generator') {
        // Seedance 2.0 Fast text-to-video, fallback to Wan 2.7
        try {
          predictionId = await generateAtlasVideo({
            model: 'bytedance/seedance-2.0-fast/text-to-video',
            prompt: enhancedPrompt,
            duration,
            aspect_ratio: aspectRatio,
            generate_audio: false,
          });
        } catch (seedanceErr) {
          console.warn('[b-roll-generator] Seedance 2.0 Fast failed, falling back to Wan 2.7:', seedanceErr);
          predictionId = await generateAtlasVideo({
            model: 'alibaba/wan-2.7/text-to-video',
            prompt: enhancedPrompt,
            duration,
            aspect_ratio: aspectRatio,
            resolution: '1080p',
          });
        }
      }

      // ── Scene Director (reference-to-video) ──────────────────────
      else if (task.worker_slug === 'scene-director') {
        // Reference video comes from audio-upload route (stored in audio-uploads bucket)
        const videoSignedUrl = input.audio_file_url; // set by AudioFileUpload via onUpload
        if (!videoSignedUrl) throw new Error('No reference video uploaded. Please upload a MP4 or MOV file.');

        // Download and re-upload to Atlas Cloud
        const vidRes = await fetch(videoSignedUrl, { signal: AbortSignal.timeout(60_000) });
        if (!vidRes.ok) throw new Error('Could not retrieve uploaded reference video');
        const vidBuf = Buffer.from(await vidRes.arrayBuffer());
        const videoUrl = await atlasUploadMedia(vidBuf, input.audio_file_name || 'reference.mp4', 'video/mp4');

        // Seedance 2.0 Fast reference-to-video, fallback to Wan 2.7
        try {
          predictionId = await generateAtlasVideo({
            model: 'bytedance/seedance-2.0-fast/reference-to-video',
            prompt: enhancedPrompt,
            video: videoUrl,
            duration,
            aspect_ratio: aspectRatio,
            generate_audio: true,
          });
        } catch (seedanceErr) {
          console.warn('[scene-director] Seedance 2.0 failed, falling back to Wan 2.7:', seedanceErr);
          predictionId = await generateAtlasVideo({
            model: 'alibaba/wan-2.7/reference-to-video',
            prompt: enhancedPrompt,
            video: videoUrl,
            duration,
            aspect_ratio: aspectRatio,
            resolution: '1080p',
          });
        }
      }

      // ── Ad Creative Generator (image-to-video or text-to-video) ──────
      else {
        const imageData = input.product_image;
        let imageUrl: string | undefined;
        if (imageData?.startsWith('[STORAGE_PATH:')) {
          const match = imageData.match(/\[STORAGE_PATH: ([^\]]+)\]/);
          if (match) {
            const { data: signedData } = await supabase.storage.from('uploads').createSignedUrl(match[1], 3600);
            if (signedData?.signedUrl) {
              const imgRes = await fetch(signedData.signedUrl);
              const rawBuf = Buffer.from(await imgRes.arrayBuffer());
              // Seedance Fast i2v ignores aspect_ratio param - pre-pad the image to enforce correct ratio
              const paddedBuf = await padImageToAspectRatio(rawBuf, aspectRatio);
              imageUrl = await atlasUploadMedia(paddedBuf, 'product.jpg', 'image/jpeg');
            }
          }
        }

        // Seedance 2.0 Fast (image-to-video or text-to-video), fallback to Wan 2.7
        try {
          predictionId = await generateAtlasVideo({
            model: imageUrl ? 'bytedance/seedance-2.0-fast/image-to-video' : 'bytedance/seedance-2.0-fast/text-to-video',
            prompt: enhancedPrompt,
            ...(imageUrl ? { image: imageUrl } : {}),
            duration,
            aspect_ratio: aspectRatio,
            generate_audio: true,
          });
        } catch (seedanceErr) {
          console.warn('[ad-creative-generator] Seedance 2.0 Fast failed, falling back to Wan 2.7:', seedanceErr);
          predictionId = await generateAtlasVideo({
            model: imageUrl ? 'alibaba/wan-2.7/image-to-video' : 'alibaba/wan-2.7/text-to-video',
            prompt: enhancedPrompt,
            ...(imageUrl ? { image: imageUrl } : {}),
            duration,
            aspect_ratio: aspectRatio,
            resolution: '1080p',
          });
        }
      }

      logExternalAPICall({
        user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
        provider: 'atlascloud', success: true, latency_ms: 0,
        metadata: {
          model: 'seedance-2.0-fast / seedance-2.0 / wan-2.7',
          prediction_id: predictionId,
          provider_responses: atlasProviderResponses,
        },
      });

      // Loading text: Fast workers get 1-3 min, Scene Director (Standard) gets 3-5 min
      const videoLoadingText = 'Generating your video... this usually takes 3-5 minutes.';

      // Store prediction_id and return immediately - cron polls for completion
      await supabase.from('tasks').update({
        status: 'processing',
        output: {
          text: videoLoadingText,
          format: 'video_pending',
          prediction_id: predictionId,
          duration: input.duration,
          aspect_ratio: input.aspect_ratio,
          provider_responses: atlasProviderResponses,
        },
      }).eq('id', taskId);

      // Poll-video cron runs every 2 minutes via Vercel scheduler and will pick this up
      // Do NOT fire the cron manually here - it causes race conditions with the DB write

      return NextResponse.json({ success: true, taskId });

      } catch (videoErr: unknown) {
        const errMsg = videoErr instanceof Error ? videoErr.message : 'Video generation error';
        const providerResponse = videoErr && typeof videoErr === 'object' && 'providerResponse' in videoErr
          ? (videoErr as { providerResponse?: unknown }).providerResponse
          : null;
        if (providerResponse && atlasProviderResponses.length === 0) {
          recordAtlasResponse('generate_error', providerResponse);
        }
        logExternalAPICall({
          user_id: task.user_id,
          task_id: taskId,
          worker_id: task.worker_slug,
          provider: 'atlascloud',
          success: false,
          latency_ms: 0,
          metadata: { error: errMsg, provider_responses: atlasProviderResponses },
        });
        await refundCredits(errMsg);
        await supabase.from('tasks').update({
          status: 'failed',
          output: {
            error: `Video generation failed: ${errMsg}. Your credits have been refunded.`,
            provider_responses: atlasProviderResponses,
          },
          error_message: errMsg,
        }).eq('id', taskId);
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Serper web search enrichment - runs before Claude for supported workers
    const SERPER_WORKERS = new Set([
      // Original 7
      'seo-strategist', 'competitor-analyst', 'trend-analyst', 'content-strategist',
      'pricing-strategist', 'audience-persona-builder',
      // New 11
      'ad-campaign-strategist',
      // personal-brand-strategist deprecated (Apr 25 2026) - website-builder does not use Serper
      'sales-outreach-writer',
      'social-media-creator',
      'instagram-strategist', 'market-research-analyst',
      // Additional - slugs that don't match name but are research workers
      'email-marketing-strategist', // Ellis · Email Marketing Strategist
      'research-assistant', // Joe · Research Assistant (slug is legacy - Joe uses Serper)
      'whitepaper-writer', // Naru · Whitepaper Writer (Serper for real third-party citations)
    ]);

    // Phase 24c Serper mode guards: free modes for Kai and Nash skip Serper enrichment.
    // keyword_angle mode = pure Claude SEO strategy, no Serper call.
    // single_page_scan mode = PageSpeed only, no Serper call.
    const taskInput = task.input as Record<string, string>;
    const isKaiFreeMode = task.worker_slug === 'seo-strategist' && taskInput?.seo_mode === 'keyword_angle';
    const isNashFreeMode = task.worker_slug === 'site-auditor' && taskInput?.audit_mode === 'single_page_scan';
    const skipSerper = isKaiFreeMode || isNashFreeMode;

    if (SERPER_WORKERS.has(task.worker_slug) && !skipSerper) {
      const serperKey = process.env.SERPER_API_KEY;
      if (!serperKey) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Web search API key not configured', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Web search API key not configured. Please try again later.' } });
        return NextResponse.json({ error: 'Serper API key not configured' }, { status: 500 });
      }

      const input = task.input as Record<string, string>;
      // Build search terms from ANY meaningful input field across all 18 Serper workers
      // Each worker uses different field names - we catch them all here
      const searchTerms = [
        // Generic / shared
        // trim topic to first sentence (80 chars) - prevents long-form descriptions from dominating the query
        input.topic ? input.topic.slice(0, 80).split('.')[0].trim() : (input.keyword || input.target_keyword || ''),
        input.industry || input.target_industry || input.niche || '',
        input.business || input.business_name || input.brand_name || input.company_name || '',
        // Competitor Analyst (Zane)
        input.competitors ? `${input.competitors.split('\n')[0]} competitor analysis` : '',
        input.target_market || '',
        // Trend Analyst (Jett)
        input.focus || '',
        // SWOT Analyst (Reese)
        input.decision || '',
        // Market Research (Duncan)
        input.market || '',
        // Audience Persona (Nora)
        input.existing_knowledge || '',
        // Ad Campaign (Trey)
        input.what_promoting || '',
        // E-commerce (Emma)
        input.product_name || input.store_platform || '',
        input.target_customer || input.target_audience || input.audience || '',
        // Personal Brand (Silas - deprecated, but kept for legacy tasks)
        input.goal || '',
        // LinkedIn Optimizer (Lea)
        input.job_title_company || '',
        // Pinterest (Lyra)
        input.niche || input.content_to_promote || '',
        // Whitepaper Writer (Naru)
        input.angle || '',
        // Sales Outreach (Wilma)
        input.what_selling || input.target_industry || '',
        // Ash niche field
        input.niche ? input.niche.slice(0, 60).trim() : '',
        // Silas legacy (personal-brand-strategist - deprecated)
        input.your_name || '',
        // Ellis (email-marketing-strategist)
        input.business_context || '',
        // Zane (competitor-analyst)
        input.your_business || '',
        input.competitors_to_analyze ? input.competitors_to_analyze.split('\n')[0] + ' competitor analysis' : '',
        // Joe (research-assistant)
        input.research_topic || '',
        // Reese (swot-analyst)
        input.business_or_idea || '',
        // Nora (audience-persona-builder) V28 field names
        input.product_or_service || '',
        input.audience_description || '',

      ].map(s => s.trim()).filter(Boolean).slice(0, 4).join(' ').slice(0, 200);

      // If still no terms, use worker slug as last resort (always produces some query)
      const finalSearchTerms = searchTerms.trim() || task.worker_slug.replace(/-/g, ' ');

      let serperResults: Array<{ title: string; snippet: string; link: string }> = [];
      const serperStart = Date.now();
      try {
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: finalSearchTerms, num: 8 }),
        });

        const serperLatency = Date.now() - serperStart;

        if (!serperRes.ok) {
          const errText = await serperRes.text();
          logExternalAPICall({
            user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
            provider: 'serper', success: false, latency_ms: serperLatency,
            metadata: { query: finalSearchTerms, status: serperRes.status, error: errText },
          });
          throw new Error(`Serper returned ${serperRes.status}: ${errText}`);
        }

        const serperData = await serperRes.json() as {
          organic?: Array<{ title: string; snippet: string; link: string }>;
        };
        serperResults = serperData?.organic || [];

        // Log full details to ai_call_log (admin-visible, never customer-facing)
        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
          provider: 'serper', success: true, latency_ms: serperLatency,
          metadata: {
            query: finalSearchTerms,
            result_count: serperResults.length,
            urls: serperResults.map(r => r.link),
          },
        });
      } catch (serperErr) {
        const serperLatency = Date.now() - serperStart;
        logExternalAPICall({
          user_id: task.user_id, task_id: taskId, worker_id: task.worker_slug,
          provider: 'serper', success: false, latency_ms: serperLatency,
          metadata: { query: finalSearchTerms, error: String(serperErr) },
        });
        console.error('Serper search failed:', serperErr);
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Web search temporarily unavailable', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Web search is temporarily unavailable. Try again in a few minutes.' } });
        return NextResponse.json({ error: 'Web search unavailable' }, { status: 503 });
      }

      if (serperResults.length === 0) {
        await failTaskAndRefund({ supabase, taskId: taskId!, userId: _creditOwnerId, reason: 'Web search returned no results', creditsCharged: _creditCost, workspaceId: task.workspace_id, output: { error: 'Web search returned no results for this topic. Try broadening your search terms.' } });
        return NextResponse.json({ error: 'No search results found' }, { status: 404 });
      }

      // Inject live results into prompt - mandatory, not optional
      const searchContext = serperResults
        .slice(0, 8)
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.link}`)
        .join('\n\n');
      userPrompt = `${userPrompt}\n\n---\nLIVE WEB RESEARCH (${serperResults.length} results):\n${searchContext}\n\nCITATION RULES (MANDATORY):\n- Use inline citations [1], [2], [3] etc. throughout your output body wherever you reference a fact, stat, or claim from the above sources.\n- Only include sources that are in the LIVE WEB RESEARCH list above. NEVER invent URLs or source details.\n- If no search result supports a specific claim, drop the claim or use general framing ("data suggests," "reports indicate") with no citation.\n- Do NOT append a ## Sources section or any standalone sources/references list at the end of your output. Inline citations are sufficient - the UI handles source display separately.\n- Do NOT append a "Sources: X web results" summary line either.\n---`;
    }

    // Determine model via router
    const modelConfig = getModelForWorker(task.worker_slug, workerCategory);

    // Per-mode max_tokens override for mode-gated workers (e.g. Charlie)
    // All values ≥ 8K use streaming (STREAM_THRESHOLD_TOKENS = 8000 in callAI.ts).
    // Streaming eliminates the blocking 600s SDK timeout - only connection timeout applies.
    // maxDuration is 800s (Fluid Compute). AI_HARD_TIMEOUT_MS is 700s (leaves 100s for DB writes).
    //
    // Signature: realistic Josh-style input (3,500 chars) can produce 50K+ char output.
    //   At ~1.5 chars/token that's ~33K tokens. 16K was the ceiling causing truncation.
    //   Raised to 20K: covers 95%+ of realistic signature inputs within ~4 min on Sonnet.
    // Premium: 8-module cohort, compressed bullet density. 20K is sufficient.
    // Certification: structured exam-prep, can be dense. Raised to 20K.
    const CHARLIE_MODE_MAX_TOKENS: Record<string, number> = {
      mini_course: 8000,
      workshop: 8000,
      signature: 20000,  // raised from 16000 - prevents truncation on realistic inputs
      premium: 20000,
      certification: 20000, // raised from 16000 - matches signature complexity
    };
    let resolvedMaxTokens = modelConfig.maxTokens;
    if (task.worker_slug === 'course-outline-builder') {
      const courseMode = task.input?.course_mode as string | undefined;
      resolvedMaxTokens = (courseMode && CHARLIE_MODE_MAX_TOKENS[courseMode]) ? CHARLIE_MODE_MAX_TOKENS[courseMode] : 20000;
    }
    // Per-mode max_tokens for Heath (podcast-show-notes-writer) - cost guardrail, max task cost $0.033
    const HEATH_MAX_TOKENS: Record<string, number> = {
      show_notes: 1500,
      audiogram_script: 500,
      trailer_concept: 400,
      guest_pitch_email: 500,
      sponsor_one_sheet: 1200,
      repurposing_plan: 2000,
    };
    if (task.worker_slug === 'podcast-show-notes-writer') {
      const heathMode = task.input?.mode as string | undefined;
      resolvedMaxTokens = (heathMode && HEATH_MAX_TOKENS[heathMode]) ? HEATH_MAX_TOKENS[heathMode] : 1500;
    }

    // Per-worker maxOutputTokens from registry — overrides router.ts WORKER_MAX_TOKENS.
    // Used for cost guardrails on light workers (e.g. Sage, Emma) without changing router.ts defaults.
    // Charlie and Heath have dedicated logic above; skip re-override for those two slugs.
    if (
      workerRegistryConfig?.maxOutputTokens &&
      task.worker_slug !== 'course-outline-builder' &&
      task.worker_slug !== 'podcast-show-notes-writer'
    ) {
      resolvedMaxTokens = workerRegistryConfig.maxOutputTokens;
    }

    // ── Inngest pilot: Charlie background job ──────────────────────────────────────────────────
    // When USE_INNGEST_FOR_CHARLIE=true, enqueue Charlie to Inngest instead of running synchronously.
    // Feature flag: flip to 'true' to enable, 'false' to fall back to Vercel synchronous path.
    const useInngestForCharlie = process.env.USE_INNGEST_FOR_CHARLIE?.trim() === 'true';
    if (useInngestForCharlie && task.worker_slug === 'course-outline-builder') {
      const courseMode = (task.input?.course_mode as string) || 'signature';
      const maxTokensForMode = (
        { mini_course: 8000, workshop: 8000, signature: 20000, premium: 20000, certification: 20000 } as Record<string, number>
      )[courseMode] ?? 20000;

      // Mark task as queued
      await supabase.from('tasks').update({ status: 'queued' }).eq('id', taskId);

      // Get user email for notification - use profiles table (fast, same connection) instead of admin API
      const { data: profileForEmail } = await supabase.from('profiles').select('email').eq('id', task.user_id).single();
      const userEmail = profileForEmail?.email || '';

      // Verify event key is present before sending - fail loudly if missing
      if (!process.env.INNGEST_EVENT_KEY) {
        console.error('[inngest] INNGEST_EVENT_KEY not set - cannot queue Charlie task');
        captureTaskError(new Error('INNGEST_EVENT_KEY missing'), 'course-outline-builder', taskId);
        throw new Error('Inngest not configured - INNGEST_EVENT_KEY missing');
      }

      // Send to Inngest - MUST AWAIT in Vercel serverless
      // Fire-and-forget doesn't work: Vercel kills the function after response, aborting in-flight fetches
      // Awaiting adds ~1-2s to response time but guarantees the event reaches Inngest
      const inngestResult = await inngest.send({
        name: 'charlie/course.generate',
        data: {
          task_id: taskId,
          user_id: task.user_id,
          workspace_id: task.workspace_id,
          input: task.input,
          course_mode: courseMode,
          user_email: userEmail,
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          max_tokens: maxTokensForMode,
        },
      });
      console.log('[inngest] Event sent, IDs:', inngestResult?.ids);

      return NextResponse.json({
        success: true,
        taskId,
        status: 'queued',
        message: 'Your course is being built. We\'ll email you when it\'s ready.',
      });
    }
    // ── End Inngest pilot ──────────────────────────────────────────────────────────────────────

    // Hard timeout wrapper: Promise.race guarantees catch fires before Fluid Compute kills the process
    // maxDuration = 800s. 700s for AI generation leaves 100s for DB writes + cleanup.
    // Previously 600s - raised because 16K→20K signature/certification streaming can take 8-10 min on load.
    const AI_HARD_TIMEOUT_MS = 700_000; // 700 seconds (matches 800s maxDuration minus 100s cleanup buffer)
    const aiTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI call timed out after 10 minutes - please try again.')), AI_HARD_TIMEOUT_MS)
    );

    // All 78 workers use sonnet tier; callAI() handles Anthropic → OpenAI fallback automatically
    const aiResult = await Promise.race([
      callAI({
        model_tier: modelConfig.tier,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: resolvedMaxTokens,
      }, { worker_id: task.worker_slug, user_id: task.user_id, task_id: taskId }),
      aiTimeoutPromise,
    ]);

    let resultText = aiResult.content;
    const modelUsed = aiResult.model;

    // Serper workers now build their own ## Sources section via prompt instructions - no code-appended footer needed

    // Case (x-twitter-ghostwriter): enforce 280-char limit per tweet, regen violators
    if (task.worker_slug === 'x-twitter-ghostwriter') {
      const containsAssistantMetaLanguage = (text: string) => {
        const normalized = text.toLowerCase();
        return [
          'no flag detected',
          'internal refusal',
          'you have submitted',
          'you\'ve submitted',
          'appears to be',
          'please provide',
          'i can\'t',
          'i cannot',
          'i am unable',
          'as an ai',
          'as a language model',
          'policy violation',
          'content policy',
        ].some((phrase) => normalized.includes(phrase));
      };

      const parseShortenedTweets = (content: string, expectedCount: number) => {
        if (containsAssistantMetaLanguage(content)) {
          throw new Error('Case tweet-shortening response contained assistant/meta language');
        }

        const shortened = content
          .split(/\n\s*---\s*\n/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        if (shortened.length !== expectedCount) {
          throw new Error(`Case tweet-shortening response count mismatch: expected ${expectedCount}, got ${shortened.length}`);
        }

        for (const tweet of shortened) {
          if (tweet.length > 280 || tweet.length < 10 || containsAssistantMetaLanguage(tweet)) {
            throw new Error('Case tweet-shortening response failed tweet validation');
          }
        }

        return shortened;
      };

      const tweets = resultText.split(/\n---\n|\n\*\*Reply-to-self:\*\*/i);
      const overLimit: string[] = [];
      for (const tweet of tweets) {
        const stripped = tweet.replace(/^\*\*Post \d+.*?\*\*\n?/i, '').replace(/^\d+\/\s*$/m, '').trim();
        if (stripped.length > 280 && stripped.length > 10) {
          overLimit.push(stripped);
        }
      }
      if (overLimit.length > 0) {
        try {
          const fixPrompt = `Shorten each tweet below to under 280 characters while preserving meaning and voice.

Rules:
- Return exactly ${overLimit.length} shortened tweet${overLimit.length === 1 ? '' : 's'}.
- Separate tweets with --- on its own line.
- Return tweet text only. No notes, analysis, refusals, explanations, labels, or questions.
- Never use em dashes.

Tweets:
${overLimit.join('\n---\n')}`;
          const fixResult = await callAI({
            model_tier: 'sonnet',
            system: 'You are a tweet editor. Shorten tweets to under 280 characters without losing the core message or voice. Never use em dashes. Return only shortened tweet text separated by --- when multiple tweets are provided.',
            messages: [{ role: 'user', content: fixPrompt }],
            max_tokens: 2000,
          }, { worker_id: 'x-twitter-ghostwriter', user_id: task.user_id, task_id: taskId });
          // Replace over-limit tweets with shortened versions
          const shortened = parseShortenedTweets(fixResult.content, overLimit.length);
          let fixIdx = 0;
          for (const orig of overLimit) {
            if (shortened[fixIdx]) {
              resultText = resultText.replace(orig, shortened[fixIdx]);
              fixIdx++;
            }
          }
        } catch (error) {
          console.warn('[execute-task] Case tweet-shortening failed validation:', error instanceof Error ? error.message : error);
          // If regen fails, flag in output but don't block
          resultText += `\n\n---\n> **Note:** Some tweets may need manual shortening to fit the 280-character limit.`;
        }
      }
    }

    resultText = enforceHighStakesDisclaimer(task.worker_slug, resultText);

    // Brody (kpi-dashboard-writer): strip metric-data JSON block from prose output, store separately
    let metricData: Record<string, unknown> | null = null;
    if (task.worker_slug === 'kpi-dashboard-writer') {
      const metricMatch = resultText.match(/```metric-data\s*([\s\S]*?)```/);
      if (metricMatch) {
        try {
          metricData = JSON.parse(metricMatch[1].trim());
        } catch {
          // malformed JSON - ignore, xlsx will fall back to empty tabs
        }
        // Strip the entire block (including any preceding newlines) from prose
        resultText = resultText.replace(/\n*```metric-data[\s\S]*?```\n*/g, '').trimEnd();
      }
    }

    // Cade (data-cleaner): strip cade-data JSON block from prose output, store separately
    let cadeData: Record<string, unknown> | null = null;
    if (task.worker_slug === 'data-cleaner') {
      const cadeMatch = resultText.match(/```cade-data\s*([\s\S]*?)```/);
      if (cadeMatch) {
        try {
          cadeData = JSON.parse(cadeMatch[1].trim());
        } catch {
          // malformed JSON - ignore, xlsx will fall back to empty tabs
        }
        // Strip the entire block from prose
        resultText = resultText.replace(/\n*```cade-data[\s\S]*?```\n*/g, '').trimEnd();
      }
    }

    // ── Truncation detection (Heavy workers only) ───────────────────────────────
    // Detects outputs cut short by mid-stream errors or unexpected truncation.
    // Heuristics: incomplete terminal punctuation, unclosed markdown structures,
    // or output significantly shorter than the worker's max_tokens would produce.
    let outputStatus = 'complete';
    const isHeavyWorkerOutput = (getWorkerBySlug(task.worker_slug)?.taskType === 'heavy');
    if (isHeavyWorkerOutput && resultText && resolvedMaxTokens) {
      const trimmed = resultText.trimEnd();
      const lastChar = trimmed.slice(-1);
      const lastLine = trimmed.split('\n').pop()?.trim() || '';

      // 1. Ends mid-word or mid-sentence (no terminal punctuation, no closing markdown)
      const hasTerminalEnd = /[.!?]$/.test(lastChar)
        || /^[-]{3,}$/.test(lastLine)        // --- horizontal rule
        || /^#+\s/.test(lastLine)             // ends on a heading (edge case, but valid)
        || lastLine === ''                    // trailing newline after content
        || /[)\]}]$/.test(lastChar);         // closing bracket/paren
      const midWordEnd = /[a-zA-Z0-9]$/.test(lastChar) && !/[.!?]$/.test(lastChar);

      // 2. Unclosed code blocks
      const codeBlockCount = (resultText.match(/```/g) || []).length;
      const unclosedCodeBlock = codeBlockCount % 2 !== 0;

      // Note: tooShort heuristic removed (false positives on short-form workers like scripts, hooks, SOPs).
      // Option 1 (store finish_reason from Claude API) filed as post-launch task.
      if (midWordEnd || unclosedCodeBlock) {
        outputStatus = 'potentially_truncated';
        console.warn(`[truncation-check] worker=${task.worker_slug} chars=${resultText.length} midWord=${midWordEnd} unclosedCode=${unclosedCodeBlock}`);
      }
    }

    const autoImageRequested = AUTO_IMAGE_WORKER_SLUGS.has(task.worker_slug)
      && wantsAutoGeneratedImage(task.input as Record<string, unknown>);
    const autoImageResult = autoImageRequested
      ? await generateAutoImageForTextTask({
          taskId: taskId!,
          userId: task.user_id,
          workerSlug: task.worker_slug,
          input: task.input as Record<string, unknown>,
          resultText,
          supabase,
        })
      : null;
    const autoImages = autoImageResult?.image ? [autoImageResult.image] : undefined;
    const imageGeneration = autoImageResult?.metadata || (autoImageRequested
      ? { requested: true, status: 'failed', model: 'gpt-image-1-mini' }
      : undefined);
    const modelUsedWithAutoImage = autoImageResult?.image ? `${modelUsed} + gpt-image-1-mini` : modelUsed;

    // Update task with result
    await supabase
      .from('tasks')
      .update({
        status: 'completed',
        output: {
          text: resultText,
          format: workerConfig.outputFormat,
          ...(autoImages ? { images: autoImages } : {}),
          ...(imageGeneration ? { imageGeneration } : {}),
          ...(metricData ? { metricData } : {}),
          ...(cadeData ? { cadeData } : {}),
        },
        output_format: workerConfig.outputFormat,
        model_used: modelUsedWithAutoImage,
        completed_at: new Date().toISOString(),
        output_status: outputStatus,
      })
      .eq('id', taskId);

    // Fire Zapier webhooks - must await before returning or Vercel kills the function
    try {
      const zapierWorker = getWorkerBySlug(task.worker_slug);
      await fireZapierWebhooks({
        event: 'task.completed',
        task_id: taskId,
        worker_name: zapierWorker?.personaName || task.worker_slug,
        worker_title: zapierWorker?.name || task.worker_slug,
        worker_slug: task.worker_slug,
        deliverable_type: `text/${workerConfig.outputFormat}`,
        deliverable_content: resultText,
        deliverable_url: null,
        credits_used: zapierWorker?.taskType === 'heavy' ? (zapierWorker?.creditCost ?? 1) : 0,
        credit_type: zapierWorker?.taskType === 'heavy' ? 'heavy' : 'light',
        created_at: new Date().toISOString(),
        user_id: task.user_id,
        workspace_id: task.workspace_id || undefined,
      });
    } catch (zapErr) { console.error('[execute-task] fireZapierWebhooks error:', zapErr); }

    // Trigger memory extraction in background (fire and forget)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

      fetch(`${baseUrl}/api/extract-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
        },
        body: JSON.stringify({
          userId: task.user_id,
          workspaceId: task.workspace_id || null,
          workerSlug: task.worker_slug,
          taskInput: task.input,
          taskOutput: resultText.slice(0, 2000),
        }),
      }).catch((err) => console.error('Memory extraction fire-and-forget error:', err));
    } catch {
      // Non-critical - don't fail the task if memory extraction fails
    }

    return NextResponse.json({ success: true, taskId });
  } catch (error: unknown) {
    console.error('Execute task error:', error);
    const msg = error instanceof Error ? error.message : 'Execution failed';
    // Capture to Sentry with task context
    captureTaskError(error, 'unknown', taskId, { msg });

    // Try to mark task as failed (best effort)
    if (taskId) {
      try {
        const supabase = await createClient();
        await supabase
          .from('tasks')
          .update({ status: 'failed', error_message: msg, output: { error: msg } })
          .eq('id', taskId);
      } catch { /* ignore */ }

      // Refund credits on failure (best effort) - covers AI errors, timeouts, unexpected throws
      try {
        if (_outerCreditCost > 0 && _outerCreditOwnerId) {
          // D6 fix: atomic refund via ledger RPC
          try {
            await ledgerRefund({
              userId: _outerCreditOwnerId,
              amount: _outerCreditCost,
              referenceId: taskId || 'unknown',
              referenceType: 'task',
            });
          } catch { /* ignore */ }
          // Mark refund_applied so the cron sweep doesn't double-refund
          if (taskId) {
            const { supabaseAdmin: adminRefund } = await import('@/lib/api-auth');
            await adminRefund.from('tasks').update({ refund_applied: true }).eq('id', taskId);
          }
          console.log(`[refund] Auto-refunded ${_outerCreditCost} credits on task failure: ${msg.slice(0, 80)}`);
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
