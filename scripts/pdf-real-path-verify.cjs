/**
 * pdf-real-path-verify.cjs
 * Real-browser PDF download verification.
 * Exercises the full client-side chain:
 *   login → result page → click Download PDF → fetch /api/report-pdf → Blob → file on disk → open
 *
 * Captures:
 * - Network request/response details (intercepted via page.on('request'/'response'))
 * - Downloaded file metadata (size, magic bytes, filename)
 * - PDF content rendered to PNG via Chromium
 * - Pollution check on the stored output text (source of truth for PDF content)
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const OUT = path.join(__dirname, '../screenshots/pdf-verify');
fs.mkdirSync(OUT, { recursive: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKERS = [
  { name: 'cleo',    slug: 'cover-letter-writer',    taskId: '82c94d12-2397-4fc1-94d3-e477018a3d99', risk: 'formatted prose' },
  { name: 'cruz',    slug: 'pricing-strategist',     taskId: 'd15a2c08-90ec-4437-b7fb-13c45d2c6627', risk: 'pricing tables' },
  { name: 'dale',    slug: 'interview-question-writer', taskId: '64d9326d-4a39-4c6c-aa7f-fc5a51301bbb', risk: 'list-heavy sections' },
  { name: 'charlie', slug: 'course-outline-builder', taskId: '01595ed0-6b56-41fe-b529-e479dfbc6faf', risk: 'long nested structure' },
  { name: 'naru',    slug: 'whitepaper-writer',      taskId: 'd0c80ba6-f6e3-480b-a3c8-c3e379fa6520', risk: 'tables + inline citations' },
];

const POLLUTION_PATTERNS = [
  ['word count',        /^\*{0,2}word count:\s*\d+/im],
  ['keep going',        /keep going with (the )?team/i],
  ['click a name',      /click a name above/i],
  ['handoff header',    /### ⚡/],
  ['## Sources',        /\n## sources\n/i],
  ['char count',        /character count:\s*\d+/i],
  ['bracket variable',  /\[(Your )?(Company Name|Product Name|Topic|Insert)\]/i],
];

async function login(page) {
  await page.goto('https://3rdshift.ai/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.locator('button').nth(1).click();
  await page.waitForTimeout(4000);
  console.log('  Login:', page.url().includes('dashboard') ? '✅ OK' : '❌ FAILED - ' + page.url());
}

async function verifyOutputText(taskId, name) {
  const { data } = await supabase.from('tasks').select('output').eq('id', taskId).single();
  const text = data?.output?.text || '';
  const hits = POLLUTION_PATTERNS.filter(([,p]) => p.test(text)).map(([n]) => n);
  console.log(`  Output text: ${text.length} chars | pollution: ${hits.length === 0 ? '✅ clean' : '❌ ' + hits.join(', ')}`);
  return { text, clean: hits.length === 0 };
}

async function downloadPdfAndVerify(page, worker) {
  console.log(`\n══ ${worker.name.toUpperCase()} (${worker.slug}) — risk: ${worker.risk} ══`);
  
  // Load result page
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${worker.taskId}`);
  await page.waitForTimeout(5000);
  
  // Screenshot result page
  await page.screenshot({ path: path.join(OUT, `${worker.name}-result-page.png`), fullPage: false });
  
  // Verify source output text
  const { text, clean } = await verifyOutputText(worker.taskId, worker.name);
  
  // Intercept the /api/report-pdf request
  const networkLog = [];
  const reqHandler = req => {
    if (req.url().includes('/api/report-pdf')) {
      networkLog.push({ type: 'request', url: req.url(), method: req.method() });
    }
  };
  const resHandler = res => {
    if (res.url().includes('/api/report-pdf')) {
      networkLog.push({
        type: 'response',
        url: res.url(),
        status: res.status(),
        headers: res.headers(),
      });
    }
  };
  page.on('request', reqHandler);
  page.on('response', resHandler);

  // Click Download button then PDF option
  const dlBtn = page.locator('button:has-text("Download")').first();
  const btnCount = await dlBtn.count();
  if (!btnCount) {
    console.log('  ❌ No Download button found');
    return { pass: false, error: 'no download button' };
  }

  // Intercept the Blob URL created by the fetch → save it
  // We'll use CDP to intercept the download at the browser level
  const client = await page.context().newCDPSession(page);
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: OUT,
    eventsEnabled: true,
  });

  let downloadComplete = false;
  let downloadFilename = null;
  client.on('Browser.downloadProgress', (event) => {
    if (event.state === 'completed') {
      downloadComplete = true;
    }
  });
  client.on('Browser.downloadWillBegin', (event) => {
    downloadFilename = event.suggestedFilename;
    console.log(`  Download started: ${event.suggestedFilename}`);
  });

  // Click the dropdown open
  await dlBtn.click();
  await page.waitForTimeout(500);

  // Screenshot the dropdown open
  await page.screenshot({ path: path.join(OUT, `${worker.name}-dropdown-open.png`) });

  // Click PDF option
  const pdfOption = page.locator('text=Download as PDF').first();
  const pdfCount = await pdfOption.count();
  if (!pdfCount) {
    console.log('  ❌ No "Download as PDF" option found in dropdown');
    await page.screenshot({ path: path.join(OUT, `${worker.name}-dropdown-debug.png`) });
    return { pass: false, error: 'no PDF option' };
  }

  const start = Date.now();
  await pdfOption.click();
  console.log(`  PDF button clicked, waiting for download...`);

  // Wait for download to complete (up to 30s — puppeteer PDF can take ~5s)
  for (let i = 0; i < 60; i++) {
    if (downloadComplete) break;
    await page.waitForTimeout(500);
  }

  const elapsed = Date.now() - start;
  console.log(`  Download completed in ${elapsed}ms | file: ${downloadFilename}`);

  // Check network log
  const req = networkLog.find(l => l.type === 'request');
  const res = networkLog.find(l => l.type === 'response');
  
  console.log(`  Network: request intercepted=${req ? '✅' : '❌'} | response=${res ? res.status : 'none'}`);
  if (res) {
    console.log(`  Content-Type: ${res.headers['content-type'] || 'not set'}`);
    console.log(`  Content-Disposition: ${res.headers['content-disposition'] || 'not set'}`);
  }

  // Remove network listeners
  page.off('request', reqHandler);
  page.off('response', resHandler);

  // Find the downloaded file
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.pdf'));
  const latestPdf = files
    .map(f => ({ f, t: fs.statSync(path.join(OUT, f)).mtimeMs }))
    .sort((a,b) => b.t - a.t)[0]?.f;

  if (!latestPdf) {
    console.log('  ❌ No PDF file found in download dir');
    return { pass: false, error: 'no file', networkReq: req, networkRes: res };
  }

  const pdfPath = path.join(OUT, latestPdf);
  const pdfBuf = fs.readFileSync(pdfPath);
  const magic = pdfBuf.slice(0, 4).toString('hex');
  const isValidPdf = magic.startsWith('255044'); // %PDF

  console.log(`  File: ${latestPdf} | size: ${pdfBuf.length} bytes | magic: ${magic} | valid: ${isValidPdf ? '✅' : '❌'}`);

  // Rename to worker-specific name to avoid overwriting
  const namedPath = path.join(OUT, `${worker.name}.pdf`);
  fs.copyFileSync(pdfPath, namedPath);

  // Screenshot the PDF by rendering it in Chromium
  let pdfScreenshotOk = false;
  try {
    const pdfBrowser = await chromium.launch({ headless: true });
    const pdfPage = await pdfBrowser.newPage();
    await pdfPage.setContent(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{margin:0;background:#888;display:flex;justify-content:center;padding:20px;}
      embed{width:900px;height:700px;border:2px solid #333;}</style></head>
      <body><embed src="file://${namedPath}" type="application/pdf"/></body></html>
    `);
    await pdfPage.waitForTimeout(2000);
    await pdfPage.screenshot({ path: path.join(OUT, `${worker.name}-pdf-open.png`) });
    await pdfBrowser.close();
    pdfScreenshotOk = true;
    console.log(`  PDF screenshot: ✅`);
  } catch(e) {
    console.log(`  PDF screenshot via embed: ${e.message.slice(0,60)}`);
  }

  // Fallback: render HTML version of the content
  if (!pdfScreenshotOk) {
    try {
      const { marked } = require('marked');
      const html = marked.parse(text || '', { gfm: true, breaks: true });
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.7;color:#111;max-width:700px;margin:0 auto;padding:30px 40px}
h1{font-size:20pt;margin:16px 0 8px}h2{font-size:14pt;margin:14px 0 6px}h3{font-size:12pt;margin:10px 0 4px}
table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f5f5f5;font-weight:600}
ul,ol{margin:8px 0 10px 20px}li{margin-bottom:3px}p{margin-bottom:8px}strong{font-weight:700}</style>
</head><body>${html}</body></html>`;
      const b2 = await chromium.launch({ headless: true });
      const p2 = await b2.newPage();
      await p2.setContent(fullHtml);
      await p2.waitForTimeout(1000);
      await p2.screenshot({ path: path.join(OUT, `${worker.name}-pdf-content.png`), fullPage: false });
      await b2.close();
      console.log(`  PDF content screenshot (HTML render): ✅`);
    } catch(e2) {
      console.log(`  Content screenshot failed: ${e2.message.slice(0,60)}`);
    }
  }

  return {
    pass: isValidPdf && clean && downloadFilename !== null,
    filename: downloadFilename || latestPdf,
    size: pdfBuf.length,
    validPdf: isValidPdf,
    clean,
    elapsed,
    networkReq: req,
    networkRes: res,
  };
}

async function main() {
  console.log('=== PDF Real-Path Verification ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page);

  const results = {};

  for (const worker of WORKERS) {
    results[worker.name] = await downloadPdfAndVerify(page, worker);
  }

  await browser.close();

  // Screenshot of downloads folder (list)
  const allFiles = fs.readdirSync(OUT).filter(f => f.endsWith('.pdf'));
  console.log('\n══ Downloads folder ══');
  for (const f of allFiles) {
    const s = fs.statSync(path.join(OUT, f));
    console.log(`  ${f} — ${s.size} bytes`);
  }

  // Final summary
  console.log('\n══ SUMMARY ══');
  for (const [name, r] of Object.entries(results)) {
    const icon = r.pass ? '✅' : '❌';
    const info = r.error || `${r.size}b | valid:${r.validPdf} | clean:${r.clean} | ${r.elapsed}ms`;
    console.log(`${icon} ${name}: ${info}`);
    if (r.networkRes) {
      console.log(`   Network: POST /api/report-pdf → ${r.networkRes.status} | Content-Type: ${r.networkRes.headers['content-type']}`);
      console.log(`   Content-Disposition: ${r.networkRes.headers['content-disposition'] || 'not set'}`);
    }
  }

  // Save results JSON
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log('\nResults saved to screenshots/pdf-verify/results.json');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
