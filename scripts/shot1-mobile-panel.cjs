const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../screenshots/six-final');

async function main() {
  const browser = await chromium.launch({ headless: false });
  
  // Mobile viewport where the bell + panel are in the navbar
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 14 size
  const page = await ctx.newPage();

  await page.goto('https://3rdshift.ai/login');
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(8000);

  // Find and click the bell in mobile navbar
  const bellInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0);
    if (bell) {
      const r = bell.getBoundingClientRect();
      bell.click();
      return { found: true, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
    }
    return { found: false };
  });
  console.log('Bell (mobile):', bellInfo);
  await page.waitForTimeout(2500);
  
  // Take full shot
  await page.screenshot({ path: `${OUT}/1-notification-panel-all-6-workers.png` });
  console.log('📸 1-notification-panel-all-6-workers (mobile)');

  const panelInfo = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    const rows = panel?.querySelectorAll('button.w-full');
    return {
      panelFound: !!panel,
      rowCount: rows?.length,
      firstRow: rows?.[0]?.textContent?.slice(0, 60),
      hasSkip: panel?.textContent?.includes('SKIP'),
    };
  });
  console.log('Panel:', panelInfo);

  // Click a suggestion
  if (panelInfo.rowCount > 0) {
    await page.evaluate(() => {
      const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
      // Click Lenny or first row
      const rows = Array.from(panel.querySelectorAll('button.w-full'));
      const lennyRow = rows.find(r => r.textContent?.includes('Lenny') || r.textContent?.includes('5 founder'));
      (lennyRow || rows[0])?.click();
    });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/2-clicked-through-to-team-chat.png` });
    console.log('📸 2-clicked-through-to-team-chat');
    console.log('URL:', page.url());
  }

  await ctx.close();
  await browser.close();
}
main().catch(console.error);
