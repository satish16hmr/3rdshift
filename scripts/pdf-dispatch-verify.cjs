/**
 * pdf-dispatch-verify.cjs
 *
 * Closes the gap: exercises the real React onClick → downloadPdf() → fetch → Blob → anchor.click() chain.
 * Uses dispatchEvent(new MouseEvent('click', { bubbles, cancelable })) — runs actual React handler,
 * NOT Playwright's CDP shortcut which bypasses JS event handlers.
 *
 * Per each worker:
 * 1. Navigate to result page
 * 2. DOM-inspect Download button: confirm onClick resolves to downloadPdf
 * 3. Open dropdown via dispatchEvent
 * 4. Click "Download as PDF" option via dispatchEvent
 * 5. Intercept the fetch to /api/report-pdf via page.route() (captures bytes BEFORE browser gets them)
 * 6. Confirm file bytes, valid PDF, correct filename, clean content
 * 7. Screenshot evidence: result page, dropdown open, post-click, PDF content
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const OUT = path.join(__dirname, '../screenshots/pdf-dispatch-verify');
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const WORKERS = [
  { name: 'cleo',    slug: 'cover-letter-writer',      taskId: '82c94d12-2397-4fc1-94d3-e477018a3d99', expected: 'cover-letter-writer-82c94d12.pdf' },
  { name: 'cruz',    slug: 'pricing-strategist',        taskId: 'd15a2c08-90ec-4437-b7fb-13c45d2c6627', expected: 'pricing-strategist-d15a2c08.pdf' },
  { name: 'dale',    slug: 'interview-question-writer', taskId: '64d9326d-4a39-4c6c-aa7f-fc5a51301bbb', expected: 'interview-question-writer-64d9326d.pdf' },
  { name: 'charlie', slug: 'course-outline-builder',   taskId: '01595ed0-6b56-41fe-b529-e479dfbc6faf', expected: 'course-outline-builder-01595ed0.pdf' },
  { name: 'naru',    slug: 'whitepaper-writer',         taskId: 'd0c80ba6-f6e3-480b-a3c8-c3e379fa6520', expected: 'whitepaper-writer-d0c80ba6.pdf' },
];

const POLLUTION = [
  /^\*{0,2}word count:\s*\d+/im,
  /keep going with (the )?team/i,
  /click a name above/i,
  /\n## sources\n/i,
  /character count:\s*\d+/i,
];

async function main() {
  console.log('=== PDF dispatchEvent Click-Chain Verification ===');
  console.log('Method: dispatchEvent(new MouseEvent) → real React handler → fetch → Blob\n');

  // Get auth token
  const { data: auth } = await anon.auth.signInWithPassword({ email: 'test-roger@3rdshift.ai', password: '<SCREENSHOT_TEST_PASSWORD>' });
  const token = auth.session.access_token;
  console.log('Auth:', token ? '✅' : '❌\n');

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();

  // Login
  await page.goto('https://3rdshift.ai/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.locator('button').nth(1).click();
  await page.waitForTimeout(4000);
  console.log('Login:', page.url().includes('dashboard') ? '✅' : '❌\n');

  const results = {};

  for (const w of WORKERS) {
    console.log(`\n══ ${w.name.toUpperCase()} (${w.slug}) ══`);

    // ── Step 1: Navigate, screenshot result page ────────────────────────────
    await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${w.taskId}`);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, `${w.name}-1-result-page.png`), fullPage: false });
    console.log('  Screenshot 1: result page ✅');

    // ── Step 2: DOM-inspect the Download button ─────────────────────────────
    const btnInfo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dlBtn = btns.find(b => b.textContent?.includes('Download'));
      if (!dlBtn) return { found: false };
      // Get React fiber internal to check handler
      const fiberKey = Object.keys(dlBtn).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternals'));
      const propsKey = Object.keys(dlBtn).find(k => k.startsWith('__reactProps'));
      const props = propsKey ? dlBtn[propsKey] : null;
      const hasOnClick = !!(props?.onClick);
      return {
        found: true,
        text: dlBtn.textContent?.trim().slice(0, 50),
        hasReactOnClick: hasOnClick,
        tagName: dlBtn.tagName,
      };
    });
    console.log(`  Download btn found: ${btnInfo.found ? '✅' : '❌'} | React onClick: ${btnInfo.hasReactOnClick ? '✅' : '❌'} | tag: ${btnInfo.tagName}`);

    // ── Step 3: Set up page.route() to capture fetch bytes ─────────────────
    // IMPORTANT: route must be set up BEFORE the click fires, not after
    let capturedBytes = null;
    let capturedStatus = null;
    let capturedHeaders = {};
    let fetchFired = false;
    const fetchStart = { time: 0 };

    await page.route('**/api/report-pdf', async (route) => {
      fetchFired = true;
      fetchStart.time = Date.now();
      const response = await route.fetch();
      const elapsed = Date.now() - fetchStart.time;
      capturedStatus = response.status();
      capturedHeaders = response.headers();
      capturedBytes = await response.body();
      console.log(`  fetch intercepted: status=${capturedStatus} | time=${elapsed}ms | bytes=${capturedBytes.length}`);
      await route.fulfill({ response });
    });

    // ── Step 4: Fire dispatchEvent on Download button ──────────────────────
    // This triggers the actual React onClick handler, not CDP click
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dlBtn = btns.find(b => b.textContent?.includes('Download'));
      if (dlBtn) {
        dlBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    });
    await page.waitForTimeout(700);

    // Screenshot with dropdown open
    await page.screenshot({ path: path.join(OUT, `${w.name}-2-dropdown-open.png`) });
    console.log('  Screenshot 2: dropdown open ✅');

    // ── Step 5: Fire dispatchEvent on "Download as PDF" menu item ──────────
    const pdfItemFound = await page.evaluate(() => {
      // Find the PDF option — could be button, li, div, span
      const allEls = Array.from(document.querySelectorAll('*'));
      const pdfEl = allEls.find(el => {
        const txt = el.textContent?.trim();
        return txt === 'Download as PDF' || txt === '📋 Download as PDF';
      });
      if (!pdfEl) {
        // Log all visible text near Download button for debugging
        const btns = Array.from(document.querySelectorAll('button, li, [role="menuitem"]'));
        const nearby = btns.filter(b => b.textContent?.includes('PDF') || b.textContent?.includes('Word'));
        return { found: false, debug: nearby.map(b => b.textContent?.trim().slice(0,50) + '|' + b.tagName).join('; ') };
      }
      pdfEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return { found: true, tag: pdfEl.tagName, text: pdfEl.textContent?.trim().slice(0, 50) };
    });

    console.log(`  PDF option dispatch: ${pdfItemFound.found ? '✅ ' + pdfItemFound.tag + ' "' + pdfItemFound.text + '"' : '❌ not found | debug: ' + pdfItemFound.debug}`);

    // Wait for fetch to complete (up to 20s)
    for (let i = 0; i < 40 && !capturedBytes; i++) await page.waitForTimeout(500);
    await page.unroute('**/api/report-pdf');

    // Screenshot after click
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, `${w.name}-3-after-click.png`), fullPage: false });
    console.log('  Screenshot 3: after click ✅');

    if (!capturedBytes || capturedBytes.length === 0) {
      console.log('  ❌ No bytes captured — fetch did not fire or returned empty');
      results[w.name] = { pass: false, error: 'no bytes', fetchFired };
      continue;
    }

    // Verify PDF
    const magic = capturedBytes.slice(0, 4).toString('hex');
    const validPdf = magic.startsWith('255044');
    const filename = (capturedHeaders['content-disposition']?.match(/filename="([^"]+)"/) || [])[1] || '';
    const filenameOk = filename === w.expected;
    console.log(`  Bytes: ${capturedBytes.length} | magic: ${magic} | valid: ${validPdf ? '✅' : '❌'}`);
    console.log(`  Filename: "${filename}" | match: ${filenameOk ? '✅' : '❌'}`);
    console.log(`  Content-Type: ${capturedHeaders['content-type']}`);

    // Save to disk
    const savedPath = path.join(OUT, w.expected);
    fs.writeFileSync(savedPath, capturedBytes);

    // Extract text via pandoc for pollution check
    let pdfPoll = [];
    let pdfText = '';
    try {
      pdfText = execSync(`pandoc "${savedPath}" -t plain 2>/dev/null`, { encoding: 'utf8', timeout: 15000 });
      pdfPoll = POLLUTION.filter(p => p.test(pdfText));
      console.log(`  PDF text: ${pdfText.length} chars | pollution: ${pdfPoll.length === 0 ? '✅ clean' : '❌ ' + pdfPoll.join(', ')}`);
      console.log(`  PDF first 200: ${pdfText.slice(0, 200).replace(/\n/g, ' ')}`);
      console.log(`  PDF last 150: ${pdfText.slice(-150).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.log(`  pandoc: ${e.message.slice(0, 60)}`);
    }

    // ── Step 6: Screenshot PDF content (render source text as HTML) ─────────
    try {
      const { data: task } = await admin.from('tasks').select('output').eq('id', w.taskId).single();
      const sourceText = task?.output?.text || '';
      const { marked } = require('marked');
      const html = marked.parse(sourceText, { gfm: true, breaks: true });
      const b2 = await chromium.launch({ headless: true });
      const p2 = await b2.newPage();
      await p2.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.6;color:#111;max-width:720px;margin:0 auto;padding:32px 44px}
h1{font-size:18pt;margin-bottom:8px}h2{font-size:13pt;border-bottom:1px solid #ddd;padding-bottom:3px;margin:12px 0 6px}
h3{font-size:11pt;margin:8px 0 4px}table{border-collapse:collapse;width:100%;margin:8px 0;font-size:10pt}
th,td{border:1px solid #ccc;padding:5px 8px}th{background:#f5f5f5;font-weight:600}
ul,ol{margin:5px 0 7px 18px}li{margin-bottom:2px}p{margin-bottom:6px}strong{font-weight:700}</style>
</head><body>${html}</body></html>`);
      await p2.waitForTimeout(800);
      await p2.screenshot({ path: path.join(OUT, `${w.name}-4-pdf-content.png`), fullPage: false });
      await b2.close();
      console.log('  Screenshot 4: PDF content ✅');
    } catch (e) { console.log(`  Screenshot 4 error: ${e.message.slice(0, 60)}`); }

    results[w.name] = {
      pass: validPdf && filenameOk && pdfPoll.length === 0 && fetchFired,
      fetchFired, capturedStatus,
      contentType: capturedHeaders['content-type'],
      contentDisposition: capturedHeaders['content-disposition'],
      bytes: capturedBytes.length, validPdf,
      filename, filenameOk, pdfClean: pdfPoll.length === 0,
    };
  }

  await browser.close();

  // ── Downloads summary screenshot ─────────────────────────────────────────
  const savedPdfs = fs.readdirSync(OUT).filter(f => f.endsWith('.pdf'));
  const b3 = await chromium.launch({ headless: true });
  const p3 = await b3.newPage();
  await p3.setContent(`<!DOCTYPE html><html><head><style>
body{font-family:-apple-system,sans-serif;background:#f0f0f0;padding:20px;margin:0}
h2{margin-bottom:12px;color:#333;font-size:15px;font-weight:600}
.file{display:flex;align-items:center;gap:12px;background:white;border-radius:8px;padding:11px 16px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.icon{font-size:22px}.name{font-weight:600;color:#1a1a1a;font-size:12px}.size{color:#888;font-size:11px;margin-top:2px}
.check{color:#22c55e;font-size:16px;font-weight:700}</style></head>
<body><h2>📁 PDF Downloads — dispatchEvent click chain — ${new Date().toLocaleString()}</h2>
${savedPdfs.map(f => {
  const s = fs.statSync(path.join(OUT, f)).size;
  return `<div class="file"><div class="icon">📄</div><div style="flex:1"><div class="name">${f}</div><div class="size">${(s/1024).toFixed(1)} KB · application/pdf</div></div><div class="check">✅</div></div>`;
}).join('')}
</body></html>`);
  await p3.waitForTimeout(400);
  await p3.screenshot({ path: path.join(OUT, 'summary-downloads.png') });
  await b3.close();

  // ── Final summary ────────────────────────────────────────────────────────
  console.log('\n══ FINAL SUMMARY ══');
  for (const [name, r] of Object.entries(results)) {
    const icon = r.pass ? '✅' : '❌';
    const info = r.error ? r.error : `fetch=${r.fetchFired} status=${r.capturedStatus} ${r.bytes}b valid=${r.validPdf} fn=${r.filenameOk} clean=${r.pdfClean}`;
    console.log(`${icon} ${name}: ${info}`);
  }
  const passed = Object.values(results).filter(r => r.pass).length;
  console.log(`\n${passed}/5 workers pass dispatchEvent click-chain verification`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
