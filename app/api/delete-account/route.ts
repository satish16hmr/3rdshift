import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';

// POST /api/delete-account
// Marks the authenticated user's account for deletion (does NOT delete data).
// Josh must approve via admin dashboard before actual deletion runs.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  // Get user email for audit record
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const userEmail = userData.user.email ?? 'unknown'

  // ── Subscription check: block deletion if active paid subscription ──
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_subscription_id, plan')
    .eq('id', userId)
    .single()

  if (profile?.stripe_subscription_id) {
    try {
      const sk = process.env.STRIPE_SECRET_KEY!
      const res = await fetch(
        `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}`,
        {
          headers: {
            'Authorization': `Bearer ${sk}`,
            'Stripe-Version': '2026-02-25.clover',
          },
        }
      )
      if (res.ok) {
        const sub = await res.json()
        // Block if subscription is active and NOT already set to cancel
        const isActive = sub.status === 'active' || sub.status === 'trialing'
        const cancelingAtPeriodEnd = sub.cancel_at_period_end === true
        if (isActive && !cancelingAtPeriodEnd) {
          // Format the period end date
          const periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
              })
            : 'the end of your billing period'
          return NextResponse.json({
            error: 'active_subscription',
            message: `You have an active subscription through ${periodEnd}. Cancel your subscription in Billing first. Once your paid period ends, you can delete your account.`,
            period_end_date: periodEnd,
          }, { status: 402 })
        }
      }
    } catch {
      // If Stripe check fails, don't block — proceed with deletion request
    }
  }

  // Check if already has a pending deletion request
  const { data: existing } = await supabaseAdmin
    .from('account_deletion_requests')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A deletion request is already pending for this account.' }, { status: 409 })
  }

  // P7-5: Block deletion if user owns a workspace with active seat members.
  // Forces the owner to remove members or transfer ownership first.
  // Prevents accidental team data destruction via a single click.
  const { data: ownedWorkspaces } = await supabaseAdmin
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', userId);

  if (ownedWorkspaces && ownedWorkspaces.length > 0) {
    for (const ws of ownedWorkspaces) {
      // Count non-owner members in this workspace
      const { count: memberCount } = await supabaseAdmin
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
        .eq('role', 'member');

      if ((memberCount ?? 0) > 0) {
        return NextResponse.json({
          error: 'workspace_has_members',
          message: `Your workspace "${ws.name}" has active members. Remove all members before deleting your account.`,
        }, { status: 400 });
      }
    }
  }

  // F2 fix: do NOT revoke workspace access at request time.
  // UI tells user "we'll process within 7 business days" — immediately deleting
  // workspace_members contradicts that promise. All actual cleanup (workspace_members,
  // profile, tasks, etc.) happens when JR processes the deletion post-review.

  // Insert deletion request (marked pending — NOT deleted)
  const { error: insertError } = await supabaseAdmin
    .from('account_deletion_requests')
    .insert({
      user_id: userId,
      user_email: userEmail,
      status: 'pending',
      requested_at: new Date().toISOString(),
    })

  if (insertError) {
    console.error('Delete account request insert error:', insertError)
    return NextResponse.json({ error: 'Failed to submit deletion request.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
