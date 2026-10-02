const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE_URL = 'https://3rdshift.ai';
const EMAIL = 'test-roger@3rdshift.ai';
const PASSWORD = '<SCREENSHOT_TEST_PASSWORD>';
const OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408';

fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1. Dashboard home
  await page.screenshot({ path: `${OUT_DIR}/01-dashboard-home.png`, fullPage: false });
  console.log('1. Dashboard home captured');

  // 2. Settings page
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/02-settings.png`, fullPage: true });
  console.log('2. Settings captured');

  // 3. My Tasks
  await page.goto(`${BASE_URL}/dashboard/tasks`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/03-my-tasks.png`, fullPage: false });
  console.log('3. My Tasks captured');

  // 4. Team/Workers grid
  await page.goto(`${BASE_URL}/dashboard/team`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/04-team-workers.png`, fullPage: false });
  console.log('4. Team/Workers captured');

  // 5. Workflows page
  await page.goto(`${BASE_URL}/dashboard/workflows`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/05-workflows.png`, fullPage: false });
  console.log('5. Workflows captured');

  // 6. Task result page (click first task if exists)
  await page.goto(`${BASE_URL}/dashboard/tasks`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const firstTask = await page.$('a[href*="/dashboard/tasks/"]');
  if (firstTask) {
    await firstTask.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT_DIR}/06-task-result.png`, fullPage: false });
    console.log('6. Task result captured');
  } else {
    await page.goto(`${BASE_URL}/dashboard/team/content-writer`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT_DIR}/06-worker-form-fallback.png`, fullPage: false });
    console.log('6. Worker form fallback captured');
  }

  await browser.close();
  console.log(`\nDone. All screenshots in: ${OUT_DIR}`);
})();
