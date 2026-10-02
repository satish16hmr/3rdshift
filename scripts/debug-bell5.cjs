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
  await page.waitForTimeout(10000);

  // Count ALL elements in page
  const info = await page.evaluate(() => {
    // Look for "relative flex h-8 w-8" (bell button classes)
    const btns = document.querySelectorAll('button');
    const bellBtns = Array.from(btns).filter(b => 
      b.className?.includes('h-8') && b.className?.includes('w-8')
    );
    
    // Also look for 'data-bell' or bell-specific wrapper
    const notifDivs = document.querySelectorAll('[class*="notification"]');
    
    // Find ANY button with SVG containing path with M18
    const bellSvgBtns = Array.from(btns).filter(b => {
      const svg = b.querySelector('svg');
      if (!svg) return false;
      const paths = svg.querySelectorAll('path');
      return Array.from(paths).some(p => p.getAttribute('d')?.startsWith('M18'));
    });

    return {
      totalButtons: btns.length,
      bellClassBtns: bellBtns.map(b => ({ class: b.className?.slice(0, 80), ariaLabel: b.getAttribute('aria-label'), rect: b.getBoundingClientRect() })),
      bellSvgBtns: bellSvgBtns.map(b => ({ ariaLabel: b.getAttribute('aria-label'), rect: b.getBoundingClientRect() })),
      notifDivs: notifDivs.length,
      // Check if NotificationBell component is mounted
      bodyHtml: document.body.innerHTML.includes('aria-label="Notifications"') ? 'bell aria-label found in HTML' : 'NOT found',
    };
  });

  console.log('Bell debug info:', JSON.stringify(info, null, 2));

  // Full page screenshot to see what's visible
  await page.screenshot({ path: '/tmp/fullpage-bell.png', fullPage: true });
  console.log('Full page screenshot saved to /tmp/fullpage-bell.png');

  await browser.close();
}
main().catch(console.error);
