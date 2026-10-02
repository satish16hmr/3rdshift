#!/usr/bin/env node
/**
 * Seedance 2.0 swap test — all 6 cases from the brief
 * Tests Atlas Cloud directly (bypasses app auth) to validate model endpoints
 */

const fs = require('fs');
const path = require('path');

const ATLAS_BASE = 'https://api.atlascloud.ai/api/v1';
const ATLAS_KEY = 'REMOVED_SECRET_PLACEHOLDER';
const ASSETS = path.join(__dirname, '../test-assets');

const headers = (extra = {}) => ({
  Authorization: `Bearer ${ATLAS_KEY}`,
  ...extra,
});

// ── Upload media ──────────────────────────────────────────────────────────────
async function uploadMedia(filePath, mimeType) {
  const fileName = path.basename(filePath);
  const buf = fs.readFileSync(filePath);
  const { FormData, Blob } = await import('node-fetch').catch(() => {
    throw new Error('node-fetch not available — using native fetch');
  }).catch(() => ({ FormData: global.FormData, Blob: global.Blob }));

  // Use native fetch FormData (Node 18+)
  const formData = new global.FormData();
  const blob = new Blob([buf], { type: mimeType });
  formData.append('file', blob, fileName);

  const res = await fetch(`${ATLAS_BASE}/model/uploadMedia`, {
    method: 'POST',
    headers: headers(),
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${JSON.stringify(data)}`);
  const url = data?.url || data?.data?.url || data?.data?.download_url || data?.download_url;
  if (!url) throw new Error(`No URL in upload response: ${JSON.stringify(data)}`);
  return url;
}

// ── Generate video ────────────────────────────────────────────────────────────
async function generateVideo(params) {
  const res = await fetch(`${ATLAS_BASE}/model/generateVideo`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Generate failed (${res.status}): ${JSON.stringify(data)}`);
  const id = data?.data?.id || data?.id;
  if (!id) throw new Error(`No prediction ID: ${JSON.stringify(data)}`);
  return id;
}

// ── Poll until done ───────────────────────────────────────────────────────────
async function pollUntilDone(predId, label, timeoutMs = 300_000) {
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const res = await fetch(`${ATLAS_BASE}/model/prediction/${predId}`, {
      headers: headers(),
    });
    const data = await res.json();
    const status = data?.data?.status || data?.status;
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\r  [${label}] ${elapsed}s — status: ${status}        `);

    if (status === 'completed') {
      const outputs = data?.data?.outputs;
      const videoUrl = Array.isArray(outputs) ? outputs[0] : outputs;
      console.log(`\n  ✅ DONE in ${elapsed}s — ${videoUrl}`);
      return { elapsed: parseFloat(elapsed), videoUrl };
    }
    if (status === 'failed' || status === 'error') {
      const err = data?.data?.error || data?.error || 'unknown error';
      console.log(`\n  ❌ FAILED after ${elapsed}s — ${err}`);
      return { elapsed: parseFloat(elapsed), error: err };
    }
  }
  console.log(`\n  ⏰ TIMED OUT after ${timeoutMs / 1000}s`);
  return { elapsed: timeoutMs / 1000, error: 'timeout' };
}

// ── Run one test ──────────────────────────────────────────────────────────────
async function runTest(num, label, params) {
  console.log(`\n── TEST ${num}: ${label} ──────────────────────────────`);
  const t0 = Date.now();
  try {
    console.log(`  Model: ${params.model}`);
    const predId = await generateVideo(params);
    console.log(`  Prediction ID: ${predId}`);
    const result = await pollUntilDone(predId, label);
    return { num, label, model: params.model, ...result };
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ❌ ERROR: ${err.message}`);
    return { num, label, model: params.model, elapsed: parseFloat(elapsed), error: err.message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Seedance 2.0 Swap Test — April 15, 2026 ===\n');
  const results = [];

  // Test 1: B-Roll Generator (text-to-video, no image)
  results.push(await runTest(1, 'B-Roll Generator (text-to-video)', {
    model: 'bytedance/seedance-2.0/text-to-video',
    prompt: 'Professional business meeting in a modern office, people collaborating around a table, natural lighting, 4K cinematic',
    duration: 5,
    aspect_ratio: '16:9',
    generate_audio: false,
  }));

  // Test 2: Ad Creative Generator (text-to-video, no image)
  results.push(await runTest(2, 'Ad Creative Generator (text-to-video)', {
    model: 'bytedance/seedance-2.0/text-to-video',
    prompt: 'Premium product advertisement, elegant product on clean white surface, dramatic lighting, luxury feel, cinematic camera movement',
    duration: 10,
    aspect_ratio: '16:9',
    generate_audio: false,
  }));

  // Test 3: Product Video Creator (image-to-video, no face)
  console.log('\n── TEST 3: Product Video Creator (image-to-video, no face) ──────────────────────────────');
  let productImageUrl;
  try {
    console.log('  Uploading product image (no face)...');
    productImageUrl = await uploadMedia(`${ASSETS}/product-no-face.jpg`, 'image/jpeg');
    console.log(`  Uploaded: ${productImageUrl}`);
    results.push(await runTest(3, 'Product Video Creator (no face)', {
      model: 'bytedance/seedance-2.0/image-to-video',
      prompt: 'Premium sneaker product showcase, smooth 360 rotation, clean white background, cinematic lighting',
      image: productImageUrl,
      duration: 5,
      aspect_ratio: '16:9',
      generate_audio: false,
    }));
  } catch (err) {
    console.log(`  ❌ Upload/generate error: ${err.message}`);
    results.push({ num: 3, label: 'Product Video Creator (no face)', error: err.message });
  }

  // Test 4: Scene Director (reference-to-video, no face)
  console.log('\n── TEST 4: Scene Director (reference-to-video, no face) ──────────────────────────────');
  try {
    console.log('  Uploading reference video (no face)...');
    const refVideoUrl = await uploadMedia(`${ASSETS}/reference-no-face.mp4`, 'video/mp4');
    console.log(`  Uploaded: ${refVideoUrl}`);
    results.push(await runTest(4, 'Scene Director (no face)', {
      model: 'bytedance/seedance-2.0/reference-to-video',
      prompt: 'Transform this into a cinematic outdoor nature scene with flowing water and sunlight',
      video: refVideoUrl,
      duration: 5,
      aspect_ratio: '16:9',
      generate_audio: false,
    }));
  } catch (err) {
    console.log(`  ❌ Upload/generate error: ${err.message}`);
    results.push({ num: 4, label: 'Scene Director (no face)', error: err.message });
  }

  // Test 5: Scene Director — reference video WITH face (face filter test)
  console.log('\n── TEST 5: Scene Director (reference-to-video, WITH face) ──────────────────────────────');
  console.log('  ⚠️  Face filter test — checking if Seedance blocks realistic faces');
  try {
    console.log('  Uploading reference video (with face)...');
    const faceVideoUrl = await uploadMedia(`${ASSETS}/reference-with-face.mp4`, 'video/mp4');
    console.log(`  Uploaded: ${faceVideoUrl}`);
    results.push(await runTest(5, 'Scene Director (WITH face — filter test)', {
      model: 'bytedance/seedance-2.0/reference-to-video',
      prompt: 'Create a professional business presentation scene from this reference',
      video: faceVideoUrl,
      duration: 5,
      aspect_ratio: '16:9',
      generate_audio: false,
    }));
  } catch (err) {
    console.log(`  ❌ Upload/generate error: ${err.message}`);
    results.push({ num: 5, label: 'Scene Director (WITH face)', error: err.message });
  }

  // Test 6: Product Video Creator — product image WITH face
  console.log('\n── TEST 6: Product Video Creator (image-to-video, WITH face) ──────────────────────────────');
  console.log('  ⚠️  Face filter test — product photo includes a person');
  try {
    console.log('  Uploading product image (with face)...');
    const faceProductUrl = await uploadMedia(`${ASSETS}/product-with-face.jpg`, 'image/jpeg');
    console.log(`  Uploaded: ${faceProductUrl}`);
    results.push(await runTest(6, 'Product Video Creator (WITH face — filter test)', {
      model: 'bytedance/seedance-2.0/image-to-video',
      prompt: 'Showcase this fashion look in motion, model walking confidently, cinematic slow motion',
      image: faceProductUrl,
      duration: 5,
      aspect_ratio: '16:9',
      generate_audio: false,
    }));
  } catch (err) {
    console.log(`  ❌ Upload/generate error: ${err.message}`);
    results.push({ num: 6, label: 'Product Video Creator (WITH face)', error: err.message });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.error ? '❌' : '✅';
    const time = r.elapsed ? `${r.elapsed}s` : 'n/a';
    console.log(`${icon} Test ${r.num}: ${r.label}`);
    console.log(`   Model: ${r.model || 'n/a'} | Time: ${time}`);
    if (r.error) console.log(`   Error: ${r.error}`);
    if (r.videoUrl) console.log(`   URL: ${r.videoUrl}`);
  }

  // Save results JSON
  const resultsPath = path.join(__dirname, '../test-assets/seedance-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to: ${resultsPath}`);
}

main().catch(console.error);
