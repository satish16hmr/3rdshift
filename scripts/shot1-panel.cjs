const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../screenshots/six-final');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('https://3rdshift.ai/login');
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(9000);

  // Debug: find all visible buttons and what's near the top-right
  const btns = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button'));
    return all
      .filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.y < 100; })
      .map(b => ({ text: b.textContent?.trim().slice(0, 30), ariaLabel: b.getAttribute('aria-label'), x: Math.round(b.getBoundingClientRect().x), y: Math.round(b.getBoundingClientRect().y), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
  });
  console.log('Visible top buttons:', JSON.stringify(btns, null, 2));

  // Try clicking by position (top-right area where bell should be in Catalyst navbar)
  const bellClicked = await page.evaluate(() => {
    // The Catalyst layout has a navbar at the top. Find the bell SVG path.
    const svgs = document.querySelectorAll('path');
    for (const path of svgs) {
      if (path.getAttribute('d')?.includes('M18 8A6') || path.getAttribute('d')?.includes('M10 2a5')) {
        const btn = path.closest('button');
        if (btn && btn.getBoundingClientRect().width > 0) {
          btn.click();
          return { clicked: true, ariaLabel: btn.getAttribute('aria-label'), x: Math.round(btn.getBoundingClientRect().x) };
        }
      }
    }
    return { clicked: false };
  });
  console.log('Bell click via SVG path:', bellClicked);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/1-notification-panel-all-6-workers.png` });
  console.log('📸 1-notification-panel-all-6-workers');

  // If panel didn't open, try clicking NavbarItem
  const panelVisible = await page.evaluate(() => !!document.querySelector('[class*="fixed inset-y-0 right-0"]'));
  console.log('Panel visible:', panelVisible);

  if (!panelVisible) {
    // Find any button in the top navigation area
    await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('a, button'));
      for (const el of allBtns) {
        const r = el.getBoundingClientRect();
        // Top-right corner area where notification bell should be
        if (r.y < 80 && r.x > 1200 && r.width > 0) {
          console.log('Clicking top-right element:', el.tagName, el.textContent?.slice(0, 20), r.x, r.y);
          el.click();
          break;
        }
      }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/1b-panel-retry.png` });
    console.log('📸 1b-panel-retry');
  }

  await ctx.close();
  await browser.close();
}
main().catch(console.error);
