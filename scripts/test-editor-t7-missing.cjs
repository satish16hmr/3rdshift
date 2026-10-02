// Quick test: run 4 missing workers and confirm editor appears
const { chromium } = require('/Users/3rdshift/.openclaw/workspace/scripts/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const OUT = path.join(__dirname, '../screenshots/editor-tests-full');
const BASE = 'https://3rdshift.ai';
const EMAIL = 'test-roger@3rdshift.ai';
const PASS = '<SCREENSHOT_TEST_PASSWORD>';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MISSING = [
  { slug: 'newsletter-writer', name: 'Oscar', prompt: 'Weekly newsletter for a digital marketing agency — top AI tools this week' },
  { slug: 'linkedin-ghostwriter', name: 'Elliot', prompt: 'LinkedIn post about how AI is changing hiring in 2026' },
  { slug: 'x-twitter-ghostwriter', name: 'Case', prompt: 'Tweet thread about why small businesses should automate with AI' },
  { slug: 'resume-writer', name: 'Beck', prompt: 'Resume for a senior software engineer with 10 years experience in React and Node.js' },
];

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await b.textContent();
    if (t && t.trim().toLowerCase() === 'log in') { await b.click(); break; }
  }
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  console.log('✅ Logged in');

  const results = {};

  for (const { slug, name, prompt } of MISSING) {
    console.log(`\nTesting ${name} (${slug})...`);
    
    await page.goto(`${BASE}/dashboard/workers/${slug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const textarea = await page.$('textarea');
    if (textarea) await textarea.fill(prompt);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const btns = await page.$$('button');
    for (const b of btns) {
      const t = await b.textContent();
      if (t && !t.toLowerCase().includes('google') && !t.toLowerCase().includes('chat') &&
          (t.includes('→') || t.toLowerCase().match(/write|draft|create|generate|build|run|submit/))) {
        await b.scrollIntoViewIfNeeded();
        await b.click();
        console.log(`  Clicked: ${t.trim()}`);
        break;
      }
    }

    try {
      await page.waitForURL('**/result**', { timeout: 90000 });
    } catch {
      console.log(`  ❌ ${name}: did not navigate to result`);
      results[slug] = false;
      continue;
    }

    // Wait up to 10s for ProseMirror
    let hasEditor = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      hasEditor = !!(await page.$('.ProseMirror'));
      if (hasEditor) break;
      process.stdout.write('.');
    }
    console.log('');

    await page.screenshot({ path: `${OUT}/t7-${slug}.png`, fullPage: false });
    results[slug] = hasEditor;
    console.log(`  ${name}: ${hasEditor ? '✅ editor present' : '❌ NO editor'}`);
  }

  await browser.close();

  console.log('\n══ Test 7 missing workers results ══');
  const passed = Object.values(results).filter(v => v).length;
  const failed = Object.values(results).filter(v => !v).length;
  for (const [slug, ok] of Object.entries(results)) {
    console.log(`  ${ok ? '✅' : '❌'} ${slug}`);
  }
  console.log(`\n${passed}/4 passed | ${failed}/4 failed`);
  if (failed > 0) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
