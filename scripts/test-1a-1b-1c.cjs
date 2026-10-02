/**
 * End-to-end generation tests for Brief 1A / 1B / 1C changes
 * Tests actual form submission and verifies real output (not errors)
 * Run: node scripts/test-1a-1b-1c.cjs
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
require('dotenv').config({ path: '.env.local' });

const BASE = 'https://3rdshift.ai';
const EMAIL = 'test-roger@3rdshift.ai';
const PASS = '<SCREENSHOT_TEST_PASSWORD>';
const TIMEOUT = 120000; // 2 min per task

const results = [];

function log(msg) { process.stdout.write(msg + '\n'); }

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(3000);
}

async function selectCard(page, cardText) {
  // Click the card that contains the given text
  const card = page.locator(`button:has-text("${cardText}")`).first();
  await card.waitFor({ timeout: 10000 });
  await card.click();
  await page.waitForTimeout(1000);
}

async function submitAndWait(page, testName) {
  const submitBtn = page.locator('button[type="submit"], button:has-text("Generate"), button:has-text("Write"), button:has-text("Run"), button:has-text("Build"), button:has-text("Create")').first();
  await submitBtn.waitFor({ timeout: 10000 });
  await submitBtn.click();
  log(`  → Submitted ${testName}, waiting for output...`);
  
  // Wait for result page or output to appear
  try {
    await page.waitForURL('**/tasks/**', { timeout: TIMEOUT });
    await page.waitForTimeout(3000);
    
    // Wait a bit extra for content to render
    await page.waitForTimeout(3000);
    
    // Check for error indicators  
    const pageUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText);
    
    if (pageText.includes('An error occurred') || pageText.includes('Something went wrong') || pageText.includes('500') || pageText.includes('failed to generate')) {
      return { pass: false, reason: 'Error visible on result page' };
    }
    
    // Look for prose output (the actual content div)
    const outputText = await page.locator('.prose').first().textContent({ timeout: 15000 }).catch(() => null);
    
    if (!outputText || outputText.trim().length < 100) {
      // Try getting any substantial text on the page as fallback
      const bodyText = (await page.evaluate(() => document.body.innerText)).trim();
      if (bodyText.length > 300 && pageUrl.includes('/tasks/')) {
        return { pass: true, reason: `Page has content (${bodyText.length} chars): ${bodyText.slice(0, 120)}...` };
      }
      return { pass: false, reason: `Output too short or empty (${outputText?.length||0} chars) on ${pageUrl}` };
    }
    return { pass: true, reason: `Output (${outputText.trim().length} chars): ${outputText.trim().slice(0, 120)}...` };
  } catch (e) {
    // Try checking for output on same page (some workers render inline)
    const pageContent = await page.content();
    if (pageContent.includes('error') || pageContent.includes('Error')) {
      return { pass: false, reason: 'Page contains error after submit' };
    }
    return { pass: false, reason: `Timeout or navigation failed: ${e.message.slice(0, 80)}` };
  }
}

async function runTest(page, name, url, setupFn) {
  log(`\n🔍 Testing: ${name}`);
  try {
    await page.goto(url, { timeout: 20000 });
    await page.waitForTimeout(2000);
    
    // Check page loaded correctly
    const notFound = await page.locator('text=404, text=not found, text=Page not found').first().isVisible().catch(() => false);
    if (notFound) {
      results.push({ name, pass: false, reason: '404 - page not found' });
      log(`  ❌ 404`);
      return;
    }
    
    await setupFn(page);
    const result = await submitAndWait(page, name);
    results.push({ name, ...result });
    log(`  ${result.pass ? '✅' : '❌'} ${result.reason.slice(0, 100)}`);
  } catch (e) {
    results.push({ name, pass: false, reason: e.message.slice(0, 100) });
    log(`  ❌ ${e.message.slice(0, 100)}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  log('🔐 Logging in...');
  await login(page);
  log('✅ Logged in\n');

  // ─── BRIEF 1A ──────────────────────────────────────────────────────────────

  // Sam — Hook Specialist
  await runTest(page, 'Sam: hooks for TikTok (10 hooks)',
    `${BASE}/dashboard/workers/hook-specialist`,
    async (p) => {
      await p.fill('textarea[name="topic"]', 'How solo founders structure their week to ship faster');
      // destination should default to tiktok, count to 10
    }
  );

  await runTest(page, 'Sam: mini-hooks mode',
    `${BASE}/dashboard/workers/hook-specialist`,
    async (p) => {
      await p.fill('textarea[name="topic"]', 'Building a SaaS without a technical co-founder');
      await p.selectOption('select[name="hook_destination"]', 'mini_hooks');
      await p.selectOption('select[name="count"]', '5');
    }
  );

  // Ava — Article Writer (card picker)
  await runTest(page, 'Ava: Blog Post card',
    `${BASE}/dashboard/workers/content-writer`,
    async (p) => {
      await selectCard(p, 'Blog Post');
      await p.fill('input[name="topic"]', 'How AI workers are replacing freelancers in 2026');
      await p.fill('textarea[name="target_audience"]', 'Small business owners');
    }
  );

  await runTest(page, 'Ava: Deep-Dive Article card',
    `${BASE}/dashboard/workers/content-writer`,
    async (p) => {
      await selectCard(p, 'Deep-Dive');
      await p.fill('input[name="topic"]', 'The real cost of hiring freelancers vs AI workers');
      await p.fill('textarea[name="target_audience"]', 'Startup founders');
    }
  );

  await runTest(page, 'Ava: Pillar Content card',
    `${BASE}/dashboard/workers/content-writer`,
    async (p) => {
      await selectCard(p, 'Pillar Content');
      await p.fill('input[name="topic"]', 'Complete guide to AI workforce tools for small business');
      await p.fill('textarea[name="target_audience"]', 'Solo founders and small teams');
    }
  );

  // Redirect check — old Sam URL
  log(`\n🔍 Testing redirect: long-form-article-writer → hook-specialist`);
  try {
    await page.goto(`${BASE}/dashboard/workers/long-form-article-writer`, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const url = page.url();
    const passed = url.includes('hook-specialist');
    results.push({ name: 'Redirect: long-form-article-writer → hook-specialist', pass: passed, reason: passed ? `✓ at ${url}` : `Still at ${url}` });
    log(`  ${passed ? '✅' : '❌'} ${url}`);
  } catch(e) {
    results.push({ name: 'Redirect: long-form-article-writer → hook-specialist', pass: false, reason: e.message.slice(0,80) });
    log(`  ❌ ${e.message.slice(0,80)}`);
  }

  // ─── BRIEF 1B ──────────────────────────────────────────────────────────────

  // Jules — Production Script Writer
  await runTest(page, 'Jules: YouTube Video script',
    `${BASE}/dashboard/workers/script-writer`,
    async (p) => {
      await selectCard(p, 'YouTube Video');
      await p.fill('textarea[name="topic"]', 'How to replace your freelancers with AI workers in 30 days');
      await p.selectOption('select[name="length"]', 'Medium (5-10 min)');
    }
  );

  // Heath — Podcast Specialist
  await runTest(page, 'Heath: Show Notes',
    `${BASE}/dashboard/workers/podcast-show-notes-writer`,
    async (p) => {
      await selectCard(p, 'Show Notes');
      const topicField = p.locator('input[name="episode_topic"], textarea[name="episode_topic"]').first();
      await topicField.fill('How AI is replacing the freelance economy');
    }
  );

  // Holly — single form (no card picker)
  await runTest(page, 'Holly: repurpose blog post to LinkedIn + X',
    `${BASE}/dashboard/workers/content-repurposer`,
    async (p) => {
      await p.fill('input[name="source_title"]', 'How AI Workers Are Replacing Freelancers');
      await p.fill('textarea[name="original_content"]', 'AI workforce platforms like 3rdShift are fundamentally changing how businesses hire. Instead of paying $2,000-$5,000 per month for a freelancer, companies can now get the same output for $29 per month. This shift is happening across content writing, design, research, and more. The freelance market is seeing significant disruption as a result.');
      // Select platforms
      const platformSelect = p.locator('[name="platforms"]');
      if (await platformSelect.isVisible()) {
        await p.click('text=LinkedIn');
        await p.click('text=X/Twitter');
      }
    }
  );

  // Ash — 3 modes (no hook_pack)
  await runTest(page, 'Ash: Single Script (TikTok)',
    `${BASE}/dashboard/workers/social-media-creator`,
    async (p) => {
      await selectCard(p, 'Single Script');
      await p.fill('textarea[name="topic"]', 'Replace your VA with AI in 60 seconds');
      await p.waitForTimeout(500);
    }
  );

  // Charlie — Course Architect (Digital Products category)
  await runTest(page, 'Charlie: Mini Course',
    `${BASE}/dashboard/workers/course-outline-builder`,
    async (p) => {
      await selectCard(p, 'Mini Course');
      const topicField = p.locator('input[name="course_topic"], textarea[name="course_topic"]').first();
      await topicField.fill('Getting started with AI workers for your business');
      const audField = p.locator('input[name="target_learner"], textarea[name="target_learner"]').first();
      if (await audField.isVisible()) await audField.fill('Small business owners');
    }
  );

  // ─── BRIEF 1C ──────────────────────────────────────────────────────────────

  // Redirect checks for cut workers
  for (const [oldSlug, newSlug] of [
    ['swot-analyst', 'market-research-analyst'],
    ['tagline-writer', 'brand-strategist'],
    ['press-release-writer', 'whitepaper-writer'],
    ['faq-writer', 'customer-support-writer'],
    ['linkedin-profile-optimizer', 'linkedin-ghostwriter'],
  ]) {
    log(`\n🔍 Testing redirect: ${oldSlug} → ${newSlug}`);
    try {
      await page.goto(`${BASE}/dashboard/workers/${oldSlug}`, { timeout: 15000 });
      await page.waitForTimeout(2500);
      const url = page.url();
      const passed = url.includes(newSlug);
      results.push({ name: `Redirect: ${oldSlug} → ${newSlug}`, pass: passed, reason: passed ? `✓ at ${url}` : `Still at ${url}` });
      log(`  ${passed ? '✅' : '❌'} ${url}`);
    } catch (e) {
      results.push({ name: `Redirect: ${oldSlug} → ${newSlug}`, pass: false, reason: e.message.slice(0, 80) });
      log(`  ❌ ${e.message.slice(0, 80)}`);
    }
  }

  // Elliot — Profile Optimizer mode
  await runTest(page, 'Elliot: Profile Optimizer mode',
    `${BASE}/dashboard/workers/linkedin-ghostwriter`,
    async (p) => {
      await selectCard(p, 'Profile Optimizer');
      await p.fill('textarea[name="target_role_or_positioning"]', 'AI SaaS founder seeking strategic partnerships and investors');
      await p.fill('textarea[name="experience_highlights"]', 'Built 3rdShift to $100K ARR in 6 months. Led product from 0 to 80 AI workers. Former growth lead at 2 YC companies.');
    }
  );

  // Duncan — SWOT Analysis mode
  await runTest(page, 'Duncan: SWOT Analysis mode',
    `${BASE}/dashboard/workers/market-research-analyst`,
    async (p) => {
      await selectCard(p, 'SWOT Analysis');
      const bizField = p.locator('textarea[name="business_or_idea"]').first();
      if (await bizField.isVisible()) {
        await bizField.fill('3rdShift — AI workforce platform replacing freelancers with specialized AI workers');
      }
      const industryField = p.locator('input[name="industry_or_category"], input[name="market"]').first();
      await industryField.fill('AI SaaS / workforce automation');
    }
  );

  // Naru — Press Release mode
  await runTest(page, 'Naru: Press Release mode',
    `${BASE}/dashboard/workers/whitepaper-writer`,
    async (p) => {
      await selectCard(p, 'Press Release');
      await p.fill('input[name="headline_focus"]', 'We launched AI workforce platform replacing freelancers');
      await p.fill('textarea[name="key_facts"]', 'Company: 3rdShift. Founded: 2025. Launch: 80 AI workers. Price: $29/mo. Category: AI workforce.');
    }
  );

  // Peyton — Instagram Content Director (content_calendar mode)
  await runTest(page, 'Peyton: 30-Day Content Calendar',
    `${BASE}/dashboard/workers/instagram-strategist`,
    async (p) => {
      await selectCard(p, '30-Day Content Calendar');
      const bizField = p.locator('input[name="business_or_niche"], input[name="business"]').first();
      await bizField.fill('AI workforce SaaS for small business owners');
    }
  );

  // Lyra — Pinterest Content Director (pin_pack mode)
  await runTest(page, 'Lyra: Pin Pack',
    `${BASE}/dashboard/workers/pinterest-strategist`,
    async (p) => {
      await selectCard(p, 'Pin Pack');
      const bizField = p.locator('input[name="business_or_niche"]').first();
      await bizField.fill('AI tools for small business');
      const audienceField = p.locator('textarea[name="target_audience"]').first();
      await audienceField.fill('Small business owners 30-55');
      const topicField = p.locator('textarea[name="pin_topic"]').first();
      if (await topicField.isVisible()) await topicField.fill('AI workers replacing freelancers');
      const kwField = p.locator('input[name="keywords_to_target"]').first();
      if (await kwField.isVisible()) await kwField.fill('AI workers, replace freelancer, AI business tools');
    }
  );

  // Sully — Naming Specialist (business_name mode)
  await runTest(page, 'Sully: Business Name mode',
    `${BASE}/dashboard/workers/product-naming-specialist`,
    async (p) => {
      await selectCard(p, 'Business Name');
      await p.fill('textarea[name="description"]', 'An AI workforce platform that replaces freelancers with specialized AI workers for $29/mo');
      await p.fill('textarea[name="target_audience"]', 'Small business owners and solo founders');
    }
  );

  // Ellis — 5 modes only (verify Cart Recovery works)
  await runTest(page, 'Ellis: Cart Recovery Flow',
    `${BASE}/dashboard/workers/email-marketing-strategist`,
    async (p) => {
      await selectCard(p, 'Cart Recovery');
      await p.fill('textarea[name="business_context"]', 'AI SaaS platform, $29-199/mo subscriptions, Stripe billing');
      await p.selectOption('select[name="business_type"]', 'SaaS / B2B software');
    }
  );

  // Piper — Messaging Architecture (should include taglines now)
  await runTest(page, 'Piper: Messaging Architecture (includes taglines)',
    `${BASE}/dashboard/workers/brand-strategist`,
    async (p) => {
      await selectCard(p, 'Messaging Architecture');
      const brandField = p.locator('input[name="brand_name"]').first();
      await brandField.fill('3rdShift');
      const prodField = p.locator('textarea[name="product_description"], textarea[name="product"]').first();
      if (await prodField.isVisible()) await prodField.fill('AI workforce platform that replaces freelancers with specialized AI workers');
    }
  );

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  await browser.close();

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  log('\n' + '═'.repeat(60));
  log(`RESULTS: ${passed}/${results.length} passed, ${failed} failed`);
  log('═'.repeat(60));
  for (const r of results) {
    log(`${r.pass ? '✅' : '❌'} ${r.name}`);
    if (!r.pass) log(`   ↳ ${r.reason}`);
  }
  log('═'.repeat(60));
  if (failed === 0) log('🎉 ALL TESTS PASSED');
  else log(`⚠️  ${failed} test(s) need attention`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
