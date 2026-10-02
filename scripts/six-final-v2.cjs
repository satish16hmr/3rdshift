const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/six-final');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log(`📸 ${name}`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  JS error:', e.message.slice(0, 80)));

  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(8000);

  // ── SHOT 1: Notification panel open ──────────────────────────────────────
  console.log('\nShot 1: Bell panel');
  // Click bell
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0);
    if (bell) bell.click(); else console.log('bell not found');
  });
  // Wait for the sliding panel
  await page.waitForSelector('[class*="fixed inset-y-0 right-0"]', { timeout: 10000 }).catch(() => console.log('Panel not found via selector'));
  await page.waitForTimeout(1500);
  await shot(page, '1-notification-panel-all-6-workers');
  const rows = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    return { rowCount: panel?.querySelectorAll('button.w-full').length, text: panel?.textContent?.slice(0, 200) };
  });
  console.log('  Panel:', rows);

  // ── SHOT 2: Click one suggestion row → Team Chat ──────────────────────────
  console.log('\nShot 2: Click through to chat');
  const clicked = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    const rows = Array.from(panel?.querySelectorAll('button.w-full') || []);
    // Click Lenny (first row by order) — has the best specific preview
    const lennyRow = rows.find(r => r.textContent?.includes('Lenny') || r.textContent?.includes('Apollo') || r.textContent?.includes('founder'));
    const target = lennyRow || rows[0];
    if (target) { target.click(); return true; }
    return false;
  });
  console.log('  Clicked:', clicked);
  await page.waitForTimeout(5000);
  await shot(page, '2-clicked-through-to-team-chat');
  console.log('  URL:', page.url());
  const c2 = await page.evaluate(() => ({
    hasBlue: document.querySelectorAll('[class*="bg-blue-50"]').length,
    hasLabel: document.body.textContent?.includes('💡') || document.body.textContent?.includes('Idea from'),
  }));
  console.log('  Chat check:', c2);

  // ── SHOT 3: Lenny chat with "Run Lenny" button ────────────────────────────
  console.log('\nShot 3: Lenny chat');
  await page.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await page.waitForTimeout(7000);
  await shot(page, '3-lenny-chat-run-button');
  const lennyBtn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run Lenny'));
    return { found: !!b, text: b?.textContent?.trim() };
  });
  console.log('  Run Lenny button:', lennyBtn);

  // ── SHOT 4: Click Run Lenny → form with ICP pre-filled ───────────────────
  console.log('\nShot 4: Form pre-filled');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run Lenny'))?.click();
  });
  await page.waitForTimeout(4000);
  await shot(page, '4-lenny-form-prefilled');
  const fields = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[type="text"]'))
      .map(i => ({ name: i.name, val: i.value })).filter(f => f.val)
  );
  console.log('  Fields:', fields);

  // ── SHOT 5: Settings with Ava toggle ─────────────────────────────────────
  console.log('\nShot 5: Settings');
  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('section')).find(x => x.textContent?.includes('Proactive Updates'));
    s?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(600);
  await shot(page, '5-settings-ava-toggle');
  const avaVisible = await page.evaluate(() => document.body.textContent?.includes('Team milestones & check-ins'));
  console.log('  Ava toggle visible:', avaVisible);

  // ── SHOT 6: Ava ⭐ in chat ─────────────────────────────────────────────────
  console.log('\nShot 6: Ava message');
  await page.goto(`${BASE}/dashboard/workers/content-writer?tab=chat`);
  await page.waitForTimeout(7000);
  await shot(page, '6-ava-star-message-in-chat');
  const avaCheck = await page.evaluate(() => ({
    amber: document.querySelectorAll('[class*="bg-amber-50"]').length,
    star: document.body.textContent?.includes('⭐'),
    text: document.querySelector('[class*="bg-amber-50"]')?.textContent?.slice(0, 80),
  }));
  console.log('  Ava:', avaCheck);

  await ctx.close();
  await browser.close();
  console.log('\n✅ Done —', OUT);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
