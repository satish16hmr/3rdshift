/**
 * final-verify.cjs — Test A (downloads) + Test D (UI hide) + Test E (result pages)
 * All in one Playwright session to save time.
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const OUT = path.join(__dirname, '../screenshots/output-purity');
const DL = path.join(OUT, 'downloads');
fs.mkdirSync(DL, { recursive: true });

// Task IDs
const TASKS = {
  // Test A: downloads
  cleo: '82c94d12-2397-4fc1-94d3-e477018a3d99',
  cruz: 'd15a2c08-90ec-4437-b7fb-13c45d2c6627',
  dale: '64d9326d-4a39-4c6c-aa7f-fc5a51301bbb',
  // Test D: non-registered workers
  bree: '866e8e82-5c48-4223-bfc1-8903f72277f6',
  kit:  'ffa59e79-ea8f-40ac-99cc-fb14aa54945e',
  // Test E: cross-worker spot check
  charlie: '57ad0389-1b4c-4fcc-aee8-7a810b704460',
  ava:     'd1cbccb8-ce9a-4165-9ae8-260e4e11e73b',
  remy:    '88601ac6-72e8-4d41-b47d-18003733076c',
  tate:    'eba414d5-56e4-4f52-9650-3833ba49b762',
};

async function login(page) {
  await page.goto('https://3rdshift.ai/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.locator('button').nth(1).click();
  await page.waitForTimeout(4000);
}

async function screenshotResult(page, taskId, label, opts = {}) {
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${taskId}`);
  await page.waitForTimeout(5000);

  const fullPath = path.join(OUT, `${label}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });

  // Check HandoffCards presence
  const handoffCount = await page.locator('text=Keep going with your team').count();
  const handoffCards = await page.locator('a.group.flex.items-start').count();
  console.log(`  HandoffCards: ${handoffCount > 0 ? 'VISIBLE' : 'HIDDEN'} | cards: ${handoffCards}`);

  // Console errors
  const errors = [];
  page.once('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  return { handoffVisible: handoffCount > 0, handoffCards, consoleErrors: errors };
}

async function tryDownload(page, taskId, format, outName) {
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${taskId}`);
  await page.waitForTimeout(4000);

  const dlPath = path.join(DL, outName);
  let dlFile = null;

  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 12000 }),
      (async () => {
        // Open download dropdown
        const mainDlBtn = page.locator('button:has-text("Download")').first();
        if (await mainDlBtn.count()) {
          await mainDlBtn.click();
          await page.waitForTimeout(400);
        }
        // Click the format option
        const isPdf = format === 'pdf';
        const label = isPdf ? /PDF/i : /Word|DOCX/i;
        const opt = page.locator('li, button, a, [role=menuitem]').filter({ hasText: label }).last();
        const count = await opt.count();
        if (count > 0) await opt.click();
        else {
          // Fallback: look in the whole page
          await page.locator(`text=/${isPdf ? 'PDF' : 'Word'}/`).last().click().catch(() => {});
        }
      })(),
    ]);
    if (download) {
      await download.saveAs(dlPath);
      dlFile = dlPath;
    }
  } catch(e) {
    console.log(`    Download event missed: ${e.message.slice(0,50)}`);
  }

  if (dlFile && fs.existsSync(dlFile)) {
    const size = fs.statSync(dlFile).size;
    const buf = fs.readFileSync(dlFile);
    const magic = buf.slice(0,4).toString('hex');
    const validPdf = magic.startsWith('255044');    // %PDF
    const validDocx = magic === '504b0304';          // PK zip
    const valid = format === 'pdf' ? validPdf : validDocx;
    console.log(`    ✅ Downloaded ${size} bytes | magic: ${magic} | format valid: ${valid}`);
    return { path: dlFile, size, valid };
  }
  return null;
}

async function pdfScreenshot(pdfPath, outName) {
  if (!pdfPath || !fs.existsSync(pdfPath)) return false;

  // Load PDF in Playwright (Chromium renders PDFs natively)
  const browser2 = await chromium.launch({ headless: true });
  const ctx = await browser2.newContext();
  const pg = await ctx.newPage();
  await pg.goto('file://' + pdfPath);
  await pg.waitForTimeout(2000);
  await pg.screenshot({ path: path.join(OUT, outName), fullPage: false });
  await browser2.close();
  return true;
}

async function docxContent(docxPath, label) {
  if (!docxPath || !fs.existsSync(docxPath)) return { clean: false, text: '' };
  try {
    const text = execSync(`pandoc "${docxPath}" -t plain 2>/dev/null`, { encoding: 'utf8', timeout: 15000 });
    const POLL = [
      /^\*{0,2}word count:\s*\d+/im,
      /keep going with (the )?team/i,
      /click a name above/i,
      /### ⚡/,
      /\n## sources\n/i,
      /character count:\s*\d+/i,
    ];
    const hits = POLL.filter(p => p.test(text));
    console.log(`    DOCX text: ${text.length} chars | clean: ${hits.length === 0 ? '✅' : '❌ ' + hits.length + ' hits'}`);
    console.log(`    First 200: ${text.slice(0,200).replace(/\n/g,' ')}`);
    console.log(`    Last 200:  ${text.slice(-200).replace(/\n/g,' ')}`);
    return { clean: hits.length === 0, text, size: text.length };
  } catch(e) {
    console.log(`    pandoc failed: ${e.message.slice(0,60)}`);
    return { clean: null, text: '' };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await login(page);

  // ── TEST A: Downloads ───────────────────────────────────────────────
  console.log('\n══ TEST A: Download Integrity ══\n');
  const dlResults = {};

  for (const [name, taskId] of [['cleo', TASKS.cleo], ['cruz', TASKS.cruz], ['dale', TASKS.dale]]) {
    console.log(`\n  ${name.toUpperCase()} (${taskId.slice(0,8)}):`);
    dlResults[name] = {};

    console.log('  → PDF');
    const pdf = await tryDownload(page, taskId, 'pdf', `${name}.pdf`);
    dlResults[name].pdf = pdf;

    console.log('  → DOCX');
    const docx = await tryDownload(page, taskId, 'docx', `${name}.docx`);
    dlResults[name].docx = docx;
    if (docx?.path) await docxContent(docx.path, name);
  }

  // ── TEST D: HandoffCards hidden on non-registered workers ────────────
  console.log('\n══ TEST D: HandoffCards hidden on Bree + Kit ══\n');

  console.log('  Bree (creative-brief-writer):');
  const breeUI = await screenshotResult(page, TASKS.bree, 'TD-bree');

  console.log('  Kit (tagline-writer):');
  const kitUI  = await screenshotResult(page, TASKS.kit,  'TD-kit');

  // ── TEST E: Cross-worker result pages ────────────────────────────────
  console.log('\n══ TEST E: Cross-worker result pages ══\n');

  console.log('  Charlie:');
  const charlieUI = await screenshotResult(page, TASKS.charlie, 'TE-charlie');

  console.log('  Ava:');
  const avaUI = await screenshotResult(page, TASKS.ava, 'TE-ava');

  console.log('  Remy:');
  const remyUI = await screenshotResult(page, TASKS.remy, 'TE-remy');

  console.log('  Tate:');
  const tateUI = await screenshotResult(page, TASKS.tate, 'TE-tate');

  await browser.close();

  // ── Screenshot PDFs in Chromium ──────────────────────────────────────
  console.log('\n══ Rendering PDFs in browser ══\n');
  for (const name of ['cleo', 'cruz', 'dale']) {
    const pdfPath = path.join(DL, `${name}.pdf`);
    if (fs.existsSync(pdfPath)) {
      const ok = await pdfScreenshot(pdfPath, `TA-${name}-pdf-rendered.png`);
      console.log(`  ${name} PDF render: ${ok ? '✅' : '❌'}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════');
  console.log('FINAL SUMMARY');
  console.log('══════════════════════════════════════════');

  console.log('\nTEST A (Downloads):');
  for (const [name, r] of Object.entries(dlResults)) {
    const pdf = r.pdf ? `✅ ${r.pdf.size}b valid:${r.pdf.valid}` : '❌';
    const docx = r.docx ? `✅ ${r.docx.size}b valid:${r.docx.valid}` : '❌';
    console.log(`  ${name}: PDF=${pdf} | DOCX=${docx}`);
  }

  console.log('\nTEST D (UI hide):');
  console.log(`  Bree: HandoffCards=${breeUI.handoffVisible ? '❌ VISIBLE (bug)' : '✅ HIDDEN'}`);
  console.log(`  Kit:  HandoffCards=${kitUI.handoffVisible ? '❌ VISIBLE (bug)' : '✅ HIDDEN'}`);

  console.log('\nTEST E (Cross-worker):');
  console.log(`  Charlie: HandoffCards=${charlieUI.handoffVisible ? '✅ VISIBLE (registered)' : 'HIDDEN'}`);
  console.log(`  Ava:     HandoffCards=${avaUI.handoffVisible ? 'VISIBLE' : '✅ HIDDEN (not registered)'}`);
  console.log(`  Remy:    HandoffCards=${remyUI.handoffVisible ? 'VISIBLE' : '✅ HIDDEN (not registered)'}`);
  console.log(`  Tate:    HandoffCards=${tateUI.handoffVisible ? 'VISIBLE' : '✅ HIDDEN (not registered)'}`);

  console.log('\nScreenshots saved to:', OUT);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
