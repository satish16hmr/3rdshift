// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * LeadCards — renders Lenny's fully-revealed RocketReach leads as styled cards.
 * All contact data is pre-revealed server-side at task completion.
 * No reveal buttons, no credit logic, no locked state.
 * Also handles too_broad output with refinement suggestions.
 */
export default function LeadCards({ output: outputProp, taskId, task }) {
  const [copyToast, setCopyToast] = useState(false)
  const router = useRouter()

  const output = task?.output || outputProp || {}
  const leads = output.leads || []
  const refundedCredits = task?.credits_charged ?? output.credits_charged ?? output.credits_refunded ?? 5

  // ── Too-broad result ────────────────────────────────────────────────────
  if (output.too_broad) {
    const criteria = output.search_criteria || {}
    const params = new URLSearchParams()
    if (criteria.industry && criteria.industry !== 'any') params.set('target_industry', criteria.industry)
    if (criteria.titles && criteria.titles !== 'any') params.set('target_role', criteria.titles)
    if (criteria.location && criteria.location !== 'any') params.set('location', criteria.location)
    if (criteria.size && criteria.size !== 'any') params.set('company_size', criteria.size)
    const refineUrl = `/dashboard/team/lead-generator?${params.toString()}`

    return (
      <div className="mt-6">
        <div style={{
          padding: '28px 28px', borderRadius: '14px',
          background: '#fffbeb', border: '1px solid #fde68a',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
            ⚠️ Your search is too broad
          </div>
          <p style={{ fontSize: '15px', color: '#78350f', marginBottom: '16px' }}>
            {output.message}
          </p>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
              Suggestions to narrow your search:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {(output.suggestions || []).map((s, i) => (
                <li key={i} style={{ fontSize: '13px', color: '#78350f', marginBottom: '4px' }}>{s}</li>
              ))}
            </ul>
          </div>
          <div style={{
            padding: '12px 16px', borderRadius: '8px', background: '#d1fae5',
            fontSize: '13px', color: '#065f46', fontWeight: 500, marginBottom: '20px',
            display: 'inline-block',
          }}>
            ✅ Your {refundedCredits} credit{refundedCredits !== 1 ? 's have' : ' has'} been refunded.
          </div>
          <div>
            <a
              href={refineUrl}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                background: '#2563eb', color: '#fff', textDecoration: 'none',
              }}
            >
              Refine Search →
            </a>
          </div>
        </div>
      </div>
    )
  }

  const criteria = output.search_criteria || {}
  const totalResults = leads.length
  const noResults = totalResults === 0

  // ── Copy all leads ──────────────────────────────────────────────────────
  function handleCopy() {
    const text = leads.map(l => {
      const lines = [
        l.name,
        `${l.title}${l.company && l.company !== 'Unknown' ? ` at ${l.company}` : ''}`,
        l.location ? `📍 ${l.location}` : null,
        l.linkedin_url ? `LinkedIn: ${l.linkedin_url}` : null,
        l.email ? `Email: ${l.email}` : null,
        l.phone ? `Phone: ${l.phone}` : null,
      ].filter(Boolean)
      return lines.join('\n')
    }).join('\n\n---\n\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2500)
    })
  }

  // ── Download CSV ────────────────────────────────────────────────────────
  function handleDownloadCsv() {
    const headers = ['Name', 'Title', 'Company', 'Location', 'LinkedIn URL', 'Email', 'Phone']
    const rows = leads.map(l => [
      l.name,
      l.title,
      l.company || '',
      l.location || '',
      l.linkedin_url || '',
      l.email || '',
      l.phone || '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lenny-leads-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Criteria summary ───────────────────────────────────────────────────
  const criteriaParts = [
    criteria.industry && criteria.industry !== 'any' ? criteria.industry : null,
    criteria.titles && criteria.titles !== 'any' ? criteria.titles : null,
    criteria.location && criteria.location !== 'any' ? criteria.location : null,
    criteria.size && criteria.size !== 'any' ? criteria.size + ' employees' : null,
  ].filter(Boolean)

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="mb-6">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111113', marginBottom: '4px' }}>
              {noResults ? 'No leads found' : `${totalResults} lead${totalResults === 1 ? '' : 's'} found`}
            </h3>
            {criteriaParts.length > 0 && (
              <p style={{ fontSize: '14px', color: '#71717a', marginTop: '2px' }}>
                {criteriaParts.join(' · ')}
              </p>
            )}
          </div>

          {!noResults && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                  background: copyToast ? '#dcfce7' : '#f4f4f5',
                  color: copyToast ? '#16a34a' : '#3f3f46',
                  border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                {copyToast ? '✅ Copied!' : '📋 Copy all'}
              </button>
              <button
                onClick={handleDownloadCsv}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                  background: '#f4f4f5', color: '#3f3f46',
                  border: 'none', cursor: 'pointer',
                }}
              >
                📊 Download CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* No results state */}
      {noResults && (
        <div style={{
          padding: '32px 24px', borderRadius: '12px', background: '#fafafa',
          border: '1px solid #e4e4e7', textAlign: 'center',
        }}>
          <p style={{ fontSize: '15px', color: '#71717a', marginBottom: '8px' }}>
            No contacts matched your search criteria.
          </p>
          <p style={{ fontSize: '13px', color: '#a1a1aa' }}>
            Try broader job titles, a different industry, or remove company size filters.
          </p>
        </div>
      )}

      {/* Lead cards */}
      {!noResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {leads.map((lead, idx) => (
            <LeadCard key={lead.profile_id || idx} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Single lead card ────────────────────────────────────────────────────────

function LeadCard({ lead }) {
  return (
    <div style={{
      borderRadius: '12px',
      border: '1px solid #e4e4e7',
      background: '#fff',
      padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Name + title */}
      <div style={{ fontWeight: 700, fontSize: '15px', color: '#111113', marginBottom: '2px' }}>
        {lead.name}
      </div>
      <div style={{ fontSize: '14px', color: '#3f3f46', marginBottom: '10px' }}>
        {lead.title}
        {lead.company && lead.company !== 'Unknown' ? (
          <span style={{ color: '#71717a' }}> · {lead.company}</span>
        ) : null}
      </div>

      {/* Location */}
      {lead.location && (
        <div style={{ fontSize: '13px', color: '#71717a', marginBottom: '5px' }}>
          📍 {lead.location}
        </div>
      )}

      {/* Email */}
      <div style={{ fontSize: '13px', marginBottom: '4px' }}>
        {lead.email ? (
          <a href={`mailto:${lead.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
            📧 {lead.email}
          </a>
        ) : (
          <span style={{ color: '#a1a1aa' }}>📧 No email found</span>
        )}
      </div>

      {/* Phone */}
      <div style={{ fontSize: '13px', marginBottom: '4px' }}>
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
            📱 {lead.phone}
          </a>
        ) : (
          <span style={{ color: '#a1a1aa' }}>📱 No phone found</span>
        )}
      </div>

      {/* LinkedIn */}
      {lead.linkedin_url && (
        <div style={{ fontSize: '13px', marginTop: '6px' }}>
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563eb', textDecoration: 'none' }}
          >
            🔗 LinkedIn →
          </a>
        </div>
      )}
    </div>
  )
}
