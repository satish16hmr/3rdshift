/**
 * Phase 2: Real browser verification via Playwright (non-headless)
 * Tests bell, panel, click-through, settings, chat visual treatment
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/phase2-verify');
fs.mkdirSync(OUT, { recursive: true });

let shotNum = 0;
async function shot(page, name, waitMs = 0) {
  if (waitMs) await page.waitForTimeout(waitMs);
  const file = `${OUT}/${String(++shotNum).padStart(2,'0')}-${name}.png`;
  await page.screenshot({ path: file });
  console.log(`📸 ${path.basename(file)}`);
  return file;
}

async function login(ctx, email, password) {
  const page = await ctx.newPage();
  // Set sidebar open
  await page.goto(BASE);
  await page.evaluate(() => { document.cookie = 'sidebar_state=true; path=/; max-age=604800'; });
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.evaluate(() => { document.cookie = 'sidebar_state=true; path=/; max-age=604800'; });
  // Wait for full hydration including session/bell
  await page.waitForTimeout(8000);
  return page;
}

async function main() {
  console.log('=== PHASE 2: REAL BROWSER VERIFICATION ===\n');

  // Use headed browser — this IS the real browser
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ── OPERATOR ACCOUNT ──────────────────────────────────────────────────────
  console.log('-- Operator account (test-roger@3rdshift.ai) --');
  const page = await login(ctx, 'test-roger@3rdshift.ai', '<SCREENSHOT_TEST_PASSWORD>');

  // 2.1 Dashboard — is bell visible?
  await shot(page, 'operator-dashboard-full', 500);
  
  // Check bell in DOM
  const bellInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.getAttribute('aria-label') === 'Notifications' || b.dataset?.teamUpdatesBell === 'true');
    if (!bell) return { found: false };
    const r = bell.getBoundingClientRect();
    return { found: true, visible: r.width > 0 && r.height > 0, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, parent: bell.parentElement?.className?.slice(0, 80) };
  });
  console.log('\n2.1 Bell state:', JSON.stringify(bellInfo, null, 2));

  // Zoom into sidebar header area for bell screenshot
  await page.evaluate(() => {
    // Scroll sidebar to top
    const sidebar = document.querySelector('[data-sidebar="sidebar"]') || document.querySelector('aside') || document.querySelector('nav');
    if (sidebar) sidebar.scrollTop = 0;
  });
  await shot(page, 'operator-sidebar-header-area');

  // 2.2 Open the notification panel
  // Try data attribute first, then aria-label
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    // Our bell has data-team-updates-bell="true"
    const bell = btns.find(b => b.dataset?.teamUpdatesBell === 'true') ||
                 btns.find(b => b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0);
    if (bell) { bell.click(); return { clicked: true, ariaLabel: bell.getAttribute('aria-label'), class: bell.className?.slice(0, 60) }; }
    return { clicked: false };
  });
  console.log('\n2.2 Bell click result:', JSON.stringify(clicked));
  await page.waitForTimeout(1500);
  await shot(page, 'operator-notification-panel');

  // Check panel content
  const panelContent = await page.evaluate(() => {
    // Look for our notification panel
    const panel = document.querySelector('[class*="rounded-xl border border-zinc-200 bg-white shadow-xl"]') ||
                  document.querySelector('[class*="notification"]') ||
                  document.querySelector('[class*="w-80"]');
    if (!panel) return { found: false };
    const rows = panel.querySelectorAll('button.w-full');
    return {
      found: true,
      rowCount: rows.length,
      firstRowText: rows[0]?.textContent?.slice(0, 100),
      panelText: panel.textContent?.slice(0, 200),
    };
  });
  console.log('\n  Panel content:', JSON.stringify(panelContent, null, 2));

  // 2.3 Click-through — click a notification row
  const navResult = await page.evaluate(() => {
    // Find our notification panel rows
    const rows = Array.from(document.querySelectorAll('button.w-full.text-left'));
    if (rows.length > 0) {
      rows[0].click();
      return { clicked: true, count: rows.length };
    }
    // Try any button in the panel area
    const panel = document.querySelector('[class*="w-80"]') || document.querySelector('[class*="shadow-xl"]');
    if (panel) {
      const btns = panel.querySelectorAll('button');
      if (btns.length > 0) { btns[0].click(); return { clicked: true, viaPanelBtn: true }; }
    }
    return { clicked: false };
  });
  console.log('\n2.3 Click-through result:', JSON.stringify(navResult));
  await page.waitForTimeout(3000);
  await shot(page, 'operator-after-notification-click');
  console.log('  Current URL after click:', page.url());

  // 2.5 Settings page
  console.log('\n2.5 Settings page check...');
  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(4000);
  
  // Scroll to Team Updates section
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    for (const s of sections) {
      if (s.textContent?.includes('Team Updates')) {
        s.scrollIntoView({ behavior: 'instant', block: 'center' });
        break;
      }
    }
  });
  await page.waitForTimeout(500);
  await shot(page, 'operator-settings-team-updates');

  // Check if section exists
  const settingsSectionExists = await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    for (const s of sections) {
      if (s.textContent?.includes('Team Updates') && s.textContent?.includes('Proactive Updates')) {
        return true;
      }
    }
    return false;
  });
  console.log('  Team Updates section exists:', settingsSectionExists);

  // Test master toggle — click it, screenshot, check persistence
  const toggleResult = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    // Find the master toggle (first rounded-full toggle in Team Updates section)
    const section = Array.from(document.querySelectorAll('section')).find(s => s.textContent?.includes('Team Updates'));
    if (!section) return { error: 'no section found' };
    const toggle = section.querySelector('button[class*="rounded-full"]');
    if (!toggle) return { error: 'no toggle found' };
    const wasBg = toggle.className?.includes('bg-blue-600') ? 'on' : 'off';
    toggle.click();
    return { clicked: true, was: wasBg };
  });
  console.log('  Toggle click:', JSON.stringify(toggleResult));
  await page.waitForTimeout(500);
  await shot(page, 'operator-settings-toggle-clicked');

  // Save
  const saveBtn = page.locator('button:has-text("Save preferences")').first();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, 'operator-settings-saved');
  }

  // Reload and check persistence
  await page.reload();
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    for (const s of sections) {
      if (s.textContent?.includes('Team Updates')) { s.scrollIntoView({ behavior: 'instant', block: 'center' }); break; }
    }
  });
  await shot(page, 'operator-settings-after-reload');

  // Restore toggle back to ON
  await page.evaluate(() => {
    const section = Array.from(document.querySelectorAll('section')).find(s => s.textContent?.includes('Team Updates'));
    if (section) {
      const toggle = section.querySelector('button[class*="rounded-full"]');
      const isOff = !toggle?.className?.includes('bg-blue-600');
      if (isOff && toggle) toggle.click();
    }
  });
  await page.waitForTimeout(300);
  const saveBtn2 = page.locator('button:has-text("Save preferences")').first();
  if (await saveBtn2.count() > 0) await saveBtn2.click();
  await page.waitForTimeout(1000);

  // 2.7 Chat visual treatment
  console.log('\n2.7 Chat visual treatment...');
  await page.goto(`${BASE}/dashboard/workers/long-form-article-writer?tab=chat`);
  await page.waitForTimeout(5000);
  await shot(page, 'operator-sam-chat-visual');

  // Check for 💡 styled messages
  const proactiveStyle = await page.evaluate(() => {
    const blueBg = document.querySelector('[class*="bg-blue-50"][class*="border-blue-200"]');
    const allMessages = document.querySelectorAll('[class*="rounded-2xl"]');
    return {
      proactiveCount: document.querySelectorAll('[class*="bg-blue-50"]').length,
      messageCount: allMessages.length,
      hasProactiveText: document.body.textContent?.includes('\uD83D\uDCA1'),
      hasCTA: document.body.textContent?.includes('Reply below to take action'),
    };
  });
  console.log('  Chat visual check:', JSON.stringify(proactiveStyle));

  // Close operator, open starter
  await page.close();

  // ── STARTER ACCOUNT ───────────────────────────────────────────────────────
  console.log('\n-- Starter account (test-starter@3rdshift.ai) --');
  const page2 = await login(ctx, 'test-starter@3rdshift.ai', '<SCREENSHOT_TEST_PASSWORD>');
  await shot(page2, 'starter-dashboard');

  // Check plan badge in sidebar
  const planBadge = await page2.evaluate(() => {
    const badges = document.querySelectorAll('[class*="bg-blue-50"][class*="text-blue-"]');
    return Array.from(badges).map(b => b.textContent?.trim()).filter(Boolean);
  });
  console.log('\n  Starter plan badges visible:', planBadge);

  // Open bell
  await page2.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.dataset?.teamUpdatesBell === 'true') ||
                 btns.find(b => b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0);
    if (bell) bell.click();
  });
  await page2.waitForTimeout(2000);
  await shot(page2, 'starter-notification-panel');

  // Check for upsell treatment
  const upsellCheck = await page2.evaluate(() => {
    return {
      hasUpgradeText: document.body.textContent?.includes('Upgrade to Pro'),
      hasBlur: !!document.querySelector('[class*="blur"]'),
      panelText: document.querySelector('[class*="w-80"]')?.textContent?.slice(0, 300),
    };
  });
  console.log('  Starter upsell check:', JSON.stringify(upsellCheck, null, 2));

  await page2.close();
  await browser.close();

  console.log(`\n✅ Phase 2 screenshots saved to ${OUT}`);
  console.log('   Review each screenshot to confirm behavior.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
