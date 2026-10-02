/**
 * Lenny execution — final screenshots
 */
const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const BASE = 'https://3rdshift.ai';
const OUT = path.join(__dirname, '../screenshots/lenny-final');
fs.mkdirSync(OUT, { recursive: true });

const OP_ID = 'beb11849-c77e-4ba0-84a5-12c85e087162';
const OP_WS = '908596ba-f86a-4ca6-b8e6-a6e70101d081';

async function shot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log('📸', name);
  return file;
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
  await p.waitForTimeout(7000);
  return { page: p, ctx };
}

async function seedFreshLenny() {
  // Clear Lenny chat
  await supabase.from('team_chat_messages').delete().eq('member_id', 'lead-generator').eq('user_id', OP_ID);
  const { data: oldTu } = await supabase.from('team_updates').select('chat_message_id').eq('user_id', OP_ID).eq('worker_slug', 'lead-generator');
  if (oldTu?.length) await supabase.from('team_chat_messages').delete().in('id', oldTu.map(t => t.chat_message_id).filter(Boolean));
  await supabase.from('team_updates').delete().eq('user_id', OP_ID).eq('worker_slug', 'lead-generator');
  await supabase.from('profiles').update({ heavy_credits_remaining: 50 }).eq('id', OP_ID);
  const text = 'There are 5 founder/CEO contacts matching your criteria right now — all at SaaS and e-commerce companies under 200 people. Want me to pull the full list with contact details?';
  const { data: msg } = await supabase.from('team_chat_messages').insert({ user_id: OP_ID, workspace_id: OP_WS, member_id: 'lead-generator', role: 'member', content: '💡 Alert from Lenny\n\n' + text + '\n\n[Take action →]' }).select('id').single();
  const { data: tu } = await supabase.from('team_updates').insert({ workspace_id: OP_WS, user_id: OP_ID, worker_slug: 'lead-generator', suggestion_type: 'alert', suggestion_text: text, preview_text: 'There are 5 founder/CEO contacts matching your criteria.', source_data: { query: 'leads', parsed_icp: { job_titles: 'Founder, CEO, Head of Operations', industry: 'SaaS, E-commerce', company_size: 'under 200 employees', location: 'United States', match_count: 5 } }, chat_message_id: msg.id, read: false }).select('id').single();
  return { msgId: msg.id, tuId: tu.data?.id };
}

async function main() {
  const browser = await chromium.launch({ headless: false });

  // ── SHOT 1: Lenny chat with "Run Lenny" button ────────────────────────────
  console.log('\n── Shot 1: Lenny chat with button ──');
  await seedFreshLenny();
  const { page, ctx } = await login(browser);
  await page.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await page.waitForTimeout(6000);
  await shot(page, '1-lenny-suggestion-with-button');

  // ── SHOT 2: Button clicked → task running (via API then reload) ───────────
  console.log('\n── Shot 2: Task running / complete ──');
  // Trigger via API directly (Playwright can't fire React async onClick)
  const { data: tu } = await supabase.from('team_updates').select('id').eq('user_id', OP_ID).eq('worker_slug', 'lead-generator').single();
  const { data: { session: anonSess } } = await (require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )).auth.signInWithPassword({ email: 'test-roger@3rdshift.ai', password: '<SCREENSHOT_TEST_PASSWORD>' });

  const apiRes = await fetch(`${BASE}/api/run-proactive-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + anonSess.access_token },
    body: JSON.stringify({ team_update_id: tu?.id }),
  });
  const apiData = await apiRes.json();
  console.log('  API result:', apiRes.status, JSON.stringify(apiData));

  if (apiRes.ok && apiData.task_id) {
    // Trigger execute-task from API
    await fetch(`${BASE}/api/execute-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + anonSess.access_token },
      body: JSON.stringify({ taskId: apiData.task_id }),
    });
    // Wait for task to process
    console.log('  Waiting for task to complete...');
    await new Promise(r => setTimeout(r, 15000));
    // Navigate to result
    await page.goto(`${BASE}/dashboard/task-result/${apiData.task_id}`);
    await page.waitForTimeout(5000);
    await shot(page, '2-lenny-task-result-page');
    const hasResults = await page.evaluate(() => document.body.textContent?.length > 200 && !document.body.textContent?.includes('error'));
    console.log('  Results page loaded:', hasResults);
  }

  // ── SHOT 3: Chat reply "yeah run it" → Lenny responds without questions ───
  console.log('\n── Shot 3: Chat reply — no redundant questions ──');
  await seedFreshLenny();
  await page.goto(`${BASE}/dashboard/workers/lead-generator?tab=chat`);
  await page.waitForTimeout(5000);
  await page.fill('textarea', 'yeah run it');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(12000);
  await shot(page, '3-chat-reply-no-redundant-questions');
  const chatReply = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll('[class*="rounded-2xl"]'));
    const last = [...msgs].reverse().find(m => !m.closest('[class*="flex-row-reverse"]'));
    return { text: last?.textContent?.slice(0, 150), hasRunBtn: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run Lenny')) };
  });
  console.log('  Reply:', chatReply.text?.slice(0, 80), '| has button:', chatReply.hasRunBtn);

  // ── SHOT 4: No credits → locked button ───────────────────────────────────
  console.log('\n── Shot 4: No credits locked ──');
  await seedFreshLenny();
  await supabase.from('profiles').update({ heavy_credits_remaining: 0 }).eq('id', OP_ID);
  await page.reload();
  await page.waitForURL('**/dashboard/workers/lead-generator**');
  await page.waitForTimeout(6000);
  await shot(page, '4-no-credits-locked-button');
  const locked = await page.evaluate(() => !!Array.from(document.querySelectorAll('a, button')).find(b => b.textContent?.includes('Upgrade to run')));
  console.log('  Locked button:', locked);
  await supabase.from('profiles').update({ heavy_credits_remaining: 50 }).eq('id', OP_ID);

  // ── SHOT 5: Criteria modification in chat ─────────────────────────────────
  console.log('\n── Shot 5: Criteria modification ──');
  await seedFreshLenny();
  await page.reload();
  await page.waitForURL('**/dashboard/workers/lead-generator**');
  await page.waitForTimeout(5000);
  await page.fill('textarea', 'yes but only marketing directors, not CEOs');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(12000);
  await shot(page, '5-criteria-modification');
  const modReply = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll('[class*="rounded-2xl"]'));
    const last = [...msgs].reverse().find(m => !m.closest('[class*="flex-row-reverse"]'));
    return { text: last?.textContent?.slice(0, 150) };
  });
  console.log('  Modified reply:', modReply.text?.slice(0, 80));

  await ctx.close();
  await browser.close();
  console.log('\n✅ All shots saved to', OUT);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
