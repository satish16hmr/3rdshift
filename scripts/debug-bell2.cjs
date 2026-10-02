const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');

const BASE_URL = 'https://3rdshift.ai';
const EMAIL = 'test-roger@3rdshift.ai';
const PASSWORD = '<SCREENSHOT_TEST_PASSWORD>';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(8000);

  // Find ALL headers in the DOM
  const allHeaders = await page.evaluate(() => {
    const headers = document.querySelectorAll('header');
    return Array.from(headers).map((h, i) => ({
      i,
      class: h.className.slice(0, 80),
      rect: h.getBoundingClientRect(),
      childButtons: h.querySelectorAll('button').length,
      innerHTML: h.innerHTML.slice(0, 200),
    }));
  });

  console.log('ALL HEADERS:', JSON.stringify(allHeaders, null, 2));

  // Find ALL buttons on the page with aria-label=Notifications
  const allBells = await page.evaluate(() => {
    const btns = document.querySelectorAll('button[aria-label="Notifications"]');
    return Array.from(btns).map((b, i) => ({
      i,
      rect: b.getBoundingClientRect(),
      visible: b.offsetParent !== null,
      parent: b.parentElement?.className?.slice(0, 80),
    }));
  });
  console.log('ALL BELL BUTTONS:', JSON.stringify(allBells, null, 2));

  await browser.close();
}
main().catch(console.error);
