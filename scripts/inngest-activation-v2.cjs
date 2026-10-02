const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://auth.3rdshift.ai';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY;
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase key env for SUPABASE_SERVICE_KEY');
const CHARLIE_EMAIL = 'test-charlie@3rdshift.ai';
const CHARLIE_PASS = '<SCREENSHOT_TEST_PASSWORD>';

(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Sign in as charlie
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email: CHARLIE_EMAIL, password: CHARLIE_PASS });
  if (signInErr || !signIn?.session) { console.log('Sign in error:', signInErr); process.exit(1); }
  const token = signIn.session.access_token;
  const userId = signIn.user.id;
  console.log('✅ Signed in as', CHARLIE_EMAIL, '| user_id:', userId);

  // Get workspace
  const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', userId).single();
  const workspaceId = member?.workspace_id;
  console.log('Workspace ID:', workspaceId);

  // Insert task
  const { data: taskData, error: insertErr } = await supabase.from('tasks').insert({
    user_id: userId,
    workspace_id: workspaceId,
    worker_slug: 'course-outline-builder',
    category: 'wc-cw',
    task_type: 'heavy',
    status: 'pending',
    input: {
      course_mode: 'signature',
      course_topic: 'Smarter Money in the AI Era — using AI tools for smarter retail investing decisions',
      expertise: 'Financial educator and YouTuber with 10+ years following markets. Host of Smarter Money in the AI Era channel (@JoshRagerYT). Covered AI tools for investors since 2022.',
      student_starting_point: 'Retail investors with 1-5 years experience who feel overwhelmed by information overload and unsure how to use AI tools without getting burned by hallucinations',
      student_transformation: 'By the end, they will be able to build a repeatable AI-assisted investment research process, screen stocks in under 30 minutes, and make data-driven portfolio decisions with confidence',
      student_blocker: 'Does not trust AI outputs for financial decisions — worried about hallucinations and bad data',
      num_modules: '6',
      include_capstone: true,
      price_point: '$997',
      platform: 'Kajabi',
      launch_style: 'Evergreen',
    },
  }).select('id').single();

  if (insertErr || !taskData) { console.log('Insert error:', insertErr); process.exit(1); }
  const taskId = taskData.id;
  console.log('✅ Task created:', taskId);

  // Call execute-task and measure response time
  const submitStart = Date.now();
  const res = await fetch('https://3rdshift.ai/api/execute-task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-workspace-id': workspaceId,
    },
    body: JSON.stringify({ taskId }),
  });
  const elapsed = Date.now() - submitStart;
  const resData = await res.json().catch(() => ({}));

  console.log(`\n=== STEP 3: IMMEDIATE RESPONSE ===`);
  console.log('Response time:', elapsed + 'ms', elapsed < 2000 ? '✅' : '❌ SLOW');
  console.log('HTTP status:', res.status);
  console.log('Response body:', JSON.stringify(resData));
  console.log('Status queued:', resData.status === 'queued' ? '✅' : '❌ got: ' + resData.status);

  if (resData.status !== 'queued') {
    console.log('\n❌ FAIL: Task not queued. Check flag and redeploy.');
    process.exit(1);
  }

  console.log('\n=== STEP 5: POLLING FOR COMPLETION (max 15 min) ===');
  let attempts = 0;
  while (attempts < 90) {
    await new Promise(r => setTimeout(r, 10000));
    attempts++;
    const { data: t } = await supabase.from('tasks').select('status, output, output_status, completed_at').eq('id', taskId).single();
    const elapsed2 = attempts * 10;
    process.stdout.write(`[${elapsed2}s] status: ${t?.status}\n`);
    if (t?.status === 'completed' || t?.status === 'failed') {
      console.log('\n=== STEP 6: COMPLETION VERIFY ===');
      console.log('Status:', t.status === 'completed' ? '✅ completed' : '❌ FAILED');
      console.log('Output status:', t.output_status === 'complete' ? '✅ ' + t.output_status : '⚠️ ' + t.output_status);
      const charCount = t.output?.text?.length || 0;
      console.log('Output chars:', charCount, charCount > 30000 ? '✅' : '⚠️ low');
      console.log('Completed at:', t.completed_at);
      if (t.output?.text) {
        const lastChars = t.output.text.slice(-150);
        console.log('Last 150 chars:', JSON.stringify(lastChars));
        const cleanEnd = /[.!?"""'\])}]$/.test(t.output.text.trim());
        console.log('Clean ending:', cleanEnd ? '✅' : '❌ possible truncation');
      }
      if (t.status === 'failed') console.log('Error:', t.output?.error);
      break;
    }
  }
  if (attempts >= 90) console.log('⚠️ Timeout: task not complete in 15 min');
})();
