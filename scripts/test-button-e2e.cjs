/**
 * End-to-end test: click Run Lenny → wait for results → confirm result page
 * Same flow a real customer would experience
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const OUT = path.join(__dirname, '../screenshots/lenny-e2e');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message.slice(0, 80)));

  // Login
  await page.goto('https://3rdshift.ai/login');
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(7000);

  // Go to Lenny chat
  await page.goto('https://3rdshift.ai/dashboard/workers/lead-generator?tab=chat');
  await page.waitForTimeout(7000);
  console.log('JS errors after load:', jsErrors);

  // Step 1: Screenshot — button visible
  await page.screenshot({ path: `${OUT}/1-before-click.png` });
  console.log('📸 1-before-click');

  const btn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run Lenny'));
    return { found: !!b, text: b?.textContent?.trim(), disabled: b?.disabled };
  });
  console.log('Button:', btn);

  if (!btn.found) {
    console.log('❌ Button not found');
    await ctx.close();
    await browser.close();
    return;
  }

  // Step 2: Click button using Playwright native click
  console.log('\nClicking Run Lenny button...');
  const runBtn = page.locator('button').filter({ hasText: 'Run Lenny' }).first();
  await runBtn.scrollIntoViewIfNeeded();
  await runBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/2-loading-state.png` });
  console.log('📸 2-loading-state');

  // Step 3: Wait for navigation to result page (execute-task takes 10-30s)
  console.log('Waiting for navigation to result page...');
  try {
    await page.waitForURL('**/tasks/result**', { timeout: 60000 });
    console.log('✅ Navigated to result page:', page.url());
  } catch {
    console.log('Navigation timeout — checking current state');
    await page.screenshot({ path: `${OUT}/2b-timeout-state.png` });
    console.log('Current URL:', page.url());
  }

  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/3-result-page.png` });
  console.log('📸 3-result-page');

  // Step 4: Verify result page
  const result = await page.evaluate(() => {
    const is404 = document.body.textContent?.includes('Page not found') || document.body.textContent?.includes('404');
    const hasLeads = document.body.textContent?.includes('Head of Growth') ||
                     document.body.textContent?.includes('VP Marketing') ||
                     document.body.textContent?.includes('Name | Job Title');
    const hasCompleted = document.body.textContent?.includes('Completed');
    const hasTable = !!document.querySelector('table') || document.body.textContent?.includes('| Name |');
    return { is404, hasLeads, hasCompleted, hasTable, url: window.location.href };
  });
  console.log('\nResult:', result);

  if (result.is404) {
    console.log('❌ FAIL: 404 page');
  } else if (!result.hasLeads) {
    console.log('❌ FAIL: No leads visible');
  } else {
    console.log('✅ PASS: Real leads on result page');
  }

  // Check credits were deducted
  const { data: prof } = await supabase.from('profiles').select('heavy_credits_remaining').eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162').single();
  console.log('Credits remaining:', prof?.heavy_credits_remaining, '(started at 50, should be 45)');

  await ctx.close();
  await browser.close();
  console.log('\nDone. Screenshots in', OUT);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
