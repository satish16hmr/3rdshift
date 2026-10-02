export const maxDuration = 120;

/**
 * POST /api/shay/brand-kit
 * On-demand brand kit generator for Shay logo concepts.
 * Fetches logo image → remove.bg → Vectorizer.ai (SVG) → EPS/PDF derivations → sharp variants (full quality) → zip → Supabase upload → signed URL
 *
 * Vector files (SVG, EPS, PDF) are added via Vectorizer.ai when the API key is configured.
 * If vectorization fails, the kit still delivers all PNG variants.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { assertSafeUrl, SsrfError } from '@/lib/ssrf';
import sharp from 'sharp';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// C11 fix: allowlist of origins Shay generates images from.
// fal.ai CDN (v3b.fal.media and other subdomains) + Supabase storage.
// Any other origin is rejected before any external API call is made.
const SHAY_ALLOWED_IMAGE_HOSTS = [
  'fal.media',          // fal.ai CDN root (subdomains like v3b.fal.media matched below)
  'auth.3rdshift.ai',   // Supabase storage signed URLs
  'supabase.co',
];

function isAllowedShayImageUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    const h = hostname.toLowerCase();
    return SHAY_ALLOWED_IMAGE_HOSTS.some(allowed =>
      h === allowed || h.endsWith('.' + allowed)
    );
  } catch {
    return false;
  }
}

// F5: In-memory cache keyed by (taskId, imageIndex)
// Prevents re-burning remove.bg + fal.ai on repeated button clicks.
// Cache is per-instance and resets on cold start — acceptable for short-lived signed URLs.
const BRAND_KIT_CACHE = new Map<string, { downloadUrl: string; fileName: string; hasVectorFiles: boolean; vectorizationFailed: boolean; cachedAt: number }>();
const BRAND_KIT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// F5: Per-user rate limit — max 5 brand kit generations per hour
const BRAND_KIT_RATE = new Map<string, number[]>(); // userId -> timestamps
const BRAND_KIT_RATE_LIMIT = 5;
const BRAND_KIT_RATE_WINDOW_MS = 60 * 60 * 1000;


type Rgb = { r: number; g: number; b: number };

type KitFile = {
  name: string;
  buffer: Buffer;
  description: string;
  dimensions?: string;
};

function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function makeIcoFromPngs(images: Array<{ size: number; buffer: Buffer }>): Buffer {
  const headerSize = 6;
  const dirSize = 16 * images.length;
  let offset = headerSize + dirSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dirs: Buffer[] = [];
  for (const image of images) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
    dir.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(image.buffer.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    offset += image.buffer.length;
  }
  return Buffer.concat([header, ...dirs, ...images.map(i => i.buffer)]);
}

async function extractBrandColors(srcBuffer: Buffer, maxColors = 5): Promise<Rgb[]> {
  const { data, info } = await sharp(srcBuffer)
    .resize(96, 96, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { color: Rgb; count: number; saturation: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 64) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 245 && min > 235) continue; // ignore white background
    const sat = max - min;
    if (max < 18 && sat < 12) continue;
    const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`;
    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { color: { r, g, b }, count: 1, saturation: sat });
  }
  const picked: Rgb[] = [];
  const candidates = [...buckets.values()]
    .sort((a, b) => (b.count * (1 + b.saturation / 255)) - (a.count * (1 + a.saturation / 255)));
  for (const candidate of candidates) {
    const farEnough = picked.every(p => Math.hypot(p.r - candidate.color.r, p.g - candidate.color.g, p.b - candidate.color.b) > 55);
    if (farEnough) picked.push(candidate.color);
    if (picked.length >= maxColors) break;
  }
  if (picked.length === 0) picked.push({ r: 17, g: 17, b: 19 });
  return picked;
}

async function removeWhiteBackgroundFallback(srcBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(srcBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data);
  for (let i = 0; i < buf.length; i += info.channels) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2], a = buf[i + 3];
    if (a === 0) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 246) {
      buf[i + 3] = 0;
    } else if (min > 226 && max - min < 22) {
      const alpha = Math.max(0, Math.min(a, Math.round((255 - min) * 8)));
      buf[i + 3] = alpha;
    }
  }
  return sharp(buf, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

async function makeBrandColorsSheet(colors: Rgb[]): Promise<Buffer> {
  const swatchW = 180;
  const width = Math.max(600, colors.length * swatchW + 80);
  const height = 260;
  const startX = (width - colors.length * swatchW) / 2;
  const blocks = colors.map((color, i) => {
    const x = startX + i * swatchW + 15;
    const hex = rgbToHex(color);
    return `<g><rect x="${x}" y="58" width="150" height="112" rx="16" fill="${hex}"/><text x="${x + 75}" y="208" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#111113">${hex}</text></g>`;
  }).join('');
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="0" fill="#FFFFFF"/><text x="${width / 2}" y="34" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#111113">Brand Color Palette</text>${blocks}</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 0 }).toBuffer();
}

async function makeBusinessCard(logo: Buffer): Promise<Buffer> {
  const logoPng = await sharp(logo).resize(360, 180, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const logoData = `data:image/png;base64,${logoPng.toString('base64')}`;
  const svg = `<svg width="1050" height="600" viewBox="0 0 1050 600" xmlns="http://www.w3.org/2000/svg"><rect width="1050" height="600" rx="34" fill="#FFFFFF"/><rect x="30" y="30" width="990" height="540" rx="28" fill="none" stroke="#E4E4E7" stroke-width="2"/><image href="${logoData}" x="345" y="78" width="360" height="180" preserveAspectRatio="xMidYMid meet"/><line x1="160" y1="322" x2="890" y2="322" stroke="#E4E4E7" stroke-width="2"/><text x="160" y="388" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#111113">Your Name</text><text x="160" y="434" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" fill="#71717A">Title / Role</text><text x="160" y="492" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#52525B">email@example.com  ·  (555) 123-4567  ·  website.com</text></svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 0 }).toBuffer();
}

async function makeEmailSignature(logo: Buffer): Promise<Buffer> {
  const logoPng = await sharp(logo).resize(120, 84, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const logoData = `data:image/png;base64,${logoPng.toString('base64')}`;
  const svg = `<svg width="600" height="160" viewBox="0 0 600 160" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="160" rx="18" fill="#FFFFFF"/><image href="${logoData}" x="26" y="38" width="120" height="84" preserveAspectRatio="xMidYMid meet"/><line x1="172" y1="28" x2="172" y2="132" stroke="#E4E4E7" stroke-width="2"/><text x="200" y="62" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#111113">Your Name</text><text x="200" y="91" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600" fill="#71717A">Title / Company</text><text x="200" y="121" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#52525B">email@example.com  ·  website.com  ·  (555) 123-4567</text></svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 0 }).toBuffer();
}

function makeReadme(files: KitFile[], colors: Rgb[]): string {
  const lines = [
    'Shay Brand Kit',
    '',
    'Files included:',
    ...files.map(file => `${file.name} — ${file.description}${file.dimensions ? ` (${file.dimensions})` : ''}`),
    '',
    `Brand colors: ${colors.map(rgbToHex).join(', ')}`,
    '',
    'Note: Brand kit download is included with the base logo run. Refinements are separate generations and cost 1 credit each.',
  ];
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { imageUrl: string; brandName?: string; conceptIndex?: number; taskId?: string; imageIndex?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { imageUrl, brandName = 'logo', conceptIndex = 1, taskId, imageIndex } = body;

  // F5 fix: require taskId + imageIndex, verify task ownership + worker_slug=shay
  if (!taskId || imageIndex === undefined || imageIndex === null) {
    return NextResponse.json({ error: 'taskId and imageIndex are required' }, { status: 400 });
  }

  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, workspace_id, worker_slug')
    .eq('id', taskId)
    .maybeSingle();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Verify ownership or workspace membership
  if (task.user_id !== userId) {
    if (task.workspace_id) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', task.workspace_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!membership) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
  }

  // Verify worker is Shay
  if (task.worker_slug !== 'logo-concept-generator') {
    return NextResponse.json({ error: 'Brand kit is only available for Shay (Logo Concept Generator) tasks' }, { status: 400 });
  }

  // F5 fix: per-user rate limit (5/hour)
  const now = Date.now();
  const userTimestamps = (BRAND_KIT_RATE.get(userId) || []).filter(t => now - t < BRAND_KIT_RATE_WINDOW_MS);
  if (userTimestamps.length >= BRAND_KIT_RATE_LIMIT) {
    return NextResponse.json({ error: 'Rate limit exceeded. Maximum 5 brand kits per hour.' }, { status: 429 });
  }

  // F5 fix: check cache before burning external API credits
  const cacheKey = `${taskId}:${imageIndex}`;
  const cached = BRAND_KIT_CACHE.get(cacheKey);
  if (cached && (now - cached.cachedAt) < BRAND_KIT_CACHE_TTL_MS) {
    console.log('[BrandKit] cache hit for', cacheKey);
    return NextResponse.json({
      downloadUrl: cached.downloadUrl,
      fileName: cached.fileName,
      hasVectorFiles: cached.hasVectorFiles,
      vectorizationFailed: cached.vectorizationFailed,
      fromCache: true,
    });
  }

  // Record rate limit hit (only after cache miss)
  BRAND_KIT_RATE.set(userId, [...userTimestamps, now]);

  if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });

  // C11 fix: SSRF protection — validate URL before any fetch
  // Step 1: standard IP/scheme checks (no private IPs, HTTPS only)
  try {
    assertSafeUrl(imageUrl);
  } catch (e) {
    const msg = e instanceof SsrfError ? e.message : 'Invalid image URL';
    return NextResponse.json({ error: `Invalid imageUrl: ${msg}` }, { status: 400 });
  }
  // Step 2: allowlist — only fal.ai CDN and Supabase storage origins accepted
  if (!isAllowedShayImageUrl(imageUrl)) {
    return NextResponse.json(
      { error: 'imageUrl must be from an allowed origin (fal.ai or 3rdShift storage).' },
      { status: 400 }
    );
  }

  const removeBgKey = process.env.REMOVE_BG_API_KEY;

  // ── Step 1: Download original image ──────────────────────────────────────
  // Item 8 / C11 fix: block redirects, validate Content-Type, cap size at 10MB
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  console.log('[BrandKit] fetching image:', imageUrl.slice(0, 80));
  const origRes = await fetch(imageUrl, { redirect: 'error' }); // block redirects
  if (!origRes.ok) {
    console.error('[BrandKit] image fetch failed:', origRes.status);
    return NextResponse.json({
      error: 'Logo image expired or unavailable. Please re-run Shay to get fresh images.',
    }, { status: 400 });
  }
  // Validate Content-Type before buffering
  const fetchedContentType = origRes.headers.get('content-type') || '';
  if (!fetchedContentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Invalid image type. Expected an image file.' }, { status: 400 });
  }
  // Check Content-Length before buffering
  const contentLength = parseInt(origRes.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image file too large (max 10MB).' }, { status: 400 });
  }
  const origBuffer = Buffer.from(await origRes.arrayBuffer());
  if (origBuffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image file too large (max 10MB).' }, { status: 400 });
  }
  console.log('[BrandKit] image fetched, bytes:', origBuffer.length);

  // ── Step 2: Remove background via remove.bg, with local white-bg fallback ─
  let transparentBuffer: Buffer;
  if (removeBgKey) {
    const key = removeBgKey;
    try {
      console.log('[BrandKit] calling remove.bg...');
      const rbForm = new FormData();
      rbForm.append('image_file', new Blob([origBuffer], { type: 'image/png' }), 'logo.png');
      rbForm.append('size', 'auto');

      const rbRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': key },
        body: rbForm,
      });

      if (!rbRes.ok) {
        const err = await rbRes.text();
        throw new Error(`remove.bg failed (${rbRes.status}): ${err.slice(0, 200)}`);
      }

      transparentBuffer = Buffer.from(await rbRes.arrayBuffer());
      console.log('[BrandKit] remove.bg success, transparent bytes:', transparentBuffer.length);
    } catch (err) {
      console.warn('[BrandKit] remove.bg unavailable; using local white-background fallback:', err instanceof Error ? err.message : String(err));
      transparentBuffer = await removeWhiteBackgroundFallback(origBuffer);
    }
  } else {
    console.warn('[BrandKit] remove.bg API key not configured; using local white-background fallback');
    transparentBuffer = await removeWhiteBackgroundFallback(origBuffer);
  }

  // ── Step 3: Generate all variants ────────────────────────────────────────
  const meta = await sharp(transparentBuffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;

  // Pure white silhouette — for dark backgrounds
  const makeWhiteSilhouette = async (srcBuffer: Buffer): Promise<Buffer> => {
    const { data, info } = await sharp(srcBuffer).raw().toBuffer({ resolveWithObject: true });
    const buf = Buffer.from(data);
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3] > 0) { buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; }
    }
    return sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
  };

  // safeComposite: resize src to fit within fillRatio of canvas, then composite.
  // Always safe — final clamp ensures resized can never exceed canvas dimensions.
  const safeComposite = async (
    src: Buffer,
    bgColor: { r: number; g: number; b: number },
    canvasW: number,
    canvasH: number,
    fillRatio = 0.75
  ): Promise<Buffer> => {
    const maxW = Math.max(1, Math.round(canvasW * fillRatio));
    const maxH = Math.max(1, Math.round(canvasH * fillRatio));
    // Hard clamp: also cap at (canvas - 2) so composite never overflows
    const clampW = Math.min(maxW, canvasW - 2);
    const clampH = Math.min(maxH, canvasH - 2);
    const resized = await sharp(src)
      .resize(clampW, clampH, { fit: 'inside', withoutEnlargement: false })
      .toBuffer();
    return sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { ...bgColor, alpha: 255 } },
    })
      .composite([{ input: resized, gravity: 'center' }])
      .png({ compressionLevel: 0 })
      .toBuffer();
  };

  // Center logo on a solid background — wrapper around safeComposite
  const centerOn = async (
    bgColor: { r: number; g: number; b: number },
    canvasW: number,
    canvasH: number,
    srcBuffer?: Buffer,
    fillRatio = 0.75
  ): Promise<Buffer> => safeComposite(srcBuffer ?? transparentBuffer, bgColor, canvasW, canvasH, fillRatio);

  // Banner: logo fits within 45% of banner width AND 70% of banner height, centered
  const makeBanner = async (
    bannerW: number,
    bannerH: number,
    srcBuffer?: Buffer
  ): Promise<Buffer> => {
    const src = srcBuffer ?? transparentBuffer;
    const maxW = Math.min(Math.round(bannerW * 0.45), bannerW - 2);
    const maxH = Math.min(Math.round(bannerH * 0.70), bannerH - 2);
    const resized = await sharp(src).resize(maxW, maxH, { fit: 'inside', withoutEnlargement: false }).toBuffer();
    return sharp({
      create: { width: bannerW, height: bannerH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
    })
      .composite([{ input: resized, gravity: 'center' }])
      .png({ compressionLevel: 0 })
      .toBuffer();
  };

  // Upscale source to 3072x3072 (3x) using Lanczos for premium quality output
  // Nanobanana Pro is locked at 1024x1024 — upscaling gives clean large files
  const UPSCALE = 3;
  const upscaledBuffer = await sharp(origBuffer)
    .resize(1024 * UPSCALE, 1024 * UPSCALE, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 0 })
    .toBuffer();
  const upscaledTransparentBuffer = await sharp(transparentBuffer)
    .resize(w * UPSCALE, h * UPSCALE, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 0 })
    .toBuffer();
  const ow = 1024 * UPSCALE;
  const oh = 1024 * UPSCALE;

  console.log('[BrandKit] upscaled to:', ow, 'x', oh);
  const whiteSilhouette = await makeWhiteSilhouette(upscaledTransparentBuffer);

  // centerOnOrig: uses upscaled full-res image — wrapper around safeComposite
  const centerOnOrig = async (
    bgColor: { r: number; g: number; b: number },
    canvasW: number,
    canvasH: number,
    srcBuffer?: Buffer,
    fillRatio = 0.75
  ): Promise<Buffer> => safeComposite(srcBuffer ?? upscaledBuffer, bgColor, canvasW, canvasH, fillRatio);

  // makeBannerOrig: logo fits within 45% of banner width AND 70% of banner height
  const makeBannerOrig = async (bannerW: number, bannerH: number, srcBuffer?: Buffer): Promise<Buffer> => {
    const src = srcBuffer ?? upscaledBuffer;
    const maxW = Math.min(Math.round(bannerW * 0.45), bannerW - 2);
    const maxH = Math.min(Math.round(bannerH * 0.70), bannerH - 2);
    const resized = await sharp(src).resize(maxW, maxH, { fit: 'inside', withoutEnlargement: false }).toBuffer();
    return sharp({
      create: { width: bannerW, height: bannerH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
    })
      .composite([{ input: resized, gravity: 'center' }])
      .png({ compressionLevel: 0 })
      .toBuffer();
  };

  const [
    originalOnWhite,
    bwBuffer,
    onDarkWhite,
    onDarkColor,
    favicon32,
    favicon16,
    favicon48,
    instagram320,
    facebook170,
    linkedin400,
    twitter400,
    twitterHeader,
    fbCover,
    liBanner,
  ] = await Promise.all([
    // Original on white — use origBuffer directly (full 2048 res, not remove.bg downscaled)
    sharp(upscaledBuffer).png({ compressionLevel: 0 }).toBuffer(),
    // B&W — use origBuffer, flatten then grayscale
    sharp(upscaledBuffer).grayscale().png({ compressionLevel: 0 }).toBuffer(),
    // White silhouette on dark — use actual whiteSilhouette dimensions as canvas
    (async () => {
      const wsMeta = await sharp(whiteSilhouette).metadata();
      return safeComposite(whiteSilhouette, { r: 26, g: 26, b: 26 }, wsMeta.width!, wsMeta.height!);
    })(),
    // Original colors on dark — use origBuffer directly
    centerOnOrig({ r: 26, g: 26, b: 26 }, ow, oh),
    // Favicons — small by design, use transparent for clean edges
    sharp(upscaledTransparentBuffer).resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 0 }).toBuffer(),
    sharp(upscaledTransparentBuffer).resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 0 }).toBuffer(),
    sharp(upscaledTransparentBuffer).resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 0 }).toBuffer(),
    // Social profile squares — 45% fill so logo isn't too large
    centerOnOrig({ r: 255, g: 255, b: 255 }, 320, 320, undefined, 0.45),
    centerOnOrig({ r: 255, g: 255, b: 255 }, 170, 170, undefined, 0.45),
    centerOnOrig({ r: 255, g: 255, b: 255 }, 400, 400, undefined, 0.45),
    centerOnOrig({ r: 255, g: 255, b: 255 }, 400, 400, undefined, 0.45),
    // Twitter header banner (1500×500) — logo 45% of width
    makeBannerOrig(1500, 500),
    // Facebook cover banner (1640×624) — logo 45% of width
    makeBannerOrig(1640, 624),
    // LinkedIn banner (1584×396) — logo 45% of width
    makeBannerOrig(1584, 396),
  ]);
  const faviconIco = makeIcoFromPngs([
    { size: 16, buffer: favicon16 },
    { size: 32, buffer: favicon32 },
    { size: 48, buffer: favicon48 },
  ]);
  const brandColors = await extractBrandColors(upscaledTransparentBuffer);
  const brandColorsSheet = await makeBrandColorsSheet(brandColors);
  const businessCard = await makeBusinessCard(upscaledTransparentBuffer);
  const emailSignature = await makeEmailSignature(upscaledTransparentBuffer);

  console.log('[BrandKit] variants done');

  // ── Step 4: Vectorize via fal.ai image2svg (SVG) + PDF from PNG ────────────
  // fal-ai/image2svg: $0.005/image, uses existing FAL_API_KEY.
  // PDF: generated from the high-res PNG via jspdf (reliable in Node, no SVG embedding needed).
  // EPS: dropped — too fragile to generate correctly server-side.
  // Failure is non-fatal — brand kit still delivers PNG-only if vectorization fails.
  let svgBuffer: Buffer | null = null;
  let pdfBuffer: Buffer | null = null;
  let vectorizationFailed = false;

  const falKey = process.env.FAL_API_KEY;
  if (falKey) {
    try {
      console.log('[BrandKit] calling fal.ai image2svg...');
      // fal-ai/image2svg accepts an image_url and returns images[0].url (SVG hosted on fal CDN)
      const vecRes = await fetch('https://fal.run/fal-ai/image2svg', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: imageUrl }),
      });

      if (vecRes.ok) {
        const vecJson = await vecRes.json();
        const svgUrl = vecJson?.images?.[0]?.url;
        if (!svgUrl) throw new Error('fal image2svg: no SVG URL in response');
        // F5 fix: SSRF + redirect block + content-type + 10MB cap on SVG fetch
        try { assertSafeUrl(svgUrl); } catch (e) {
          throw new Error(`fal image2svg: SVG URL failed SSRF check: ${e instanceof SsrfError ? e.message : String(e)}`);
        }
        const svgFetch = await fetch(svgUrl, { redirect: 'error' });
        if (!svgFetch.ok) throw new Error(`fal image2svg: SVG fetch failed (${svgFetch.status})`);
        const svgContentType = svgFetch.headers.get('content-type') || '';
        const svgBytes = Buffer.from(await svgFetch.arrayBuffer());
        const svgHead = svgBytes.slice(0, 512).toString('utf8').trimStart();
        const looksLikeSvg = /<svg[\s>]/i.test(svgHead) || /^<\?xml[\s\S]*<svg[\s>]/i.test(svgHead);
        if (!svgContentType.includes('svg') && !svgContentType.includes('xml') && !svgContentType.includes('image/') && !looksLikeSvg) {
          throw new Error(`fal image2svg: unexpected SVG Content-Type: ${svgContentType}`);
        }
        if (svgBytes.length > MAX_IMAGE_BYTES) throw new Error('fal image2svg: SVG file too large (>10MB)');
        svgBuffer = svgBytes;
        console.log('[BrandKit] fal image2svg success, SVG bytes:', svgBuffer.length);

        // ── PDF: embed the high-res PNG into a single-page A4 PDF via jspdf ─────────
        // We use addImage (PNG) rather than addSvgAsImage — addImage is reliable in
        // jspdf's Node build; addSvgAsImage is browser-only and produces blank pages.
        try {
          // jspdf Node build exports { jsPDF } (named), not a default export
          const jspdfMod = await import('jspdf');
          const JsPDFClass = (jspdfMod as { jsPDF?: unknown }).jsPDF ?? (jspdfMod as { default?: unknown }).default;
          if (!JsPDFClass) throw new Error('jspdf: cannot resolve constructor');
          type JsPDFDoc = {
            addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void;
            output: (type: string) => unknown;
          };
          const doc = new (JsPDFClass as new (o: string, u: string, f: string) => JsPDFDoc)('p', 'mm', 'a4');
          // A4: 210×297mm. Logo centered at 170×170mm.
          const pageW = 210, pageH = 297, logoSize = 170;
          const x = (pageW - logoSize) / 2;
          const y = (pageH - logoSize) / 2;
          // Embed high-res PNG — addImage is reliable in Node; addSvgAsImage is browser-only
          const pngB64 = upscaledBuffer.toString('base64');
          doc.addImage(`data:image/png;base64,${pngB64}`, 'PNG', x, y, logoSize, logoSize);
          pdfBuffer = Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
          console.log('[BrandKit] PDF generated, bytes:', pdfBuffer.length);
        } catch (pdfErr) {
          console.warn('[BrandKit] jspdf PDF generation failed (non-fatal):', pdfErr);
        }
      } else {
        const errText = await vecRes.text();
        console.warn('[BrandKit] fal image2svg failed:', vecRes.status, errText.slice(0, 200));
        vectorizationFailed = true;
      }
    } catch (vecErr) {
      console.warn('[BrandKit] fal image2svg error (non-fatal):', vecErr);
      vectorizationFailed = true;
    }
  } else {
    console.log('[BrandKit] FAL_API_KEY not configured — skipping vector files');
  }

  // ── Step 5: Zip everything ────────────────────────────────────────────────
  console.log('[BrandKit] building zip...');
  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 1 } }); // low zip compression — PNGs don't compress further
    const chunks: Buffer[] = [];
    const pass = new PassThrough();
    pass.on('data', (chunk) => chunks.push(chunk));
    pass.on('end', () => resolve(Buffer.concat(chunks)));
    pass.on('error', reject);
    archive.on('error', reject);
    archive.pipe(pass);

    const kitFiles: KitFile[] = [
      { name: 'logo-original.png', buffer: originalOnWhite, description: 'full color logo on white, use for documents and print', dimensions: `${ow}x${oh}` },
      { name: 'logo-transparent.png', buffer: upscaledTransparentBuffer, description: 'transparent background logo, use anywhere a clean cutout is needed', dimensions: `${w * UPSCALE}x${h * UPSCALE}` },
      { name: 'logo-black-white.png', buffer: bwBuffer, description: 'black-and-white/grayscale version for one-color contexts', dimensions: `${ow}x${oh}` },
      { name: 'logo-on-dark-white.png', buffer: onDarkWhite, description: 'white logo version for dark backgrounds', dimensions: `${w * UPSCALE}x${h * UPSCALE}` },
      { name: 'logo-on-dark-color.png', buffer: onDarkColor, description: 'full-color logo previewed on a dark background', dimensions: `${ow}x${oh}` },
      { name: 'favicon-16.png', buffer: favicon16, description: '16x16 PNG favicon', dimensions: '16x16' },
      { name: 'favicon-32.png', buffer: favicon32, description: '32x32 PNG favicon', dimensions: '32x32' },
      { name: 'favicon-48.png', buffer: favicon48, description: '48x48 PNG favicon', dimensions: '48x48' },
      { name: 'favicon.ico', buffer: faviconIco, description: 'multi-resolution browser favicon with 16/32/48 sizes bundled', dimensions: '16x16, 32x32, 48x48' },
      { name: 'brand-colors.png', buffer: brandColorsSheet, description: `dominant brand color swatch sheet with HEX labels: ${brandColors.map(rgbToHex).join(', ')}` },
      { name: 'business-card.png', buffer: businessCard, description: 'front business card mockup, standard 3.5x2 inch at 300dpi with placeholder contact zones', dimensions: '1050x600' },
      { name: 'email-signature.png', buffer: emailSignature, description: '600px-wide email signature strip with logo and placeholder contact text', dimensions: '600x160' },
      { name: 'social-instagram-320.png', buffer: instagram320, description: 'Instagram profile square', dimensions: '320x320' },
      { name: 'social-facebook-170.png', buffer: facebook170, description: 'Facebook profile square', dimensions: '170x170' },
      { name: 'social-linkedin-400.png', buffer: linkedin400, description: 'LinkedIn profile square', dimensions: '400x400' },
      { name: 'social-twitter-400.png', buffer: twitter400, description: 'X/Twitter profile square', dimensions: '400x400' },
      { name: 'social-twitter-header.png', buffer: twitterHeader, description: 'X/Twitter header banner', dimensions: '1500x500' },
      { name: 'social-facebook-cover.png', buffer: fbCover, description: 'Facebook cover banner', dimensions: '1640x624' },
      { name: 'social-linkedin-banner.png', buffer: liBanner, description: 'LinkedIn banner image', dimensions: '1584x396' },
    ];

    if (svgBuffer) kitFiles.push({ name: 'logo.svg', buffer: svgBuffer, description: 'vector SVG logo for scalable web/design use' });
    if (pdfBuffer) kitFiles.push({ name: 'logo.pdf', buffer: pdfBuffer, description: 'print-friendly PDF logo sheet' });
    kitFiles.push({ name: 'README.txt', buffer: Buffer.from(makeReadme(kitFiles, brandColors), 'utf8'), description: 'plain text manifest and brand color list' });

    for (const file of kitFiles) archive.append(file.buffer, { name: file.name });

    archive.finalize();
  });
  console.log('[BrandKit] zip ready, bytes:', zipBuffer.length);

  // ── Step 6: Upload zip to Supabase (brand-kits bucket) ────────────────────
  const safeName = brandName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const zipPath = `${safeName}-concept-${conceptIndex}-${Date.now()}.zip`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('brand-kits')
    .upload(zipPath, zipBuffer, { contentType: 'application/zip', upsert: true });

  if (uploadError) {
    console.error('[BrandKit] upload error:', JSON.stringify(uploadError));
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: signed } = await supabaseAdmin.storage
    .from('brand-kits')
    .createSignedUrl(zipPath, 172800);

  if (!signed?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }

  console.log('[BrandKit] done');

  // F5 fix: cache result to prevent re-burning external API on retry
  const result = {
    downloadUrl: signed.signedUrl,
    fileName: `${safeName}-brand-kit.zip`,
    hasVectorFiles: !!svgBuffer,
    vectorizationFailed,
  };
  BRAND_KIT_CACHE.set(cacheKey, { ...result, cachedAt: Date.now() });

  return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[BrandKit] unhandled error:', msg);
    return NextResponse.json({ error: `Brand kit failed: ${msg}` }, { status: 500 });
  }
}
