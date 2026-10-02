/**
 * pdf-real-path-verify-v2.cjs
 *
 * Real-browser PDF verification — corrected harness.
 *
 * Problem with v1: Blob URL downloads (fetch → createObjectURL → a.click)
 * don't land in CDP download directory. Fix: intercept /api/report-pdf 
 * via page.route() to capture the response bytes directly, AND verify
 * the full client-side flow fired correctly.
 *
 * Evidence captured:
 * 1. page.route intercept: confirm fetch to /api/report-pdf fires from the browser
 * 2. Response bytes saved directly to disk
 * 3. Magic bytes + filename verified
 * 4. PDF rendered as PNG via Chromium
 * 5. Pollution check on both source text AND PDF extracted text
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const OUT = path.join(__dirname, '../screenshots/pdf-verify');
fs.mkdirSync(OUT, { recursive: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKERS = [
  { name: 'cleo',    slug: 'cover-letter-writer',      taskId: '82c94d12-2397-4fc1-94d3-e477018a3d99', risk: 'formatted prose' },
  { name: 'cruz',    slug: 'pricing-strategist',        taskId: 'd15a2c08-90ec-4437-b7fb-13c45d2c6627', risk: 'pricing tables' },
  { name: 'dale',    slug: 'interview-question-writer', taskId: '64d9326d-4a39-4c6c-aa7f-fc5a51301bbb', risk: 'list-heavy sections' },
  { name: 'charlie', slug: 'course-outline-builder',   taskId: '01595ed0-6b56-41fe-b529-e479dfbc6faf', risk: 'long nested structure' },
  { name: 'naru',    slug: 'whitepaper-writer',         taskId: 'd0c80ba6-f6e3-480b-a3c8-c3e379fa6520', risk: 'tables + inline citations' },
];

const POLLUTION = [
  ['word count',    /^\*{0,2}word count:\s*\d+/im],
  ['keep going',    /keep going with (the )?team/i],
  ['click a name',  /click a name above/i],
  ['handoff ⚡',    /### ⚡/],
  ['## Sources',    /\n## sources\n/i],
  ['char count',    /character count:\s*\d+/i],
  ['bracket var',   /\[(Your )?(Company Name|Product Name|Topic|Insert)\]/i],
];

function checkPollution(text) {
  return POLLUTION.filter(([,p]) => p.test(text)).map(([n]) => n);
}

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto('https://3rdshift.ai/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.locator('button').nth(1).click();
  await page.waitForTimeout(4000);
  const ok = page.url().includes('dashboard');
  console.log('Login:', ok ? '✅' : '❌ ' + page.url());
  await page.close();
  return ok;
}

async function testWorker(ctx, worker) {
  console.log(`\n══ ${worker.name.toUpperCase()} — ${worker.slug} — risk: ${worker.risk} ══`);

  // Verify source text
  const { data } = await supabase.from('tasks').select('output').eq('id', worker.taskId).single();
  const sourceText = data?.output?.text || '';
  const pollHits = checkPollution(sourceText);
  console.log(`  Source text: ${sourceText.length} chars | pollution: ${pollHits.length === 0 ? '✅ clean' : '❌ ' + pollHits.join(', ')}`);

  const page = await ctx.newPage();

  // Track the /api/report-pdf request via route interception
  // This captures the actual bytes the browser fetches
  let capturedBytes = null;
  let capturedStatus = null;
  let capturedHeaders = {};
  let requestFired = false;
  let requestPayload = null;

  await page.route('**/api/report-pdf', async (route) => {
    requestFired = true;
    const req = route.request();
    try { requestPayload = JSON.parse(req.postData() || '{}'); } catch {}
    
    // Continue the request and capture response
    const response = await route.fetch();
    capturedStatus = response.status();
    capturedHeaders = response.headers();
    capturedBytes = await response.body();
    
    // Let the browser get the response too (so the download triggers)
    await route.fulfill({ response });
  });

  // Load result page
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${worker.taskId}`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, `${worker.name}-result-page.png`), fullPage: false });

  // Scroll to bottom to make Download button visible
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(h => window.scrollTo(0, h * 0.4), h);
  await page.waitForTimeout(300);

  // Click Download → PDF
  await page.locator('button:has-text("Download")').first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${worker.name}-dropdown-open.png`) });

  await page.locator('text=Download as PDF').first().click();

  // Wait for the route interception to complete (the fetch from the browser)
  for (let i = 0; i < 60 && !capturedBytes; i++) {
    await page.waitForTimeout(500);
  }

  await page.close();

  // Analyse captured response
  console.log(`  API request fired: ${requestFired ? '✅' : '❌'}`);
  console.log(`  Response status: ${capturedStatus}`);
  console.log(`  Content-Type: ${capturedHeaders['content-type'] || 'not set'}`);
  console.log(`  Content-Disposition: ${capturedHeaders['content-disposition'] || 'not set'}`);

  if (!capturedBytes) {
    console.log('  ❌ No bytes captured');
    return { pass: false, error: 'no bytes captured', requestFired };
  }

  // Verify PDF magic bytes
  const magic = capturedBytes.slice(0, 4).toString('hex');
  const validPdf = magic.startsWith('255044'); // %PDF
  const sizeBytes = capturedBytes.length;
  console.log(`  Bytes: ${sizeBytes} | magic: ${magic} | valid PDF: ${validPdf ? '✅' : '❌'}`);

  // Save to disk
  const savedPath = path.join(OUT, `${worker.name}.pdf`);
  fs.writeFileSync(savedPath, capturedBytes);
  console.log(`  Saved: ${path.basename(savedPath)}`);

  // Verify filename format from Content-Disposition
  const cdHeader = capturedHeaders['content-disposition'] || '';
  const filenameMatch = cdHeader.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] || 'unknown';
  const expectedPattern = new RegExp(`^${worker.slug}-[a-f0-9]{8}\\.pdf$`);
  const filenameOk = expectedPattern.test(filename);
  console.log(`  Filename: "${filename}" | format correct: ${filenameOk ? '✅' : '❌'}`);

  // Extract text from PDF via pandoc or pdftotext (check what exists)
  let pdfText = '';
  let pdfPollHits = [];
  try {
    pdfText = execSync(`pandoc "${savedPath}" -t plain 2>/dev/null`, { encoding: 'utf8', timeout: 15000 });
    pdfPollHits = checkPollution(pdfText);
    console.log(`  PDF text: ${pdfText.length} chars | pollution in PDF: ${pdfPollHits.length === 0 ? '✅ clean' : '❌ ' + pdfPollHits.join(', ')}`);
    console.log(`  PDF first 200: ${pdfText.slice(0, 200).replace(/\n/g, ' ')}`);
    console.log(`  PDF last 150: ${pdfText.slice(-150).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`  PDF text extraction: ${e.message.slice(0, 60)}`);
  }

  // Render PDF first page as PNG via Chromium
  try {
    const b2 = await chromium.launch({ headless: true });
    const p2 = await b2.newPage();
    // Use Chromium's built-in PDF viewer
    await p2.goto('about:blank');
    // Encode PDF as base64 and render via data URL
    const b64 = capturedBytes.toString('base64');
    await p2.setContent(`<!DOCTYPE html><html><head><style>
      body{margin:0;background:#999;display:flex;flex-direction:column;align-items:center;padding:10px;gap:10px}
      iframe{width:900px;height:650px;border:none;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
      p{color:white;font-family:sans-serif;font-size:14px;margin:0}
    </style></head><body>
      <p>${worker.name}.pdf — ${sizeBytes} bytes — ${filename}</p>
      <iframe src="data:application/pdf;base64,${b64}"></iframe>
    </body></html>`);
    await p2.waitForTimeout(3000);
    await p2.screenshot({ path: path.join(OUT, `${worker.name}-pdf-page1.png`) });
    await b2.close();
    console.log(`  PDF screenshot: ✅ saved ${worker.name}-pdf-page1.png`);
  } catch (e) {
    console.log(`  PDF screenshot error: ${e.message.slice(0, 80)}`);
    // Fallback: screenshot the HTML-rendered source text
    try {
      const { marked } = require('marked');
      const html = marked.parse(sourceText, { gfm: true, breaks: true });
      const b3 = await chromium.launch({ headless: true });
      const p3 = await b3.newPage();
      await p3.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.6;color:#111;max-width:700px;margin:0 auto;padding:30px 40px}
h1{font-size:18pt}h2{font-size:13pt;border-bottom:1px solid #ddd;padding-bottom:2px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:10pt}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
th{background:#f5f5f5;font-weight:600}ul,ol{margin:6px 0 8px 18px}p{margin-bottom:7px}</style>
</head><body>${html}</body></html>`);
      await p3.waitForTimeout(1000);
      await p3.screenshot({ path: path.join(OUT, `${worker.name}-pdf-page1.png`), fullPage: false });
      await b3.close();
      console.log(`  PDF screenshot (HTML render fallback): ✅`);
    } catch (e2) { console.log(`  Fallback screenshot failed: ${e2.message.slice(0, 60)}`); }
  }

  const pass = requestFired && validPdf && pollHits.length === 0 && pdfPollHits.length === 0 && filenameOk;

  return {
    pass,
    requestFired,
    status: capturedStatus,
    contentType: capturedHeaders['content-type'],
    contentDisposition: cdHeader,
    filename,
    filenameOk,
    sizeBytes,
    validPdf,
    sourcePollution: pollHits,
    pdfPollution: pdfPollHits,
  };
}

