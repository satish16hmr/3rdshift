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

  // Find ALL visible buttons on page
  const visibleBtns = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    return Array.from(btns)
      .filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map(b => ({
        ariaLabel: b.getAttribute('aria-label'),
        text: b.textContent?.trim().slice(0, 30),
        rect: b.getBoundingClientRect(),
        class: b.className?.slice(0, 60),
      }));
  });

  console.log(`Found ${visibleBtns.length} visible buttons`);
  visibleBtns.forEach((b, i) => {
    if (b.ariaLabel || b.text) {
      console.log(`  ${i}: "${b.ariaLabel || b.text}" at (${Math.round(b.rect.x)}, ${Math.round(b.rect.y)}) ${Math.round(b.rect.width)}x${Math.round(b.rect.height)}`);
    }
  });

  // Check the SidebarInset element
  const insetInfo = await page.evaluate(() => {
    // Look for the custom header (h-12)
    const customHeader = document.querySelector('[class*="h-12"]');
    if (!customHeader) return 'No h-12 element found';
    const r = customHeader.getBoundingClientRect();
    return { tag: customHeader.tagName, rect: r, html: customHeader.innerHTML.slice(0, 300) };
  });
  console.log('\nCustom header (h-12):', JSON.stringify(insetInfo, null, 2));

  await browser.close();
}
main().catch(console.error);
