/**
 * Run proactive cron inline with full logging of Haiku responses
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const OPERATOR_ID = 'beb11849-c77e-4ba0-84a5-12c85e087162';
const OPERATOR_WS = '908596ba-f86a-4ca6-b8e6-a6e70101d081';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SERPER_KEY = process.env.SERPER_API_KEY;
const APOLLO_KEY = process.env.APOLLO_API_KEY;

function isSkipResponse(response) {
  if (!response || typeof response !== 'string') return true;
  const trimmed = response.trim();
  if (trimmed.length < 50) return true;
  if (trimmed.toUpperCase().startsWith('SKIP')) return true;
  const rejectPatterns = ['i need more context','i need more information',"i don't have enough",'i need to be honest',"i'm not able to",'i cannot provide',"i'm unable to",'without more details','without more information','without knowing more','i would need to know',"i'd need more",'hard to suggest','difficult to recommend','not enough data','not enough information',"i'm not sure what",'could you provide','could you share','can you tell me','let me know more','please provide','please share'];
  const lower = trimmed.toLowerCase();
  for (const pattern of rejectPatterns) { if (lower.includes(pattern)) return true; }
  return false;
}

async function callHaiku(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Haiku ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || 'SKIP';
}

async function fetchSerper(query) {
  if (!SERPER_KEY) return null;
  try {
    const res = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY }, body: JSON.stringify({ q: query, num: 5 }) });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.organic || [];
    if (!results.length) return null;
    return results.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}\nSource: ${r.link}`).join('\n\n');
  } catch { return null; }
}

async function fetchApollo(titles) {
  if (!APOLLO_KEY) return null;
  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': APOLLO_KEY },
      body: JSON.stringify({ per_page: 5, page: 1, person_titles: titles }),
    });
    if (!res.ok) { console.log('Apollo status:', res.status, await res.text()); return null; }
    const data = await res.json();
    const people = data?.people || [];
    if (!people.length) return null;
    return people.map((p, i) => {
      const name = p.name || (p.first_name ? `${p.first_name} ${p.last_name_obfuscated || ''}`.trim() : 'Contact');
      return `[${i+1}] ${name} — ${p.title}${p.organization?.name ? ` at ${p.organization.name}` : ''}`;
    }).join('\n');
  } catch (e) { console.log('Apollo error:', e.message); return null; }
}

async function main() {
  console.log('=== Verbose cron run ===\n');
  
  // Get profile + brand context
  const { data: profile } = await supabase.from('profiles').select('plan, brand_context, team_updates_settings, team_updates_activated').eq('id', OPERATOR_ID).single();
  console.log('Plan:', profile?.plan, '| Activated:', profile?.team_updates_activated);
  // Parse brand_context — may be string or object
  const rawBrandCtx = profile?.brand_context;
  const brandCtxParsed = typeof rawBrandCtx === 'string' ? (() => { try { return JSON.parse(rawBrandCtx); } catch { return {}; } })() : (rawBrandCtx || {});
  console.log('Brand context company:', brandCtxParsed.company_name, '| industry:', brandCtxParsed.industry);
  
  // Get tasks
  const ninetyDaysAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString();
  const { data: tasks } = await supabase.from('tasks').select('worker_slug, input, created_at').eq('workspace_id', OPERATOR_WS).eq('status', 'complete').gte('created_at', ninetyDaysAgo).order('created_at', { ascending: false }).limit(30);
  console.log('\nTask history:');
  tasks?.forEach(t => { const inp = t.input || {}; const title = inp.topic || inp.subject || inp.keyword || inp.icp_title || t.worker_slug; console.log(` - ${t.worker_slug}: "${title}"`); });

  const taskHistorySummary = (tasks || []).slice(0, 15).map(t => { const inp = t.input || {}; const title = inp.topic || inp.subject || inp.title || inp.keyword || t.worker_slug; return `- ${t.worker_slug}: "${title}" (${t.created_at.slice(0, 10)})`; }).join('\n');
  const brandCtx = brandCtxParsed;
  const brandContextStr = [
    brandCtx.company_name ? `Company: ${brandCtx.company_name}` : '',
    brandCtx.industry ? `Industry: ${brandCtx.industry}` : '',
    brandCtx.audience ? `Target audience: ${brandCtx.audience}` : '',
    brandCtx.tone ? `Tone: ${brandCtx.tone}` : '',
    brandCtx.competitors ? `Competitors: ${brandCtx.competitors}` : '',
    brandCtx.additional_context ? `Additional: ${brandCtx.additional_context}` : '',
  ].filter(Boolean).join('\n');

  // Test workers in order: Ava, Sam, Mira, Tate, Kai, Ash, Lenny
  const workers = [
    { slug: 'content-writer', name: 'Ava', role: 'Short-Form Content Writer', types: ['reminder', 'idea'], external: null },
    { slug: 'hook-specialist', name: 'Sam', role: 'Hook Specialist', types: ['idea', 'reminder'], external: null },
    { slug: 'email-copywriter', name: 'Mira', role: 'Email Copywriter', types: ['idea'], external: null },
    { slug: 'ad-copywriter', name: 'Tate', role: 'Ad Copywriter', types: ['idea'], external: null },
    { slug: 'seo-strategist', name: 'Kai', role: 'SEO Strategist', types: ['alert', 'encouragement'], external: 'serper' },
    { slug: 'social-media-manager', name: 'Ash', role: 'Social Media Strategist', types: ['idea'], external: 'serper' },
    { slug: 'lead-generator', name: 'Lenny', role: 'Lead Generator', types: ['alert'], external: 'apollo' },
  ];

  const results = [];

  for (const w of workers) {
    console.log(`\n--- ${w.name} (${w.slug}) ---`);
    
    let externalData = null;
    
    if (w.external === 'serper') {
      let query = '';
      if (w.slug === 'seo-strategist') {
        const kaiTasks = (tasks || []).filter(t => t.worker_slug === 'seo-strategist');
        const kaiInput = kaiTasks[0]?.input || {};
        const keyword = kaiInput.keyword || kaiInput.topic || '';
        const competitors = brandCtx.competitors || '';
        if (keyword && competitors) {
          query = `${competitors.split(',')[0].trim()} ${keyword} blog 2026`;
        } else if (keyword) {
          query = `${keyword} competitor articles 2026`;
        } else if (competitors) {
          query = `${competitors.split(',')[0].trim()} blog ${brandCtx.industry || ''} 2026`;
        } else {
          query = `${brandCtx.industry || 'SaaS'} SEO content trends 2026`;
        }
      } else {
        query = `trending ${brandCtx.industry || 'small business'} social media April 2026`;
      }
      console.log('  Serper query:', query);
      externalData = await fetchSerper(query);
      console.log('  Serper returned:', externalData ? `${externalData.length} chars` : 'NULL');
      if (!externalData) { console.log(`  → SKIP (no Serper data)`); results.push({ worker: w.name, result: 'SKIP (no Serper data)', sourceData: null }); continue; }
    }
    
    if (w.external === 'apollo') {
      const lennyTasks = (tasks || []).filter(t => t.worker_slug === 'lead-generator');
      const lennyInput = lennyTasks[0]?.input || {};
      const icpRaw = lennyInput.icp_title || lennyInput.job_titles || brandCtx.audience || '';
      const titles = icpRaw.includes(',') ? icpRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4)
                    : icpRaw.toLowerCase().includes('ceo') || icpRaw.toLowerCase().includes('founder') ? ['CEO', 'Founder', 'Co-Founder']
                    : ['Marketing Manager', 'Head of Marketing'];
      console.log('  Apollo titles:', titles);
      externalData = await fetchApollo(titles);
      console.log('  Apollo returned:', externalData ? `${externalData.split('\n').length} leads` : 'NULL');
      if (!externalData) { console.log(`  → SKIP (no Apollo data)`); results.push({ worker: w.name, result: 'SKIP (no Apollo data)', sourceData: null }); continue; }
      console.log('  Leads:', externalData);
    }
    
    const suggestionType = w.types[0];
    const prompt = `You are ${w.name}, a ${w.role} on the customer's AI team at 3rdShift.
Your job is to proactively bring one useful, actionable ${suggestionType} to the customer.

RESPONSE RULES — READ CAREFULLY:

You must respond with ONE of two things:
1. A specific, actionable suggestion the customer can act on TODAY. It must reference something concrete — a topic, a trend, a data point, a competitor move, a gap in their content, a specific lead. Vague advice like "consider posting more" or "think about your strategy" is NOT acceptable.
2. The word SKIP and nothing else. No explanation. No apology. Just SKIP.

You MUST respond with SKIP if ANY of these are true:
- You don't have enough brand context to say something specific
- You can't reference a real trend, data point, or concrete topic from the information provided
- Your suggestion would be generic advice that applies to any business
- You're about to ask the customer for more information
- You're about to apologize or explain your limitations

A good suggestion names a SPECIFIC topic, article, keyword, trend, lead, or action.

Worker identity: ${w.name}, a ${w.role}. Speak in first person, 2-4 sentences, end with a clear next step.

Customer brand context:
${brandContextStr || 'Not provided. SKIP.'}

Customer task history:
${taskHistorySummary}
${externalData ? `\nFresh data from today:\n${externalData}` : ''}

Generate your suggestion now. SKIP if you cannot meet the quality bar.`;

    const response = await callHaiku(prompt);
    const skipped = isSkipResponse(response);
    
    console.log('  Haiku response:', response?.slice(0, 150));
    console.log('  isSkipResponse:', skipped);
    
    results.push({ worker: w.name, result: skipped ? `SKIP: "${response?.slice(0, 60)}"` : response?.slice(0, 100), sourceData: externalData ? externalData.slice(0, 200) : null, passed: !skipped });
  }

  console.log('\n=== RESULTS ===');
  for (const r of results) {
    console.log(`\n[${r.worker}]`);
    console.log('  Result:', r.result);
    if (r.sourceData) console.log('  source_data (first 200):', r.sourceData);
    console.log('  Verdict:', r.passed === true ? '✅ PASS' : r.passed === false ? '❌ FAIL (generated but isSkip=true)' : '⏭️  SKIP (no external data or quality gate)');
  }
}

main().catch(console.error);
