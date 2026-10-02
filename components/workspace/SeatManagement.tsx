// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/input'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from '@/components/dialog' // adjust path as needed
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/toast-provider'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/client'
import { getStoredWorkspaceId } from '@/lib/workspace-client'

export default function SeatManagement() {
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState(null)
  const [workspacePlan, setWorkspacePlan] = useState(null)
  const [userRole, setUserRole] = useState(null) // 'owner' or 'member'
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [session, setSession] = useState(null)

  // Dialog state
  const [removeDialog, setRemoveDialog] = useState(null) // { userId, name }
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)
      loadWorkspace(session)
    })
  }, [])

  function wsHeaders(sess, extra = {}) {
    const h = { 'Authorization': `Bearer ${sess.access_token}`, ...extra }
    const wsId = getStoredWorkspaceId()
    if (wsId) h['x-workspace-id'] = wsId
    return h
  }

  async function loadWorkspace(sess) {
    try {
      const res = await fetch('/api/workspace', {
        headers: wsHeaders(sess)
      })
      const data = await res.json()
      if (!data.activeWorkspaceId) { setLoading(false); return }

      const ws = data.workspaces?.find(w => w.id === data.activeWorkspaceId)
      setWorkspaceId(data.activeWorkspaceId)
      setWorkspacePlan(data.ownerCredits?.plan || ws?.plan || null)

      if ((data.ownerCredits?.plan || ws?.plan) !== 'operator') { setLoading(false); return }

      await loadMembers(data.activeWorkspaceId, sess)
    } catch { setLoading(false) }
  }

  async function loadMembers(wsId, sess) {
    try {
      const res = await fetch(`/api/workspace/members`, {
        headers: wsHeaders(sess)
      })
      const data = await res.json()
      setMembers(data.members || [])
      setPendingInvites(data.pending_invites || [])

      // Determine current user's role
      const myMembership = (data.members || []).find(m => m.user_id === sess.user.id)
      setUserRole(myMembership?.role || null)
    } catch { }
    setLoading(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim() || !session) return
    setInviting(true)
    try {
      const res = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: wsHeaders(session, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: inviteEmail.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.email_sent === false) {
          showToast({ title: 'Invite created — email failed', description: `Share this link: ${data.invite_link || data.invite_url || ''}`, variant: 'warning' })
        } else {
          showToast({ title: `Invite sent to ${inviteEmail}`, variant: 'success' })
        }
        setInviteEmail('')
        await loadMembers(workspaceId, session)
      } else {
        showToast({ title: data.error || 'Failed to send invite', variant: 'error' })
      }
    } catch { showToast({ title: 'Something went wrong', variant: 'error' }) }
    setInviting(false)
  }

  // Opens dialog (or skips it if dontAskAgain is checked)
  function handleRemove(userId, name) {
    if (dontAskAgain) {
      confirmRemove(userId)
      return
    }
    setRemoveDialog({ userId, name })
  }

  // Actual removal logic
  async function confirmRemove(userId) {
    if (!userId) return
    setRemoveDialog(null)
    setRemoving(userId)
    try {
      const res = await fetch(`/api/workspace/invite?user_id=${userId}`, {
        method: 'DELETE',
        headers: wsHeaders(session)
      })
      if (res.ok) {
        showToast({ title: 'Member removed', variant: 'success' })
        await loadMembers(workspaceId, session)
      } else {
        const data = await res.json()
        showToast({ title: data.error || 'Failed to remove member', variant: 'error' })
      }
    } catch { showToast({ title: 'Something went wrong', variant: 'error' }) }
    setRemoving(null)
  }

  async function handleLeave() {
    if (!confirm('Leave this workspace? You will lose access immediately.')) return
    setRemoving('self')
    try {
      const res = await fetch(`/api/workspace/invite?user_id=${session.user.id}`, {
        method: 'DELETE',
        headers: wsHeaders(session)
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        showToast({ title: data.error || 'Failed to leave workspace', variant: 'error' })
      }
    } catch { showToast({ title: 'Something went wrong', variant: 'error' }) }
    setRemoving(null)
  }

  async function handleCancelInvite(inviteId) {
    setCancelling(inviteId)
    try {
      const res = await fetch(`/api/workspace/invite/cancel?id=${inviteId}`, {
        method: 'DELETE',
        headers: wsHeaders(session)
      })
      if (res.ok) {
        showToast({ title: 'Invite cancelled', variant: 'success' })
        await loadMembers(workspaceId, session)
      } else {
        showToast({ title: 'Failed to cancel invite', variant: 'error' })
      }
    } catch { showToast({ title: 'Something went wrong', variant: 'error' }) }
    setCancelling(null)
  }

  if (loading) {
    return (
      <div>
        <div className="px-4 sm:px-6 py-4 flex items-center gap-3 border-b border-[#f4f4f5]">
          <Skeleton className="w-10 h-10 rounded-full bg-zinc-200" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32 bg-zinc-200" />
            <Skeleton className="h-3 w-32 bg-zinc-200" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full bg-zinc-200" />
        </div>

        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full bg-zinc-200" />
          <div className="flex-1">
            <Skeleton className="h-4 w-28 bg-zinc-200" />
          </div>
          <Skeleton className="h-9 w-full sm:w-52.5 rounded-md bg-zinc-200 mt-2 sm:mt-0" />
          <Skeleton className="h-9 w-full sm:w-15.5 rounded-md bg-zinc-200" />
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-[#f4f4f5]">
          <Skeleton className="h-16 sm:h-10 lg:h-6 w-full bg-zinc-200" />
        </div>
      </div>
    )
  }

  if (workspacePlan !== 'operator') {
    return (
      <div style={{ padding: '20px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e4e4e7' }}>
        <p style={{ fontSize: 14, color: '#71717a', margin: 0 }}>
          Seat management is available on the <strong>Operator plan</strong>.{' '}
          <Link href="/dashboard/settings/billing" style={{ color: '#2563eb' }}>Upgrade →</Link>
        </p>
      </div>
    )
  }

  const owner = members.find(m => m.role === 'owner')
  const seat2Member = members.find(m => m.role === 'member')
  const isOwner = userRole === 'owner'

  // Seat 2 state: active member → pending invite(s) → empty
  const seat2State = seat2Member ? 'active' : pendingInvites.length > 0 ? 'pending' : 'empty'

  return (
    <div>

      {/* Seat 1 — Owner */}
      <div className="px-4 sm:px-6 py-4" style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f4f4f5' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
          {owner?.avatar_url
            ? <img src={owner.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (owner?.name || owner?.email || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <p className="max-w-[124px] truncate" style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#181D27' }}>{owner?.name || owner?.email || 'Owner'}</p>
          <p className="max-w-[124px] truncate" style={{ margin: 0, fontSize: 14, color: '#535862' }}>{owner?.email}</p>
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#175CD3', background: '#EFF8FF', padding: '2px 10px', borderRadius: 999, border: '1px solid #B2DDFF' }}>Owner</span>
      </div>

      {/* Seat 2 — one of three states */}
      <div className="px-4 sm:px-6 py-4 flex sm:items-center gap-3 flex-col sm:flex-row">

        {/* STATE: active member */}
        {seat2State === 'active' && (
          <>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
              {seat2Member?.avatar_url
                ? <img src={seat2Member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (seat2Member.name || seat2Member.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#181D27' }}>{seat2Member.name || seat2Member.email}</p>
              <p style={{ margin: 0, fontSize: 14, color: '#535862' }}>{seat2Member.email}</p>
            </div>
            <span className='flex items-center justify-center' style={{ fontSize: 12, fontWeight: 500, color: '#414651', background: '#FAFAFA', width: 76, height: 24, borderRadius: 999, border: '1px solid #E9EAEB' }}>Member</span>
            {isOwner && (
              <button
                className="w-full sm:w-[83px]"
                onClick={() => handleRemove(seat2Member.user_id, seat2Member.name || seat2Member.email)}
                disabled={removing === seat2Member.user_id}
                style={{ fontSize: 14, color: '#F04438', fontWeight: 600, background: 'none', border: '1px solid #FDA29B', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: 83 }}
              >
                {removing === seat2Member.user_id ? 'Removing…' : 'Remove'}
              </button>
            )}
            {!isOwner && (
              <button
                className="w-full sm:w-[83px]"
                onClick={handleLeave}
                disabled={removing === 'self'}
                style={{ fontSize: 14, color: '#F04438', fontWeight: 600, background: 'none', border: '1px solid #FDA29B', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: 83 }}
              >
                {removing === 'self' ? 'Leaving…' : 'Leave'}
              </button>
            )}
          </>
        )}

        {/* STATE: pending invite(s) */}
        {seat2State === 'pending' && (
          <div style={{ flex: 1 }}>
            {pendingInvites.map((invite) => (
              <div key={invite.id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8, marginBottom: 8, borderBottom: pendingInvites.length > 1 ? '1px solid #f4f4f5' : 'none' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', fontSize: 18, flexShrink: 0 }}>⏳</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#181D27' }}>{invite.email}</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#535862' }}>Invite pending — expires {new Date(invite.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
                {isOwner && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/join?token=${invite.token}`).then(() => showToast({ title: 'Link copied!', variant: 'success' })).catch(() => { }) }}
                      style={{ fontSize: 11, color: '#2563eb', background: 'none', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      disabled={cancelling === invite.id}
                      style={{ fontSize: 11, color: '#71717a', background: 'none', border: '1px solid #e4e4e7', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
                    >
                      {cancelling === invite.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* STATE: empty — show invite form (owner only) */}
        {seat2State === 'empty' && (
          <div className="w-full flex flex-col items-center text-center sm:text-left sm:flex-row sm:items-center gap-3">
            {/* Left group: Avatar and Seat description */}
            <div className="flex items-center sm:items-center gap-3 flex-1 w-full">
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f4f4f5', border: '2px dashed #d4d4d8', flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: 14, color: '#71717a' }}>Seat 2 — empty</p>
              </div>
            </div>

            {/* Right group: Invite form field and button */}
            {isOwner && (
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="example@exmpale.com"
                  className="w-full sm:w-52.5"
                />
                <button
                  className="w-full sm:w-auto h-9!"
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 14px', /* slightly increased padding for better mobile tap targets */
                    cursor: 'pointer',
                    opacity: inviting ? 0.6 : 1
                  }}
                >
                  {inviting ? 'Sending…' : 'Invite'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <p className="px-4 sm:px-6 py-4" style={{ fontSize: 14, color: '#535862', borderTop: '1px solid #f4f4f5' }}>
        Operator workspaces include 2 seats. Members share credits and can see each other's tasks.
      </p>

      {/* View Workspace Usage — only shown when Seat 2 is active */}
      {seat2State === 'active' && (
        <div style={{ padding: 16, borderTop: '1px solid #f4f4f5' }}>
          <Link href="/dashboard/settings/workspace-usage">
            <Button variant="outline">View Workspace Usage →</Button>
          </Link>
          <p style={{ marginTop: 12, fontSize: 14, color: '#535862' }}>See credit usage and task activity across all seats.</p>
        </div>
      )}

      {/* ── Remove Member Confirmation Dialog ── */}
      <Dialog
        open={!!removeDialog}
        onClose={() => setRemoveDialog(null)}
        className="w-[90%]! sm:w-100! p-0! max-w-none!"

      >
        <DialogTitle className="text-[#181D27] text-lg font-semibold px-4! sm:px-6! py-3! border-b border-[#E9EAEB]">Remove member?</DialogTitle>
        <DialogDescription className="text-[#71717A] text-base px-6! py-5!">
          Remove {removeDialog?.name} from this workspace? They will lose access immediately.
        </DialogDescription>

        <DialogBody className="mt-0! border-b border-[#E9EAEB] px-6! pb-5!">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={e => setDontAskAgain(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 14, color: '#374151' }}>Don't ask again</span>
          </label>
        </DialogBody>

        <DialogActions className="px-4! sm:px-6! pb-5! flex-row! gap-3! mt-3! sm:mt-5!">
          <Button
            variant="outline"
            className="w-[120px]! sm:w-[170px]!"
            onClick={() => setRemoveDialog(null)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="w-[120px]! sm:w-[170px]!"
            onClick={() => {
              const uid = removeDialog?.userId
              confirmRemove(uid)
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}