// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heading, Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Divider } from '@/components/divider'
import { useRouter } from 'next/navigation'

export default function ActivityDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(null)
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [credits, setCredits] = useState({ heavy_used: 0, heavy_limit: 0, light_used: 0, light_limit: 0 })
  const [session, setSession] = useState(null)
  const [workspaceId, setWorkspaceId] = useState(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)
      loadData(session)
    })
  }, [])

  async function loadData(sess) {
    try {
      // First check plan via workspace endpoint
      const wsRes = await fetch('/api/workspace', {
        headers: { 'Authorization': `Bearer ${sess.access_token}` }
      })
      const wsData = await wsRes.json()
      const ws = wsData.workspaces?.find(w => w.id === wsData.activeWorkspaceId)
      setPlan(ws?.plan || null)

      if (ws?.plan !== 'operator') { setLoading(false); return }

      // Load all activity via admin API (bypasses RLS — gets ALL workspace tasks)
      const actRes = await fetch('/api/workspace/activity', {
        headers: { 'Authorization': `Bearer ${sess.access_token}` }
      })
      const actData = await actRes.json()

      if (!actRes.ok) { setLoading(false); return }

      setTasks(actData.tasks || [])
      setMembers(actData.members || [])
      setCredits({
        heavy_used: actData.workspace?.heavy_credits_used || 0,
        heavy_limit: actData.workspace?.heavy_credits_limit || 0,
        light_used: actData.completed_count || 0,
        light_limit: actData.workspace?.light_tasks_limit || 0,
      })

    } catch (e) {
      console.error('Activity load error:', e)
    }
    setLoading(false)
  }

  function getMemberName(userId) {
    const m = members.find(m => m.user_id === userId)
    return m?.name || m?.email || userId?.slice(0, 8) + '…'
  }

  function getWorkerName(slug) {
    return slug?.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || slug
  }

  function getStatusColor(status) {
    if (status === 'completed') return '#16a34a'
    if (status === 'failed') return '#dc2626'
    if (status === 'processing') return '#2563eb'
    return '#71717a'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e4e4e7', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (plan !== 'operator') return (
    <div className="mx-auto max-w-4xl">
      <Heading>Usage</Heading>
      <Divider className="mt-6 mb-8" />
      <div style={{ background: '#f9fafb', border: '1px solid #e4e4e7', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: '#374151', margin: '0 0 8px', fontWeight: 600 }}>Operator Plan Required</p>
        <p style={{ fontSize: 14, color: '#71717a', margin: '0 0 20px' }}>The Activity Dashboard shows tasks from all workspace members and shared credit usage.</p>
        <a href="/dashboard/settings/billing" style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, padding: '10px 24px', borderRadius: 8, textDecoration: 'none' }}>Upgrade to Operator →</a>
      </div>
    </div>
  )

  const heavyPct = credits.heavy_limit > 0 ? Math.min(100, Math.round(credits.heavy_used / credits.heavy_limit * 100)) : 0
  const lightPct = credits.light_limit > 0 ? Math.min(100, Math.round(credits.light_used / credits.light_limit * 100)) : 0

  return (
    <div className="mx-auto max-w-4xl">
      <Heading>Usage</Heading>
      <Text className="mt-1">Workspace usage and activity across all members.</Text>
      <Divider className="mt-6" />

      {/* Credits */}
      <section className="py-8">
        <Subheading>Credits</Subheading>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: 20 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heavy Credits</p>
            <p style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: '#111113' }}>{credits.heavy_used} <span style={{ fontSize: 16, color: '#71717a', fontWeight: 400 }}>/ {credits.heavy_limit}</span></p>
            <div style={{ height: 6, background: '#f4f4f5', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${heavyPct}%`, background: heavyPct > 80 ? '#ef4444' : '#2563eb', borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: 20 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tasks Completed</p>
            <p style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: '#111113' }}>{credits.light_used} <span style={{ fontSize: 16, color: '#71717a', fontWeight: 400 }}>/ {credits.light_limit}</span></p>
            <div style={{ height: 6, background: '#f4f4f5', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${lightPct}%`, background: lightPct > 80 ? '#ef4444' : '#16a34a', borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      </section>

      <Divider soft />

      {/* Seats */}
      <section className="py-8">
        <Subheading>Seats</Subheading>
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          {members.map(m => (
            <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.role === 'owner' ? 'linear-gradient(135deg, #818cf8, #a78bfa)' : 'linear-gradient(135deg, #34d399, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {(m.name || m.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111113' }}>{m.name || m.email}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#71717a', textTransform: 'capitalize' }}>{m.role}</p>
              </div>
              <span style={{ marginLeft: 4, fontSize: 12, color: '#71717a' }}>
                {tasks.filter(t => t.user_id === m.user_id).length} tasks
              </span>
            </div>
          ))}
        </div>
      </section>

      <Divider soft />

      {/* Activity Feed */}
      <section className="py-8">
        <Subheading>Recent Activity</Subheading>
        <Text className="mt-1">Tasks from all workspace members.</Text>
        <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, overflow: 'hidden' }}>
          {tasks.length === 0 ? (
            <p style={{ padding: 24, color: '#71717a', fontSize: 14, textAlign: 'center' }}>No tasks yet in this workspace.</p>
          ) : (
            tasks.slice(0, 20).map((task, i) => (
              <div
                key={task.id}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < tasks.length - 1 ? '1px solid #f4f4f5' : 'none', cursor: 'pointer' }}
                onClick={() => router.push(`/dashboard/tasks/result?taskId=${task.id}`)}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(task.status), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111113' }}>{getWorkerName(task.worker_slug)}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#71717a' }}>by {getMemberName(task.user_id)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: getStatusColor(task.status), textTransform: 'capitalize' }}>{task.status}</span>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#a1a1aa' }}>
                    {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
