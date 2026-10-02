const { chromium } = require('/Users/3rdshift/.openclaw/workspace/scripts/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../screenshots/editor-tests-full');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Log into WordPress admin
  await page.goto('http://localhost:8765/wp-login.php');
  await page.waitForLoadState('networkidle');
  await page.fill('#user_login', 'admin');
  await page.fill('#user_pass', 'admin123');
  await page.click('#wp-submit');
  await page.waitForURL('**/wp-admin/**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Go to the posts list
  await page.goto('http://localhost:8765/wp-admin/edit.php');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/t1-wp-posts-list.png`, fullPage: false });
  console.log('📸 t1-wp-posts-list.png');

  // Open the most recent post (post ID 5)
  await page.goto('http://localhost:8765/wp-admin/post.php?post=5&action=edit');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/t1-wp-post-editor.png`, fullPage: false });
  console.log('📸 t1-wp-post-editor.png');

  // Check the post content contains our marker
  const pageText = await page.evaluate(() => document.body.innerText);
  const hasMarker = pageText.includes('WP_EDIT_TEST_');
  console.log(hasMarker ? '✅ Marker visible in WP editor' : '⚠️  Marker not visible in WP editor (may be in code view)');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
