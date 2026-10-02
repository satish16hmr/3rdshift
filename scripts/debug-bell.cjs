const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const fs = require('fs');

const BASE_URL = 'https://3rdshift.ai';
const EMAIL = 'test-roger@3rdshift.ai';
const PASSWORD = '<SCREENSHOT_TEST_PASSWORD>';

async function main() {
  const browser = await chromium.launch({ headless: false }); // visible for debugging
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(6000); // let everything hydrate

  // Inspect the header
  const headerContent = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return 'no header found';
    const buttons = header.querySelectorAll('button');
    const info = [];
    buttons.forEach((btn, i) => {
      info.push({
        i,
        ariaLabel: btn.getAttribute('aria-label'),
        text: btn.textContent?.slice(0, 50),
        visible: btn.offsetParent !== null,
        rect: btn.getBoundingClientRect()
      });
    });
    return { buttons: info, html: header.innerHTML.slice(0, 500) };
  });
  
  console.log('Header content:', JSON.stringify(headerContent, null, 2));

  await page.screenshot({ path: '/tmp/bell-debug.png', fullPage: false });
  await browser.close();
}

main().catch(console.error);
