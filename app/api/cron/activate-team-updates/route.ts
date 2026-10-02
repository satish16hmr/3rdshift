/**
 * /api/cron/activate-team-updates
 * Runs daily at 11:00 UTC — marks customers as eligible for proactive updates.
 * Requirements: signed up 7+ days ago AND completed 3+ tasks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { verifyCronRequest } from '@/lib/cron-auth';

function getSupabase() {
  return supabaseAdmin;
}

export async function POST(req: NextRequest) {
  const cronAuth = verifyCronRequest(req);
  if (!cronAuth.valid) {
    return NextResponse.json({ error: `Unauthorized: ${cronAuth.reason}` }, { status: 401 });
  }

  const supabase = getSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find profiles not yet activated, created 7+ days ago, with active plan
  const { data: candidates, error: candidatesError } = await supabase
    .from('profiles')
    .select('id, created_at')
    .eq('team_updates_activated', false)
    .lt('created_at', sevenDaysAgo)
    .in('plan', ['starter', 'pro', 'operator']);

  if (candidatesError) {
    console.error('activate-team-updates: candidates query failed:', candidatesError);
    return NextResponse.json({ error: 'candidates_query_failed', message: candidatesError.message }, { status: 500 });
  }

  let activated = 0;

  for (const candidate of candidates ?? []) {
    // Get their workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', candidate.id)
      .single();

    if (!workspace) continue;

    // Count completed tasks
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('status', 'completed');

    if ((count ?? 0) >= 3) {
      await supabase
        .from('profiles')
        .update({
          team_updates_activated: true,
          team_updates_activated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);
      activated++;
      console.log(`activate-team-updates: activated user ${candidate.id}`);

      // Send Ava's intro message — fires once when customer first activates
      const introText = `Hey — I'm Ava, your team lead at 3rdShift. I'll check in from time to time with updates on how your team is doing. Your teammates may also send you ideas based on what they're seeing in your industry. Welcome aboard.`;
      try {
        const { data: introMsg } = await supabase
          .from('team_chat_messages')
          .insert({
            user_id: candidate.id,
            workspace_id: workspace.id,
            member_id: 'content-writer', // Ava's chat page
            role: 'member',
            content: `⭐ ${introText}`,
          })
          .select('id')
          .single();

        if (introMsg) {
          await supabase.from('team_updates').insert({
            workspace_id: workspace.id,
            user_id: candidate.id,
            worker_slug: 'ava-team-lead',
            suggestion_type: 'encouragement',
            suggestion_text: introText,
            preview_text: introText.slice(0, 120),
            source_data: null,
            chat_message_id: introMsg.id,
            read: false,
            dismissed: false,
          });
          console.log(`activate-team-updates: sent Ava intro to ${candidate.id}`);
        }
      } catch (err) {
        console.error(`activate-team-updates: intro send failed for ${candidate.id}:`, err);
      }
    }
  }

  return NextResponse.json({ activated, checked: (candidates ?? []).length });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
