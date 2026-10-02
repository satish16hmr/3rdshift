/**
 * purity-playwright.cjs
 * Tests 7 and 8: HandoffCards UI + Download integrity
 * Uses Playwright to take screenshots and download PDFs/DOCXs
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '../screenshots/output-purity');
const DOWNLOADS = path.join(OUT, 'downloads');
fs.mkdirSync(DOWNLOADS, { recursive: true });

const IDS_FILE = path.join(OUT, 'task-ids.json');
let taskIds = {};
try { taskIds = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')); } catch {}

async function login(page) {
  await page.goto('https://3rdshift.ai/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.locator('button').nth(1).click();
  await page.waitForTimeout(5000);
  console.log('  Logged in, URL:', page.url());
}

async function screenshotResult(page, taskId, name) {
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${taskId}`);
  await page.waitForTimeout(6000);

  // Full page
  await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true });

  // Bottom section (HandoffCards)
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(h => window.scrollTo(0, h - 900), h);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${name}-bottom.png`) });

  // Check for HandoffCards in DOM — look for the section heading + cards below deliverable
  const handoffSection = await page.locator('text=Keep going with your team').count();
  // HandoffCards are inside the section with that heading, after border-t divider
  // They render as <a> tags with bg-zinc-50 class inside the handoff section
  const sectionHandle = page.locator('text=Keep going with your team').first();
  let cardCount = 0;
  if (handoffSection > 0) {
    // Count links in the parent container (go up 2 levels from heading, count links)
    const parent = sectionHandle.locator('xpath=../../..');
    cardCount = await parent.locator('a[href^="/dashboard/workers/"]').count();
  }
  console.log(`  HandoffCards visible: ${handoffSection > 0 ? 'YES' : 'NO'} | Handoff cards: ${cardCount}`);

  return { handoffVisible: handoffSection > 0, cardCount };
}

async function downloadFile(page, taskId, format, name) {
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${taskId}`);
  await page.waitForTimeout(5000);

  const dlPath = path.join(DOWNLOADS, `${name}.${format}`);
  let downloaded = false;

  // Listen for download
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
    (async () => {
      // Find download button for this format
      const formatLabel = format === 'pdf' ? 'PDF' : format === 'docx' ? 'Word' : format.toUpperCase();
      const btn = page.locator(`button, a`).filter({ hasText: new RegExp(formatLabel, 'i') }).first();
      const count = await btn.count();
      if (count === 0) {
        // Try clicking the Download dropdown first
        const dlBtn = page.locator('button:has-text("Download")').first();
        const dlCount = await dlBtn.count();
        if (dlCount > 0) {
          await dlBtn.click();
          await page.waitForTimeout(500);
          const menuItem = page.locator('*').filter({ hasText: new RegExp(formatLabel, 'i') }).last();
          await menuItem.click().catch(() => {});
        }
      } else {
        await btn.click();
      }
    })(),
  ]).catch(() => [null]);

  if (download) {
    await download.saveAs(dlPath);
    downloaded = true;
    console.log(`  Downloaded: ${dlPath} (${fs.statSync(dlPath).size} bytes)`);
  } else {
    console.log(`  ⚠️  Download event not captured for ${name}.${format}`);
  }

  return { downloaded, path: dlPath };
}

async function checkHandoffClick(page, taskId) {
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${taskId}`);
  await page.waitForTimeout(5000);

  // Scroll to HandoffCards
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(h => window.scrollTo(0, h - 900), h);
  await page.waitForTimeout(500);

  // Find and click the first HandoffCards card (NOT the chat/quick-action buttons above)
  // HandoffCards are in the section with "Keep going with your team" heading
  const section = page.locator('text=Keep going with your team').first();
  const sectionParent = section.locator('xpath=../../..');
  const cards = sectionParent.locator('a[href^="/dashboard/workers/"]');
  const count = await cards.count();
  console.log(`  Handoff card links found: ${count}`);

  if (count > 0) {
    const href = await cards.first().getAttribute('href');
    console.log(`  First card href: ${href}`);
    await cards.first().click();
    await page.waitForTimeout(4000);
    console.log(`  Navigated to: ${page.url()}`);
    await page.screenshot({ path: path.join(OUT, 'handoff-click-result.png') });
    return { clicked: true, navigatedTo: page.url(), href };
  }
  return { clicked: false };
}

async function main() {
  console.log('=== Tests 7 & 8: UI + Download Verification ===\n');

  const browser = await chromium.launch({ headless: true });

  // Use separate context for downloads
  const downloadContext = await browser.newContext({
    acceptDownloads: true,
  });
  const page = await downloadContext.newPage();
  await login(page);

  const report = { t7: {}, t8: {} };

  // ── TEST 7: HandoffCards UI ──────────────────────────────────────────
  console.log('\n══ TEST 7: HandoffCards UI (Cleo) ══');
  // Use the clean Cleo task from purity-verify
  const cleoTaskId = taskIds.t1_cleo || 'f6d1593d-612e-4d0e-b5c7-6d9ba8567d3b';
  const ui = await screenshotResult(page, cleoTaskId, 'T7-cleo-ui');
  report.t7.handoffVisible = ui.handoffVisible;
  report.t7.cardCount = ui.cardCount;

  // Click a handoff card and verify navigation
  console.log('\n  Clicking handoff card...');
  const clickResult = await checkHandoffClick(page, cleoTaskId);
  report.t7.clickTest = clickResult;

  // Console errors check
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  // Verify non-registered worker (Bree) hides HandoffCards
  console.log('\n  Checking non-registered worker (Bree - creative-brief-writer)...');
  const harness = require('./purity-harness.cjs');
  let breeTask = null;
  try {
    const { data } = await harness.adminClient
      .from('tasks')
      .select('id')
      .eq('worker_slug', 'creative-brief-writer')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    breeTask = data;
  } catch (e) {}

  if (breeTask) {
    await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${breeTask.id}`);
    await page.waitForTimeout(4000);
    const handoffOnBree = await page.locator('text=Keep going with your team').count();
    console.log(`  Bree HandoffCards visible: ${handoffOnBree > 0 ? 'YES (bug)' : 'NO (correct - hidden)'}`);
    report.t7.breeHidden = handoffOnBree === 0;
    await page.screenshot({ path: path.join(OUT, 'T7-bree-no-handoff.png') });
  } else {
    console.log('  No Bree task available — submit one to test');
    report.t7.breeHidden = 'not tested';
  }

  report.t7.consoleErrors = consoleErrors;

  // ── TEST 8: Downloads ────────────────────────────────────────────────
  console.log('\n══ TEST 8: Download Integrity ══');

  // Worker + taskId pairs for download testing
  const downloadTests = [
    ['cleo',    'cover-letter-writer',   taskIds.t1_cleo],
    ['cruz',    'pricing-strategist',    taskIds.t2_cruz],
    ['dale',    'interview-question-writer', taskIds.t3_hiring],
    ['charlie', 'course-outline-builder', taskIds.t4_charlie],
    ['marlo',   'business-plan-writer',  taskIds.t4_marlo],
    ['sam',     'long-form-article-writer', taskIds.t5_sam],
    ['oscar',   'newsletter-writer',     taskIds.t5_oscar],
    ['naru',    'whitepaper-writer',     taskIds.t6_naru],
    ['vera',    'proposal-writer',       taskIds.t8_vera],
    ['jude',    'legal-document-drafter', taskIds.t8_jude],
  ];

  for (const [name, slug, taskId] of downloadTests) {
    if (!taskId) {
      console.log(`\n  ${name}: no taskId available`);
      report.t8[name] = { pdf: 'no taskId', docx: 'no taskId' };
      continue;
    }

    console.log(`\n  ${name} (${slug}) — task ${taskId.slice(0,8)}...`);
    await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${taskId}`);
    await page.waitForTimeout(4000);

    const statusEl = await page.locator('text=Completed').count();
    if (!statusEl) {
      console.log(`  ⚠️  Task not completed or not found`);
      report.t8[name] = { pdf: 'task not completed', docx: 'task not completed' };
      continue;
    }

    // Screenshot the result page
    await page.screenshot({ path: path.join(OUT, `T8-${name}-result.png`) });

    // Try PDF download
    const pdfResult = await downloadFile(page, taskId, 'pdf', `T8-${name}`);
    report.t8[name] = { pdf: pdfResult.downloaded ? 'downloaded' : 'failed' };

    // Check DOCX workers
    const noDocxSlugs = ['lead-generator', 'spreadsheet-builder', 'bookkeeping-summarizer',
      'data-cleaner', 'pitch-deck-writer', 'x-twitter-ghostwriter', 'linkedin-ghostwriter',
      'course-outline-builder'];
    if (!noDocxSlugs.includes(slug)) {
      const docxResult = await downloadFile(page, taskId, 'docx', `T8-${name}`);
      report.t8[name].docx = docxResult.downloaded ? 'downloaded' : 'failed';
    } else {
      report.t8[name].docx = 'N/A for this worker';
    }
  }

  await browser.close();

  // ── Final Report ────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════');
  console.log('TEST 7 — HandoffCards UI');
  console.log('══════════════════════════════════════════');
  console.log('HandoffCards visible on Cleo result:', report.t7.handoffVisible ? '✅ YES' : '❌ NO');
  console.log('Card count:', report.t7.cardCount);
  console.log('Card click → navigation:', report.t7.clickTest?.clicked ? '✅ ' + report.t7.clickTest.navigatedTo : '❌ not clicked');
  console.log('Bree (non-registered) hides HandoffCards:', report.t7.breeHidden === true ? '✅ HIDDEN (correct)' : '❌ ' + report.t7.breeHidden);
  console.log('Console errors:', report.t7.consoleErrors?.length ? '❌ ' + report.t7.consoleErrors.join(' | ') : '✅ None');

  console.log('\n\n══════════════════════════════════════════');
  console.log('TEST 8 — Download Integrity');
  console.log('══════════════════════════════════════════');
  for (const [name, r] of Object.entries(report.t8)) {
    const pdfOk = r.pdf === 'downloaded';
    const docxOk = r.docx === 'downloaded' || r.docx === 'N/A for this worker';
    console.log(`${(pdfOk && docxOk) ? '✅' : '⚠️ '} ${name}: PDF=${r.pdf} | DOCX=${r.docx}`);
  }

  // Save report
  fs.writeFileSync(path.join(OUT, 'playwright-report.json'), JSON.stringify(report, null, 2));
  console.log('\nScreenshots saved to', OUT);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
