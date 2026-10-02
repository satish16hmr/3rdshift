const { chromium } = require('/Users/3rdshift/.openclaw/workspace/scripts/node_modules/playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('screenshots/editor-test', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Login via 3rdshift.ai email/password form
  await page.goto('https://3rdshift.ai/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  // Check if we got redirected to Google
  const url = page.url();
  if (url.includes('google.com') || url.includes('accounts.google')) {
    console.log('Redirected to Google OAuth - navigating back to /login');
    await page.goto('https://3rdshift.ai/login');
    await page.waitForLoadState('networkidle');
  }
  
  await page.screenshot({ path: 'screenshots/editor-test/00-login-page.png' });
  
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  
  // Click 'Log in' button (not Google)
  const allBtns = await page.$$('button');
  let clicked = false;
  for (const b of allBtns) {
    const t = await b.textContent();
    if (t && t.trim().toLowerCase() === 'log in') {
      await b.click();
      clicked = true;
      console.log(`Clicked: ${t.trim()}`);
      break;
    }
  }
  if (!clicked) {
    // fallback: click the submit button that is NOT the Google button
    for (const b of allBtns) {
      const t = await b.textContent();
      if (t && !t.toLowerCase().includes('google') && (t.toLowerCase().includes('sign') || t.toLowerCase().includes('log'))) {
        await b.click();
        console.log(`Fallback clicked: ${t.trim()}`);
        break;
      }
    }
  }
  
  try {
    await page.waitForURL('**/dashboard**', { timeout: 20000 });
    console.log('✅ Logged in');
  } catch {
    await page.screenshot({ path: 'screenshots/editor-test/00-login-fail.png' });
    console.log('❌ Login failed, see screenshot');
    await browser.close();
    return;
  }

  // Navigate to Sam's form
  await page.goto('https://3rdshift.ai/dashboard/workers/long-form-article-writer');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/editor-test/01-sam-form.png', fullPage: false });
  console.log('📸 01-sam-form.png');

  // Fill first textarea
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.fill('The future of AI in small businesses');
    console.log('✅ Filled textarea');
  }

  // Scroll to bottom and click submit/run button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  
  const buttons = await page.$$('button');
  let submitClicked = false;
  for (const b of buttons) {
    const text = await b.textContent();
    if (text && (text.includes('Run') || text.includes('Submit') || text.includes('Generate') || text.includes('Write') || text.includes('Create'))) {
      await b.scrollIntoViewIfNeeded();
      await b.click();
      console.log(`✅ Clicked: ${text.trim()}`);
      submitClicked = true;
      break;
    }
  }
  if (!submitClicked) {
    // Last resort: click any visible blue/primary button that isn't navigation
    await page.screenshot({ path: 'screenshots/editor-test/01b-before-submit.png' });
    console.log('📸 01b-before-submit.png — could not find submit button');
  }

  // Wait for result URL (articles take up to 90s)
  try {
    await page.waitForURL('**/result**', { timeout: 120000 });
    console.log('✅ On result page');
  } catch {
    await page.screenshot({ path: 'screenshots/editor-test/02-no-result.png' });
    console.log('❌ Did not navigate to result in 120s');
    await browser.close();
    return;
  }

  // Wait for completion (poll 60s)
  let hasEditor = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    hasEditor = !!(await page.$('[data-tiptap-editor]'));
    const done = await page.$('.prose, [class*="ProseMirror"]');
    if (hasEditor || done) { console.log('✅ Content appeared'); break; }
    process.stdout.write('.');
  }
  console.log('');

  await page.screenshot({ path: 'screenshots/editor-test/02-sam-result.png', fullPage: false });
  console.log('📸 02-sam-result.png');

  const editorDom = await page.$('[data-tiptap-editor]');
  console.log(editorDom ? '✅ Tiptap [data-tiptap-editor] found' : '⚠️  data-tiptap-editor not found — checking ProseMirror');
  const prosemirror = await page.$('.ProseMirror');
  console.log(prosemirror ? '✅ .ProseMirror found — editor IS rendering' : '❌ No ProseMirror');

  // Scroll down to see more
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.screenshot({ path: 'screenshots/editor-test/03-sam-result-scrolled.png', fullPage: false });
  console.log('📸 03-sam-result-scrolled.png');

  await browser.close();
  console.log('Done!');
})().catch(e => { console.error(e); process.exit(1); });
