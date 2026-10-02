import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';
import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';
import { enforceBillingAccess } from '@/lib/billing/billing-access';

// POST /api/workspace/invite — send a seat invite (Operator only)
export async function POST(req: NextRequest) {
  // Use direct JWT auth — same as join route, avoids requireAuth workspace resolution issues
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;

  // A3 fix: use the workspace the client explicitly selected, not the first-owned workspace.
  // x-workspace-id is set by the dashboard layout for every authenticated request.
  const headerWorkspaceId = req.headers.get('x-workspace-id');
  if (!headerWorkspaceId) {
    return NextResponse.json({ error: 'x-workspace-id header required' }, { status: 400 });
  }

  // Verify caller is the owner of that specific workspace
  const { data: ownerCheck } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('id', headerWorkspaceId)
    .eq('owner_id', userId)
    .maybeSingle();

  const workspaceId = ownerCheck?.id;
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found or you are not the owner' }, { status: 403 });
  }

  let body: { email: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email } = body;
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Verify workspace exists and user is owner
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, plan, max_seats, owner_id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found or you are not the owner' }, { status: 403 });
  }

  if (workspace.plan !== 'operator') {
    return NextResponse.json({ error: 'Seat invites require an Operator workspace' }, { status: 403 });
  }

  // Phase 23 Step 2 — billing delinquency gate
  {
    const billingAccess = await enforceBillingAccess(supabaseAdmin, userId);
    if (billingAccess.blocked) {
      return NextResponse.json(
        {
          error: billingAccess.code,
          message: billingAccess.code === 'billing_past_due'
            ? 'Your payment is past due. Please update your billing information to continue.'
            : 'No active subscription.',
        },
        { status: 402 }
      );
    }
  }

  // P8-5: Rate limit — max 10 invites per workspace per hour
  const { count: recentInviteCount } = await supabaseAdmin
    .from('workspace_invites')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if ((recentInviteCount ?? 0) >= 10) {
    return NextResponse.json({ error: 'Too many invites sent. Maximum 10 per hour per workspace.' }, { status: 429 });
  }

  // Check current member count
  const { count: memberCount } = await supabaseAdmin
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if ((memberCount ?? 0) >= workspace.max_seats) {
    return NextResponse.json({ error: `This workspace is full (${workspace.max_seats} seats)` }, { status: 400 });
  }

  // P7-3: Check if already a member using profiles table — avoids listUsers() full scan
  const normalizedEmail = email.toLowerCase().trim();
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    const { data: alreadyMember } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', existingProfile.id)
      .single();

    if (alreadyMember) {
      return NextResponse.json({ error: 'This user is already a member of this workspace' }, { status: 400 });
    }
  }

  // Create invite record
  const { data: invite, error } = await supabaseAdmin
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: normalizedEmail,
      invited_by: userId,
    })
    .select('id, token, email, expires_at')
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }

  // P7-4: Hardcode origin from env — never trust the Origin request header
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';
  const inviteUrl = `${siteUrl}/join?token=${invite.token}`;

  // Get inviter's name/email for the email body
  const { data: inviterProfile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();
  let inviterEmail = inviterProfile?.email;
  if (!inviterEmail) {
    const { data: { user: inviterUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    inviterEmail = inviterUser?.email;
  }
  const inviterName = inviterProfile?.full_name || inviterEmail || 'Someone';

  // Send invite email via Resend — D5 fix: surface email failures instead of silently ignoring
  let emailSent = false;
  let emailError: string | null = null;
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '3rdShift <hello@3rdshift.ai>',
        to: [normalizedEmail],
        subject: `${inviterName} invited you to join a 3rdShift workspace`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
  <img src="https://3rdshift.ai/logo-hq.png" alt="3rdShift" style="height:28px;margin-bottom:24px;" />
  <h2 style="font-size:20px;font-weight:700;color:#111113;margin:0 0 12px;">You've been invited to join <strong>${workspace.name}</strong></h2>
  <p style="font-size:14px;color:#52525b;margin:0 0 24px;"><strong>${inviterName}</strong> (${inviterEmail}) invited you to join their workspace on 3rdShift.</p>
  <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">Accept Invitation</a>
  <p style="font-size:12px;color:#a1a1aa;margin-top:24px;">This invite expires in 7 days. If you didn't expect this, you can ignore it.</p>
</div>`,
      }),
    });
    emailSent = emailRes.ok;
    if (!emailRes.ok) {
      const errBody = await emailRes.text().catch(() => '');
      emailError = `Email service returned ${emailRes.status}${errBody ? ': ' + errBody.slice(0, 100) : ''}`;
      console.error('[workspace/invite] Resend error:', emailError);
    }
  } catch (e) {
    emailError = e instanceof Error ? e.message : 'Email send failed';
    console.error('[workspace/invite] Email send exception:', emailError);
  }

  // Return partial success when email fails — invite row exists, owner can copy link manually
  return NextResponse.json({
    success: true,
    invite_id: invite.id,
    email: invite.email,
    invite_url: inviteUrl,
    email_sent: emailSent,
    ...(emailError ? { email_error: 'Invite created but email failed. Use the invite link to share manually.', invite_link: inviteUrl } : {}),
  });
}

// DELETE /api/workspace/invite — remove a seat member
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;

  const { searchParams: sp } = new URL(req.url);
  const memberId = sp.get('user_id');
  const isSelfLeave = memberId === userId;

  let workspaceId: string | null = null;
  if (isSelfLeave) {
    const headerWsId = req.headers.get('x-workspace-id');
    let memberQuery = supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('role', 'member');

    if (headerWsId) {
      memberQuery = memberQuery.eq('workspace_id', headerWsId);
    }

    const { data: memberRow } = await memberQuery
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    workspaceId = memberRow?.workspace_id ?? null;
  } else {
    // A3 fix: use x-workspace-id for remove operations too
    const headerWsId = req.headers.get('x-workspace-id');
    if (headerWsId) {
      // Verify caller is owner of the specified workspace
      const { data: ownerCheck } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('id', headerWsId)
        .eq('owner_id', userId)
        .maybeSingle();
      workspaceId = ownerCheck?.id ?? null;
    } else {
      // Fallback for older clients without header
      const { data: ownedWs } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      workspaceId = ownedWs?.id ?? null;
    }
  }

  if (!workspaceId) return NextResponse.json({ error: 'No workspace found' }, { status: 403 });

  if (!memberId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  if (!isSelfLeave) {
    const roleAuth = await requireWorkspaceRole(req, workspaceId, ['owner']);
    if (roleAuth instanceof NextResponse) return roleAuth;

    const { data: targetMember } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found in this workspace' }, { status: 404 });
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove workspace owner' }, { status: 403 });
    }
  }

  const { error } = await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', memberId);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }

  // Clean up invite records
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(memberId);
  if (authUser?.user?.email) {
    await supabaseAdmin
      .from('workspace_invites')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('email', authUser.user.email);
  }

  return NextResponse.json({ success: true });
}
