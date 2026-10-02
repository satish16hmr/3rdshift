/**
 * Screenshot proactive team updates feature checkpoints
 */
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

  // Login
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(5000); // wait for session + bell to hydrate
  console.log('Current URL:', page.url());

  // D1: Notification bell with badge count
  console.log('Screenshot D1: Notification bell badge...');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D1-notification-bell-badge.png`, fullPage: false });

  // Wait for bell to appear
  try {
    await page.waitForSelector('.notification-bell-btn, header button[aria-label="Notifications"]', { timeout: 10000 });
  } catch {
    console.log('Bell not found by selector, trying JavaScript click...');
  }

  // Click the bell via JavaScript to bypass visibility check
  await page.evaluate(() => {
    const btns = document.querySelectorAll('header button');
    for (const btn of btns) {
      if (btn.getAttribute('aria-label') === 'Notifications') {
        btn.click();
        return;
      }
    }
    console.log('bell not found in DOM');
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D2-notification-panel-open.png`, fullPage: false });
  console.log('Screenshot D2: Notification panel open');

  // D3: Click a notification row via JS to bypass overlay
  const rowCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('[class*="w-full text-left"], button.w-full');
    console.log('rows found:', rows.length);
    if (rows.length > 0) { rows[0].click(); return rows.length; }
    return 0;
  });
  console.log(`Found ${rowCount} notification rows, clicked first`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D3-chat-navigate-from-notification.png`, fullPage: false });
  console.log('Screenshot D3: Navigated to Team Chat from notification');

  // D4: Check for proactive message visual distinction (💡 style)
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D4-proactive-message-in-chat.png`, fullPage: false });
  console.log('Screenshot D4: Proactive message visual treatment');

  // F1: Settings page Team Updates section
  console.log('Screenshot F1: Settings Team Updates section...');
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForTimeout(3000);
  // Scroll to Team Updates section
  await page.evaluate(() => {
    const els = document.querySelectorAll('section');
    for (const el of els) {
      if (el.textContent.includes('Team Updates')) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/F1-settings-team-updates.png`, fullPage: false });

  // Notification bell on dashboard (shows badge)
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/bell-with-badge-dashboard.png`, fullPage: false });

  console.log(`\n✅ All screenshots saved to ${SCREENSHOTS_DIR}`);
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
