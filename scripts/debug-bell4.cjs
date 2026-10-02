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

  // What's at the top right of the page (header area)?
  const topRightArea = await page.evaluate(() => {
    // Get elements near y=0 to y=60 (header height)
    const all = document.querySelectorAll('*');
    const headerArea = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.y >= 0 && r.y < 60 && r.x > 400 && r.width > 0 && r.height > 0) {
        headerArea.push({
          tag: el.tagName,
          class: el.className?.slice(0, 60),
          text: el.textContent?.trim().slice(0, 30),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        });
      }
    }
    return headerArea.slice(0, 20);
  });

  console.log('Top-right area elements:');
  topRightArea.forEach(e => console.log(`  ${e.tag}: "${e.text}" at x=${e.rect.x} y=${e.rect.y} (${e.rect.w}x${e.rect.h})`));

  // Check if NotificationBell is in DOM at all
  const bellInDom = await page.evaluate(() => {
    // Look for the bell SVG path
    const paths = document.querySelectorAll('path');
    for (const p of paths) {
      if (p.getAttribute('d')?.includes('M18 8A6 6 0 0 0 6')) {
        return { found: true, parent: p.closest('button')?.className?.slice(0, 60) };
      }
    }
    return { found: false };
  });
  console.log('\nBell SVG in DOM:', JSON.stringify(bellInDom));

  await browser.close();
}
main().catch(console.error);