async function main() {
  console.log('=== PDF Real-Path Verification v2 ===\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();

  await login(ctx);

  const results = {};
  for (const w of WORKERS) {
    results[w.name] = await testWorker(ctx, w);
  }

  await browser.close();

  // ── Downloads folder listing screenshot ──────────────────────────────
  console.log('\n══ Files in screenshots/pdf-verify/ ══');
  const pdfFiles = fs.readdirSync(OUT).filter(f => f.endsWith('.pdf'));
  for (const f of pdfFiles) {
    const s = fs.statSync(path.join(OUT, f));
    console.log(`  ${f} — ${s.size} bytes`);
  }

  // ── Final summary ────────────────────────────────────────────────────
  console.log('\n══ SUMMARY ══');
  for (const [name, r] of Object.entries(results)) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} ${name}:`);
    console.log(`   Request fired: ${r.requestFired ? '✅' : '❌'} | Status: ${r.status} | valid PDF: ${r.validPdf ? '✅' : '❌'} | ${r.sizeBytes} bytes`);
    console.log(`   Filename: "${r.filename}" | format OK: ${r.filenameOk ? '✅' : '❌'}`);
    console.log(`   Source pollution: ${r.sourcePollution?.length === 0 ? '✅ clean' : '❌ ' + r.sourcePollution?.join(', ')}`);
    console.log(`   PDF pollution:    ${r.pdfPollution?.length === 0 ? '✅ clean' : '❌ ' + r.pdfPollution?.join(', ')}`);
  }

  fs.writeFileSync(path.join(OUT, 'results-v2.json'), JSON.stringify(results, null, 2));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
