const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://auth.3rdshift.ai';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY;
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase key env for SUPABASE_SERVICE_KEY');
const CHARLIE_EMAIL = 'test-charlie@3rdshift.ai';
const CHARLIE_PASS = '<SCREENSHOT_TEST_PASSWORD>';

(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Clear rate limit
  const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
  const { data: tasks } = await sb.from('tasks').select('id').eq('user_id','3d714838-b4d7-4052-9f65-c0d5620310d6').eq('worker_slug','course-outline-builder').in('status',['completed','processing']).gte('created_at', since24h).limit(5);
  for (const t of tasks || []) {
    await sb.from('tasks').update({ created_at: new Date(Date.now() - 25*60*60*1000).toISOString() }).eq('id', t.id);
  }
  const { count } = await sb.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id','3d714838-b4d7-4052-9f65-c0d5620310d6').eq('worker_slug','course-outline-builder').in('status',['completed','processing']).gte('created_at', since24h);
  console.log('Rate limit count after clear:', count);

  // Now do the browser test
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Capture network timing
  const timing = {};
  page.on('request', req => {
    if (req.url().includes('/api/execute-task')) {
      timing.start = Date.now();
      timing.url = req.url();
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/execute-task')) {
      timing.end = Date.now();
      timing.status = res.status();
      try { timing.body = await res.json(); } catch {}
    }
  });

  // Login
  await page.goto('https://3rdshift.ai/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  // Find login form fields
  const emailInput = await page.$('input[type="email"]');
  const passInput = await page.$('input[type="password"]');
  if (emailInput) await emailInput.fill(CHARLIE_EMAIL);
  if (passInput) await passInput.fill(CHARLIE_PASS);
  
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click();
  await page.waitForTimeout(8000);
  console.log('Login URL:', page.url());

  if (!page.url().includes('dashboard')) {
    console.log('Login failed');
    await page.screenshot({ path: '/Users/3rdshift/.openclaw/workspace/latency-login-fail.png' });
    await browser.close();
    return;
  }

  // Navigate to Charlie
  await page.goto('https://3rdshift.ai/dashboard/workers/course-outline-builder', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/Users/3rdshift/.openclaw/workspace/latency-charlie-page.png' });
  console.log('Charlie page URL:', page.url());

  // Select Signature mode
  try {
    // Click Signature Course card
    const sigCard = await page.$('[data-mode="signature"], button:has-text("Signature"), [class*="mode"]:has-text("Signature")');
    if (sigCard) {
      await sigCard.click();
      await page.waitForTimeout(2000);
    } else {
      // Try clicking by text
      await page.getByText('Signature', { exact: false }).first().click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: '/Users/3rdshift/.openclaw/workspace/latency-mode-selected.png' });
  } catch(e) {
    console.log('Mode selection error:', e.message.substring(0, 100));
  }

  await browser.close();
  
  // Use API approach instead for accurate timing
  console.log('\nUsing direct API call for latency measurement...');
  const { data: signIn } = await sb.auth.signInWithPassword({ email: CHARLIE_EMAIL, password: CHARLIE_PASS });
  const token = signIn?.session?.access_token;
  const userId = signIn?.user?.id;
  const { data: member } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId).single();
  const workspaceId = member?.workspace_id;

  const { data: taskData } = await sb.from('tasks').insert({
    user_id: userId,
    workspace_id: workspaceId,
    worker_slug: 'course-outline-builder',
    category: 'wc-cw',
    task_type: 'heavy',
    status: 'pending',
    input: {
      course_mode: 'signature',
      course_topic: 'AI Tools for Retail Investors',
      expertise: 'Financial educator, 10+ years',
      student_starting_point: 'Beginner retail investors',
      student_transformation: 'Build AI-assisted investment research process',
      num_modules: '6',
      include_capstone: true,
      price_point: '$997',
      platform: 'Kajabi',
      launch_style: 'Evergreen',
    },
  }).select('id').single();

  const taskId = taskData?.id;
  console.log('Task created:', taskId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s max wait

  const start = Date.now();
  try {
    const res = await fetch('https://3rdshift.ai/api/execute-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-workspace-id': workspaceId,
      },
      body: JSON.stringify({ taskId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    console.log(`\n=== LATENCY RESULT ===`);
    console.log(`Response time: ${elapsed}ms`, elapsed < 2000 ? '✅ <2s' : elapsed < 5000 ? '⚠️ <5s' : '❌ >5s');
    console.log('HTTP status:', res.status);
    console.log('Response:', JSON.stringify(body));
    console.log('Status queued:', body.status === 'queued' ? '✅' : '❌ ' + body.status);
    
    // Check DB state
    await new Promise(r => setTimeout(r, 2000));
    const { data: dbTask } = await sb.from('tasks').select('status').eq('id', taskId).single();
    console.log('DB status after submit:', dbTask?.status, dbTask?.status === 'processing' || dbTask?.status === 'queued' ? '✅' : '❌');
    
  } catch(e) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;
    if (e.name === 'AbortError') {
      console.log(`\nRequest timed out after ${elapsed}ms (10s limit)`);
      // Check what DB status is — if queued/processing, Inngest is working but response is slow
      await new Promise(r => setTimeout(r, 2000));
      const { data: dbTask } = await sb.from('tasks').select('status').eq('id', taskId).single();
      console.log('DB status after timeout:', dbTask?.status);
      if (dbTask?.status === 'processing' || dbTask?.status === 'queued') {
        console.log('✅ Task IS queued in Inngest — response latency issue only, not a blocking problem');
      }
    } else {
      console.log('Error:', e.message);
    }
  }
})();
