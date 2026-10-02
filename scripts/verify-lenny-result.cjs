const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../screenshots/lenny-final');

const TASK_ID = '90c75167-4d7c-4ac1-b829-3aefb3e604ae';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('JS err:', e.message.slice(0, 60)));

  await p.goto('https://3rdshift.ai/login');
  await p.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await p.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await p.waitForTimeout(400);
  await p.click('button:has-text("Log in")');
  await p.waitForURL('**/dashboard**', { timeout: 20000 });
  await p.waitForTimeout(3000);

  // Navigate to correct result URL
  await p.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${TASK_ID}`);
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${OUT}/VERIFIED-lenny-result-page.png` });
  console.log('📸 VERIFIED-lenny-result-page');

  const check = await p.evaluate(() => ({
    title: document.querySelector('h1, h2, h3')?.textContent?.slice(0, 50),
    hasTable: !!document.querySelector('table'),
    hasLeads: document.body.textContent?.includes('Head of Growth') || document.body.textContent?.includes('VP Marketing') || document.body.textContent?.includes('Name'),
    is404: document.body.textContent?.includes('Page not found') || document.body.textContent?.includes('404'),
    bodyPreview: document.body.textContent?.slice(200, 400),
  }));
  console.log('Result page check:', JSON.stringify(check, null, 2));

  // Also screenshot Lenny chat with button
  await p.goto('https://3rdshift.ai/dashboard/workers/lead-generator?tab=chat');
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `${OUT}/VERIFIED-lenny-chat-button.png` });
  console.log('📸 VERIFIED-lenny-chat-button');

  await ctx.close();
  await browser.close();
  console.log('Done.');
}
main().catch(e => { console.error(e.message); process.exit(1); });
