export const maxDuration = 300;
/**
 * /api/cron/proactive-updates
 * Runs daily at 12:00 UTC — generates proactive suggestions from workers
 * and inserts them into Team Chat as if the worker sent them.
 *
 * Build order:
 *  1. Fetch eligible customers (activated, settings on, subscription active)
 *  2. Per customer: determine which workers fire today (rotation)
 *  3. For external-data workers (Kai, Ash, Lenny): fetch live data first
 *  4. Call Haiku with worker prompt + brand context + task history + past suggestions
 *  5. If not SKIP: insert into team_chat_messages + team_updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { sendPushToMany } from '@/lib/push/send';
import { verifyCronRequest } from '@/lib/cron-auth';

// ─── Push notification helper (FCM HTTP v1 via firebase-admin) ─────────────────
// NOTE: FCM Legacy API (fcm.googleapis.com/fcm/send + server key) was shut
// down by Google in July 2024. This now uses firebase-admin SDK which
// handles FCM HTTP v1 auth automatically via a service account JSON.
//
// Required Vercel env vars (set in Vercel dashboard — never commit values):
//   FIREBASE_SERVICE_ACCOUNT  — full service account JSON (stringified)
//   FIREBASE_PROJECT_ID       — e.g. 'my-firebase-project-id'
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendPushToUser(
  supabase: any,
  userId: string,
  workerName: string,
  previewText: string,
  workerSlug: string
): Promise<void> {
  // Get all tokens for this user from push_tokens table
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token, platform')
    .eq('user_id', userId);

  if (error || !tokens?.length) {
    // No tokens registered or table error — skip silently
    return;
  }

  // Send via FCM v1 through firebase-admin SDK.
  // Returns list of stale/invalid tokens to clean up.
  const staleTokens = await sendPushToMany(
    tokens as Array<{ token: string; platform: string }>,
    {
      title: workerName,
      body: previewText,
      data: {
        type: 'team_update',
        worker_slug: workerSlug,
        url: `/dashboard/team/${workerSlug}?tab=chat`,
      },
    }
  );

  // Clean up stale / unregistered tokens so they don't accumulate
  if (staleTokens.length > 0) {
    await supabase
      .from('push_tokens')
      .delete()
      .in('token', staleTokens);
  }
}
function getSupabase() {
  return supabaseAdmin;
}

// ─── Worker config for proactive updates ─────────────────────────────────────

// SYSTEM 1: 6 suggestion workers. Ava (content-writer) is System 2 only — NOT in this list.
const PROACTIVE_WORKERS = [
  // Context workers (brand context + task history, no external API)
  {
    slug: 'hook-specialist',
    personaName: 'Sam',
    role: 'Hook Specialist',
    suggestionTypes: ['idea', 'reminder'] as const,
    needsExternalData: false,
    minPlan: 'starter' as const,
  },
  {
    slug: 'email-copywriter',
    personaName: 'Mira',
    role: 'Email Copywriter',
    suggestionTypes: ['idea'] as const,
    needsExternalData: false,
    minPlan: 'starter' as const,
  },
  {
    slug: 'ad-copywriter',
    personaName: 'Tate',
    role: 'Ad Copywriter',
    suggestionTypes: ['idea'] as const,
    needsExternalData: false,
    minPlan: 'starter' as const,
  },
  // External data workers (Serper) — Pro+
  {
    slug: 'seo-strategist',
    personaName: 'Kai',
    role: 'SEO Strategist',
    suggestionTypes: ['alert'] as const,
    needsExternalData: true,
    externalType: 'serper' as const,
    minPlan: 'pro' as const,
  },
  {
    slug: 'social-media-creator',
    personaName: 'Ash',
    role: 'Short-Form Video Script Writer',
    suggestionTypes: ['idea'] as const,
    needsExternalData: true,
    externalType: 'serper' as const,
    minPlan: 'pro' as const,
  },
  // RocketReach worker — Operator only
  {
    slug: 'lead-generator',
    personaName: 'Lenny',
    role: 'Lead Generator',
    suggestionTypes: ['alert'] as const,
    needsExternalData: true,
    externalType: 'apollo' as const, // keep 'apollo' for the externalType check below
    minPlan: 'operator' as const,
  },
];

// Workers available per plan (6 total, Ava excluded from System 1)
const PLAN_WORKER_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 3,
  operator: 6,
};

// Max suggestions per week per customer
const PLAN_FREQUENCY: Record<string, number> = {
  starter: 1,
  pro: 3,
  operator: 3,
};

// ─── Haiku call ───────────────────────────────────────────────────────────────

async function callHaiku(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Haiku API error: ${res.status}`);
  const data = await res.json() as { content: Array<{ text: string }> };
  return data.content?.[0]?.text?.trim() || 'SKIP';
}

// ─── SKIP quality gate ─────────────────────────────────────────────────────
function isSkipResponse(response: string | null | undefined): boolean {
  if (!response || typeof response !== 'string') return true;

  const trimmed = response.trim();

  // Too short to be useful
  if (trimmed.length < 50) return true;

  // Explicit SKIP — starts with SKIP (case-insensitive), covers all variants:
  // "SKIP", "SKIP.", "SKIP \u2014 not enough context", "Skip", "SKIP\n", " SKIP "
  if (trimmed.toUpperCase().startsWith('SKIP')) return true;

  // Soft SKIPs — AI apologizing or asking for more info instead of suggesting
  const rejectPatterns = [
    'i need more context',
    'i need more information',
    "i don't have enough",
    'i need to be honest',
    "i'm not able to",
    'i cannot provide',
    "i'm unable to",
    'without more details',
    'without more information',
    'without knowing more',
    'i would need to know',
    "i'd need more",
    'hard to suggest',
    'difficult to recommend',
    'not enough data',
    'not enough information',
    "i'm not sure what",
    'could you provide',
    'could you share',
    'can you tell me',
    'let me know more',
    'please provide',
    'please share',
  ];

  const lower = trimmed.toLowerCase();
  for (const pattern of rejectPatterns) {
    if (lower.includes(pattern)) return true;
  }

  return false;
}

// ─── External data fetchers ────────────────────────────────────────────────────

async function fetchSerperData(query: string): Promise<string | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { organic?: Array<{ title: string; snippet: string; link: string }> };
    const results = data?.organic || [];
    if (!results.length) return null;
    return results.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}\nSource: ${r.link}`).join('\n\n');
  } catch {
    return null;
  }
}

async function fetchRocketReachCount(query: {
  job_titles?: string;
  target_industry?: string;
  company_size?: string;
  location?: string;
}): Promise<number | null> {
  if (!process.env.ROCKETREACH_API_KEY) return null;
  try {
    const { searchRocketReach } = await import('@/lib/rocketreach');
    const result = await searchRocketReach(query);
    return result.total ?? result.leads.length;
  } catch {
    return null;
  }
}

// ─── Build suggestion prompt ───────────────────────────────────────────────────

// Worker-specific prompt additions per the brief
const WORKER_SPECIFIC_PROMPTS: Record<string, string> = {
  'seo-strategist': `You have access to real Serper search results for the customer's target keywords and competitors. Reference specific articles, URLs, or keyword movements from this data. If Serper returned nothing relevant, SKIP.

Example: "Your competitor just published 'AI Hiring Tools Comparison 2026' targeting a keyword you care about. They missed the cost angle — a response piece focusing on real pricing data could outrank them."`,
  'social-media-creator': `You have access to real Serper search results for trending topics in the customer's industry. Reference specific trends, events, or articles. If nothing is trending relevantly, SKIP.

Example: "National Small Business Week starts Monday. Here's a LinkedIn post angle: share the one tool that saved you the most time this month and tag #SmallBusinessWeek."`,
  'lead-generator': `You have access to the NUMBER of leads matching the customer's criteria from RocketReach. You do NOT have access to individual contact details.

NEVER name specific people. NEVER show email addresses or phone numbers. NEVER fabricate contact data.

Your job is to tell the customer that matches exist and encourage them to run a full Lenny task to get the full list.

Example: "There are 12 new contacts matching your criteria this week — Founders and CEOs at SaaS companies. Good time to run a fresh search and pick the best ones to reach out to."

If RocketReach returned zero matches, SKIP. When the customer takes action, they go to your task form to run a real search — not chat delivery.`,
  'hook-specialist': `Suggest hook angles based on the customer's brand context and past task history. Reference specific topics they've tackled and suggest hook variations or new angles worth testing.

NEVER claim a hook is "performing well" or "getting engagement." You have no analytics data.
NEVER say the customer "hasn't posted" — you don't know their publishing activity outside 3rdShift.
You CAN reference: "It's been a few weeks since your last task with me" if the task history shows a gap.

Example: "You've been writing about AI workforce tools — a Curiosity Gap hook angle you haven't tried yet: 'The [X] mistake I didn't know I was making until [Y]' applied to hiring decisions. Strong angle for LinkedIn."`,
  'email-copywriter': `Suggest email ideas, templates, or sequence concepts based on the customer's brand context and past work.

NEVER claim the customer "hasn't followed up" or "hasn't sent emails." You do not know their email activity outside 3rdShift.
You CAN reference past email tasks they've run with you.

Example: "Here's a cold email concept for your SaaS founder outreach — lead with the cost comparison hook, then pivot to a specific pain point. I can write the full 3-email sequence if you want."`,
  'ad-copywriter': `Suggest ad angles, headline variants, and creative approaches based on the customer's brand context and audience.

NEVER claim their ads "need a refresh" or they've "been running the same copy." You do not know their ad activity outside 3rdShift.

Example: "Fresh ad angle for your audience: instead of leading with features, try the contrast hook — '$29/month vs $2,000/month for a freelancer.' That price gap drives clicks."`,
};

function buildPrompt({
  workerName,
  workerRole,
  workerSlug,
  suggestionType,
  brandContext,
  taskHistorySummary,
  pastSuggestions,
  externalData,
}: {
  workerName: string;
  workerRole: string;
  workerSlug: string;
  suggestionType: string;
  brandContext: string;
  taskHistorySummary: string;
  pastSuggestions: string[];
  externalData: string | null;
}): string {
  const pastList = pastSuggestions.length
    ? pastSuggestions.map((s, i) => `${i+1}. ${s.slice(0, 100)}`).join('\n')
    : 'None yet.';

  const workerSpecific = WORKER_SPECIFIC_PROMPTS[workerSlug] || '';

  return `You are ${workerName}, a ${workerRole} on the customer's AI team at 3rdShift.
Your job is to proactively bring one useful, actionable ${suggestionType} to the customer.

RESPONSE RULES:

You must respond with ONE of two things:
1. A specific, actionable suggestion the customer can act on TODAY. It must reference something concrete — a topic, a trend, a data point, a competitor move, a gap in their content. Vague advice like "consider posting more" is NOT acceptable.
2. The word SKIP and nothing else.

You MUST respond with SKIP if ANY of these are true:
- You don't have enough brand context to say something specific
- Your suggestion would be generic advice that applies to any business
- You're about to ask the customer for more information
- You're about to apologize or explain limitations
- You cannot complete the suggestion in 2-4 sentences

THINGS YOU DO NOT KNOW (never claim these):
- How the customer's content is performing (no traffic, rankings, or analytics claims)
- What the customer has done outside of 3rdShift (no "you haven't posted" or "you haven't followed up")
- What campaigns or ads the customer is running
- Whether leads have been contacted

You CAN reference:
- Topics from their past 3rdShift tasks
- Their brand context (industry, audience, products)
- Real external data (Serper results, Apollo match counts)
- How long since their last task with you ("it's been a few weeks since your last task with me")

${workerSpecific ? `WORKER-SPECIFIC RULES:
${workerSpecific}
` : ''}
Customer brand context:
${brandContext || 'Not provided. SKIP if you cannot be specific without this.'}

Customer's recent task history with 3rdShift (last 90 days):
${taskHistorySummary || 'No tasks yet. SKIP.'}

Past suggestions from you (do not repeat):
${pastList}
${externalData ? `\nFresh data from today (use this to be specific):\n${externalData}` : ''}

Generate your suggestion now. SKIP if you cannot meet the quality bar above.`;
}

// ─── Determine which workers fire for this customer today ──────────────────────

function getWorkersForToday(
  customerUserId: string,
  plan: string,
  dayOfYear: number,
  usedWorkerSlugs: Set<string>,
  workerOverrides: Record<string, boolean>
): typeof PROACTIVE_WORKERS {
  const limit = PLAN_WORKER_LIMITS[plan] ?? 1;

  // Filter by plan eligibility and customer override settings
  const eligible = PROACTIVE_WORKERS.filter(w => {
    const planOrder = ['starter', 'pro', 'operator'];
    const workerPlanIndex = planOrder.indexOf(w.minPlan);
    const customerPlanIndex = planOrder.indexOf(plan);
    if (workerPlanIndex > customerPlanIndex) return false;
    // Respect per-worker toggles from settings
    if (workerOverrides[w.slug] === false) return false;
    // Starter: only most-used worker (just first eligible)
    return true;
  });

  // Deterministic rotation: rotate which workers fire based on day of year + userId hash
  const userHash = customerUserId.split('-').reduce((acc, part) => acc + parseInt(part.slice(0, 4) || '0', 16), 0);
  const offset = (dayOfYear + userHash) % eligible.length;

  // Pick `limit` workers starting at rotation offset
  const rotated: typeof PROACTIVE_WORKERS = [];
  for (let i = 0; i < eligible.length && rotated.length < limit; i++) {
    const w = eligible[(offset + i) % eligible.length];
    if (!usedWorkerSlugs.has(w.slug)) {
      rotated.push(w);
    }
  }
  return rotated;
}

// ─── Main cron handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const supabase = getSupabase();
  const results: Record<string, unknown> = { processed: 0, skipped: 0, suggestions_created: 0, errors: [] };

  // ── 1. Fetch eligible customers ──────────────────────────────────────────
  // Activated + team updates enabled + subscription not canceled
  const { data: eligibleProfiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, plan, brand_context, team_updates_settings, team_updates_activated, team_updates_activated_at, last_notification_date')
    .eq('team_updates_activated', true)
    .not('plan', 'is', null);

  if (profilesErr) {
    console.error('proactive-updates: profiles fetch error', profilesErr);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }

  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const profile of eligibleProfiles ?? []) {
    try {
      // ── Check settings ────────────────────────────────────────────────────
      const settings = (profile.team_updates_settings || {}) as {
        enabled?: boolean;
        frequency?: string;
        worker_overrides?: Record<string, boolean>;
      };

      if (settings.enabled === false) {
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      // ── ONE-PER-DAY RULE ─────────────────────────────────────────────────
      // System 1 runs at 14:00 UTC. System 2 (Ava) runs at 15:00 UTC and checks this field.
      const todayDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const profileFull = profile as Record<string, string>;
      if (profileFull.last_notification_date === todayDate) {
        console.log(`proactive-updates: ${profile.id} already notified today, skipping`);
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      // Check subscription is active (plan exists and is not 'free'/'canceled')
      const activePlans = ['starter', 'pro', 'operator'];
      if (!activePlans.includes(profile.plan)) {
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      // ── Check weekly frequency cap ────────────────────────────────────────
      const maxPerWeek = settings.frequency === 'off' ? 0 :
                         settings.frequency === 'once_weekly' ? 1 :
                         PLAN_FREQUENCY[profile.plan] ?? 1;

      if (maxPerWeek === 0) {
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      const { count: weekCount } = await supabase
        .from('team_updates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('created_at', oneWeekAgo);

      if ((weekCount ?? 0) >= maxPerWeek) {
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      // ── Check idempotency: no suggestions TODAY ───────────────────────────
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('team_updates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('created_at', todayStart.toISOString());

      if ((todayCount ?? 0) > 0) {
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      // ── Get workspace for this user ───────────────────────────────────────
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', profile.id)
        .single();

      if (!workspace) continue;

      // ── Get task history (last 90 days) ───────────────────────────────────
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: tasks } = await supabase
        .from('tasks')
        .select('worker_slug, input, created_at')
        .eq('workspace_id', workspace.id)
        .eq('status', 'completed')
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(30);

      // Check activation: 3+ completed tasks (if not yet activated, skip — activation cron handles this separately)
      if ((tasks?.length ?? 0) < 3) {
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      // Build task history summary
      const taskHistorySummary = (tasks ?? []).slice(0, 15).map(t => {
        const inputObj = (t.input || {}) as Record<string, string>;
        const title = inputObj.topic || inputObj.subject || inputObj.title || inputObj.keyword || t.worker_slug;
        return `- ${t.worker_slug}: "${title}" (${t.created_at.slice(0, 10)})`;
      }).join('\n');

      // Worker slugs used (for dedup of "already used this worker today")
      const usedWorkerSlugsThisWeek = new Set<string>();
      const { data: weekSuggestions } = await supabase
        .from('team_updates')
        .select('worker_slug, suggestion_text')
        .eq('user_id', profile.id)
        .gte('created_at', oneWeekAgo)
        .limit(10);
      (weekSuggestions ?? []).forEach(s => usedWorkerSlugsThisWeek.add(s.worker_slug));

      // ── Determine which workers fire today ────────────────────────────────
      const workerOverrides = settings.worker_overrides || {};
      const workersToday = getWorkersForToday(
        profile.id,
        profile.plan,
        dayOfYear,
        usedWorkerSlugsThisWeek,
        workerOverrides
      );

      if (!workersToday.length) {
        results.skipped = (results.skipped as number) + 1;
        continue;
      }

      // ── Brand context ─────────────────────────────────────────────────────
      // Prefer workspace-scoped brand_profile; fall back to legacy profiles.brand_context.
      const { data: workspaceBrandProfile } = await supabase
        .from('brand_profile')
        .select('company_name, industry, audience, tone, competitors, additional_context')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      const legacyRawBrandCtx = profile.brand_context;
      const legacyBrandCtx: Record<string, string> | null = (
        typeof legacyRawBrandCtx === 'string'
          ? (() => { try { return JSON.parse(legacyRawBrandCtx); } catch { return null; } })()
          : legacyRawBrandCtx
      ) as Record<string, string> | null;
      const brandCtx = (workspaceBrandProfile || legacyBrandCtx) as Record<string, string> | null;
      const brandContextStr = brandCtx
        ? [
            brandCtx.company_name ? `Company: ${brandCtx.company_name}` : '',
            brandCtx.industry ? `Industry: ${brandCtx.industry}` : '',
            brandCtx.audience ? `Target audience: ${brandCtx.audience}` : '',
            brandCtx.tone ? `Tone: ${brandCtx.tone}` : '',
            brandCtx.competitors ? `Competitors: ${brandCtx.competitors}` : '',
            brandCtx.additional_context ? `Additional context: ${brandCtx.additional_context}` : '',
          ].filter(Boolean).join('\n')
        : '';

      results.processed = (results.processed as number) + 1;

      // ── Process each worker ───────────────────────────────────────────────
      for (const worker of workersToday) {
        try {
          // Past suggestions for this worker (dedup)
          const { data: pastSuggestionsData } = await supabase
            .from('team_updates')
            .select('suggestion_text')
            .eq('user_id', profile.id)
            .eq('worker_slug', worker.slug)
            .order('created_at', { ascending: false })
            .limit(10);

          const pastSuggestions = (pastSuggestionsData ?? []).map(s => s.suggestion_text);

          // ── Fetch external data if needed ─────────────────────────────────
          let externalData: string | null = null;

          if (worker.needsExternalData && worker.externalType === 'serper') {
            const industry = brandCtx?.industry || '';
            let searchQuery = '';

            if (worker.slug === 'seo-strategist') {
              // Use actual keywords from past Kai tasks for a targeted search
              const kaiTasks = (tasks ?? []).filter(t => t.worker_slug === 'seo-strategist');
              const kaiInput = (kaiTasks[0]?.input || {}) as Record<string, string>;
              const keyword = kaiInput.keyword || kaiInput.topic || kaiInput.keywords || '';
              const competitors = brandCtx?.competitors || '';
              if (keyword && competitors) {
                // Search for competitor content around the target keyword (no exact match quotes to avoid 0 results)
                searchQuery = `${competitors.split(',')[0].trim()} ${keyword} blog 2026`;
              } else if (keyword) {
                searchQuery = `${keyword} competitor articles ${new Date().getFullYear()}`;
              } else if (competitors) {
                searchQuery = `${competitors.split(',')[0].trim()} blog ${industry} ${new Date().getFullYear()}`;
              } else {
                searchQuery = `${industry || 'SaaS'} SEO content trends ${new Date().getFullYear()}`;
              }
            } else if (worker.slug === 'social-media-creator') {
              const ashTasks = (tasks ?? []).filter(t => t.worker_slug === 'social-media-creator');
              const ashInput = (ashTasks[0]?.input || {}) as Record<string, string>;
              const topic = ashInput.topic || ashInput.platform || '';
              searchQuery = `trending ${industry || topic || 'small business'} social media ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`;
            }

            if (searchQuery) {
              externalData = await fetchSerperData(searchQuery);
              if (!externalData) {
                console.log(`proactive-updates: ${worker.personaName} skipping (no Serper data) for user ${profile.id}`);
                continue;
              }
            }
          } else if (worker.needsExternalData && worker.externalType === 'apollo') {
            // Pull ICP from past Lenny tasks
            const lennyTasks = (tasks ?? []).filter(t => t.worker_slug === 'lead-generator');
            const lennyInput = (lennyTasks[0]?.input || {}) as Record<string, string>;
            const icpTitles = lennyInput.icp_title || lennyInput.job_titles || brandCtx?.audience || '';
            const icpIndustry = lennyInput.icp_industry || lennyInput.target_industry || brandCtx?.industry || '';
            const icpSize = lennyInput.icp_company_size || lennyInput.company_size || 'under 200 employees';
            const icpLocation = lennyInput.icp_location || lennyInput.location || 'United States';
            // Use RocketReach search (free — count only, no export credits)
            const matchCount = await fetchRocketReachCount({
              job_titles: icpTitles,
              target_industry: icpIndustry,
              company_size: icpSize,
              location: icpLocation,
            });
            if (!matchCount) {
              console.log(`proactive-updates: ${worker.personaName} skipping (no RocketReach data) for user ${profile.id}`);
              continue;
            }
            externalData = `${matchCount} contacts matching the customer's criteria`;
            // Store structured ICP so button can auto-run without asking questions
            (worker as Record<string, unknown>)._parsedIcp = {
              job_titles: icpTitles,
              industry: icpIndustry,
              company_size: icpSize,
              location: icpLocation,
              match_count: matchCount,
            };
          }

          // ── Generate suggestion via Haiku ──────────────────────────────────
          const suggestionType = worker.suggestionTypes[dayOfYear % worker.suggestionTypes.length];
          const prompt = buildPrompt({
            workerName: worker.personaName,
            workerRole: worker.role,
            workerSlug: worker.slug,
            suggestionType,
            brandContext: brandContextStr,
            taskHistorySummary,
            pastSuggestions,
            externalData,
          });

          let suggestionText: string;
          try {
            suggestionText = await callHaiku(prompt);
          } catch (err) {
            console.error(`proactive-updates: Haiku error for ${worker.personaName}:`, err);
            continue;
          }

          // Strip common Haiku preamble artifacts that add no value
          suggestionText = suggestionText
            .replace(/^(here's your actionable suggestion:?\s*)/i, '')
            .replace(/^(here's a specific suggestion:?\s*)/i, '')
            .replace(/^(here's a suggestion:?\s*)/i, '')
            .replace(/^(here's an idea:?\s*)/i, '')
            .trim();

          // Quality gate — catches explicit SKIP and all soft variants
          if (isSkipResponse(suggestionText)) {
            console.log(`proactive-updates: ${worker.personaName} SKIP (quality gate) for user ${profile.id}: "${suggestionText?.slice(0, 60)}"`);
            continue;
          }

          // ── Insert chat message ───────────────────────────────────────────
          // Format: 💡 Idea from {Name}\n\n{text}\n\n[Take action →]
          const chatContent = `💡 ${suggestionType.charAt(0).toUpperCase() + suggestionType.slice(1)} from ${worker.personaName}\n\n${suggestionText}\n\n[Take action →]`;
          const previewText = suggestionText.split('\n')[0].slice(0, 120);

          // Ensure chat thread exists (intro may not have been triggered yet)
          // This is safe to call even if messages already exist
          const { data: insertedMsg, error: chatErr } = await supabase
            .from('team_chat_messages')
            .insert({
              user_id: profile.id,
              workspace_id: workspace.id,
              member_id: worker.slug,
              role: 'member',
              content: chatContent,
            })
            .select('id')
            .single();

          if (chatErr || !insertedMsg) {
            console.error(`proactive-updates: chat insert failed for ${worker.personaName}:`, chatErr);
            // Don't create team_updates row either (atomic write)
            continue;
          }

          // ── Insert team_updates row ───────────────────────────────────────
          const { error: updateErr } = await supabase
            .from('team_updates')
            .insert({
              workspace_id: workspace.id,
              user_id: profile.id,
              worker_slug: worker.slug,
              suggestion_type: suggestionType,
              suggestion_text: suggestionText,
              preview_text: previewText,
              source_data: externalData ? {
                  query: externalData.slice(0, 500),
                  // Structured ICP for Lenny auto-run (both button and chat paths)
                  parsed_icp: (worker as Record<string, unknown>)._parsedIcp || null,
                } : null,
              chat_message_id: insertedMsg.id,
              read: false,
              dismissed: false,
            });

          if (updateErr) {
            console.error(`proactive-updates: team_updates insert error for ${worker.personaName}:`, updateErr);
            // Chat message was inserted but team_updates failed — log but continue
            // (notification won't show but the message is in chat)
            (results.errors as string[]).push(`team_updates insert failed for ${worker.slug}: ${updateErr.message}`);
          } else {
            results.suggestions_created = (results.suggestions_created as number) + 1;
            console.log(`proactive-updates: ✅ ${worker.personaName} → ${profile.id} (${suggestionType})`);
            // ONE-PER-DAY: mark this customer as notified today
            await supabase.from('profiles').update({ last_notification_date: todayDate }).eq('id', profile.id);
            // Send push notification (silent fail if no tokens or table missing)
            sendPushToUser(supabase, profile.id, worker.personaName, previewText, worker.slug).catch(() => {});
            // Only one worker per day per customer — break after first successful suggestion
            break;
          }
        } catch (workerErr) {
          console.error(`proactive-updates: worker error ${worker.slug}:`, workerErr);
          (results.errors as string[]).push(`${worker.slug}: ${String(workerErr)}`);
        }
      }
    } catch (customerErr) {
      console.error(`proactive-updates: customer error ${profile.id}:`, customerErr);
      (results.errors as string[]).push(`customer ${profile.id}: ${String(customerErr)}`);
    }
  }

  console.log('proactive-updates: complete', results);
  return NextResponse.json(results);
}

// Also support GET for Vercel cron (Vercel cron sends GET requests)
export async function GET(req: NextRequest) {
  return POST(req);
}
