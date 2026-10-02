const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../screenshots/six-final');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('JS error:', e.message.slice(0, 80)));

  await page.goto('https://3rdshift.ai/login');
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(9000);

  // Find the desktop bell in sidebar header
  const bellInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0);
    if (!bell) return { found: false };
    const r = bell.getBoundingClientRect();
    return { found: true, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log('Desktop bell:', bellInfo);

  if (!bellInfo.found) {
    console.log('Bell not found at 1440px — checking DOM...');
    const all = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-label="Notifications"]')).map(e => ({
      tag: e.tagName, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height)
    })));
    console.log('All Notifications elements:', all);
    await page.screenshot({ path: `${OUT}/DESKTOP-no-bell.png` });
    await ctx.close();
    await browser.close();
    return;
  }

  // Click it
  await page.evaluate(() => {
    document.querySelector('[aria-label="Notifications"]')?.click();
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/1-desktop-panel-open.png` });
  console.log('📸 1-desktop-panel-open (1440px)');

  const panelCheck = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    return { found: !!panel, rows: panel?.querySelectorAll('button.w-full').length, text: panel?.textContent?.slice(100, 200) };
  });
  console.log('Panel:', panelCheck);

  await ctx.close();
  await browser.close();
}
main().catch(e => { console.error(e.message); process.exit(1); });
