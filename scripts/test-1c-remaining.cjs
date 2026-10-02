/**
 * Test the 5 workers that didn't get form-submitted in the first run
 * Holly, Duncan (SWOT), Naru (Press Release), Lyra, Sully
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const BASE = 'https://3rdshift.ai';
const TIMEOUT = 120000;
const results = [];

function log(msg) { process.stdout.write(msg + '\n'); }

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(3000);
}

async function selectCard(page, cardText) {
  const card = page.locator(`button`).filter({ hasText: cardText }).first();
  await card.waitFor({ timeout: 10000 });
  await card.click();
  await page.waitForTimeout(1500);
}

async function checkTaskCompleted(supabase, workerSlug, beforeTime) {
  // Wait up to 90s for task to complete
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await supabase
      .from('tasks')
      .select('id,status,error_message,output')
      .eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162')
      .eq('worker_slug', workerSlug)
      .gte('created_at', beforeTime)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.[0]) {
      const t = data[0];
      if (t.status === 'completed') {
        const outputText = typeof t.output === 'string' ? t.output : JSON.stringify(t.output);
        return { pass: true, reason: `completed (${outputText?.length} chars): ${outputText?.slice(0,100).replace(/\n/g,' ')}...` };
      }
      if (t.status === 'failed') return { pass: false, reason: `failed: ${t.error_message?.slice(0,100)}` };
    }
  }
  return { pass: false, reason: 'Timed out waiting for task completion' };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  log('🔐 Logging in...');
  await login(page);
  log('✅ Logged in\n');

  // Holly — single form, no card picker
  log('\n🔍 Testing: Holly: repurpose blog post');
  try {
    const before = new Date().toISOString();
    await page.goto(`${BASE}/dashboard/workers/content-repurposer`);
    await page.waitForTimeout(2000);
    await page.fill('input[name="source_title"]', 'How AI Workers Replace Freelancers');
    await page.fill('textarea[name="original_content"]', 'AI workforce platforms are disrupting the $1.5 trillion freelance market. Companies can now replace expensive freelancers with specialized AI workers at a fraction of the cost. 3rdShift offers 82 specialized AI workers starting at $29/month.');
    // Multi-select platforms — try checking checkboxes
    const linkedinCheckbox = page.locator('label:has-text("LinkedIn"), input[value="LinkedIn"]').first();
    if (await linkedinCheckbox.isVisible()) await linkedinCheckbox.click();
    const xCheckbox = page.locator('label:has-text("X/Twitter"), input[value="X/Twitter"]').first();
    if (await xCheckbox.isVisible()) await xCheckbox.click();
    
    const submit = page.locator('button:has-text("Repurpose Content"), button:has-text("Submit"), button:has-text("Generate"), button[color="blue"]').first();
    await submit.waitFor({ timeout: 10000 });
    await submit.click();
    log('  → Submitted, checking DB...');
    const result = await checkTaskCompleted(supabase, 'content-repurposer', before);
    results.push({ name: 'Holly: repurpose blog post', ...result });
    log(`  ${result.pass ? '✅' : '❌'} ${result.reason.slice(0, 100)}`);
  } catch(e) {
    results.push({ name: 'Holly: repurpose blog post', pass: false, reason: e.message.slice(0,100) });
    log(`  ❌ ${e.message.slice(0,100)}`);
  }

  // Duncan — SWOT Analysis (7th mode)
  log('\n🔍 Testing: Duncan: SWOT Analysis mode');
  try {
    const before = new Date().toISOString();
    await page.goto(`${BASE}/dashboard/workers/market-research-analyst`);
    await page.waitForTimeout(2000);
    await selectCard(page, 'SWOT Analysis');
    // Fill the market field (all Duncan modes share it)
    const marketField = page.locator('input[name="market"]').first();
    await marketField.fill('AI workforce SaaS');
    const angleField = page.locator('textarea[name="product_angle"]').first();
    await angleField.fill('3rdShift — 82 specialized AI workers replacing freelancers at $29/mo');
    // SWOT-specific fields
    const bizField = page.locator('textarea[name="business_or_idea"]').first();
    if (await bizField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bizField.fill('AI workforce platform replacing freelancers');
    }
    const submit = page.locator('button:has-text("Research"), button:has-text("Run"), button:has-text("Submit"), button[color="blue"]').first();
    await submit.waitFor({ timeout: 10000 });
    await submit.click();
    log('  → Submitted, checking DB...');
    const result = await checkTaskCompleted(supabase, 'market-research-analyst', before);
    results.push({ name: 'Duncan: SWOT Analysis mode', ...result });
    log(`  ${result.pass ? '✅' : '❌'} ${result.reason.slice(0, 100)}`);
  } catch(e) {
    results.push({ name: 'Duncan: SWOT Analysis mode', pass: false, reason: e.message.slice(0,100) });
    log(`  ❌ ${e.message.slice(0,100)}`);
  }

  // Naru — Press Release mode
  log('\n🔍 Testing: Naru: Press Release mode');
  try {
    const before = new Date().toISOString();
    await page.goto(`${BASE}/dashboard/workers/whitepaper-writer`);
    await page.waitForTimeout(2000);
    await selectCard(page, 'Press Release');
    const headlineField = page.locator('input[name="headline_focus"]').first();
    if (await headlineField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await headlineField.fill('3rdShift launches AI workforce platform replacing freelancers');
    }
    const factsField = page.locator('textarea[name="key_facts"]').first();
    if (await factsField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await factsField.fill('Company: 3rdShift. Founded 2025. 82 AI workers. Plans from $29/mo. Replacing freelance market.');
    }
    // If no press_release fields showed, the topic/company fields may be showing instead
    const topicField = page.locator('textarea[name="topic"]').first();
    if (await topicField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await topicField.fill('AI workforce platform launch press release');
    }
    const submit = page.locator('button:has-text("Write"), button:has-text("Generate"), button:has-text("Submit"), button[color="blue"]').first();
    await submit.waitFor({ timeout: 10000 });
    await submit.click();
    log('  → Submitted, checking DB...');
    const result = await checkTaskCompleted(supabase, 'whitepaper-writer', before);
    results.push({ name: 'Naru: Press Release mode', ...result });
    log(`  ${result.pass ? '✅' : '❌'} ${result.reason.slice(0, 100)}`);
  } catch(e) {
    results.push({ name: 'Naru: Press Release mode', pass: false, reason: e.message.slice(0,100) });
    log(`  ❌ ${e.message.slice(0,100)}`);
  }

  // Lyra — Pinterest Content Director (old form still, but new modes)
  log('\n🔍 Testing: Lyra: Pin Pack mode');
  try {
    const before = new Date().toISOString();
    await page.goto(`${BASE}/dashboard/workers/pinterest-strategist`);
    await page.waitForTimeout(2000);
    await selectCard(page, 'Pin Pack');
    // Try both old and new field names
    const brandField = page.locator('input[name="brand_name"], input[name="business_or_niche"]').first();
    await brandField.fill('3rdShift AI workforce tools');
    const nicheField = page.locator('input[name="niche"]').first();
    if (await nicheField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nicheField.fill('AI tools for small business owners');
    }
    const submit = page.locator('button:has-text("→"), button:has-text("Submit"), button:has-text("Generate")').first();
    await submit.waitFor({ timeout: 10000 });
    await submit.click();
    log('  → Submitted, checking DB...');
    const result = await checkTaskCompleted(supabase, 'pinterest-strategist', before);
    results.push({ name: 'Lyra: Pin Pack mode', ...result });
    log(`  ${result.pass ? '✅' : '❌'} ${result.reason.slice(0, 100)}`);
  } catch(e) {
    results.push({ name: 'Lyra: Pin Pack mode', pass: false, reason: e.message.slice(0,100) });
    log(`  ❌ ${e.message.slice(0,100)}`);
  }

  // Sully — Naming Specialist (old form, new modes)
  log('\n🔍 Testing: Sully: Business Name mode');
  try {
    const before = new Date().toISOString();
    await page.goto(`${BASE}/dashboard/workers/product-naming-specialist`);
    await page.waitForTimeout(2000);
    await selectCard(page, 'Business Name');
    // Old form uses 'concept' field
    const conceptField = page.locator('textarea[name="concept"]').first();
    if (await conceptField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await conceptField.fill('AI workforce platform that replaces freelancers with 82 specialized AI workers at $29/month for small businesses');
    }
    const submit = page.locator('button:has-text("Generate Names"), button:has-text("Generate"), button[color="blue"]:not([disabled])').first();
    await submit.waitFor({ timeout: 10000 });
    await submit.click();
    log('  → Submitted, checking DB...');
    const result = await checkTaskCompleted(supabase, 'product-naming-specialist', before);
    results.push({ name: 'Sully: Business Name mode', ...result });
    log(`  ${result.pass ? '✅' : '❌'} ${result.reason.slice(0, 100)}`);
  } catch(e) {
    results.push({ name: 'Sully: Business Name mode', pass: false, reason: e.message.slice(0,100) });
    log(`  ❌ ${e.message.slice(0,100)}`);
  }

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
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
