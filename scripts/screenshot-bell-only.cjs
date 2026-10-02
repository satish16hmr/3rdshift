const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://3rdshift.ai';
const EMAIL = 'test-roger@3rdshift.ai';
const PASSWORD = '<SCREENSHOT_TEST_PASSWORD>';
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/proactive-updates');

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(12000); // extra long wait for session hydration

  // Check if bell badge appeared
  const bellInfo = await page.evaluate(() => {
    // Look for badge in sidebar header
    const badges = document.querySelectorAll('[class*="bg-blue-600"][class*="rounded-full"]');
    const bellBtn = document.querySelector('button[aria-label="Notifications"]');
    const allBtnsInSidebar = document.querySelectorAll('[data-sidebar="header"] button, [class*="SidebarHeader"] button');
    return {
      badgeCount: badges.length,
      bellExists: !!bellBtn,
      bellVisible: bellBtn ? bellBtn.getBoundingClientRect().width > 0 : false,
      bellRect: bellBtn ? bellBtn.getBoundingClientRect() : null,
      sidebarHeaderBtns: allBtnsInSidebar.length,
    };
  });
  console.log('Bell info after 12s:', JSON.stringify(bellInfo, null, 2));
  
  // Screenshot after 12s
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D1-bell-12s-wait.png`, fullPage: false });
  console.log('Screenshot saved: D1-bell-12s-wait.png');

  // Try clicking the bell via any available method
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Notifications"]');
    if (btn && btn.getBoundingClientRect().width > 0) {
      btn.click();
      return 'clicked';
    }
    // Try sidebar area
    const sidebarHeader = document.querySelector('.px-4.py-3'); // SidebarHeader className
    if (sidebarHeader) {
      const btns = sidebarHeader.querySelectorAll('button');
      btns.forEach(b => { if (b.getAttribute('aria-label') === 'Notifications') b.click(); });
      return 'clicked via sidebar header';
    }
    return 'not found';
  });
  console.log('Click result:', clicked);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D2-bell-panel-12s.png`, fullPage: false });
  console.log('Screenshot saved: D2-bell-panel-12s.png');

  await browser.close();
}
main().catch(console.error);
