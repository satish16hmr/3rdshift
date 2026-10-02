/**
 * Final 5 items verification — screenshots for every check
 */
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
  console.log(`  📸 ${name}`);
  return file;
}

async function login(browser, email, pass = '<SCREENSHOT_TEST_PASSWORD>') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', pass);
  await p.waitForTimeout(400);
  await p.click('button:has-text("Log in")');
  await p.waitForURL('**/dashboard**', { timeout: 20000 });
  await p.waitForTimeout(7000);
  return { page: p, ctx };
}

async function clickBell(page) {
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bell = btns.find(b => b.dataset?.teamUpdatesBell === 'true' ||
      (b.getAttribute('aria-label') === 'Notifications' && b.getBoundingClientRect().width > 0));
    if (bell) bell.click();
  });
  await page.waitForTimeout(2000);
}

async function runCron(path) {
  const r = await fetch(`${BASE}${path}`, { method: 'GET', headers: { 'x-vercel-cron': '1' } });
  return r.json().catch(() => ({}));
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const { page, ctx } = await login(browser, 'test-roger@3rdshift.ai');

  // ─── ITEM 4: Suggestion sweep — all 6 workers ──────────────────────────
  console.log('\n═══ ITEM 4: SUGGESTION SWEEP — ALL 6 WORKERS ═══');

  // Notification panel showing all 6
  await clickBell(page);
  await shot(page, 'ITEM4-01-panel-all-6-workers');

  const panelCheck = await page.evaluate(() => {
    const panel = document.querySelector('[class*="fixed inset-y-0 right-0"]');
    const rows = panel?.querySelectorAll('button.w-full');
    return {
      count: rows?.length,
      hasSkip: panel?.textContent?.includes('SKIP'),
      workers: Array.from(rows || []).map(r => r.textContent?.slice(0, 60)),
    };
  });
  console.log('Panel rows:', panelCheck.count, '| hasSkip:', panelCheck.hasSkip);
  panelCheck.workers?.forEach(w => console.log(' -', w?.slice(0, 50)));

  // Each worker's chat — Sam, Mira, Tate, Kai, Ash, Lenny
  const chatWorkers = [
    { slug: 'long-form-article-writer', name: 'Sam' },
    { slug: 'email-copywriter', name: 'Mira' },
    { slug: 'ad-copywriter', name: 'Tate' },
    { slug: 'seo-strategist', name: 'Kai' },
    { slug: 'social-media-manager', name: 'Ash' },
    { slug: 'lead-generator', name: 'Lenny' },
  ];

  for (const w of chatWorkers) {
    await page.goto(`${BASE}/dashboard/workers/${w.slug}?tab=chat`);
    await page.waitForTimeout(5000);
    await shot(page, `ITEM4-${w.name}-chat`);
    const chatCheck = await page.evaluate(() => ({
      hasSuggestion: document.body.textContent?.includes('[Take action →]') || document.body.textContent?.includes('Reply below'),
      hasBlue: document.querySelectorAll('[class*="bg-blue-50"]').length,
    }));
    console.log(`  ${w.name}: suggestion=${chatCheck.hasSuggestion} | blue=${chatCheck.hasBlue}`);
  }

  // ─── ITEM 1: Lenny "Run Lenny" button ─────────────────────────────────
  console.log('\n═══ ITEM 1: LENNY TAKE-ACTION ROUTING ═══');
  await page.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await page.waitForTimeout(5000);
  await shot(page, 'ITEM1-lenny-button-visible');

  const lennyBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent?.includes('Run Lenny'));
    return { found: !!runBtn, text: runBtn?.textContent?.trim() };
  });
  console.log('Lenny Run button:', lennyBtn);

  // Click the button and see if form opens with prefill
  if (lennyBtn.found) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      btns.find(b => b.textContent?.includes('Run Lenny'))?.click();
    });
    await page.waitForTimeout(3000);
    await shot(page, 'ITEM1-lenny-form-prefilled');
    const formCheck = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], select'));
      return inputs.map(i => ({ name: i.name || i.getAttribute('name') || i.id, value: i.value })).filter(f => f.value);
    });
    console.log('Pre-filled form fields:', JSON.stringify(formCheck, null, 2));
  }

  // ─── ITEM 2: Ava intro message ─────────────────────────────────────────
  console.log('\n═══ ITEM 2: AVA INTRO MESSAGE ═══');
  // Trigger activate cron for a fresh test (using test-starter, deactivate first)
  await supabase.from('profiles').update({ team_updates_activated: false, team_updates_activated_at: null }).eq('id', '7cab4c5b-f4f2-42fe-a815-211d81ef5fa3');
  await supabase.from('profiles').update({ created_at: new Date(Date.now() - 10*24*60*60*1000).toISOString() }).eq('id', '7cab4c5b-f4f2-42fe-a815-211d81ef5fa3');
  // Clear starter's Ava intro if any
  await supabase.from('team_updates').delete().eq('user_id', '7cab4c5b-f4f2-42fe-a815-211d81ef5fa3').eq('worker_slug', 'ava-team-lead');
  await supabase.from('team_chat_messages').delete().like('content', '⭐%').eq('user_id', '7cab4c5b-f4f2-42fe-a815-211d81ef5fa3');

  const activateCron = await runCron('/api/cron/activate-team-updates');
  console.log('Activate cron result:', JSON.stringify(activateCron));
  await new Promise(r => setTimeout(r, 2000));

  // Check for intro message
  const { data: introMsg } = await supabase.from('team_updates').select('suggestion_text, worker_slug').eq('user_id', '7cab4c5b-f4f2-42fe-a815-211d81ef5fa3').eq('worker_slug', 'ava-team-lead');
  console.log('Ava intro in team_updates:', introMsg?.length, introMsg?.[0]?.suggestion_text?.slice(0, 80));

  // Show in starter chat
  await ctx.close();
  const { page: stPage, ctx: stCtx } = await login(browser, 'test-starter@3rdshift.ai');
  await stPage.goto(`${BASE}/dashboard/workers/content-writer?tab=chat`);
  await stPage.waitForTimeout(5000);
  await shot(stPage, 'ITEM2-ava-intro-in-chat');
  const introVisible = await stPage.evaluate(() => document.body.textContent?.includes("I'm Ava") || document.body.textContent?.includes('Welcome aboard'));
  console.log('Ava intro visible in chat:', introVisible);
  await stCtx.close();

  // ─── ITEM 3: Ava toggle in Settings ───────────────────────────────────
  console.log('\n═══ ITEM 3: AVA TOGGLE IN SETTINGS ═══');
  const { page: p3, ctx: ctx3 } = await login(browser, 'test-roger@3rdshift.ai');
  await p3.goto(`${BASE}/dashboard/settings`);
  await p3.waitForTimeout(4000);
  await p3.evaluate(() => {
    const sections = document.querySelectorAll('section');
    for (const s of sections) { if (s.textContent?.includes('Team Updates')) { s.scrollIntoView({ behavior: 'instant', block: 'start' }); break; } }
  });
  await p3.waitForTimeout(500);
  await shot(p3, 'ITEM3-settings-with-ava-toggle');
  const avaToggleVisible = await p3.evaluate(() => document.body.textContent?.includes('Team milestones & check-ins'));
  console.log('Ava toggle visible:', avaToggleVisible);

  // ─── ITEM 5: PHASE 4 CROSS-SYSTEM VERIFICATION ────────────────────────
  console.log('\n═══ ITEM 5: PHASE 4 CROSS-SYSTEM VERIFICATION ═══');

  // 5a: One-per-day test
  await supabase.from('profiles').update({ last_notification_date: null }).eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  await supabase.from('team_updates').delete().eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  const cron1 = await runCron('/api/cron/proactive-updates');
  await new Promise(r => setTimeout(r, 3000));
  const { data: after1 } = await supabase.from('team_updates').select('worker_slug').eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  console.log('5a System 1:', JSON.stringify(cron1), '| suggestions:', after1?.length, after1?.map(r => r.worker_slug).join(', '));

  const cron2 = await runCron('/api/cron/ava-team-lead');
  await new Promise(r => setTimeout(r, 2000));
  const { data: after2 } = await supabase.from('team_updates').select('worker_slug, suggestion_type').eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  const avaRow = after2?.find(r => r.worker_slug === 'ava-team-lead');
  console.log('5a System 2 (should be skipped since System 1 fired):', JSON.stringify(cron2), '| Ava fired:', !!avaRow);

  // Screenshot the final DB state
  await p3.goto(`${BASE}/dashboard`);
  await p3.waitForTimeout(5000);
  await shot(p3, 'ITEM5a-one-per-day-verified');

  // 5b: Settings toggles — Ash OFF
  await supabase.from('profiles').update({ team_updates_settings: { enabled: true, frequency: 'few_times_weekly', worker_overrides: { 'social-media-manager': false } } }).eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  await supabase.from('team_updates').delete().eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  await supabase.from('profiles').update({ last_notification_date: null }).eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  const cronF2 = await runCron('/api/cron/proactive-updates');
  await new Promise(r => setTimeout(r, 3000));
  const { data: f2data } = await supabase.from('team_updates').select('worker_slug').eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  const ashFired = f2data?.some(r => r.worker_slug === 'social-media-manager');
  console.log('5b Ash toggle OFF test — Ash fired:', ashFired, '(should be false) | Workers:', f2data?.map(r => r.worker_slug).join(', '));
  await supabase.from('profiles').update({ team_updates_settings: { enabled: true, frequency: 'few_times_weekly', worker_overrides: {} } }).eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162');

  // 5c: Milestone savings math test
  const tasks50 = Array.from({ length: 55 }, (_, i) => ({
    user_id: 'beb11849-c77e-4ba0-84a5-12c85e087162',
    workspace_id: '908596ba-f86a-4ca6-b8e6-a6e70101d081',
    worker_slug: i < 20 ? 'long-form-article-writer' : i < 35 ? 'email-copywriter' : i < 45 ? 'ad-copywriter' : 'seo-strategist',
    category: 'Content',
    status: 'complete',
    input: { topic: 'Test task ' + i },
    output: { text: 'result' },
    created_at: new Date(Date.now() - (55-i)*24*60*60*1000).toISOString(),
  }));
  // Delete test tasks first
  await supabase.from('tasks').delete().eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162').like('input::text', '%Test task%');
  await supabase.from('tasks').insert(tasks50.slice(0, 55));
  // Reset milestone for test
  await supabase.from('profiles').update({ milestone_reached: 0, last_notification_date: null }).eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  const cronMilestone = await runCron('/api/cron/ava-team-lead');
  await new Promise(r => setTimeout(r, 2000));
  const { data: milestoneRow } = await supabase.from('team_updates').select('worker_slug, suggestion_type, suggestion_text').eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162').eq('suggestion_type', 'milestone').single();
  console.log('5c Milestone test result:', JSON.stringify(cronMilestone));
  console.log('Milestone message:', milestoneRow?.suggestion_text);
  // Check savings math: 20 content tasks @ $75 + 15 email @ $50 + 10 ad @ $60 + 10 seo @ $100 = 1500+750+600+1000 = $3850 → rounds to $3800
  const expectedSavingsText = milestoneRow?.suggestion_text?.match(/\$[\d,]+/)?.[0];
  console.log('Savings amount in message:', expectedSavingsText, '(expected ~$3800)');

  // Screenshot Ava milestone in chat
  await p3.goto(`${BASE}/dashboard/workers/content-writer?tab=chat`);
  await p3.waitForTimeout(5000);
  await shot(p3, 'ITEM5c-ava-milestone-in-chat');

  // Cleanup test tasks
  await supabase.from('tasks').delete().eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162').like('input::text', '%Test task%');
  await supabase.from('profiles').update({ milestone_reached: 0, last_notification_date: null }).eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162');

  // 5d: Plan gating screenshot  
  await supabase.from('team_updates').delete().eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162');
  const { data: opProf } = await supabase.from('profiles').select('plan').eq('id', 'beb11849-c77e-4ba0-84a5-12c85e087162').single();
  const { data: stProf } = await supabase.from('profiles').select('plan').eq('id', '7cab4c5b-f4f2-42fe-a815-211d81ef5fa3').single();
  console.log('5d Plans: operator=', opProf?.plan, '| starter=', stProf?.plan);
  await shot(p3, 'ITEM5d-dashboard-operator-plan');

  await ctx3.close();
  await browser.close();

  console.log('\n✅ All screenshots saved to', OUT);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
