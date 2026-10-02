/**
 * test-post-deliverable.mjs
 * Tests post-deliverable conversation awareness for Ava (text worker)
 * Uses real login + real chat API — waits for deliverable, then sends follow-up
 */
import pkg from '/Users/3rdshift/.openclaw/workspace/scripts/node_modules/playwright/index.js';
const { chromium } = pkg;
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ykevcpqawtqxacfslwtf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BASE_URL = 'https://3rdshift.ai';

const TEST_EMAIL = `test-postdel-${Date.now()}@3rdshift.ai`;
const TEST_PASS = 'TestPass2026!';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createTestUser(plan = 'operator') {
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL, password: TEST_PASS, email_confirm: true
  });
  if (error) throw new Error('createUser: ' + error.message);
  const uid = data.user.id;
  await supabase.from('profiles').update({ plan, heavy_credits_remaining: 175 }).eq('id', uid);
  return uid;
}

async function deleteTestUser(uid) {
  await supabase.auth.admin.deleteUser(uid);
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  console.log('✅ Logged in');
}

async function waitForDeliverableCard(page, timeout = 90000) {
  // Wait for "View & Download" or "View All" button to appear
  await page.waitForSelector('a:has-text("View"), a:has-text("Download")', { timeout });
  console.log('✅ Deliverable card appeared');
}

async function sendChatMessage(page, text) {
  const textarea = page.locator('textarea').last();
  await textarea.fill(text);
  await textarea.press('Enter');
  console.log(`📤 Sent: "${text}"`);
  // Wait for response (typing indicator to disappear)
  await page.waitForTimeout(1500);
  // Wait until sending stops (bounce dots gone)
  await page.waitForFunction(() => {
    const dots = document.querySelectorAll('.animate-bounce');
    return dots.length === 0;
  }, { timeout: 30000 });
  await page.waitForTimeout(500);
}

async function screenshot(page, name) {
  const path = `screenshots/post-deliverable/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`📸 ${path}`);
}

(async () => {
  let uid = null;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  try {
    uid = await createTestUser('operator');
    console.log('✅ Test user created:', TEST_EMAIL);

    await login(page);

    // ── TEST 1: Positive response after Ava delivers ──────────────────────
    console.log('\n── TEST 1: Positive response (Ava) ──');
    await page.goto(`${BASE_URL}/dashboard/workers/content-writer?tab=chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Dismiss intro if present, then send real request
    await sendChatMessage(page, 'Write me a short landing page intro for a SaaS product called TaskFlow that helps remote teams manage projects. Keep it under 150 words, professional tone.');

    // Wait for deliverable
    try {
      await waitForDeliverableCard(page, 90000);
      await screenshot(page, '1a-ava-delivered');

      // Send positive follow-up
      await sendChatMessage(page, 'cool');
      await screenshot(page, '1b-ava-positive-response');
      console.log('✅ Test 1 complete');
    } catch (e) {
      console.log('⚠️ Test 1: deliverable timed out — taking screenshot anyway');
      await screenshot(page, '1-ava-timeout');
    }

    // ── TEST 2: Negative response after Ava delivers ──────────────────────
    console.log('\n── TEST 2: Negative response (Ava) ──');
    await page.goto(`${BASE_URL}/dashboard/workers/content-writer?tab=chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await sendChatMessage(page, 'Write a 3-sentence tagline and value prop for a coffee subscription service called Mornings Co. Casual, warm tone.');
    try {
      await waitForDeliverableCard(page, 90000);
      await screenshot(page, '2a-ava-delivered');

      await sendChatMessage(page, "that's not what I wanted, the tone is too formal");
      await screenshot(page, '2b-ava-negative-response');
      console.log('✅ Test 2 complete');
    } catch (e) {
      console.log('⚠️ Test 2: deliverable timed out');
      await screenshot(page, '2-ava-timeout');
    }

    // ── TEST 3: Vague response ────────────────────────────────────────────
    console.log('\n── TEST 3: Vague response (Ava) ──');
    await page.goto(`${BASE_URL}/dashboard/workers/content-writer?tab=chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await sendChatMessage(page, 'Write a welcome email for new users of a productivity app called FocusHQ. Keep it short, 3 paragraphs, friendly tone.');
    try {
      await waitForDeliverableCard(page, 90000);
      await screenshot(page, '3a-ava-delivered');

      await sendChatMessage(page, 'hmm');
      await screenshot(page, '3b-ava-vague-response');
      console.log('✅ Test 3 complete');
    } catch (e) {
      console.log('⚠️ Test 3: deliverable timed out');
      await screenshot(page, '3-ava-timeout');
    }

    console.log('\n✅ All tests done. Screenshots in screenshots/post-deliverable/');

  } catch (err) {
    console.error('❌ Error:', err.message);
    await screenshot(page, 'error-state').catch(() => {});
  } finally {
    await browser.close();
    if (uid) {
      await deleteTestUser(uid);
      console.log('🧹 Test user deleted');
    }
  }
})();
