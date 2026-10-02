/**
 * Final V20 visual screenshots
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/v20-final');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, scroll = false) {
  if (scroll) await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`📸 ${name}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Set sidebar open cookie before login
  await page.goto(BASE);
  await page.evaluate(() => { document.cookie = 'sidebar_state=true; path=/; max-age=604800'; });

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.evaluate(() => { document.cookie = 'sidebar_state=true; path=/; max-age=604800'; });
  await page.waitForTimeout(6000);

  // 1. Dashboard — shows Recent Chats with 💡 previews
  await shot(page, '01-dashboard-with-proactive-chats');

  // 2. Sam's chat with proactive message
  await page.goto(`${BASE}/dashboard/workers/long-form-article-writer?tab=chat`);
  await page.waitForTimeout(5000);
  await shot(page, '02-sam-proactive-message-in-chat');

  // 3. Ash's chat
  await page.goto(`${BASE}/dashboard/workers/social-media-manager?tab=chat`);
  await page.waitForTimeout(5000);
  await shot(page, '03-ash-proactive-message-in-chat');

  // 4. Lenny's chat (lead generator alert)
  await page.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await page.waitForTimeout(5000);
  await shot(page, '04-lenny-proactive-message-in-chat');

  // 5. Kai's chat (SEO alert)
  await page.goto(`${BASE}/dashboard/workers/seo-strategist?tab=chat`);
  await page.waitForTimeout(5000);
  await shot(page, '05-kai-proactive-message-in-chat');

  // 6. Settings — Team Updates section
  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    for (const s of sections) {
      if (s.textContent?.includes('Team Updates')) {
        s.scrollIntoView({ behavior: 'instant', block: 'center' });
        break;
      }
    }
  });
  await page.waitForTimeout(800);
  await shot(page, '06-settings-team-updates-section');

  // 7. Settings — toggle OFF a worker, screenshot
  await page.evaluate(() => {
    // Click Ash's toggle (social-media-manager)
    const buttons = document.querySelectorAll('button');
    let ashToggle = null;
    for (const b of buttons) {
      if (b.className?.includes('rounded-full') && b.previousElementSibling?.textContent?.includes('Ash')) {
        ashToggle = b; break;
      }
    }
    if (ashToggle) ashToggle.click();
  });
  await page.waitForTimeout(500);
  await shot(page, '07-settings-ash-toggle-off');

  // 8. Billing page (starter upsell context)  
  await page.goto(`${BASE}/dashboard/settings/billing`);
  await page.waitForTimeout(4000);
  await shot(page, '08-billing-page');

  await browser.close();

  // Login as starter to test upsell
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/login`);
  await page2.fill('input[type="email"]', 'test-starter@3rdshift.ai');
  await page2.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page2.waitForTimeout(500);
  await page2.click('button:has-text("Log in")');
  await page2.waitForURL('**/dashboard**', { timeout: 20000 });
  await page2.waitForTimeout(5000);
  await page2.screenshot({ path: `${OUT}/09-starter-dashboard.png` });
  console.log('📸 09-starter-dashboard (starter account)');
  await ctx2.close();

  console.log(`\n✅ All screenshots saved to ${OUT}`);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
