const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../screenshots/phase2-final');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('https://3rdshift.ai/login');
  await page.fill('input[type="email"]', 'test-starter@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(8000);

  // Screenshot dashboard showing Starter badge + bell with badge
  await page.screenshot({ path: `${OUT}/E4-starter-dashboard-with-badge.png` });
  console.log('📸 E4-starter-dashboard-with-badge');

  // Open bell panel
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.dataset?.teamUpdatesBell === 'true' || (b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0));
    if (bell) bell.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/E4b-starter-panel-with-notification.png` });
  console.log('📸 E4b-starter-panel-with-notification');

  const panelInfo = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    return {
      found: !!panel,
      hasUpgrade: document.body.textContent?.includes('Upgrade to Pro'),
      text: panel?.textContent?.slice(0, 300),
    };
  });
  console.log('Panel:', JSON.stringify(panelInfo, null, 2));

  await browser.close();
}
main().catch(console.error);
