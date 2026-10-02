/**
 * Test all 4 Lenny searches from the brief via the actual form submission path
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/lenny-searches');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log('📸', name);
}

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  JS err:', e.message.slice(0, 60)));
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await p.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await p.waitForTimeout(400);
  await p.click('button:has-text("Log in")');
  await p.waitForURL('**/dashboard**', { timeout: 20000 });
  await p.waitForTimeout(5000);
  return { page: p, ctx };
}

async function runSearch(page, { industry, titles, size, location, testName }) {
  console.log(`\n── Search: ${testName} ──`);
  await page.goto(`${BASE}/dashboard/workers/lead-generator`);
  await page.waitForTimeout(3000);

  // Fill target_industry
  await page.fill('input[name="target_industry"]', industry).catch(async () => {
    await page.locator('[placeholder*="industry"], [placeholder*="niche"], [placeholder*="SaaS"]').first().fill(industry).catch(() => {});
  });
  await page.waitForTimeout(200);

  // Fill job_titles
  await page.fill('input[name="job_titles"]', titles).catch(async () => {
    await page.locator('[placeholder*="job title"], [placeholder*="title"]').first().fill(titles).catch(() => {});
  });
  await page.waitForTimeout(200);

  // Fill location
  await page.fill('input[name="location"]', location).catch(async () => {
    await page.locator('[placeholder*="location"], [placeholder*="geographic"], [placeholder*="United States"]').first().fill(location).catch(() => {});
  });
  await page.waitForTimeout(200);

  // Company size — select from dropdown
  const sizeSelect = page.locator('select[name="company_size"]').first();
  if (await sizeSelect.count() > 0) {
    // Find the closest matching option
    const options = await sizeSelect.locator('option').allTextContents();
    console.log('  Size options:', options);
    const match = options.find(o => o.toLowerCase().includes('smb') || o.includes('11-200') || o.includes('11,200'));
    if (match) await sizeSelect.selectOption({ label: match });
  }

  await shot(page, `${testName}-form`);

  // Submit
  const submitBtn = page.locator('button[type="button"]').filter({ hasText: /Submit|Generate|Run|Search/ }).first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
  } else {
    await page.keyboard.press('Tab');
    await page.locator('button').filter({ hasText: /Submit|Run|Generate/ }).first().click();
  }

  console.log('  Submitted. Waiting for results (~20s)...');
  
  try {
    await page.waitForURL('**/tasks/result**', { timeout: 60000 });
  } catch {
    console.log('  Navigation timeout — checking page state');
  }
  
  await page.waitForTimeout(4000);
  await shot(page, `${testName}-result`);

  const check = await page.evaluate(() => ({
    is404: document.body.textContent?.includes('Page not found'),
    noLeads: document.body.textContent?.includes('No Leads Found') || document.body.textContent?.includes('0 results'),
    hasLeads: document.body.textContent?.includes('Name | Job Title') || document.body.textContent?.includes('| Name |') ||
              document.body.textContent?.includes('Founder') || document.body.textContent?.includes('CEO') || document.body.textContent?.includes('Marketing'),
    completed: document.body.textContent?.includes('Completed'),
    url: window.location.href,
  }));

  const verdict = check.is404 ? '❌ 404' : check.noLeads ? '❌ NO LEADS' : check.hasLeads ? '✅ HAS LEADS' : '⚠️ UNCLEAR';
  console.log(`  Result: ${verdict} | completed: ${check.completed} | url: ${check.url.slice(0, 80)}`);
  return check;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const { page, ctx } = await login(browser);

  const results = [];

  // Search 4A: Basic SaaS founders  
  results.push(await runSearch(page, {
    industry: 'SaaS',
    titles: 'Founder, CEO',
    size: 'SMB (11-200)',
    location: 'United States',
    testName: '4A-basic-saas-founders',
  }));

  // Search 4C: Marketing managers/directors (different criteria)
  results.push(await runSearch(page, {
    industry: 'Marketing, Agencies',
    titles: 'Marketing Manager, Marketing Director',
    size: 'SMB (11-200)',
    location: 'United States',
    testName: '4C-marketing-directors',
  }));

  // Search 4D: The original failing search
  results.push(await runSearch(page, {
    industry: 'SaaS, AI tools, Marketing Technology',
    titles: 'Founder, CEO, Head of Marketing, VP Marketing',
    size: 'SMB (11-200)',
    location: 'United States',
    testName: '4D-original-failing-search',
  }));

  await ctx.close();
  await browser.close();

  console.log('\n═══ SUMMARY ═══');
  const names = ['4A Basic SaaS', '4C Marketing Directors', '4D Original Failing'];
  results.forEach((r, i) => {
    const status = r.is404 ? '❌ 404' : r.noLeads ? '❌ NO LEADS' : r.hasLeads ? '✅ LEADS' : '⚠️ UNCLEAR';
    console.log(`  ${names[i]}: ${status}`);
  });
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
