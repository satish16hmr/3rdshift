const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/final-5');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log(`📸 ${name}`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await p.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await p.waitForTimeout(400);
  await p.click('button:has-text("Log in")');
  await p.waitForURL('**/dashboard**', { timeout: 20000 });
  await p.waitForTimeout(7000);

  const workers = [
    { slug: 'long-form-article-writer', name: 'Sam' },
    { slug: 'email-copywriter', name: 'Mira' },
    { slug: 'ad-copywriter', name: 'Tate' },
    { slug: 'seo-strategist', name: 'Kai' },
    { slug: 'social-media-manager', name: 'Ash' },
    { slug: 'lead-generator', name: 'Lenny' },
  ];

  for (const w of workers) {
    await p.goto(`${BASE}/dashboard/workers/${w.slug}?tab=chat`);
    await p.waitForTimeout(6000);
    await shot(p, `ITEM4-${w.name}-chat`);
    const check = await p.evaluate(() => ({
      hasSuggestion: document.querySelectorAll('[class*="bg-blue-50"]').length,
      hasRunLenny: document.body.textContent?.includes('Run Lenny'),
      error: document.body.textContent?.includes('Application error'),
    }));
    console.log(`  ${w.name}: blueBg=${check.hasSuggestion} runLenny=${check.hasRunLenny} error=${check.error}`);
  }

  // Lenny specifically — check button and click it
  console.log('\nLenny routing test...');
  await p.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await p.waitForTimeout(6000);
  await shot(p, 'ITEM1-lenny-button-visible');
  
  const lennyBtn = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.textContent?.includes('Run Lenny'));
    return { found: !!b, text: b?.textContent?.trim() };
  });
  console.log('Run Lenny button:', lennyBtn);

  if (lennyBtn.found) {
    await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      btns.find(b => b.textContent?.includes('Run Lenny'))?.click();
    });
    await p.waitForTimeout(3000);
    await shot(p, 'ITEM1-lenny-form-prefilled');
    const formState = await p.evaluate(() => {
      const activeTab = document.querySelector('[class*="border-b-2 border-blue-"]')?.textContent;
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return { activeTab, fields: inputs.map(i => ({ name: i.name, value: i.value })).filter(f => f.value) };
    });
    console.log('Form state after click:', JSON.stringify(formState));
  }

  // Settings with Ava toggle
  await p.goto(`${BASE}/dashboard/settings`);
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    const s = Array.from(document.querySelectorAll('section')).find(x => x.textContent?.includes('Team Updates'));
    s?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await p.waitForTimeout(500);
  await shot(p, 'ITEM3-settings-with-ava-toggle');

  // Ava milestone
  await p.goto(`${BASE}/dashboard/workers/content-writer?tab=chat`);
  await p.waitForTimeout(6000);
  await shot(p, 'ITEM5c-ava-milestone-in-chat');

  await ctx.close();
  await browser.close();
  console.log('\nDone. Screenshots in', OUT);
}
main().catch(e => { console.error(e.message); process.exit(1); });
