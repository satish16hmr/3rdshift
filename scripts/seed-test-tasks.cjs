/**
 * Seed completed tasks for test accounts so proactive updates can fire
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getUserId(email) {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find(u => u.email === email);
  return user?.id;
}

async function getWorkspace(userId) {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .single();
  return data;
}

async function seedTasks(userId, workspaceId) {
  const tasks = [
    {
      user_id: userId,
      workspace_id: workspaceId,
      worker_slug: 'long-form-article-writer',
      category: 'Content',
      status: 'complete',
      input: { topic: 'How AI is replacing freelancers in 2025', type: 'Blog Post' },
      output: { text: 'AI is transforming the freelance market...' },
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      user_id: userId,
      workspace_id: workspaceId,
      worker_slug: 'content-writer',
      category: 'Content',
      status: 'complete',
      input: { topic: 'Benefits of using AI workers for small businesses', type: 'Blog Post' },
      output: { text: 'Small businesses are adopting AI workers...' },
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      user_id: userId,
      workspace_id: workspaceId,
      worker_slug: 'email-copywriter',
      category: 'Content',
      status: 'complete',
      input: { subject: 'Welcome email sequence for SaaS product', email_type: 'Welcome Email' },
      output: { text: 'Welcome to our platform...' },
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      user_id: userId,
      workspace_id: workspaceId,
      worker_slug: 'seo-strategist',
      category: 'Writing & Copy',
      status: 'complete',
      input: { keyword: 'AI virtual assistants for business', industry: 'SaaS' },
      output: { text: 'SEO brief for AI virtual assistants...' },
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      user_id: userId,
      workspace_id: workspaceId,
      worker_slug: 'social-media-manager',
      category: 'Social Media',
      status: 'complete',
      input: { platform: 'LinkedIn', topic: 'AI productivity tips for entrepreneurs', content_type: 'Full Posts' },
      output: { text: '5 ways AI is changing how entrepreneurs work...' },
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasks)
    .select('id, worker_slug');

  if (error) console.error('Seed error:', error.message);
  else console.log(`✅ Seeded ${data.length} tasks for user ${userId}`);
  return data;
}

async function main() {
  const operatorId = await getUserId('test-roger@3rdshift.ai');
  const starterId = await getUserId('test-starter@3rdshift.ai');

  if (operatorId) {
    const ws = await getWorkspace(operatorId);
    if (ws) {
      // Clear existing seed tasks first
      await supabase.from('tasks').delete().eq('workspace_id', ws.id).eq('status', 'complete');
      await seedTasks(operatorId, ws.id);
    }
  }

  if (starterId) {
    const ws = await getWorkspace(starterId);
    if (ws) {
      await supabase.from('tasks').delete().eq('workspace_id', ws.id).eq('status', 'complete');
      // Starter gets 3 tasks minimum
      const tasks = [
        {
          user_id: starterId,
          workspace_id: ws.id,
          worker_slug: 'content-writer',
          category: 'Content',
          status: 'complete',
          input: { topic: 'Productivity hacks for remote workers', type: 'Blog Post' },
          output: { text: 'Remote work productivity...' },
          created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          user_id: starterId,
          workspace_id: ws.id,
          worker_slug: 'email-copywriter',
          category: 'Content',
          status: 'complete',
          input: { subject: 'Newsletter intro', email_type: 'Newsletter' },
          output: { text: 'Welcome to the newsletter...' },
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          user_id: starterId,
          workspace_id: ws.id,
          worker_slug: 'long-form-article-writer',
          category: 'Content',
          status: 'complete',
          input: { topic: 'How to automate your business', type: 'Blog Post' },
          output: { text: 'Automation is key...' },
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
      const { data, error } = await supabase.from('tasks').insert(tasks).select('id, worker_slug');
      if (error) console.error('Starter seed error:', error.message);
      else console.log(`✅ Seeded ${data.length} tasks for starter user ${starterId}`);
    }
  }

  console.log('\nDone! Now run test-proactive-updates.cjs');
}

main().catch(console.error);
