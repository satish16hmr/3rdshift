export const maxDuration = 300;
/**
 * /api/cron/ava-team-lead
 * System 2 — Runs at 15:00 UTC daily (1 hour after System 1)
 *
 * Ava is the face of the platform. She sends:
 *   Type 1: Milestones (10, 50, 100... 1000 tasks)
 *   Type 2: Consistency (weeks 3, 5, 8, 12 of consecutive weekly usage)
 *   Type 3: Discovery (intro a teammate they haven't used)
 *   Type 4: Re-engagement (7, 14, 21 day inactivity — 3 attempts max)
 *
 * ONE-PER-DAY RULE: If System 1 already sent a notification today (last_notification_date = today),
 * Ava stays silent. System 1 has priority.
 *
 * Ava's worker_slug is 'ava-team-lead' — distinct from 'content-writer' (which is System 1's Ava).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { verifyCronRequest } from '@/lib/cron-auth';

function getSupabase() {
  return supabaseAdmin;
}

// ─── Savings rate per worker category ────────────────────────────────────────
const SAVINGS_RATES: Record<string, number> = {
  'hook-specialist': 75,
  'content-writer': 75,
  'social-media-creator': 75,
  'newsletter-writer': 75,
  'creative-editor': 75,
  'script-writer': 75,
  'instagram-strategist': 75,
  'community-manager': 75,
  'email-copywriter': 50,
  'email-marketing-strategist': 50,
  'ad-copywriter': 60,
  'ad-campaign-strategist': 60,
  'lead-generator': 100,
  'seo-strategist': 100,
  'market-research-analyst': 100,
  'competitor-analyst': 100,
  'thumbnail-designer': 80,
  'social-media-graphics-designer': 80,
  'logo-concept-generator': 80,
  'voiceover-artist': 75,
  'transcription-specialist': 75,
  'product-video-creator': 150,
  'b-roll-generator': 150,
  'scene-director': 150,
  'ad-creative-generator': 150,
};

const DEFAULT_RATE = 50;

function calculateSavings(tasks: Array<{ worker_slug: string }>): number {
  const total = tasks.reduce((sum, t) => sum + (SAVINGS_RATES[t.worker_slug] ?? DEFAULT_RATE), 0);
  return Math.floor(total / 100) * 100; // round down to nearest $100
}

// ─── Discovery mapping ────────────────────────────────────────────────────────
const DISCOVERY_MAP: Record<string, { slug: string; name: string; role: string }> = {
  'hook-specialist': { slug: 'social-media-creator', name: 'Ash', role: 'Short-Form Video Script Writer' },
  'content-writer': { slug: 'social-media-creator', name: 'Ash', role: 'Short-Form Video Script Writer' },
  'social-media-creator': { slug: 'content-writer', name: 'Ava', role: 'Article Writer' },
  'email-copywriter': { slug: 'lead-generator', name: 'Lenny', role: 'Lead Generator' },
  'lead-generator': { slug: 'email-copywriter', name: 'Mira', role: 'Email Copywriter' },
  'ad-copywriter': { slug: 'social-media-creator', name: 'Ash', role: 'Short-Form Video Script Writer' },
  'thumbnail-designer': { slug: 'social-media-creator', name: 'Ash', role: 'Short-Form Video Script Writer' },
  'seo-strategist': { slug: 'content-writer', name: 'Ava', role: 'Article Writer' },
  'newsletter-writer': { slug: 'email-copywriter', name: 'Mira', role: 'Email Copywriter' },
};

// ─── Milestone thresholds ────────────────────────────────────────────────────
const MILESTONES = [10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

// ─── Light Haiku call for discovery message ───────────────────────────────────
async function callHaikuForDiscovery(mostUsedWorker: string, suggestedWorker: { name: string; role: string }, brandContext: string): Promise<string> {
  const prompt = `You are Ava, team lead at the customer's 3rdShift team. Introduce a teammate the customer hasn't met yet.

Write exactly 2 sentences:
1. One sentence about what the suggested teammate does and how it connects to the customer's current work.
2. One sentence suggesting they give it a try.

Keep it casual, warm, and brief. Do NOT say "I'd like to introduce" — just speak naturally.

Customer's most used worker: ${mostUsedWorker}
Teammate to introduce: ${suggestedWorker.name} (${suggestedWorker.role})
Customer's brand context: ${brandContext || 'A small business using AI workers to save time.'}

Write the 2-sentence introduction now:`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return '';
    const data = await res.json() as { content: Array<{ text: string }> };
    return data.content?.[0]?.text?.trim() || '';
  } catch {
    return '';
  }
}

// ─── Insert Ava message into Team Chat + team_updates ─────────────────────────
async function sendAvaMessage(
  supabase: ReturnType<typeof getSupabase>,
  {
    userId,
    workspaceId,
    messageType,
    messageText,
    previewText,
    todayDate,
  }: {
    userId: string;
    workspaceId: string;
    messageType: string;
    messageText: string;
    previewText: string;
    todayDate: string;
  }
): Promise<boolean> {
  // Visual treatment for Ava: ⭐ label (different from 💡 suggestion treatment)
  const chatContent = `⭐ ${messageText}`;

  const { data: insertedMsg, error: chatErr } = await supabase
    .from('team_chat_messages')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      member_id: 'content-writer',  // Routes to Ava's existing chat page
      role: 'member',
      content: chatContent,
    })
    .select('id')
    .single();

  if (chatErr || !insertedMsg) {
    console.error('ava-team-lead: chat insert failed:', chatErr?.message);
    return false;
  }

  const { error: tuErr } = await supabase.from('team_updates').insert({
    workspace_id: workspaceId,
    user_id: userId,
    worker_slug: 'ava-team-lead',
    suggestion_type: messageType,
    suggestion_text: messageText,
    preview_text: previewText,
    source_data: null,
    chat_message_id: insertedMsg.id,
    read: false,
    dismissed: false,
  });

  if (tuErr) {
    console.error('ava-team-lead: team_updates insert failed:', tuErr.message);
    return false;
  }

  // Update last_notification_date (one-per-day rule)
  await supabase.from('profiles').update({ last_notification_date: todayDate }).eq('id', userId);
  console.log(`ava-team-lead: ✅ sent ${messageType}`);
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.valid) return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });

  const supabase = getSupabase();
  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const results = { processed: 0, skipped: 0, sent: 0, errors: [] as string[] };

  // Fetch all activated profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, plan, brand_context, team_updates_settings, team_updates_activated, last_notification_date, milestone_reached, consistency_streak_weeks, reengagement_attempts, last_task_date')
    .eq('team_updates_activated', true)
    .in('plan', ['starter', 'pro', 'operator']);

  if (profilesError) {
    console.error('ava-team-lead: profiles query failed:', profilesError);
    return NextResponse.json({ error: 'profiles_query_failed', message: profilesError.message }, { status: 500 });
  }

  for (const profile of profiles ?? []) {
    try {
      // ONE-PER-DAY: if System 1 already sent today, Ava stays silent
      const profileAny = profile as Record<string, string | number | null>;
      if (profileAny.last_notification_date === todayDate) {
        results.skipped++;
        continue;
      }

      // Check Team Updates enabled + Ava toggle
      const settings = (profile.team_updates_settings || {}) as { enabled?: boolean; ava_enabled?: boolean };
      if (settings.enabled === false) { results.skipped++; continue; }
      if (settings.ava_enabled === false) { results.skipped++; continue; }

      // Get workspace
      const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', profile.id).single();
      if (!workspace) continue;

      // Get all completed tasks for this workspace
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('id, worker_slug, created_at, status')
        .eq('workspace_id', workspace.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      const taskCount = allTasks?.length ?? 0;

      // Prefer workspace-scoped brand_profile; fall back to legacy profiles.brand_context.
      const { data: workspaceBrandProfile } = await supabase
        .from('brand_profile')
        .select('company_name, industry, audience, tone, competitors, additional_context')
        .eq('workspace_id', workspace.id)
        .maybeSingle();
      const rawBC = profile.brand_context;
      const legacyBrandCtx: Record<string, string> =
        typeof rawBC === 'string' ? (() => { try { return JSON.parse(rawBC); } catch { return {}; } })() : (rawBC as Record<string, string> || {});
      const brandCtx = (workspaceBrandProfile || legacyBrandCtx || {}) as Record<string, string>;
      const brandContextStr = [
        brandCtx.company_name ? `Company: ${brandCtx.company_name}` : '',
        brandCtx.industry ? `Industry: ${brandCtx.industry}` : '',
        brandCtx.audience ? `Audience: ${brandCtx.audience}` : '',
        brandCtx.tone ? `Tone: ${brandCtx.tone}` : '',
        brandCtx.competitors ? `Competitors: ${brandCtx.competitors}` : '',
        brandCtx.additional_context ? `Additional context: ${brandCtx.additional_context}` : '',
      ].filter(Boolean).join('\n');

      results.processed++;
      let sent = false;

      // ── TYPE 1: MILESTONES ────────────────────────────────────────────────
      const milestoneReached = (profileAny.milestone_reached as number) || 0;
      const nextMilestone = MILESTONES.find(m => m > milestoneReached && taskCount >= m);

      if (nextMilestone && nextMilestone <= 1000) {
        const savings = calculateSavings(allTasks || []);
        let messageText: string;

        if (nextMilestone === 1000) {
          messageText = `1,000 tasks. You and your 3rdShift team have done something most businesses never get to — consistent, high-output execution without burning out or blowing budget. That's over $${savings.toLocaleString()} in freelancer costs you've saved. Here's to the next 1,000.`;
        } else {
          messageText = `You've hit ${nextMilestone} tasks with your 3rdShift team — that's over $${savings.toLocaleString()} you've saved compared to hiring this out. Smart move.`;
        }

        const previewText = messageText.slice(0, 120);

        sent = await sendAvaMessage(supabase, {
          userId: profile.id,
          workspaceId: workspace.id,
          messageType: 'milestone',
          messageText,
          previewText,
          todayDate,
        });

        if (sent) {
          // Record milestone as reached
          await supabase.from('profiles').update({ milestone_reached: nextMilestone }).eq('id', profile.id);
          results.sent++;
          continue;
        }
      }

      if (sent) continue;

      // ── TYPE 2: CONSISTENCY ───────────────────────────────────────────────
      // Check if customer has run ≥1 task per week for 3+ consecutive weeks
      const consistencyWeeks = (profileAny.consistency_streak_weeks as number) || 0;
      const CONSISTENCY_MESSAGES: Record<number, string> = {
        3: '3 weeks straight with your team. You\'re building real momentum.',
        5: '5 weeks running. Your team knows your brand better every week — the output keeps getting sharper.',
        8: '2 months with your team. Most people quit tools after a week. You\'re getting the real value.',
        12: '3 months in. Your 3rdShift team is fully dialed into your brand. The work you\'re getting now is miles better than week one.',
      };

      // Count weeks of activity in the last 12 weeks
      const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
      const weekBuckets = new Set<string>();
      for (const task of allTasks || []) {
        const taskDate = new Date(task.created_at);
        if (taskDate >= twelveWeeksAgo) {
          const weekNum = Math.floor((now.getTime() - taskDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          weekBuckets.add(String(weekNum));
        }
      }

      // Calculate consecutive streak
      let streak = 0;
      for (let w = 0; w <= 12; w++) {
        if (weekBuckets.has(String(w))) streak++;
        else break;
      }

      const CONSISTENCY_FIRE_WEEKS = [3, 5, 8, 12];
      const shouldFireConsistency = CONSISTENCY_FIRE_WEEKS.includes(streak) && streak > consistencyWeeks;

      if (shouldFireConsistency && CONSISTENCY_MESSAGES[streak]) {
        sent = await sendAvaMessage(supabase, {
          userId: profile.id,
          workspaceId: workspace.id,
          messageType: 'consistency',
          messageText: CONSISTENCY_MESSAGES[streak],
          previewText: CONSISTENCY_MESSAGES[streak].slice(0, 120),
          todayDate,
        });

        if (sent) {
          await supabase.from('profiles').update({ consistency_streak_weeks: streak }).eq('id', profile.id);
          results.sent++;
          continue;
        }
      }

      if (sent) continue;

      // ── TYPE 3: DISCOVERY ─────────────────────────────────────────────────
      // Fire once per month if customer uses 1-2 workers repeatedly but hasn't tried a related one
      const { count: recentDiscovery } = await supabase
        .from('team_updates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('worker_slug', 'ava-team-lead')
        .eq('suggestion_type', 'discovery')
        .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if ((recentDiscovery ?? 0) === 0 && taskCount >= 10) {
        // Find most used worker
        const workerCounts: Record<string, number> = {};
        for (const t of allTasks || []) {
          workerCounts[t.worker_slug] = (workerCounts[t.worker_slug] || 0) + 1;
        }
        const mostUsed = Object.entries(workerCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const suggested = mostUsed ? DISCOVERY_MAP[mostUsed] : null;

        if (suggested) {
          // Check customer hasn't used the suggested worker
          const hasUsedSuggested = (workerCounts[suggested.slug] ?? 0) > 0;
          if (!hasUsedSuggested) {
            const introText = await callHaikuForDiscovery(mostUsed, suggested, brandContextStr);
            if (introText && introText.length > 20) {
              sent = await sendAvaMessage(supabase, {
                userId: profile.id,
                workspaceId: workspace.id,
                messageType: 'discovery',
                messageText: introText,
                previewText: introText.slice(0, 120),
                todayDate,
              });
              if (sent) { results.sent++; continue; }
            }
          }
        }
      }

      if (sent) continue;

      // ── TYPE 4: RE-ENGAGEMENT ─────────────────────────────────────────────
      const reengagementAttempts = (profileAny.reengagement_attempts as number) || 0;
      const lastTaskDate = (profileAny.last_task_date as string) || null;

      // Skip re-engagement if: max attempts reached, subscription canceled, first 7 days
      if (reengagementAttempts >= 3) { results.skipped++; continue; }

      // Update last_task_date from actual tasks
      const mostRecentTaskDate = allTasks?.[0]?.created_at?.slice(0, 10) || null;
      if (mostRecentTaskDate && mostRecentTaskDate !== lastTaskDate) {
        await supabase.from('profiles').update({ last_task_date: mostRecentTaskDate }).eq('id', profile.id);
      }

      const effectiveLastTask = mostRecentTaskDate || lastTaskDate;
      if (!effectiveLastTask) { results.skipped++; continue; }

      const RE_ENGAGEMENT_MESSAGES: Record<number, string> = {
        0: "Your team's still here whenever you're ready. No pressure — just wanted you to know.",
        1: "It's been a couple weeks. If you want to pick back up, your team remembers your brand and preferences — no re-explaining needed.",
        2: "Quick check-in from your team. We're here if you need us. If not, no worries at all.",
      };

      let reengagementMessage: string | null = null;
      if (effectiveLastTask <= twentyOneDaysAgo && reengagementAttempts === 2) {
        reengagementMessage = RE_ENGAGEMENT_MESSAGES[2];
      } else if (effectiveLastTask <= fourteenDaysAgo && reengagementAttempts === 1) {
        reengagementMessage = RE_ENGAGEMENT_MESSAGES[1];
      } else if (effectiveLastTask <= sevenDaysAgo && reengagementAttempts === 0) {
        reengagementMessage = RE_ENGAGEMENT_MESSAGES[0];
      }

      if (reengagementMessage) {
        sent = await sendAvaMessage(supabase, {
          userId: profile.id,
          workspaceId: workspace.id,
          messageType: 're-engagement',
          messageText: reengagementMessage,
          previewText: reengagementMessage.slice(0, 120),
          todayDate,
        });

        if (sent) {
          await supabase.from('profiles').update({ reengagement_attempts: reengagementAttempts + 1 }).eq('id', profile.id);
          results.sent++;
        }
      }

    } catch (err) {
      console.error(`ava-team-lead: error for ${profile.id}:`, err);
      (results.errors as string[]).push(`${profile.id}: ${String(err)}`);
    }
  }

  console.log('ava-team-lead: complete', results);
  return NextResponse.json(results);
}

export async function GET(req: NextRequest) {
  return POST(req);
}
