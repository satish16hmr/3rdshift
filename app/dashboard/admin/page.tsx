// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { agentFetch } from '@/lib/agent-mode/api'
import { useRouter } from 'next/navigation'

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean)

const LEVER_LABELS = {
  max_workers_per_chain:        { label: 'Max workers per chain', min: 2, max: 10 },
  max_active_chains:            { label: 'Max active chains per user', min: 1, max: 25 },
  max_proactive_checks_per_day: { label: 'Max proactive checks/day', min: 0, max: 10 },
  chain_retry_count:            { label: 'Chain retry count', min: 1, max: 5 },
  execution_timeout_seconds:    { label: 'Execution timeout (seconds)', min: 30, max: 600 },
  rescue_window_max_attempts:   { label: 'Rescue window max attempts', min: 0, max: 5 },
}

function MetricCard({ label, value, subtitle, highlight = false }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'}`}>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${highlight ? 'text-red-600' : 'text-zinc-950'}`}>{value}</p>
      {subtitle && <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [leverValues, setLeverValues] = useState({})
  const [pendingSave, setPendingSave] = useState(null) // { key, oldVal, newVal }
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Deletion requests state
  const [deletionRequests, setDeletionRequests] = useState([])
  const [deletionLoading, setDeletionLoading] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState(null)
  const [deletionExecuting, setDeletionExecuting] = useState(false)
  const [deletionMsg, setDeletionMsg] = useState('')
  const [deletionPage, setDeletionPage] = useState(1)
  const [deletionTotal, setDeletionTotal] = useState(0)
  const [deletionTotalPages, setDeletionTotalPages] = useState(1)
  const [deletionSearch, setDeletionSearch] = useState('')
  const [deletionSearchInput, setDeletionSearchInput] = useState('')

  // 7-day guarantee refund review state (admin-only)
  const [refundAccount, setRefundAccount] = useState('')
  const [refundData, setRefundData] = useState(null)
  const [refundLoading, setRefundLoading] = useState(false)
  const [refundMsg, setRefundMsg] = useState('')
  const [liftReason, setLiftReason] = useState('')

  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !ADMIN_IDS.includes(user.id)) {
        router.replace('/dashboard')
        return
      }
      loadData()
    })
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await agentFetch('/api/admin/metrics')
      if (!res.ok) { setError('Failed to load metrics'); setLoading(false); return }
      const json = await res.json()
      setData(json)
      const levers = {}
      for (const cfg of json.system_config ?? []) {
        levers[cfg.key] = cfg.value
      }
      setLeverValues(levers)
    } catch (e) {
      setError('Failed to load admin data')
    }
    setLoading(false)
    loadDeletionRequests()
  }

  const loadDeletionRequests = async (page = 1, search = '') => {
    setDeletionLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/deletion-requests?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setDeletionRequests(json.requests ?? [])
        setDeletionTotal(json.total ?? 0)
        setDeletionTotalPages(json.totalPages ?? 1)
        setDeletionPage(json.page ?? 1)
      }
    } catch {}
    setDeletionLoading(false)
  }

  const handleApproveDeletion = async () => {
    if (!pendingDeletion) return
    setDeletionExecuting(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/execute-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deletion_request_id: pendingDeletion.id }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setDeletionMsg(`✓ Account for ${pendingDeletion.user_email} has been permanently deleted.`)
      } else {
        setDeletionMsg(`Error: ${json.message || json.error || 'Deletion failed'}`)
      }
      setTimeout(() => setDeletionMsg(''), 6000)
      await loadDeletionRequests(deletionPage, deletionSearch)
    } catch (e) {
      setDeletionMsg('Deletion failed — check console.')
    }
    setDeletionExecuting(false)
    setPendingDeletion(null)
  }

  const loadRefundGuarantee = async () => {
    if (!refundAccount.trim()) return
    setRefundLoading(true)
    setRefundMsg('')
    try {
      const res = await agentFetch(`/api/admin/refund-guarantee?account=${encodeURIComponent(refundAccount.trim())}`)
      const json = await res.json()
      if (!res.ok) {
        setRefundMsg(`Error: ${json.error || 'Unable to load guarantee view'}`)
        setRefundData(null)
      } else {
        setRefundData(json)
      }
    } catch (e) {
      setRefundMsg('Error: unable to load guarantee view')
      setRefundData(null)
    }
    setRefundLoading(false)
  }

  const liftHeavyCap = async () => {
    if (!refundAccount.trim()) return
    setRefundLoading(true)
    setRefundMsg('')
    try {
      const res = await agentFetch('/api/admin/refund-guarantee', {
        method: 'POST',
        body: JSON.stringify({ account: refundAccount.trim(), reason: liftReason }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRefundMsg(`Error: ${json.error || 'Unable to lift cap'}`)
      } else {
        setRefundMsg('✓ Week-one heavy cap lifted for this account')
        await loadRefundGuarantee()
      }
    } catch (e) {
      setRefundMsg('Error: unable to lift cap')
    }
    setRefundLoading(false)
  }

  const handleLeverChange = (key, val) => {
    setLeverValues(prev => ({ ...prev, [key]: val }))
  }

  const handleSaveClick = (key) => {
    const oldVal = data?.system_config?.find(c => c.key === key)?.value ?? ''
    const newVal = leverValues[key]
    setPendingSave({ key, oldVal, newVal })
  }

  const confirmSave = async () => {
    if (!pendingSave) return
    setSaving(true)
    try {
      const res = await agentFetch('/api/admin/config', {
        method: 'PATCH',
        body: JSON.stringify({ key: pendingSave.key, value: pendingSave.newVal }),
      })
      if (res.ok) {
        setSaveMsg(`✓ ${LEVER_LABELS[pendingSave.key]?.label ?? pendingSave.key} updated to ${pendingSave.newVal}`)
        setTimeout(() => setSaveMsg(''), 4000)
        await loadData()
      }
    } catch {}
    setSaving(false)
    setPendingSave(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
    </div>
  )

  if (error) return (
    <div className="p-8 text-center text-red-600">{error}</div>
  )

  const m = data?.metrics ?? {}
  const fallbackHighlight = parseFloat(m.fallback_rate_24h ?? '0') > 5

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950">Admin Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Agent Mode metrics — internal only</p>
        </div>
        <button onClick={loadData} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
          Refresh
        </button>
      </div>

      {/* ── 7 Metric Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Scheduled runs this week" value={m.scheduled_runs_week ?? 0} subtitle="Mon–Sun" />
        <MetricCard label="Avg chain length" value={`${m.avg_chain_length ?? 0} workers`} subtitle="active chains only" />
        <MetricCard label="AM heavy credits (month)" value={m.am_heavy_consumed_month ?? 0} subtitle="from Agent Mode runs" />
        <MetricCard label="Avg AM cost / Operator" value={`$${m.avg_cost_per_operator ?? '0.00'}`} subtitle={`${m.operators_with_runs ?? 0} operators with runs`} />
        <MetricCard label="AM adoption rate" value={`${m.adoption_rate ?? 0}%`} subtitle={`${m.total_operators ?? 0} total Operators`} />
        <MetricCard label="Credit exhaustion rate" value={`${m.exhaustion_rate ?? 0}%`} subtitle={`${m.exhausted_operators ?? 0} operators at 100%`} />
        <MetricCard
          label="OpenAI fallback rate (24h)"
          value={`${m.fallback_rate_24h ?? 0}%`}
          subtitle={`${m.fallback_calls_24h ?? 0} / ${m.total_calls_24h ?? 0} calls`}
          highlight={fallbackHighlight}
        />
      </div>

      {/* ── Alert flags ────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-zinc-950 mb-3">Alert Flags</h2>
        {(!data?.alerts || data.alerts.length === 0) ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✅ No active alerts. All systems healthy.
          </div>
        ) : (
          <div className="space-y-2">
            {data.alerts.map((a, i) => (
              <div key={i} className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                a.type === 'red'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}>
                <span>{a.type === 'red' ? '🔴' : '🟠'}</span>
                {a.message}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 7-day guarantee refund review ───────────────────── */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-zinc-950 mb-3">7-day Guarantee Refund Review</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={refundAccount}
              onChange={(e) => setRefundAccount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadRefundGuarantee() }}
              placeholder="Email, user ID, or Stripe customer ID"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400"
            />
            <button
              onClick={loadRefundGuarantee}
              disabled={refundLoading || !refundAccount.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {refundLoading ? 'Loading…' : 'Review account'}
            </button>
          </div>
          {refundMsg && <p className={`text-sm ${refundMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{refundMsg}</p>}
          {refundData && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Light tasks" value={refundData.guarantee.lightTasksUsed} subtitle={`Clean refund: ≤ ${refundData.guarantee.thresholds.light_tasks}`} />
                <MetricCard label="Heavy credits" value={refundData.guarantee.heavyCreditsConsumed} subtitle={`Clean refund: ≤ ${refundData.guarantee.thresholds.heavy_credits}`} />
                <MetricCard label="Threshold" value={refundData.guarantee.underCleanRefundThreshold ? 'Under' : 'Over'} highlight={!refundData.guarantee.underCleanRefundThreshold} subtitle="Manual Stripe refund" />
                <MetricCard label="Net-out guide" value={`$${(refundData.guarantee.heavyCreditNetOutCents / 100).toFixed(2)}`} subtitle="$37 / 25cr top-up math" />
              </div>
              <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
                <div className="grid gap-2 md:grid-cols-2">
                  <p><span className="font-semibold text-zinc-800">Account:</span> {refundData.account.email} ({refundData.account.plan})</p>
                  <p><span className="font-semibold text-zinc-800">First purchase:</span> {refundData.guarantee.first_purchase_at ? new Date(refundData.guarantee.first_purchase_at).toLocaleString() : 'Not recorded'}</p>
                  <p><span className="font-semibold text-zinc-800">Window:</span> {refundData.guarantee.windowStart ? `${new Date(refundData.guarantee.windowStart).toLocaleDateString()} – ${new Date(refundData.guarantee.windowEnd).toLocaleDateString()}` : '—'}</p>
                  <p><span className="font-semibold text-zinc-800">Week-one cap:</span> {refundData.heavy_cap.cap || 'None'} {refundData.heavy_cap.lifted_at ? `(lifted ${new Date(refundData.heavy_cap.lifted_at).toLocaleString()})` : ''}</p>
                  <p><span className="font-semibold text-zinc-800">Stripe charge:</span> {refundData.guarantee.first_purchase_stripe_charge_id || '—'}</p>
                  <p><span className="font-semibold text-zinc-800">Stripe subscription:</span> {refundData.account.stripe_subscription_id || '—'}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={liftReason}
                  onChange={(e) => setLiftReason(e.target.value)}
                  placeholder="Optional reason for lifting cap"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400"
                />
                <button
                  onClick={liftHeavyCap}
                  disabled={refundLoading || Boolean(refundData.heavy_cap.lifted_at)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Lift week-one heavy cap
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Operator usage table ───────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-zinc-950 mb-3">Operator Usage — This Month</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">User</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Active chains</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Runs</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Heavy (AM)</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Est. cost</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Last run</th>
              </tr>
            </thead>
            <tbody>
              {(data?.operator_table ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">No operator activity this month</td></tr>
              ) : (
                (data?.operator_table ?? []).map((op, i) => (
                  <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-700">{op.email}</td>
                    <td className="px-4 py-3 text-right text-zinc-700">{op.active_chains}</td>
                    <td className="px-4 py-3 text-right text-zinc-700">{op.runs_this_month}</td>
                    <td className="px-4 py-3 text-right text-zinc-700">{op.heavy_am}</td>
                    <td className={`px-4 py-3 text-right font-medium ${parseFloat(op.est_cost) > 7 ? 'text-red-600' : 'text-zinc-700'}`}>
                      ${op.est_cost}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400 text-xs">
                      {op.last_run ? new Date(op.last_run).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Throttle levers ────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-zinc-950 mb-1">Throttle Levers</h2>
        <p className="text-xs text-zinc-500 mb-4">Changes take effect immediately on next chain execution. No deploy required.</p>

        {saveMsg && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {saveMsg}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-50">
          {Object.entries(LEVER_LABELS).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900">{meta.label}</p>
                <p className="text-xs text-zinc-400">{key}</p>
              </div>
              <input
                type="number"
                min={meta.min}
                max={meta.max}
                value={leverValues[key] ?? ''}
                onChange={e => handleLeverChange(key, e.target.value)}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-950 text-right focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveClick(key)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
              >
                Save
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Deletion Requests ──────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-zinc-950 mb-1">Deletion Requests</h2>
        <p className="text-xs text-zinc-500 mb-4">Account deletion requests from customers. Review and approve each one individually. Approval permanently deletes all data for that user.</p>

        {deletionMsg && (
          <div className={`mb-4 rounded-lg border px-4 py-2 text-sm ${deletionMsg.startsWith('✓') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {deletionMsg}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="Search by email..."
            value={deletionSearchInput}
            onChange={e => setDeletionSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setDeletionSearch(deletionSearchInput)
                loadDeletionRequests(1, deletionSearchInput)
              }
            }}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={() => { setDeletionSearch(deletionSearchInput); loadDeletionRequests(1, deletionSearchInput) }}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Search
          </button>
          {deletionSearch && (
            <button
              onClick={() => { setDeletionSearch(''); setDeletionSearchInput(''); loadDeletionRequests(1, '') }}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
            >
              Clear
            </button>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Requested</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {deletionLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-sm">Loading...</td></tr>
              ) : deletionRequests.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-sm">{deletionSearch ? `No results for "${deletionSearch}"` : 'No deletion requests.'}</td></tr>
              ) : (
                deletionRequests.map((req) => (
                  <tr key={req.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-900 font-medium">{req.user_email}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{req.user_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'pending' ? (
                        <button
                          onClick={() => setPendingDeletion(req)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                        >
                          Approve Deletion
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {req.completed_at ? new Date(req.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {deletionTotalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 bg-zinc-50">
              <p className="text-xs text-zinc-500">
                {deletionTotal} total · page {deletionPage} of {deletionTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { const p = deletionPage - 1; setDeletionPage(p); loadDeletionRequests(p, deletionSearch) }}
                  disabled={deletionPage <= 1 || deletionLoading}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => { const p = deletionPage + 1; setDeletionPage(p); loadDeletionRequests(p, deletionSearch) }}
                  disabled={deletionPage >= deletionTotalPages || deletionLoading}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Throttle lever confirmation modal ──────────────── */}
      {pendingSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-950 mb-2">Confirm change</h3>
            <p className="text-sm text-zinc-600 mb-4">
              Change <strong>{LEVER_LABELS[pendingSave.key]?.label ?? pendingSave.key}</strong> from{' '}
              <strong>{pendingSave.oldVal}</strong> to <strong>{pendingSave.newVal}</strong>?
              <br /><span className="text-zinc-400 text-xs mt-1 block">Takes effect immediately.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPendingSave(null)} className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                Cancel
              </button>
              <button onClick={confirmSave} disabled={saving} className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deletion approval confirmation modal ───────────── */}
      {pendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border-2 border-red-200">
            <h3 className="text-base font-bold text-red-700 mb-2">⚠️ Approve Account Deletion</h3>
            <p className="text-sm text-zinc-700 mb-1">
              You are about to <strong>permanently delete all data</strong> for:
            </p>
            <p className="text-sm font-semibold text-zinc-950 mb-1">{pendingDeletion.user_email}</p>
            <p className="text-xs text-zinc-400 font-mono mb-4">{pendingDeletion.user_id}</p>
            <p className="text-sm text-red-600 mb-4">
              This deletes all tasks, chats, memories, brand profile, and the auth account. <strong>This cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDeletion(null)}
                className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveDeletion}
                disabled={deletionExecuting}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deletionExecuting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
