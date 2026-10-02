/**
 * Screenshot Resend dashboard + email HTML preview
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const OUT = path.join(__dirname, '../screenshots/final-verify');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Go to Resend dashboard
  await page.goto('https://resend.com/emails');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/ITEM1-A2-resend-dashboard.png` });
  console.log('📸 ITEM1-A2-resend-dashboard');
  
  // Try to find the digest email
  const emailText = await page.evaluate(() => document.body.textContent?.slice(0, 500));
  console.log('Resend page content:', emailText?.slice(0, 200));

  await browser.close();
}
main().catch(e => console.error(e.message));
