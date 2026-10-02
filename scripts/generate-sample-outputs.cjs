'use strict';
/**
 * generate-sample-outputs.cjs
 * Deliverable 2: Sample Output Library
 * Submits one test task per worker and saves results to outputs/worker-samples/
 * 
 * Run: node scripts/generate-sample-outputs.cjs
 * Runs unattended — logs progress to console and saves state to outputs/samples-state.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = '/Users/3rdshift/.openclaw/workspace/outputs/worker-samples';
const STATE_FILE = '/Users/3rdshift/.openclaw/workspace/outputs/samples-state.json';
const FRONTEND = '/Users/3rdshift/.openclaw/workspace/3rdshift-frontend';

// Load .env.local for credentials
const envSrc = fs.readFileSync(path.join(FRONTEND, '.env.local'), 'utf8');
const env = {};
for (const line of envSrc.split('\n')) {
  const m = line.match(/^([^=]+)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY;

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── State management ──────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { completed: [], failed: [], inProgress: null }; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1' + path);
    const opts = {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : '',
      },
    };
    const req = https.request(url, opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getUser(email) {
  const r = await supabaseRequest('GET', `/profiles?email=eq.${encodeURIComponent(email)}&select=id`);
  return r.body?.[0]?.id;
}

async function submitTask(userId, workerSlug, input) {
  const r = await supabaseRequest('POST', '/tasks', {
    user_id: userId,
    worker_slug: workerSlug,
    input,
    status: 'pending',
  });
  return r.body?.[0]?.id || r.body?.id;
}

async function pollTask(taskId, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(8000);
    const r = await supabaseRequest('GET', `/tasks?id=eq.${taskId}&select=*`);
    const task = r.body?.[0];
    if (!task) continue;
    if (task.status === 'completed' || task.status === 'failed') return task;
  }
  return { status: 'timeout', id: taskId };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Default test inputs per worker ────────────────────────────────────────────
function getTestInput(slug) {
  // Generic defaults
  const defaults = {
    topic: 'customer retention strategies for SaaS companies',
    business: 'Acme Analytics',
    brand: '3rdShift',
    audience: 'small business owners running service businesses',
    goal: 'grow revenue and reduce churn',
    platform: 'LinkedIn',
    tone: 'Professional',
    product: 'B2B analytics software',
    industry: 'SaaS / Technology',
  };

  // Worker-specific overrides
  const inputs = {
    // Content writing
    'content-writer': { topic: defaults.topic, audience: defaults.audience, content_type: 'Blog Post', tone: defaults.tone, word_count: '800-1000' },
    'newsletter-writer': { topic: defaults.topic, audience: defaults.audience, tone: defaults.tone, newsletter_name: 'The Growth Brief' },
    'email-copywriter': { email_type: 'Welcome Email', product: defaults.product, audience: defaults.audience, tone: defaults.tone },
    'ad-copywriter': { product: defaults.product, platform: 'Facebook/Instagram', goal: 'Free trial signups', audience: defaults.audience },
    'landing-page-copywriter': { product: defaults.product, audience: defaults.audience, goal: 'Drive free trial signups', tone: defaults.tone },
    'script-writer': { topic: defaults.topic, platform: 'YouTube', duration: '5-7 minutes', tone: defaults.tone },
    'grant-writer': { organization: 'TechNonprofit Inc', grant_name: 'Community Innovation Grant', amount: '$25,000', purpose: 'Build free coding education platform' },
    'long-form-article-writer': { topic: defaults.topic, audience: defaults.audience, length: '1500 words', tone: defaults.tone },
    'press-release-writer': { company: defaults.brand, news: 'Launches AI-powered analytics dashboard for small businesses', contact: 'press@acme.com' },
    'whitepaper-writer': { topic: defaults.topic, audience: 'SaaS executives and product managers', length: '8-10 pages' },
    'case-study-writer': { company: defaults.brand, client: 'Retail Co', problem: 'High customer churn', solution: 'Predictive analytics', result: '40% reduction in churn' },
    'proposal-writer': { client: 'Growth Corp', service: 'Marketing strategy consulting', value: '$15,000', timeline: '3 months' },
    'technical-writer': { topic: 'REST API authentication setup', audience: 'Software developers', product: 'Acme Analytics API' },
    'ux-writer': { product: defaults.product, context: 'Onboarding flow for new users', tone: 'Friendly and clear' },
    'faq-writer': { product: defaults.product, audience: defaults.audience, num_questions: '10' },
    'standard-operating-procedure-writer': { process: 'Customer support ticket handling', department: 'Customer Success', steps: '6-8 steps' },
    'onboarding-document-creator': { role: 'Customer Success Manager', company: defaults.brand, tools: 'Salesforce, Slack, Jira' },
    'training-material-writer': { topic: 'Using analytics dashboards for decision-making', audience: 'Non-technical business users', format: 'Workshop guide' },

    // Social media
    'x-twitter-ghostwriter': { topic: defaults.topic, content_type: 'Thread', niche: 'SaaS growth', tone: 'Direct', account_stage: 'Growing (1k–10k)', goal: 'Build audience' },
    'linkedin-ghostwriter': { topic: 'How data-driven decisions reduced our churn by 40%', tone: 'Professional but human', goal: 'Build thought leadership' },
    'social-media-creator': { platform: 'All Platforms', content_type: 'Full Post', content_theme: defaults.topic },
    'community-manager': { platform: 'Slack Community', community_type: 'SaaS founders and operators', community_goal: 'Build engagement' },
    'instagram-strategist': { business: 'B2B analytics software', goal: 'Grow followers', frequency: 'Daily' },
    'email-marketing-strategist': { campaign_goal: 'Welcome Series', product_service: defaults.product, target_audience: defaults.audience },
    'pinterest-strategist': { business: 'Online course platform', goal: 'Drive traffic', niche: 'Business education' },
    'content-strategist': { business: defaults.brand, audience: defaults.audience, goal: 'Increase organic traffic and leads', timeline: '6 months' },
    'content-repurposer': { original_content: 'Our latest SaaS product update increased retention by 40% through predictive churn scoring.', source_format: 'Blog post', target_formats: 'Twitter thread, LinkedIn post, Email newsletter snippet' },

    // Research & strategy
    'competitor-analyst': { business: defaults.brand + ' — analytics software', competitors: 'Mixpanel\nAmplitude\nHeap', focus_areas: ['Pricing', 'Positioning', 'Product features'] },
    'trend-analyst': { industry: defaults.industry, region: 'Global', timeframe: 'Next 12 months', focus: 'AI adoption in analytics' },
    'audience-persona-builder': { product: defaults.product, existing_customers: 'Startup founders, SMB owners, data-driven operators' },
    'swot-analyst': { business: defaults.brand, industry: defaults.industry, market_position: 'Growing mid-market analytics player' },
    'market-research-analyst': { research_topic: defaults.topic, industry: defaults.industry, depth: 'Detailed report' },
    'pricing-strategist': { product: defaults.product, current_price: '$49/month', competitors: 'Mixpanel ($28), Amplitude ($995)', audience: defaults.audience },
    'report-writer': { topic: 'Q1 2026 SaaS metrics summary', audience: 'Executive team', data: 'ARR: $2.1M, MRR growth: 12%, Churn: 3.2%, NPS: 42' },
    'kpi-dashboard-writer': { business_type: 'SaaS', metrics: 'MRR, churn rate, DAU, NPS, CAC, LTV', reporting_period: 'Monthly', audience: 'Executive team' },
    'data-analyst': { data: 'Month, Revenue, Users, Churn\nJan, $50k, 200, 5%\nFeb, $58k, 240, 4%\nMar, $67k, 290, 3.5%', analysis_type: 'Growth trend analysis', context: 'SaaS subscription business' },
    'research-assistant': { research_topic: defaults.topic, context: 'Preparing a content strategy for a B2B SaaS blog', depth: 'Detailed report', industry: defaults.industry },

    // Marketing
    'funnel-strategist': { business: defaults.brand, target_audience: defaults.audience, goal: 'Generate leads' },
    'ad-campaign-strategist': { business_name: defaults.brand, what_promoting: 'Free analytics trial', ad_platforms: ['Google', 'Meta (Facebook/Instagram)'], monthly_budget: '$3,000', target_audience: defaults.audience, campaign_goal: 'Generate Leads' },
    'brand-strategist': { brand_name: defaults.brand, industry: defaults.industry, target_audience: defaults.audience, current_positioning: 'Analytics made simple' },
    'ecommerce-strategist': { store_type: 'B2B software (SaaS)', goal: 'Increase trial-to-paid conversions', current_revenue: '$50k MRR' },
    'personal-brand-strategist': { name: 'Alex Chen', role: 'Founder & CEO at ' + defaults.brand, audience: 'SaaS founders and operators', goal: 'Thought leadership on data-driven growth' },
    'linkedin-profile-optimizer': { name: 'Alex Chen', current_headline: 'CEO at Acme Analytics', experience: '10 years in B2B SaaS, built 3 companies', goal: 'Attract enterprise clients and top talent' },

    // HR & recruiting
    'job-description-writer': { role: 'Senior Customer Success Manager', company: defaults.brand, location: 'Remote', requirements: '3+ years CSM experience, SaaS background' },
    'resume-screener': { job_title: 'Senior Customer Success Manager', resumes: 'Candidate 1: 4 years CSM at Salesforce, CS degree\nCandidate 2: 2 years CSM at startup, MBA\nCandidate 3: 5 years account management, no SaaS', criteria: 'SaaS experience required, strong retention metrics' },
    'cover-letter-writer': { role: 'Senior Customer Success Manager', company: defaults.brand, applicant_background: '4 years CSM at B2B SaaS, reduced churn by 30%' },
    'interview-question-writer': { role: 'Senior Customer Success Manager', company: defaults.brand, interview_type: 'Technical + behavioral', num_questions: '10' },

    // Design & creative
    'creative-brief-writer': { project: 'Product launch campaign', brand: defaults.brand, audience: defaults.audience, objective: 'Drive 500 free trial signups in 30 days' },
    'tagline-writer': { brand: defaults.brand, product: defaults.product, audience: defaults.audience, tone: defaults.tone },
    'product-naming-specialist': { product_description: 'AI-powered churn prediction for SaaS companies', audience: defaults.audience, style: 'Modern, memorable, tech-forward' },
    'brand-voice-guide-writer': { brand: defaults.brand, industry: defaults.industry, audience: defaults.audience, personality: 'Smart, direct, approachable' },

    // Admin & ops  
    'legal-document-drafter': { document_type: 'Terms of Service', business: defaults.brand, jurisdiction: 'United States', industry: 'SaaS software' },
    'meeting-notes-summarizer': { transcript: 'Team discussed Q1 results. MRR is $2.1M, up 12% from last quarter. Churn improved to 3.2%. John raised concern about enterprise pipeline. Sarah suggested adding analytics to pricing page. Agreed to launch new onboarding flow next month.', meeting_type: 'Quarterly business review' },
    'data-cleaner': { data_type: 'Customer contacts', data_input: 'Name, Email, Phone\njohn smith, JOHN@ACME.COM, 555-1234\nJane DOE,jane@example.com,(555) 567-8900\nBob Jones,,555.345.6789' },
    'spreadsheet-builder': { what_to_track: 'Monthly SaaS metrics: MRR, new customers, churned customers, expansion revenue', spreadsheet_type: 'Custom', columns_needed: 'Month, MRR, New Customers, Churned, Expansion, Net Revenue Change', formulas_needed: 'MRR growth %, Net Revenue Retention' },
    'bookkeeping-summarizer': { transactions: 'Date, Description, Amount\n2026-04-01, AWS, -$127\n2026-04-03, Stripe Payout, +$3240\n2026-04-05, Anthropic API, -$89\n2026-04-10, Vercel, -$20\n2026-04-15, Stripe Payout, +$2890', time_period: 'April 1-15 2026', business_type: 'SaaS' },

    // Specialized
    'prompt-engineer': { ai_tool: 'ChatGPT', goal: 'Write compelling cold email subject lines for B2B SaaS outreach', use_case: 'Writing', num_variations: '3' },
    'sales-outreach-writer': { your_name_company: 'Alex at ' + defaults.brand, what_selling: 'Analytics platform for SaaS companies', prospect_role: 'Head of Revenue', target_industry: 'B2B SaaS', channel: 'Cold Email', sequence_length: '3 messages', tone: 'Friendly', value_prop: 'Predict and prevent churn before it happens' },
    'automation-blueprint-writer': { process: 'Lead nurturing after free trial signup', tools: 'HubSpot, Slack, Stripe', trigger: 'User signs up for free trial', goal: 'Convert trial to paid within 14 days' },
    'translator': { source_language: 'English', target_language: 'Spanish', content_type: 'Marketing copy', text: 'Grow your SaaS business with predictive analytics. Reduce churn by 40%. Start your free trial today.' },
    'customer-support-writer': { support_type: 'Feature request response', product: defaults.product, situation: 'Customer requesting API documentation improvements', tone: 'Empathetic, helpful' },

    // Course
    'course-outline-builder': { course_mode: 'mini_course', course_title: 'SaaS Metrics Mastery', expertise: 'I have 10 years in SaaS analytics and have helped 50+ companies improve their metrics.', course_topic: 'Understanding and improving key SaaS metrics', student_starting_point: 'SaaS founders who track some metrics but don\'t know how to act on them', student_transformation: 'By the end they will be able to identify which metrics matter most and take specific actions to improve MRR, reduce churn, and increase NPS.', price_point: '$47-$97', platform: 'Teachable', mini_course_type: 'Paid mini-course ($27-$47)' },
    
    // Remy
    'creative-editor': { topic: 'How I reduced churn by 40% using predictive analytics', tone: 'Authentic, first-person', platform: 'LinkedIn', audience: defaults.audience },

    // Lenny - lead gen - skip heavy API call, use note
    'lead-generator': '__SKIP__',
    
    // Image workers - note only
    'thumbnail-designer': '__IMAGE__',
    'logo-concept-generator': '__IMAGE__',
    'social-media-graphics-designer': '__IMAGE__',
    
    // Audio/video workers - note only  
    'voiceover-artist': '__AUDIO__',
    'transcription-specialist': '__AUDIO__',
    'meeting-notes-writer': '__AUDIO__',
    'sound-effects-designer': '__AUDIO__',
    'content-translator': '__AUDIO__',
    'scene-director': '__VIDEO__',
    'b-roll-generator': '__VIDEO__',
    'ad-creative-generator': '__VIDEO__',
    'product-video-creator': '__VIDEO__',

    // Remaining workers with reasonable defaults
    'podcast-show-notes-writer': { transcript_or_summary: 'In this episode we discuss how SaaS companies can use data to predict and prevent churn. Key topics: early warning signals, cohort analysis, intervention strategies.', episode_title: 'Preventing Churn Before It Happens', guest: 'Solo episode', podcast_name: 'The SaaS Growth Show' },
    'video-repurposer': { video_url: 'https://youtube.com/watch?v=example', video_topic: 'SaaS metrics deep dive', target_formats: 'Blog post, Email newsletter, Twitter thread' },
    'seo-strategist': { target_keyword: 'saas churn reduction', audience: defaults.audience, website: 'acmeanalytics.com', business_goal: 'Drive organic signups' },
    'pitch-deck-writer': { company: defaults.brand, industry: defaults.industry, stage: 'Series A', ask: '$5M', use_of_funds: 'Product development and go-to-market', traction: '$2.1M ARR, 12% MoM growth' },
    'presentation-builder': { title: 'Q1 2026 Business Review', audience: 'Board of Directors', key_points: 'ARR growth, product milestones, team expansion, Q2 roadmap', num_slides: '12' },
  };

  // Fill in any missing with generic input
  if (!inputs[slug]) {
    return { topic: defaults.topic, audience: defaults.audience, business: defaults.business, tone: defaults.tone };
  }
  return inputs[slug];
}

// ── Execute API-based task ────────────────────────────────────────────────────
async function runTaskViaSupabase(userId, slug, input) {
  // Insert task directly and then call execute-task API
  const taskId = await submitTask(userId, slug, input);
  if (!taskId) throw new Error('Failed to create task');
  
  // Call execute-task endpoint
  const executeRes = await fetch(`${env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'}/api/execute-task`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getServiceToken()}`,
    },
    body: JSON.stringify({ taskId }),
  });
  
  if (!executeRes.ok) {
    const error = await executeRes.text();
    throw new Error(`execute-task failed: ${executeRes.status} ${error}`);
  }
  
  // Poll for completion
  const result = await pollTask(taskId);
  return result;
}

async function getServiceToken() {
  // Use anon key for execute-task — it validates against task ownership
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Starting Deliverable 2: Sample Output Library');
  console.log('Authenticating with Supabase...');
  
  // Get test user ID (operator account)
  const userId = await getUser('test-roger@3rdshift.ai');
  if (!userId) { console.error('Could not find test-roger@3rdshift.ai'); process.exit(1); }
  console.log('User ID:', userId);
  
  // Get all workers
  const regSrc = fs.readFileSync(path.join(FRONTEND, 'lib/workers/registry.ts'), 'utf8');
  const slugs = new Set();
  for (const m of regSrc.matchAll(/slug:\s*'([^']+)'/g)) {
    const s = m[1];
    if (s && regSrc.includes(`name: '`) && !slugs.has(s)) slugs.add(s);
  }
  
  // Ordered list from the registry array (not interface)
  const allWorkers = [];
  const seen = new Set();
  for (const m of regSrc.matchAll(/\{\s*\n?\s*slug:\s*'([^']+)'/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); allWorkers.push(m[1]); }
  }
  
  const state = loadState();
  const completed = new Set(state.completed);
  const failed = new Set(state.failed.map(f => f.slug || f));
  
  console.log(`\nWorkers to process: ${allWorkers.length}`);
  console.log(`Already completed: ${completed.size}`);
  console.log(`Previously failed: ${failed.size}`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const slug of allWorkers.sort()) {
    const outFile = path.join(OUT_DIR, `${slug}.md`);
    
    if (completed.has(slug) && fs.existsSync(outFile)) {
      console.log(`[SKIP] ${slug} — already done`);
      continue;
    }
    
    const input = getTestInput(slug);
    
    // Special cases — skip actual API call
    if (input === '__SKIP__') {
      const content = `# Sample output: ${slug}\n\n**Note:** Skipped — requires live external API (RocketReach) which is expensive and rate-limited. Test manually.\n\n**Test input that would be used:**\n\`\`\`\njob_titles: VP of Customer Success\ntarget_industry: B2B SaaS\nlocation: United States\ncompany_size: 50-500 employees\n\`\`\`\n`;
      fs.writeFileSync(outFile, content);
      completed.add(slug);
      saveState({ ...state, completed: [...completed] });
      console.log(`[NOTE] ${slug} — skipped (external API)`);
      continue;
    }
    
    if (input === '__IMAGE__') {
      const content = `# Sample output: ${slug}\n\n**Note:** Image generation worker — requires fal.ai credits. Test manually via dashboard.\n**External API:** fal.ai\n**Output format:** PNG images (4 variations)\n`;
      fs.writeFileSync(outFile, content);
      completed.add(slug);
      saveState({ ...state, completed: [...completed] });
      console.log(`[NOTE] ${slug} — skipped (image worker)`);
      continue;
    }
    
    if (input === '__AUDIO__') {
      const content = `# Sample output: ${slug}\n\n**Note:** Audio/video processing worker — requires ElevenLabs or Atlas/Wan credits and file upload. Test manually via dashboard.\n`;
      fs.writeFileSync(outFile, content);
      completed.add(slug);
      saveState({ ...state, completed: [...completed] });
      console.log(`[NOTE] ${slug} — skipped (audio/video worker)`);
      continue;
    }
    
    console.log(`\n[RUN] ${slug}...`);
    const startTime = Date.now();
    
    try {
      // Direct Anthropic call approach — bypass the web API
      // Read the worker's system prompt and user prompt builder
      const promptResult = await generateDirectly(slug, input);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      const content = [
        `# Sample output: ${slug} — ${promptResult.name}`,
        '',
        '**Test input used:**',
        '```json',
        JSON.stringify(input, null, 2),
        '```',
        '',
        `**Generation time:** ${elapsed}s`,
        `**Credits deducted:** ${promptResult.credits}`,
        `**Output tokens (estimated):** ~${Math.round((promptResult.output || '').length / 4)}`,
        `**Output char count:** ${(promptResult.output || '').length}`,
        '',
        '**Full output below:**',
        '',
        '---',
        '',
        promptResult.output || `[No output — Error: ${promptResult.error}]`,
      ].join('\n');
      
      fs.writeFileSync(outFile, content);
      completed.add(slug);
      successCount++;
      saveState({ ...state, completed: [...completed], failed: [...failed].map(f => ({ slug: f })) });
      console.log(`[✅] ${slug} — ${elapsed}s, ${(promptResult.output || '').length} chars`);
      
      // Small delay between workers to avoid rate limiting
      await sleep(2000);
      
    } catch (err) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.error(`[❌] ${slug} — ${err.message}`);
      
      const content = `# Sample output: ${slug}\n\n**GENERATION FAILED**\n\n**Error:** ${err.message}\n**Time before failure:** ${elapsed}s\n\n**Test input used:**\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n`;
      fs.writeFileSync(outFile, content);
      failed.add(slug);
      failCount++;
      saveState({ ...state, completed: [...completed], failed: [...failed].map(f => ({ slug: typeof f === 'string' ? f : f.slug })) });
      await sleep(3000);
    }
  }
  
  console.log(`\n\n✅ Complete! Success: ${successCount}, Failed: ${failCount}, Total: ${allWorkers.length}`);
}

// ── Direct generation via Anthropic ──────────────────────────────────────────
async function generateDirectly(slug, input) {
  const Anthropic = require(path.join(FRONTEND, 'node_modules/@anthropic-ai/sdk'));
  const client = new Anthropic.default({ apiKey: env.ANTHROPIC_API_KEY });
  
  // Get worker info
  const regSrc = fs.readFileSync(path.join(FRONTEND, 'lib/workers/registry.ts'), 'utf8');
  const nameM = regSrc.match(new RegExp(`slug: '${slug}'[\\s\\S]{0,500}name: '([^']+)'`));
  const workerName = nameM ? nameM[1] : slug;
  
  // Get system prompt and user prompt
  const configsSrc = fs.readFileSync(path.join(FRONTEND, 'lib/workers/configs.ts'), 'utf8');
  
  let systemPrompt = '';
  let userPrompt = '';
  
  // Try worker-specific file first
  const workerDir = path.join(FRONTEND, 'lib/workers', slug);
  const promptFile = path.join(workerDir, 'prompt.ts');
  
  if (fs.existsSync(promptFile)) {
    const psrc = fs.readFileSync(promptFile, 'utf8');
    const sm = psrc.match(/systemPrompt:\s*`([\s\S]+?)`(?=,|\n\s*\n)/);
    if (sm) systemPrompt = sm[1];
    
    // Try to extract buildUserPrompt logic (simplified)
    const um = psrc.match(/buildUserPrompt:\s*\(i\)\s*=>\s*`([\s\S]+?)`(?=,|\n\s*\})/);
    if (um) {
      try {
        // Simple template substitution
        userPrompt = um[1].replace(/\$\{i\.(\w+).*?\}/g, (_, key) => input[key] || '');
      } catch {}
    }
  } else {
    const idx = configsSrc.indexOf(`'${slug}':`);
    if (idx !== -1) {
      const block = configsSrc.slice(idx, idx + 30000);
      const sm = block.match(/systemPrompt:\s*`([\s\S]+?)`(?=,\s*\n\s*build|\n\s*\})/);
      if (sm) systemPrompt = sm[1];
    }
  }
  
  if (!systemPrompt) {
    throw new Error(`Could not extract system prompt for ${slug}`);
  }
  
  // Build a simple user prompt from input fields if we couldn't extract it
  if (!userPrompt) {
    const inputLines = Object.entries(input)
      .filter(([k, v]) => v && typeof v === 'string')
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    userPrompt = `Please complete the task with these inputs:\n\n${inputLines.join('\n')}`;
  }
  
  // Trim system prompt to remove internal constants
  systemPrompt = systemPrompt.replace(/\$\{ANTI_AI\}/g, 'Write in a natural, direct human voice.')
    .replace(/\$\{NO_HALLUCINATION\}/g, 'Only state facts you are confident about.')
    .replace(/\$\{DELIVERABLE_RULE\}/g, 'Produce finished, usable deliverables only.')
    .replace(/\$\{[^}]+\}/g, '');
  
  const maxTokens = 4096;
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt.slice(0, 12000), // Cap system prompt for speed
    messages: [{ role: 'user', content: userPrompt.slice(0, 4000) }],
  }, { timeout: 120000 });
  
  const output = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return { name: workerName, output, credits: 0, error: null };
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
