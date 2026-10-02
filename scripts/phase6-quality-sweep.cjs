/**
 * Phase 6 Quality Sweep — real browser screenshots
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/phase6');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log(`  📸 ${name}`);
  return file;
}

async function login(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await p.waitForTimeout(400);
  await p.click('button:has-text("Log in")');
  await p.waitForURL('**/dashboard**', { timeout: 20000 });
  await p.waitForTimeout(7000);
  return { page: p, ctx };
}

async function clickBell(page) {
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.dataset?.teamUpdatesBell === 'true' ||
      (b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0));
    if (bell) bell.click();
  });
  await page.waitForTimeout(2000);
}

async function main() {
  const browser = await chromium.launch({ headless: false });

  // Quality sweep data
  const { data: allSugs } = await supabase
    .from('team_updates')
    .select('worker_slug, suggestion_type, suggestion_text, source_data, preview_text')
    .order('created_at', { ascending: false });

  console.log('\n=== PHASE 6 QUALITY SWEEP ===\n');
  console.log('Notifications in DB:', allSugs?.length);

  let allPass = true;
  for (const s of allSugs || []) {
    const isExternal = ['seo-strategist', 'social-media-manager', 'lead-generator'].includes(s.worker_slug);
    const needsSource = isExternal;
    const hasSource = !!s.source_data;
    const text = s.suggestion_text || '';
    const isSpecific = text.length > 50 &&
      !text.toLowerCase().startsWith('skip') &&
      !text.toLowerCase().includes('i need more') &&
      !text.toLowerCase().includes('could you share') &&
      !text.toLowerCase().includes('here\'s your actionable');
    const sourcePassed = !needsSource || hasSource;
    const verdict = isSpecific && sourcePassed ? 'PASS' : 'FAIL';
    if (verdict === 'FAIL') allPass = false;
    console.log(`[${s.worker_slug}] ${s.suggestion_type}: ${verdict}`);
    console.log(`  "${text.slice(0, 100)}"`);
    if (needsSource) console.log(`  source_data: ${hasSource ? 'YES' : 'NULL'}`);
    console.log();
  }
  console.log('Overall:', allPass ? '✅ ALL PASS' : '❌ SOME FAIL');

  // Browser screenshots
  const { page, ctx } = await login(browser, 'test-roger@3rdshift.ai');

  // 1. Dashboard with notification badge
  await shot(page, '01-dashboard-notification-badge');

  // 2. Bell panel with Ava notification
  await clickBell(page);
  await shot(page, '02-notification-panel-ava-message');

  const panelData = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    return {
      rows: panel?.querySelectorAll('button.w-full').length,
      text: panel?.textContent?.slice(0, 300),
      hasSkip: panel?.textContent?.includes('SKIP'),
    };
  });
  console.log('Panel rows:', panelData.rows, '| hasSkip:', panelData.hasSkip);

  // 3. Click Ava notification → lands in content-writer chat with ⭐ message
  await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    panel?.querySelector('button.w-full')?.click();
  });
  await page.waitForTimeout(4000);
  await shot(page, '03-ava-message-in-chat');
  console.log('Ava chat URL:', page.url());

  // 4. Settings — verify Team Updates section
  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('section')).find(x => x.textContent?.includes('Team Updates'));
    s?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(500);
  await shot(page, '04-settings-team-updates');

  await ctx.close();

  // Log the quality sweep summary
  const sweepSummary = allSugs?.map(s => ({
    worker: s.worker_slug,
    type: s.suggestion_type,
    text: s.suggestion_text?.slice(0, 80),
    hasSource: !!s.source_data,
    verdict: s.suggestion_text?.length > 50 && !s.suggestion_text?.toLowerCase().startsWith('skip') ? 'PASS' : 'FAIL',
  }));
  fs.writeFileSync(`${OUT}/quality-sweep.json`, JSON.stringify(sweepSummary, null, 2));

  await browser.close();
  console.log(`\nAll screenshots: ${OUT}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
