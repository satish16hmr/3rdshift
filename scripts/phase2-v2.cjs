/**
 * Phase 2 v2 — verification with corrected selectors
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/phase2-final');
fs.mkdirSync(OUT, { recursive: true });

let n = 0;
async function shot(page, name, ms = 500) {
  await page.waitForTimeout(ms);
  const file = `${OUT}/${String(++n).padStart(2,'0')}-${name}.png`;
  await page.screenshot({ path: file });
  console.log(`📸 ${path.basename(file)}`);
}

async function login(browser, email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(8000);
  return { page, ctx };
}

async function clickBell(page) {
  return await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.dataset?.teamUpdatesBell === 'true' || 
      (b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0));
    if (bell) { bell.click(); return true; }
    return false;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: false });

  // ── OPERATOR ──────────────────────────────────────────────────────────────
  console.log('== Operator ==');
  const { page, ctx } = await login(browser, 'test-roger@3rdshift.ai', '<SCREENSHOT_TEST_PASSWORD>');

  // D1: Dashboard + bell location
  await shot(page, 'D1-operator-dashboard-bell-visible', 0);

  // Check bell
  const bellInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.dataset?.teamUpdatesBell === 'true' ||
      (b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0));
    if (!bell) return { found: false };
    const r = bell.getBoundingClientRect();
    return { found: true, visible: r.width > 0, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
  });
  console.log('Bell:', JSON.stringify(bellInfo));

  // D2: Open panel
  const clicked = await clickBell(page);
  console.log('Clicked bell:', clicked);
  await shot(page, 'D2-operator-notification-panel-open', 1500);

  // D3: Preview text — actual first line
  const panelData = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    if (!panel) return { found: false, text: document.querySelector('h2')?.textContent };
    const rows = panel.querySelectorAll('button.w-full');
    return {
      found: true,
      rowCount: rows.length,
      firstRow: rows[0]?.textContent?.slice(0, 150),
      panelHeader: panel.querySelector('h2')?.textContent,
      tabs: Array.from(panel.querySelectorAll('button')).slice(0, 4).map(b => b.textContent?.trim()),
    };
  });
  console.log('Panel data:', JSON.stringify(panelData, null, 2));

  // D4: Click first notification row
  const navd = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    if (!panel) return { clicked: false, reason: 'no panel' };
    const rows = panel.querySelectorAll('button.w-full');
    if (rows.length === 0) return { clicked: false, reason: 'no rows', panelHTML: panel.innerHTML.slice(0, 200) };
    rows[0].click();
    return { clicked: true, count: rows.length };
  });
  console.log('Nav click:', JSON.stringify(navd));
  await page.waitForTimeout(3000);
  await shot(page, 'D4-operator-after-click-team-chat', 0);
  console.log('URL:', page.url());

  // D5: Badge count
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(5000);
  const badge = await page.evaluate(() => {
    const span = document.querySelector('button[data-team-updates-bell="true"] span') ||
                 document.querySelector('button[aria-label="Notifications"] span.bg-blue-600');
    return { text: span?.textContent?.trim(), found: !!span };
  });
  console.log('Badge:', JSON.stringify(badge));
  await shot(page, 'D5-operator-bell-badge', 0);

  // Open panel, click row to mark read, close, check badge
  await clickBell(page);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    const rows = panel?.querySelectorAll('button.w-full');
    if (rows?.length > 0) rows[0].click();
  });
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(5000);
  const badge2 = await page.evaluate(() => {
    const span = document.querySelector('button[data-team-updates-bell="true"] span') ||
                 document.querySelector('button[aria-label="Notifications"] span.bg-blue-600');
    return { text: span?.textContent?.trim(), found: !!span };
  });
  console.log('Badge after read:', JSON.stringify(badge2));
  await shot(page, 'D5b-operator-bell-badge-after-read', 0);

  // D6: Mark all read
  await clickBell(page);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const markAll = btns.find(b => b.textContent?.includes('Mark all read'));
    if (markAll) markAll.click();
  });
  await page.waitForTimeout(1000);
  await shot(page, 'D6-mark-all-read', 0);

  // 2.7 Chat visual
  await page.goto(`${BASE}/dashboard/workers/ad-copywriter?tab=chat`);
  await page.waitForTimeout(5000);
  await shot(page, 'H1-chat-visual-treatment', 0);

  // H2: Reply to proactive message
  await page.fill('textarea', 'Tell me more about this');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(8000);
  await shot(page, 'H2-reply-to-proactive-suggestion', 0);

  // Settings persistence test
  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    for (const s of sections) {
      if (s.textContent?.includes('Team Updates')) { s.scrollIntoView({ behavior: 'instant', block: 'center' }); break; }
    }
  });
  await shot(page, 'F1-settings-team-updates', 500);

  await ctx.close();

  // ── STARTER ───────────────────────────────────────────────────────────────
  console.log('\n== Starter ==');
  const { page: p2, ctx: ctx2 } = await login(browser, 'test-starter@3rdshift.ai', '<SCREENSHOT_TEST_PASSWORD>');
  await shot(p2, 'E4-starter-dashboard-plan-badge', 0);
  
  const clicked2 = await clickBell(p2);
  console.log('Starter bell clicked:', clicked2);
  await shot(p2, 'E4b-starter-notification-panel', 1500);
  
  const starterPanel = await p2.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    return {
      found: !!panel,
      hasUpgrade: document.body.textContent?.includes('Upgrade to Pro'),
      panelText: panel?.textContent?.slice(0, 300),
    };
  });
  console.log('Starter panel:', JSON.stringify(starterPanel, null, 2));

  await ctx2.close();
  await browser.close();

  console.log(`\nAll screenshots: ${OUT}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
