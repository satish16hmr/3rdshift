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
  return file;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture any JS errors
  page.on('pageerror', e => console.log('  ⚠️ JS error:', e.message.slice(0, 80)));

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(8000);

  // ── SCREENSHOT 1: Notification panel with all 6 workers ─────────────────
  console.log('\n── Shot 1: Notification panel ──');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0);
    if (bell) bell.click();
  });
  await page.waitForTimeout(2500);
  await shot(page, '1-notification-panel-all-6-workers');
  const panelInfo = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    const rows = panel?.querySelectorAll('button.w-full');
    return { rows: rows?.length, hasSkip: panel?.textContent?.includes('SKIP'), first: rows?.[0]?.textContent?.slice(0, 60) };
  });
  console.log('  Panel rows:', panelInfo.rows, '| hasSkip:', panelInfo.hasSkip, '| first:', panelInfo.first?.slice(0, 50));

  // ── SCREENSHOT 2: Click a suggestion → Team Chat ─────────────────────────
  console.log('\n── Shot 2: Click notification → chat ──');
  await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    // Click the first non-Ava row (worker suggestion)
    const rows = Array.from(panel?.querySelectorAll('button.w-full') || []);
    const suggestionRow = rows.find(r => !r.textContent?.includes('weeks') && !r.textContent?.includes('tasks'));
    (suggestionRow || rows[0])?.click();
  });
  await page.waitForTimeout(4000);
  await shot(page, '2-clicked-through-to-team-chat');
  console.log('  URL:', page.url());
  const chatCheck = await page.evaluate(() => ({
    hasSuggestion: document.querySelectorAll('[class*="bg-blue-50"]').length,
    hasLabel: document.body.textContent?.includes('💡'),
    hasCTA: document.body.textContent?.includes('Reply below to take action'),
  }));
  console.log('  Chat:', chatCheck);

  // ── SCREENSHOT 3: Lenny chat with "Run Lenny" button ────────────────────
  console.log('\n── Shot 3: Lenny Run button ──');
  await page.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await page.waitForTimeout(6000);
  await shot(page, '3-lenny-chat-run-button');
  const lennyBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.textContent?.includes('Run Lenny'));
    return { found: !!b, text: b?.textContent?.trim() };
  });
  console.log('  Run Lenny button:', lennyBtn);

  // ── SCREENSHOT 4: Click "Run Lenny" → form with ICP pre-filled ───────────
  console.log('\n── Shot 4: Form pre-filled ──');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find(b => b.textContent?.includes('Run Lenny'))?.click();
  });
  await page.waitForTimeout(3000);
  await shot(page, '4-lenny-form-prefilled');
  const formState = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
    return inputs.map(i => ({ field: i.name || i.placeholder?.slice(0, 30), value: i.value })).filter(f => f.value);
  });
  console.log('  Pre-filled fields:', formState);

  // ── SCREENSHOT 5: Settings with Ava toggle ───────────────────────────────
  console.log('\n── Shot 5: Settings Ava toggle ──');
  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    for (const s of sections) {
      if (s.textContent?.includes('Team Updates') && s.textContent?.includes('Proactive Updates')) {
        s.scrollIntoView({ behavior: 'instant', block: 'center' });
        break;
      }
    }
  });
  await page.waitForTimeout(600);
  await shot(page, '5-settings-ava-toggle');
  const avaToggle = await page.evaluate(() => document.body.textContent?.includes('Team milestones & check-ins'));
  console.log('  Ava toggle visible:', avaToggle);

  // ── SCREENSHOT 6: Ava ⭐ message in chat ──────────────────────────────────
  console.log('\n── Shot 6: Ava ⭐ message in chat ──');
  await page.goto(`${BASE}/dashboard/workers/content-writer?tab=chat`);
  await page.waitForTimeout(6000);
  await shot(page, '6-ava-star-message-in-chat');
  const avaCheck = await page.evaluate(() => ({
    hasAmber: document.querySelectorAll('[class*="bg-amber-50"]').length,
    hasStar: document.body.textContent?.includes('⭐'),
    milestoneText: document.body.textContent?.includes('saved') || document.body.textContent?.includes('momentum'),
  }));
  console.log('  Ava chat:', avaCheck);

  await ctx.close();
  await browser.close();
  console.log(`\n✅ All 6 screenshots in ${OUT}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
