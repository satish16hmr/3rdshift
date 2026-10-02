/**
 * Directly run the proactive updates cron logic inline
 * (bypasses HTTP auth — runs the same code as the cron route)
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SERPER_KEY = process.env.SERPER_API_KEY;
const APOLLO_KEY = process.env.APOLLO_API_KEY;

// ─── Worker config ────────────────────────────────────────────────────────────
const PROACTIVE_WORKERS = [
  { slug: 'hook-specialist', personaName: 'Sam', role: 'Hook Specialist', suggestionTypes: ['idea', 'reminder'], needsExternalData: false, minPlan: 'starter' },
  { slug: 'content-writer',           personaName: 'Ava', role: 'Short-Form Content Writer', suggestionTypes: ['reminder', 'idea'], needsExternalData: false, minPlan: 'starter' },
  { slug: 'email-copywriter',         personaName: 'Mira', role: 'Email Copywriter', suggestionTypes: ['idea'], needsExternalData: false, minPlan: 'starter' },
  { slug: 'ad-copywriter',            personaName: 'Tate', role: 'Ad Copywriter', suggestionTypes: ['idea'], needsExternalData: false, minPlan: 'starter' },
  { slug: 'seo-strategist',           personaName: 'Kai', role: 'SEO Strategist', suggestionTypes: ['alert', 'encouragement'], needsExternalData: true, externalType: 'serper', minPlan: 'pro' },
  { slug: 'social-media-manager',     personaName: 'Ash', role: 'Social Media Strategist', suggestionTypes: ['idea'], needsExternalData: true, externalType: 'serper', minPlan: 'pro' },
  { slug: 'lead-generator',           personaName: 'Lenny', role: 'Lead Generator', suggestionTypes: ['alert'], needsExternalData: true, externalType: 'apollo', minPlan: 'operator' },
];

const PLAN_WORKER_LIMITS = { starter: 1, pro: 3, operator: 7 };
const PLAN_FREQUENCY = { starter: 1, pro: 3, operator: 3 };

async function callHaiku(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Haiku API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || 'SKIP';
}

async function fetchSerperData(query) {
  if (!SERPER_KEY) return null;
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.organic || [];
    if (!results.length) return null;
    return results.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}\nSource: ${r.link}`).join('\n\n');
  } catch { return null; }
}

function buildPrompt({ workerName, workerRole, suggestionType, brandContext, taskHistorySummary, pastSuggestions, externalData }) {
  const pastList = pastSuggestions.length
    ? pastSuggestions.map((s, i) => `${i+1}. ${s.slice(0, 100)}`).join('\n')
    : 'None yet.';
  return `You are ${workerName}, a ${workerRole} on the customer's AI team at 3rdShift.
Your job is to proactively bring one useful, actionable ${suggestionType} to the customer.

Rules:
- Speak in first person as ${workerName}
- Be specific and actionable — never vague
- Reference their brand, industry, or past work when relevant
- Do NOT repeat or closely resemble any past suggestions listed below
- Do NOT suggest topics they've already covered
- Keep it to 2-4 sentences max
- End with a clear next step the customer can take with you
- NEVER fabricate data — only use real data provided below
- If you cannot generate something genuinely useful, respond with exactly "SKIP"

Customer brand context:
${brandContext || 'Not provided.'}

Customer's recent task history:
${taskHistorySummary || 'No tasks yet.'}

Past suggestions (do not repeat):
${pastList}
${externalData ? `\nFresh data from today:\n${externalData}` : ''}

Generate one proactive suggestion now. If you cannot, respond with exactly: SKIP`;
}

function getWorkersForToday(userId, plan, dayOfYear, usedSlugs, workerOverrides) {
  const limit = PLAN_WORKER_LIMITS[plan] || 1;
  const planOrder = ['starter', 'pro', 'operator'];
  const planIdx = planOrder.indexOf(plan);
  const eligible = PROACTIVE_WORKERS.filter(w => {
    if (planOrder.indexOf(w.minPlan) > planIdx) return false;
    if (workerOverrides[w.slug] === false) return false;
    return true;
  });
  const userHash = userId.split('-').reduce((acc, part) => acc + parseInt(part.slice(0, 4) || '0', 16), 0);
  const offset = (dayOfYear + userHash) % Math.max(eligible.length, 1);
  const rotated = [];
  for (let i = 0; i < eligible.length && rotated.length < limit; i++) {
    const w = eligible[(offset + i) % eligible.length];
    if (!usedSlugs.has(w.slug)) rotated.push(w);
  }
  return rotated;
}

async function main() {
  console.log('=== Running Proactive Updates Cron (inline) ===\n');

  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, plan, brand_context, team_updates_settings, team_updates_activated')
    .eq('team_updates_activated', true)
    .in('plan', ['starter', 'pro', 'operator']);

  console.log(`Found ${profiles?.length || 0} activated profiles`);

  let suggestionsCreated = 0;

  for (const profile of profiles || []) {
    const settings = profile.team_updates_settings || {};
    if (settings.enabled === false) { console.log(`[${profile.id}] skipped: team updates off`); continue; }

    const maxPerWeek = settings.frequency === 'off' ? 0 : settings.frequency === 'once_weekly' ? 1 : PLAN_FREQUENCY[profile.plan] || 1;
    if (maxPerWeek === 0) continue;

    const { count: weekCount } = await supabase.from('team_updates').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).gte('created_at', oneWeekAgo);
    if ((weekCount || 0) >= maxPerWeek) { console.log(`[${profile.id}] skipped: week limit (${weekCount}/${maxPerWeek})`); continue; }

    const { count: todayCount } = await supabase.from('team_updates').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).gte('created_at', todayStart.toISOString());
    if ((todayCount || 0) > 0) { console.log(`[${profile.id}] skipped: already got suggestion today`); continue; }

    const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', profile.id).single();
    if (!workspace) { console.log(`[${profile.id}] skipped: no workspace`); continue; }

    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: tasks } = await supabase.from('tasks').select('worker_slug, input, created_at').eq('workspace_id', workspace.id).eq('status', 'complete').gte('created_at', ninetyDaysAgo).order('created_at', { ascending: false }).limit(30);

    if ((tasks?.length || 0) < 3) { console.log(`[${profile.id}] skipped: only ${tasks?.length || 0} tasks (need 3+)`); continue; }

    const taskHistorySummary = (tasks || []).slice(0, 15).map(t => {
      const inp = t.input || {};
      const title = inp.topic || inp.subject || inp.title || inp.keyword || t.worker_slug;
      return `- ${t.worker_slug}: "${title}" (${t.created_at.slice(0, 10)})`;
    }).join('\n');

    const { data: weekSugs } = await supabase.from('team_updates').select('worker_slug, suggestion_text').eq('user_id', profile.id).gte('created_at', oneWeekAgo).limit(10);
    const usedSlugsThisWeek = new Set((weekSugs || []).map(s => s.worker_slug));

    const workerOverrides = settings.worker_overrides || {};
    const workersToday = getWorkersForToday(profile.id, profile.plan, dayOfYear, usedSlugsThisWeek, workerOverrides);

    console.log(`\n[${profile.id}] plan=${profile.plan} workers today: ${workersToday.map(w => w.personaName).join(', ') || 'none'}`);

    const brandCtx = profile.brand_context || {};
    const brandContextStr = [
      brandCtx.company_name ? `Company: ${brandCtx.company_name}` : '',
      brandCtx.industry ? `Industry: ${brandCtx.industry}` : '',
      brandCtx.audience ? `Target audience: ${brandCtx.audience}` : '',
      brandCtx.tone ? `Tone: ${brandCtx.tone}` : '',
      brandCtx.competitors ? `Competitors: ${brandCtx.competitors}` : '',
      brandCtx.additional_context ? `Additional: ${brandCtx.additional_context}` : '',
    ].filter(Boolean).join('\n');

    for (const worker of workersToday) {
      try {
        const { data: pastSugsData } = await supabase.from('team_updates').select('suggestion_text').eq('user_id', profile.id).eq('worker_slug', worker.slug).order('created_at', { ascending: false }).limit(10);
        const pastSuggestions = (pastSugsData || []).map(s => s.suggestion_text);

        let externalData = null;
        if (worker.needsExternalData && worker.externalType === 'serper') {
          const query = worker.slug === 'seo-strategist'
            ? `${brandCtx.competitors?.split(',')[0]?.trim() || ''} blog content ${brandCtx.industry || 'business'} ${now.getFullYear()}`
            : `trending topics ${brandCtx.industry || 'small business'} social media ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
          externalData = await fetchSerperData(query.trim());
          if (!externalData) { console.log(`  ${worker.personaName}: SKIP (no Serper data)`); continue; }
        }

        const suggestionType = worker.suggestionTypes[dayOfYear % worker.suggestionTypes.length];
        const prompt = buildPrompt({ workerName: worker.personaName, workerRole: worker.role, suggestionType, brandContext: brandContextStr, taskHistorySummary, pastSuggestions, externalData });

        console.log(`  ${worker.personaName}: calling Haiku...`);
        const suggestionText = await callHaiku(prompt);

        if (!suggestionText || suggestionText.trim().toUpperCase() === 'SKIP') {
          console.log(`  ${worker.personaName}: returned SKIP`);
          continue;
        }

        console.log(`  ${worker.personaName}: got suggestion: "${suggestionText.slice(0, 80)}..."`);

        const chatContent = `💡 ${suggestionType.charAt(0).toUpperCase() + suggestionType.slice(1)} from ${worker.personaName}\n\n${suggestionText}\n\n[Take action →]`;
        const previewText = suggestionText.split('\n')[0].slice(0, 120);

        const { data: insertedMsg, error: chatErr } = await supabase
          .from('team_chat_messages')
          .insert({ user_id: profile.id, workspace_id: workspace.id, member_id: worker.slug, role: 'member', content: chatContent })
          .select('id').single();

        if (chatErr || !insertedMsg) {
          console.error(`  ${worker.personaName}: chat insert failed:`, chatErr?.message);
          continue;
        }

        const { error: updateErr } = await supabase.from('team_updates').insert({
          workspace_id: workspace.id,
          user_id: profile.id,
          worker_slug: worker.slug,
          suggestion_type: suggestionType,
          suggestion_text: suggestionText,
          preview_text: previewText,
          source_data: externalData ? { raw: externalData.slice(0, 500) } : null,
          chat_message_id: insertedMsg.id,
          read: false,
          dismissed: false,
        });

        if (updateErr) {
          console.error(`  ${worker.personaName}: team_updates insert failed:`, updateErr.message);
        } else {
          suggestionsCreated++;
          console.log(`  ✅ ${worker.personaName} suggestion created and inserted into chat`);
        }
      } catch (err) {
        console.error(`  ${worker.personaName}: error:`, err.message);
      }
    }
  }

  console.log(`\n=== Done. Suggestions created: ${suggestionsCreated} ===`);

  // Show results
  const { data: allUpdates } = await supabase.from('team_updates').select('user_id, worker_slug, suggestion_type, preview_text, created_at').gte('created_at', todayStart.toISOString());
  console.log('\nToday\'s team_updates rows:');
  (allUpdates || []).forEach(u => console.log(`  - [${u.worker_slug}] ${u.suggestion_type}: "${u.preview_text?.slice(0, 80)}"`));

  // Check chat messages
  const { data: chatMsgs } = await supabase.from('team_chat_messages').select('member_id, content, created_at').like('content', '💡%').gte('created_at', todayStart.toISOString());
  console.log('\nProactive chat messages inserted today:');
  (chatMsgs || []).forEach(m => console.log(`  - [${m.member_id}]: "${m.content.slice(0, 100)}..."`));
}

main().catch(console.error);
