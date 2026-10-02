// @ts-nocheck
'use client'

import React from 'react'
import Link from 'next/link'

const MODE_UPGRADE_CONTENT = {
  signature: {
    emoji: '🚀',
    label: 'Signature course',
    what: '4–8 hour complete course packages with modules, lessons, content ideas, quiz questions, lead magnet, and sales page',
    proMath: [
      { label: 'Pro Annual', value: '$79/month' },
      { label: 'Pro Annual total', value: '$948/year' },
      { label: 'One course sale', value: '$297' },
      { label: 'Three sales', value: '$891 (Pro paid for the year)' },
    ],
    credits: '2 credits per course · 50 credits/month on Pro = 25 Signature courses/month',
    source: 'charlie-signature',
  },
  premium: {
    emoji: '💎',
    label: 'Premium transformation / Cohort',
    what: '10+ hour programs with live cohort structure, accountability systems, peer learning, and high-ticket sales page',
    proMath: [
      { label: 'Pro Annual', value: '$79/month' },
      { label: 'One cohort sale', value: '$1,997' },
      { label: 'One sale covers', value: 'Pro plan for over 2 years' },
    ],
    credits: '2 credits per program · 50 credits/month on Pro = 25 programs/month',
    source: 'charlie-premium',
  },
  certification: {
    emoji: '🎖️',
    label: 'Certification / Credential prep',
    what: 'Exam-aligned course with practice question banks, mock exams, test-taking strategy, and pass guarantee framing',
    proMath: [
      { label: 'Pro Annual', value: '$79/month' },
      { label: 'Pro Annual total', value: '$948/year' },
      { label: 'One course sale', value: '$297' },
      { label: 'Three sales', value: '$891 (Pro paid for the year)' },
    ],
    credits: '2 credits per course · 50 credits/month on Pro = 25 courses/month',
    source: 'charlie-certification',
  },
}

export default function CharlieUpgradePage({ mode, onBack }) {
  const content = MODE_UPGRADE_CONTENT[mode]
  if (!content) return null

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '8px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>{content.emoji}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111113', margin: '0 0 8px' }}>
          {content.label} unlocks on Pro
        </h2>
        <p style={{ fontSize: 14, color: '#71717a', margin: 0, lineHeight: 1.6 }}>
          You'll build: {content.what}
        </p>
      </div>

      {/* ROI math box */}
      <div style={{ background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: 12, padding: '20px 22px', marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Your subscription vs. one {content.label.toLowerCase()} sale
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {content.proMath.map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111113' }}>{row.value}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #bfdbfe', marginTop: 12, paddingTop: 12 }}>
          <p style={{ fontSize: 12, color: '#1d4ed8', margin: 0 }}>{content.credits}</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link
          href={`/dashboard/settings/billing?source=${content.source}`}
          style={{
            display: 'block',
            textAlign: 'center',
            background: '#2563eb',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            padding: '14px 24px',
            borderRadius: 10,
            textDecoration: 'none',
          }}
        >
          Upgrade to Pro →
        </Link>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            color: '#2563eb',
            fontSize: 13,
            fontWeight: 500,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #dbeafe',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          ← Back to free modes
        </button>
      </div>
    </div>
  )
}
