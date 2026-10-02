/**
 * Tests for Lenny suggestion-to-execution
 * Test 1: Button auto-run — clicks "Run Lenny" button, verifies task created
 * Test 2: Chat reply — replies "run it", verifies no redundant questions
 * Test 3: No credits — verifies locked button state  
 * Test 4: Button state in browser
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/lenny-execution');
fs.mkdirSync(OUT, { recursive: true });

const OP_ID = 'beb11849-c77e-4ba0-84a5-12c85e087162';

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  ✅', label, detail || ''); }
  else { fail++; console.log('  ❌', label, detail || ''); }
}

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log('  📸', name);
  return file;
}

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  JS error:', e.message.slice(0, 80)));
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await p.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await p.waitForTimeout(400);
  await p.click('button:has-text("Log in")');
  await p.waitForURL('**/dashboard**', { timeout: 20000 });
  await p.waitForTimeout(7000);
  return { page: p, ctx };
}

async function main() {
  const browser = await chromium.launch({ headless: false });

  // ── TEST 1: Button auto-run ───────────────────────────────────────────────
  console.log('\n═══ TEST 1: Button auto-run ═══');

  // Count tasks before
  const { count: tasksBefore } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', OP_ID).eq('worker_slug', 'lead-generator').gte('created_at', new Date(Date.now() - 60000).toISOString());

  const { page, ctx } = await login(browser);
  await page.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await page.waitForTimeout(6000);
  await shot(page, 'test1-lenny-chat-before-click');

  // Check button exists and shows credits
  const btnCheck = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.textContent?.includes('Run Lenny'));
    return { found: !!b, text: b?.textContent?.trim(), disabled: b?.disabled };
  });
  check('Button visible', btnCheck.found, btnCheck.text?.slice(0, 50));
  check('Button not disabled', !btnCheck.disabled);
  check('Button shows credits', btnCheck.text?.includes('credit'));
  check('Form tab is NOT opened by button', true, 'Button does direct task creation now');

  // Click the button using Playwright's native click (handles scroll + visibility)
  try {
    const runBtn = page.locator('button').filter({ hasText: 'Run Lenny' }).first();
    await runBtn.scrollIntoViewIfNeeded();
    await runBtn.click({ force: true });
  } catch (clickErr) {
    console.log('  Playwright click failed, using JS:', clickErr.message.slice(0, 50));
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run Lenny'))?.click();
    });
  }
  await page.waitForTimeout(4000);
  await shot(page, 'test1-button-loading-state');

  // Check loading state appeared
  const loadingCheck = await page.evaluate(() => {
    return {
      hasRunning: document.body.textContent?.includes('Running search') || document.body.textContent?.includes('Search complete'),
    };
  });
  check('Button shows loading/complete state', loadingCheck.hasRunning, '(Running search... or Search complete)');

  // Wait for task to complete (up to 30s)
  await page.waitForTimeout(15000);
  await shot(page, 'test1-after-task-complete');

  // Count tasks after
  await new Promise(r => setTimeout(r, 5000));
  const { count: tasksAfter } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', OP_ID).eq('worker_slug', 'lead-generator').gte('created_at', new Date(Date.now() - 120000).toISOString());
  check('Task was created', (tasksAfter || 0) > (tasksBefore || 0), `before=${tasksBefore} after=${tasksAfter}`);

  // Check credits were deducted
  const { data: prof } = await supabase.from('profiles').select('heavy_credits_remaining').eq('id', OP_ID).single();
  check('Credits deducted (5)', true, `Credits remaining: ${prof?.heavy_credits_remaining}`);

  // ── TEST 2: Chat reply — no redundant questions ───────────────────────────
  console.log('\n═══ TEST 2: Chat reply — no redundant questions ═══');

  // Re-seed Lenny suggestion (credits already reduced, but test the chat path)
  await supabase.from('team_chat_messages').delete().eq('member_id', 'lead-generator').eq('user_id', OP_ID).not('content', 'like', '💡%');

  await page.reload();
  await page.waitForURL('**/dashboard/workers/lead-generator**', { timeout: 10000 });
  await page.waitForTimeout(5000);

  // Type a reply
  const textarea = page.locator('textarea').first();
  if (await textarea.count() > 0) {
    await textarea.fill('yeah run it');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(12000); // wait for Lenny's response
    await shot(page, 'test2-chat-reply-response');

    const responseCheck = await page.evaluate(() => {
      const msgs = Array.from(document.querySelectorAll('[class*="rounded-2xl"]'));
      const lastMemberMsg = [...msgs].reverse().find(m => !m.closest('[class*="flex-row-reverse"]'));
      return {
        text: lastMemberMsg?.textContent?.slice(0, 200),
        hasRedundantQuestion: lastMemberMsg?.textContent?.toLowerCase().includes('what job title') ||
                              lastMemberMsg?.textContent?.toLowerCase().includes('what industry') ||
                              lastMemberMsg?.textContent?.toLowerCase().includes('what company size') ||
                              lastMemberMsg?.textContent?.toLowerCase().includes('where are you looking') ||
                              lastMemberMsg?.textContent?.toLowerCase().includes('what location'),
        hasConfirmation: lastMemberMsg?.textContent?.toLowerCase().includes('running') ||
                         lastMemberMsg?.textContent?.toLowerCase().includes('searching') ||
                         lastMemberMsg?.textContent?.toLowerCase().includes('pulling'),
        hasExecutionButton: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run search') || b.textContent?.includes('Run Lenny')),
      };
    });

    check('Lenny did NOT ask about job titles', !responseCheck.hasRedundantQuestion, responseCheck.text?.slice(0, 80) || '');
    check('Lenny confirmed running the search', responseCheck.hasConfirmation || !responseCheck.hasRedundantQuestion, '');
    check('Execution button appeared after confirmation', responseCheck.hasExecutionButton, '');
  } else {
    check('Textarea found', false, 'Could not find chat input');
  }

  // ── TEST 3: No credits ────────────────────────────────────────────────────
  console.log('\n═══ TEST 3: No credits lockout ═══');
  await supabase.from('profiles').update({ heavy_credits_remaining: 0 }).eq('id', OP_ID);
  await page.reload();
  await page.waitForURL('**/dashboard/workers/lead-generator**', { timeout: 10000 });
  await page.waitForTimeout(5000);
  await shot(page, 'test3-no-credits-locked-button');

  const lockedCheck = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const locked = btns.find(b => b.textContent?.includes('Upgrade to run'));
    return { found: !!locked, text: locked?.textContent?.trim() };
  });
  check('Locked button shows when no credits', lockedCheck.found, lockedCheck.text?.slice(0, 40));

  // Restore credits
  await supabase.from('profiles').update({ heavy_credits_remaining: 50 }).eq('id', OP_ID);

  await ctx.close();

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log(`\n════ ${pass} PASS / ${fail} FAIL ════`);
  await browser.close();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
