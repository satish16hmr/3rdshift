import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getAvailableCredits } from '@/lib/billing/available-credits';

/**
 * GET /api/billing/topup-status?session_id=cs_xxx
 *
 * Phase 3 Component 7: Polls whether a top-up checkout webhook has been processed.
 * Client polls this after Stripe checkout success to confirm credits were actually granted.
 * Returns { credited: false } until webhook fires, then { credited: true, new_total: N }.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  // Check if the webhook event for this session_id was fully processed (status=completed).
  // The handler sets status='processing' on insert, then writes credit_topups,
  // then sets status='completed' — so 'completed' is the correct atomic signal that credits landed.
  // Polling on any row (including 'processing') would return credited:true before credits exist.
  const { data: event } = await supabaseAdmin
    .from('stripe_webhook_events')
    .select('id, event_type')
    .eq('session_id', sessionId)
    .eq('status', 'completed')
    .maybeSingle();

  if (!event) {
    // Webhook not yet processed (or still in-flight)
    return NextResponse.json({ credited: false });
  }

  const availableCredits = await getAvailableCredits(supabaseAdmin, userId);

  return NextResponse.json({
    credited: true,
    new_total: availableCredits.availableCreditsRemaining,
    plan_credits_remaining: availableCredits.planCreditsRemaining,
    topup_credits_remaining: availableCredits.topupCreditsRemaining,
  });
}
