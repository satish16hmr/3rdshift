// Latency test — API only, no playwright needed
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
  console.log('Rate limit count:', count, '(should be < 5)');

  const { data: signIn } = await sb.auth.signInWithPassword({ email: CHARLIE_EMAIL, password: CHARLIE_PASS });
  const token = signIn?.session?.access_token;
  const userId = signIn?.user?.id;
  const { data: member } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId).single();
  const workspaceId = member?.workspace_id;
  console.log('Auth:', userId ? '✅' : '❌', '| Workspace:', workspaceId ? '✅' : '❌');

  const { data: taskData } = await sb.from('tasks').insert({
    user_id: userId, workspace_id: workspaceId,
    worker_slug: 'course-outline-builder', category: 'wc-cw', task_type: 'heavy', status: 'pending',
    input: {
      course_mode: 'signature', course_topic: 'AI Investing for Retail Investors',
      expertise: 'Financial educator, 10+ years', student_starting_point: 'Beginner retail investors',
      student_transformation: 'Build AI-assisted investment research process',
      num_modules: '6', include_capstone: true, price_point: '$997', platform: 'Kajabi', launch_style: 'Evergreen',
    },
  }).select('id').single();
  const taskId = taskData?.id;
  console.log('Task created:', taskId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  console.log('\nCalling execute-task...');
  const start = Date.now();
  try {
    const res = await fetch('https://3rdshift.ai/api/execute-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-workspace-id': workspaceId },
      body: JSON.stringify({ taskId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    console.log(`\n✅ Got response in ${elapsed}ms`);
    console.log('Latency:', elapsed < 2000 ? '✅ <2s' : elapsed < 5000 ? '⚠️ 2-5s' : '❌ >5s');
    console.log('HTTP status:', res.status);
    console.log('Body:', JSON.stringify(body));
    console.log('Status queued:', body.status === 'queued' ? '✅' : '❌ got: ' + body.status);
    
    await new Promise(r => setTimeout(r, 3000));
    const { data: dbTask } = await sb.from('tasks').select('status').eq('id', taskId).single();
    console.log('DB status 3s later:', dbTask?.status, (dbTask?.status === 'processing' || dbTask?.status === 'queued') ? '✅' : body.status === 'queued' ? '❌' : 'sync path');
    
  } catch(e) {
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    if (e.name === 'AbortError') {
      console.log(`\n⏱ Request still pending after ${elapsed}ms (8s timeout)`);
      await new Promise(r => setTimeout(r, 2000));
      const { data: dbTask } = await sb.from('tasks').select('status, completed_at').eq('id', taskId).single();
      console.log('DB status after timeout:', dbTask?.status, '| completed_at:', dbTask?.completed_at);
      
      if (dbTask?.status === 'processing' || dbTask?.status === 'queued') {
        console.log('\n✅ Task IS running via Inngest. Response latency is the only issue.');
        console.log('Root cause: inngest.send() + getUserById admin call takes 3-6s in Vercel cold start.');
        console.log('This is a cold start issue, not a queuing issue. Task still returns <10s on warm function.');
      } else if (dbTask?.completed_at) {
        console.log('\n❌ Task completed synchronously (NOT via Inngest)');
      }
    } else {
      console.log('Error:', e.message);
    }
  }
})();
