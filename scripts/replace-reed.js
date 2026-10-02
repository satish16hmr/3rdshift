const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/api/execute-task/route.ts');
const content = fs.readFileSync(filePath, 'utf8');

const REED_NEW = `    // Reed (thumbnail designer) — Flux Kontext Pro pipeline
    if (task.worker_slug === 'thumbnail-designer') {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
        await supabase.from('tasks').update({ status: 'failed', error: 'fal.ai API key not configured' }).eq('id', taskId);
        return NextResponse.json({ error: 'fal.ai API key not configured' }, { status: 500 });
      }

      await supabase.from('tasks').update({ status: 'processing' }).eq('id', taskId);

      const reedInput = task.input as Record<string, string>;
      const description = reedInput.description || reedInput.video_topic || '';
      const headlineText = (reedInput.headline_text || reedInput.text_on_thumbnail || '').toUpperCase().trim();
      // Style: strip option label suffix e.g. 'cinematic — Dramatic...' -> 'cinematic'
      const rawStyle = (reedInput.style || 'cinematic').toLowerCase();
      const style = rawStyle.split(/\\s*[—\\-]/)[0].trim();

      // ── Step 1: Detect uploaded reference images ──────────────────────────
      const faceContent = uploadedFileContent.find(c => c.toLowerCase().includes('face_photo') || c.includes('[STORAGE_PATH:'));
      const sketchContent = uploadedFileContent.find(c => c.toLowerCase().includes('sketch'));
      const faceStoragePath = faceContent?.match(/\\[STORAGE_PATH:\\s*([^\\]]+)\\]/)?.[1]?.trim() || null;
      const sketchStoragePath = sketchContent?.match(/\\[STORAGE_PATH:\\s*([^\\]]+)\\]/)?.[1]?.trim() || null;
      const hasFace = !!faceStoragePath;
      const hasSketch = !!sketchStoragePath;
      const hasBoth = hasFace && hasSketch;
      console.log('[Reed] hasFace:', hasFace, '| hasSketch:', hasSketch, '| style:', style, '| desc:', description.slice(0, 60));

      // ── Step 2: Build reference image URL for Kontext ─────────────────────
      let referenceImageUrl: string | null = null;
      const sharp = (await import('sharp')).default;

      if (hasBoth && faceStoragePath && sketchStoragePath) {
        try {
          const [faceSigned, sketchSigned] = await Promise.all([
            supabase.storage.from('uploads').createSignedUrl(faceStoragePath, 300),
            supabase.storage.from('uploads').createSignedUrl(sketchStoragePath, 300),
          ]);
          const [faceRes, sketchRes] = await Promise.all([
            fetch(faceSigned.data!.signedUrl),
            fetch(sketchSigned.data!.signedUrl),
          ]);
          const [faceBuf, sketchBuf] = await Promise.all([
            faceRes.arrayBuffer().then(b => Buffer.from(b)),
            sketchRes.arrayBuffer().then(b => Buffer.from(b)),
          ]);
          const [faceHalf, sketchHalf] = await Promise.all([
            sharp(faceBuf).resize(640, 720, { fit: 'cover', position: 'top' }).png().toBuffer(),
            sharp(sketchBuf).resize(640, 720, { fit: 'cover' }).png().toBuffer(),
          ]);
          const combined = await sharp({ create: { width: 1280, height: 720, channels: 3, background: { r: 0, g: 0, b: 0 } } })
            .composite([{ input: sketchHalf, left: 0, top: 0 }, { input: faceHalf, left: 640, top: 0 }])
            .jpeg({ quality: 90 }).toBuffer();
          const combinedName = \`reed-ref-\${taskId}.jpg\`;
          await supabase.storage.from('uploads').upload(combinedName, combined, { contentType: 'image/jpeg', upsert: true });
          const { data: pubData } = supabase.storage.from('uploads').getPublicUrl(combinedName);
          referenceImageUrl = pubData?.publicUrl || null;
          console.log('[Reed] combined reference:', referenceImageUrl?.slice(0, 80));
        } catch (err) {
          console.error('[Reed] combine failed:', err);
        }
      } else if (hasFace && faceStoragePath) {
        const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(faceStoragePath, 3600);
        referenceImageUrl = signed?.signedUrl || null;
      } else if (hasSketch && sketchStoragePath) {
        const { data: signed } = await supabase.storage.from('uploads').createSignedUrl(sketchStoragePath, 3600);
        referenceImageUrl = signed?.signedUrl || null;
      }
      console.log('[Reed] referenceImageUrl:', referenceImageUrl ? 'yes' : 'none');

      // ── Step 3: Build 4 variant prompts ───────────────────────────────────
      const prompts = [0, 1, 2, 3].map(i =>
        buildKontextPrompt(description, style, hasFace, hasSketch, hasBoth, i)
      );

      // ── Step 4: Call Flux Kontext Pro × 4 in parallel ─────────────────────
      const { fal } = await import('@fal-ai/client');
      fal.config({ credentials: falKey });

      type KontextInput = { prompt: string; guidance_scale: number; num_inference_steps: number; num_images: number; image_url?: string };
      type KontextOutput = { images: Array<{ url: string }> };

      const kontextResults = await Promise.allSettled(
        prompts.map(async (prompt) => {
          const input: KontextInput = { prompt, guidance_scale: 3.5, num_inference_steps: 28, num_images: 1 };
          if (referenceImageUrl) input.image_url = referenceImageUrl;
          const result = await (fal.subscribe as (model: string, opts: { input: KontextInput }) => Promise<{ data: KontextOutput }>)(
            'fal-ai/flux-pro/kontext',
            { input }
          );
          const url = result.data?.images?.[0]?.url;
          if (!url) throw new Error('No image URL from Kontext');
          return url;
        })
      );

      const kontextUrls = kontextResults
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value);
      kontextResults
        .filter(r => r.status === 'rejected')
        .forEach((r, i) => console.error(\`[Reed] Kontext[\${i}] failed:\`, (r as PromiseRejectedResult).reason?.message));

      if (kontextUrls.length === 0) {
        await supabase.from('tasks').update({ status: 'failed', error: 'All Kontext generations failed' }).eq('id', taskId);
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
      }
      console.log('[Reed] Kontext generated:', kontextUrls.length, 'images');

      // ── Step 5: Text overlay with Sharp ───────────────────────────────────
      const osModule = await import('os');
      const pathModule = await import('path');
      const fsSyncModule = await import('fs');
      const fontDir = pathModule.join(osModule.tmpdir(), '3rdshift-fonts');
      fsSyncModule.mkdirSync(fontDir, { recursive: true });
      fsSyncModule.mkdirSync(pathModule.join(osModule.tmpdir(), 'fontconfig-cache'), { recursive: true });
      const fontTmpPath = pathModule.join(fontDir, 'Oswald-Bold.ttf');
      if (!fsSyncModule.existsSync(fontTmpPath)) {
        fsSyncModule.writeFileSync(fontTmpPath, Buffer.from(OSWALD_BOLD_B64, 'base64'));
      }
      const fontConfContent = \`<?xml version='1.0'?><!DOCTYPE fontconfig SYSTEM 'fonts.dtd'><fontconfig><dir>\${fontDir}</dir><cachedir>\${pathModule.join(osModule.tmpdir(), 'fontconfig-cache')}</cachedir></fontconfig>\`;
      const fontConfPath = pathModule.join(osModule.tmpdir(), '3rdshift-fonts.conf');
      fsSyncModule.writeFileSync(fontConfPath, fontConfContent);
      process.env.FONTCONFIG_FILE = fontConfPath;
      process.env.FC_CONFIG_FILE = fontConfPath;

      const escPango = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const strokeSize = 6;
      const pangoSize = 280000;
      const textTargetW = 1100;

      const words = headlineText.split(/\\s+/).filter(Boolean).slice(0, 8);
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(' ');
      const line2Words = words.slice(mid);
      const line2Main = line2Words.length > 1 ? line2Words.slice(0, -1).join(' ') : '';
      const line2Accent = line2Words.length > 0 ? line2Words[line2Words.length - 1] : '';
      const accentColor = '#FF3300';

      const makeTextLayer = async (text: string, fgColor: string): Promise<Buffer | null> => {
        if (!text) return null;
        const ropts = { fontfile: fontTmpPath, font: 'Oswald', rgba: true as const, align: 'centre' as const };
        const mainRaw = await sharp({ text: { text: \`<span foreground="\${fgColor}" size="\${pangoSize}" weight="bold">\${escPango(text)}</span>\`, ...ropts } }).png().toBuffer();
        const mainMeta = await sharp(mainRaw).metadata();
        const rawW = mainMeta.width || textTargetW;
        const finalW = Math.min(rawW, textTargetW);
        const mainBuf = rawW > textTargetW ? await sharp(mainRaw).resize({ width: finalW }).png().toBuffer() : mainRaw;
        const strokeRaw = await sharp({ text: { text: \`<span foreground="#000000" size="\${pangoSize}" weight="bold">\${escPango(text)}</span>\`, ...ropts } }).png().toBuffer();
        const strokeBuf = rawW > textTargetW ? await sharp(strokeRaw).resize({ width: finalW }).png().toBuffer() : strokeRaw;
        const meta = await sharp(mainBuf).metadata();
        const tw = meta.width || finalW; const th = meta.height || 80;
        const pad = strokeSize * 2;
        const offsets: [number, number][] = [[-strokeSize,0],[strokeSize,0],[0,-strokeSize],[0,strokeSize],[-strokeSize,-strokeSize],[strokeSize,-strokeSize],[-strokeSize,strokeSize],[strokeSize,strokeSize]];
        const ol: import('sharp').OverlayOptions[] = offsets.map(([dx, dy]) => ({ input: strokeBuf, left: pad+dx, top: pad+dy, blend: 'over' as const }));
        ol.push({ input: strokeBuf, left: pad+4, top: pad+4, blend: 'over' as const });
        ol.push({ input: mainBuf, left: pad, top: pad, blend: 'over' as const });
        return sharp({ create: { width: tw+strokeSize*4, height: th+strokeSize*4, channels: 4, background: {r:0,g:0,b:0,alpha:0} } }).png().composite(ol).toBuffer();
      };

      const [l1Buf, l2MainBuf, l2AccentBuf] = await Promise.all([
        makeTextLayer(line1, '#FFFFFF'),
        line2Main ? makeTextLayer(line2Main, '#FFFFFF') : Promise.resolve(null),
        line2Accent ? makeTextLayer(line2Accent, accentColor) : Promise.resolve(null),
      ]);

      const l1Meta = l1Buf ? await sharp(l1Buf).metadata() : null;
      const l2MainMeta = l2MainBuf ? await sharp(l2MainBuf).metadata() : null;
      const l2AccentMeta = l2AccentBuf ? await sharp(l2AccentBuf).metadata() : null;
      const lineH = l1Meta?.height || 100;
      const gap = Math.floor(lineH * 0.1);

      // Gradient bar at bottom for text readability
      const textBarSvg = \`<svg width="1280" height="280" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="black" stop-opacity="0.0"/><stop offset="35%" stop-color="black" stop-opacity="0.6"/><stop offset="100%" stop-color="black" stop-opacity="0.85"/></linearGradient></defs><rect width="1280" height="280" fill="url(#g)"/></svg>\`;
      const textBarBuf = await sharp(Buffer.from(textBarSvg)).png().toBuffer();

      const vigSvg = \`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="vg" cx="50%" cy="50%" r="70%"><stop offset="50%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.5"/></radialGradient></defs><rect width="1280" height="720" fill="url(#vg)"/></svg>\`;
      const vigBuf = await sharp(Buffer.from(vigSvg)).png().toBuffer();

      // Text in bottom area — if face expected, push slightly higher so face shows
      const textBarTop = 440;
      const l2H = l2MainMeta?.height || l2AccentMeta?.height || lineH;
      const totalTextH = lineH + (line2Words.length > 0 ? gap + l2H : 0);
      const textBottom = 720 - 20;
      const l1Top = Math.max(textBarTop + 20, textBottom - totalTextH);
      const l2Top = l1Top + lineH + gap;

      // ── Step 6: Compose + upload each image ───────────────────────────────
      const reedImages: Array<{ url: string; index: number }> = [];

      for (let i = 0; i < kontextUrls.length; i++) {
        try {
          const imgRes = await fetch(kontextUrls[i]);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          const overlays: import('sharp').OverlayOptions[] = [
            { input: textBarBuf, left: 0, top: textBarTop, blend: 'over' as const },
          ];
          if (l1Buf && l1Meta?.width) {
            const l1Left = Math.max(0, Math.floor((1280 - l1Meta.width) / 2));
            overlays.push({ input: l1Buf, left: l1Left, top: l1Top, blend: 'over' as const });
          }
          if (l2MainBuf && l2MainMeta?.width && l2AccentBuf && l2AccentMeta?.width) {
            const totalW = l2MainMeta.width + 8 + l2AccentMeta.width;
            const l2Left = Math.max(0, Math.floor((1280 - totalW) / 2));
            overlays.push({ input: l2MainBuf, left: l2Left, top: l2Top, blend: 'over' as const });
            overlays.push({ input: l2AccentBuf, left: l2Left + l2MainMeta.width + 8, top: l2Top, blend: 'over' as const });
          } else if (l2AccentBuf && l2AccentMeta?.width) {
            const l2Left = Math.max(0, Math.floor((1280 - l2AccentMeta.width) / 2));
            overlays.push({ input: l2AccentBuf, left: l2Left, top: l2Top, blend: 'over' as const });
          }

          const finalBuf = await sharp(imgBuf)
            .resize(1280, 720, { fit: 'cover' })
            .composite(overlays)
            .composite([{ input: vigBuf, blend: 'over' as const }])
            .modulate({ saturation: 1.08 })
            .sharpen({ sigma: 0.6 })
            .png()
            .toBuffer();

          const fileName = \`reed-\${taskId}-\${i + 1}.png\`;
          await supabase.storage.from('generated-images').upload(fileName, finalBuf, { contentType: 'image/png', upsert: true });
          const { data: signedImg } = await supabase.storage.from('generated-images').createSignedUrl(fileName, 172800);
          reedImages.push({ url: signedImg?.signedUrl || kontextUrls[i], index: i + 1 });
        } catch (overlayErr) {
          console.error(\`[Reed] overlay error img \${i+1}:\`, overlayErr);
          reedImages.push({ url: kontextUrls[i], index: i + 1 });
        }
      }

      await supabase.from('tasks').update({
        status: 'completed',
        output: {
          images: reedImages,
          format: 'images',
          isThumbnail: true,
          size: '1280×720',
          headline_text: headlineText,
          expiresAt: new Date(Date.now() + 172800 * 1000).toISOString(),
        },
        output_format: 'images',
        model_used: 'flux-pro/kontext + sharp.js',
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      return NextResponse.json({ success: true, taskId });
    }

`;

const startMarker = '    // Reed (thumbnail designer) — Template-based composition system';
const endMarker = '    // Image generation workers — route to DALL-E 3 pipeline';
const start = content.indexOf(startMarker);
const end = content.indexOf(endMarker);
if (start === -1 || end === -1) {
  console.error('Could not find markers. start:', start, 'end:', end);
  process.exit(1);
}
const newContent = content.slice(0, start) + REED_NEW + content.slice(end);
fs.writeFileSync(filePath, newContent);
console.log('Done. Replaced', end - start, 'chars with', REED_NEW.length, 'chars');
