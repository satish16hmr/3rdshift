const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../screenshots/phase4-audit');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('https://3rdshift.ai/login');
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(6000);

  // H1: ad-copywriter has both proactive and regular messages
  await page.goto('https://3rdshift.ai/dashboard/workers/ad-copywriter?tab=chat');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/H1-chat-visual-proactive-vs-regular.png` });
  console.log('📸 H1-chat-visual-proactive-vs-regular.png (ad-copywriter with both message types)');

  const h1Check = await page.evaluate(() => ({
    hasBlueBg: document.querySelectorAll('[class*="bg-blue-50"]').length,
    hasProactiveLabel: document.body.textContent?.includes('from Tate') || document.body.textContent?.includes('from Sam') || document.body.textContent?.includes('from Ava'),
    hasCTA: document.body.textContent?.includes('Reply below to take action'),
    hasRegularMsg: document.querySelectorAll('[class*="bg-white border border-zinc-200"]').length,
  }));
  console.log('H1 check:', JSON.stringify(h1Check));

  // H3: First-ever chat — insert proactive for a worker with no prior messages
  // Find email-copywriter thread (has proactive message from production cron)
  await page.goto('https://3rdshift.ai/dashboard/workers/email-copywriter?tab=chat');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/H3-email-copywriter-chat.png` });
  console.log('📸 H3-email-copywriter-chat.png');

  await browser.close();
}
main().catch(console.error);
