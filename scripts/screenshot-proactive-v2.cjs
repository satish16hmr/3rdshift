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
  const context = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });

  // Force sidebar open by setting cookie
  await page.evaluate(() => {
    document.cookie = 'sidebar_state=true; path=/; max-age=604800';
  });

  // Reload to apply cookie
  await page.reload();
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(8000); // wait for session + bell hydration

  // D1: Dashboard with bell badge
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D1-notification-bell-badge.png` });
  console.log('✅ D1: Dashboard with notification bell');

  // Check bell state
  const bellInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.getAttribute('aria-label') === 'Notifications');
    if (!bell) return { found: false };
    const r = bell.getBoundingClientRect();
    return { found: true, visible: r.width > 0, rect: r, parent: bell.parentElement?.className?.slice(0, 60) };
  });
  console.log('Bell state:', JSON.stringify(bellInfo));

  // Click bell via JS
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.getAttribute('aria-label') === 'Notifications');
    if (bell) bell.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D2-notification-panel-open.png` });
  console.log('✅ D2: Notification panel open');

  // Navigate to Team Chat (Ash) to see proactive message
  await page.goto(`${BASE_URL}/dashboard/workers/social-media-manager?tab=chat`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/D4-proactive-message-in-chat.png` });
  console.log('✅ D4: Proactive message in Team Chat');

  // Settings
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    for (const s of sections) {
      if (s.textContent?.includes('Team Updates')) {
        s.scrollIntoView({ behavior: 'instant', block: 'center' });
        break;
      }
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/F1-settings-team-updates.png` });
  console.log('✅ F1: Settings Team Updates section');

  console.log(`\nAll screenshots saved to ${SCREENSHOTS_DIR}`);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
