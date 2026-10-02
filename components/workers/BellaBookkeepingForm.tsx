// @ts-nocheck
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/ui/file-upload'

const MAX_CHARS = 8000

export default function BellaBookkeepingForm({ worker, slug, userPlan, planLoading, heavyCreditsRemaining, activeWorkspaceId, onTaskCreated }) {
  const router = useRouter()

  // Input mode
  const [inputMode, setInputMode] = useState(null) // 'upload' | 'paste'
  const [uploadedContent, setUploadedContent] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState(null)
  const [parsedCount, setParsedCount] = useState(null)
  const [transactions, setTransactions] = useState('')

  // Shared fields
  const [timePeriod, setTimePeriod] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [customCategories, setCustomCategories] = useState('')
  const [flagItems, setFlagItems] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitSeconds, setSubmitSeconds] = useState(0)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleUploadComplete = (content, fileName) => {
    setUploadedContent(content)
    setUploadedFileName(fileName)
    setFieldErrors(prev => { if (!prev.uploadedTransactions) return prev; const next = { ...prev }; delete next.uploadedTransactions; return next })
    // Estimate transaction count from lines
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
    const count = Math.max(0, lines.length - 1) // subtract header
    setParsedCount(count)
    setInputMode('upload')
  }

  const handleClearUpload = () => {
    setUploadedContent(null)
    setUploadedFileName(null)
    setParsedCount(null)
    setInputMode(null)
  }

  const handleSubmit = async () => {
    setError('')
    setFieldErrors({})
    
    const newErrors: Record<string, string> = {}
    if (!inputMode) {
      newErrors.transactions = 'Upload a file or paste your transactions to continue.'
    }
    if (inputMode === 'paste' && !transactions.trim()) newErrors.transactions = 'Paste your transactions to continue.'
    if (inputMode === 'upload' && !uploadedContent) newErrors.uploadedTransactions = 'Upload failed — please try again.'
    if (!timePeriod.trim()) newErrors.timePeriod = 'Time period is required.'
    if (!businessType.trim()) newErrors.businessType = 'Business type is required.'

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    setSubmitting(true)
    setSubmitSeconds(0)
    const timer = setInterval(() => setSubmitSeconds(s => s + 1), 1000)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const inputObj = {
        time_period: timePeriod.trim(),
        business_type: businessType.trim(),
        custom_categories: customCategories.trim() || '',
        flag_items: flagItems.trim() || '',
        transactions: inputMode === 'upload'
          ? `[Uploaded from ${uploadedFileName}]\n${uploadedContent}`
          : transactions.trim(),
      }

      const createRes = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ worker_slug: slug, workspace_id: activeWorkspaceId, input: inputObj }),
      })
      const taskData = await createRes.json().catch(() => null)

      if (!createRes.ok || !(taskData?.taskId || taskData?.task_id)) {
        clearInterval(timer)
        setError(taskData?.message || taskData?.error || 'Failed to create task')
        setSubmitting(false)
        return
      }

      clearInterval(timer)
      const taskId = taskData.taskId || taskData.task_id
      if (onTaskCreated) {
        onTaskCreated(taskId)
      } else {
        router.push(`/dashboard/tasks/result?taskId=${taskId}`)
      }
    } catch (e) {
      clearInterval(timer)
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className=" p-4 sm:p-6">

      {/* File upload area */}
      <div className='mb-6'>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', marginBottom: 10 }}>
          Upload your bank statement or transaction file
        </p>

        {inputMode === 'upload' && uploadedFileName ? (
          <div style={{
            border: '1.5px solid #86efac',
            borderRadius: 10,
            padding: '14px 16px',
            background: '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                ✅ Parsed from {uploadedFileName}
              </div>
              {parsedCount !== null && (
                <div style={{ fontSize: 12, color: '#4ade80', marginTop: 2 }}>
                  ~{parsedCount} transaction{parsedCount !== 1 ? 's' : ''} detected
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearUpload}
              style={{
                fontSize: 12, color: '#6b7280', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <FileUpload
            type="document"
            label=""
            acceptedTypesLabel="CSV, XLSX, PDF, PNG, JPG"
            required={false}
            fieldName="transaction_file"
            onUploadComplete={handleUploadComplete}
            onUploadError={(err) => setError(`Upload failed: ${err}`)}
            onClear={handleClearUpload}
          />
        )}
        {fieldErrors.uploadedTransactions && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.uploadedTransactions}</p>}
        <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 6 }}>
          CSV and Excel exports from your bank work best. PDF and image statements also supported. Max 10MB.
        </p>
      </div>

      {/* Divider with OR paste */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
        <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>or paste manually</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
      </div>

      {/* Paste textarea — disabled when file uploaded */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>
          Transactions (CSV or plain rows)
          {inputMode !== 'upload' && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        {inputMode === 'upload' ? (
          <div style={{
            ...textareaStyle,
            height: 80,
            background: '#f4f4f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a1a1aa',
            fontSize: 13,
            borderStyle: 'dashed',
          }}>
            Using uploaded file — remove it above to paste manually
          </div>
        ) : (
          <>
            <textarea
              rows={10}
              placeholder={`Date, Description, Amount\n2026-03-01, AWS, -$127.43\n2026-03-04, Stripe Payout, +$3,240.00\n2026-03-07, Gusto Payroll, -$8,500.00\n...`}
              value={transactions}
              maxLength={MAX_CHARS}
              onChange={e => {
                setTransactions(e.target.value)
                if (!inputMode) setInputMode('paste')
                setFieldErrors(prev => { if (!prev.transactions) return prev; const next = { ...prev }; delete next.transactions; return next })
              }}
              style={textareaStyle}
            />
            {fieldErrors.transactions && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.transactions}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>{transactions.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      {/* Required fields */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5'>
        <div>
          <label style={labelStyle}>Time Period <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            placeholder="e.g. March 2026"
            value={timePeriod}
            onChange={e => {
              setTimePeriod(e.target.value)
              setFieldErrors(prev => { if (!prev.timePeriod) return prev; const next = { ...prev }; delete next.timePeriod; return next })
            }}
            style={inputStyle}
          />
          {fieldErrors.timePeriod && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.timePeriod}</p>}
        </div>
        <div>
          <label style={labelStyle}>Business Type <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={businessType}
            onChange={e => {
              setBusinessType(e.target.value)
              setFieldErrors(prev => { if (!prev.businessType) return prev; const next = { ...prev }; delete next.businessType; return next })
            }}
            style={{ ...inputStyle, appearance: 'auto' }}
          >
            <option value="">Select...</option>
            {['SaaS', 'Ecommerce', 'Agency', 'Marketplace', 'Creator', 'Services', 'Physical Product', 'Other'].map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {fieldErrors.businessType && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.businessType}</p>}
        </div>
      </div>

      {/* Optional fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ ...labelStyle, color: '#71717a' }}>Custom Categories <span style={{ fontSize: 11, fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Payroll, Software, Ads, Revenue, Refunds"
            value={customCategories}
            onChange={e => setCustomCategories(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ ...labelStyle, color: '#71717a' }}>Specific items to watch for <span style={{ fontSize: 11, fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. missing Stripe payout, duplicate AWS charge"
            value={flagItems}
            onChange={e => setFlagItems(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Submit */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 20 }}>
        {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#71717a' }}>
            <span style={{ fontWeight: 600, color: '#111113' }}>2 credits</span> · Downloads as PDF + Excel
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: submitting ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 150ms',
            }}
          >
            {submitting ? (
              <>
                <svg style={{ animation: 'spin 1s linear infinite', width: 16, height: 16 }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing…
              </>
            ) : 'Summarize Transactions →'}
          </button>
        </div>
        {submitting && (
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <p style={{ fontSize: 12, color: '#a1a1aa' }}>Bella is categorizing your transactions…</p>
            {submitSeconds >= 5 && <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>This usually takes 20–40 seconds</p>}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const textareaStyle = {
  width: '100%', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)',
  padding: '10px 12px', fontSize: 14, color: '#111113', fontFamily: 'inherit',
  resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
}
const inputStyle = {
  width: '100%', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)',
  padding: '10px 12px', fontSize: 14, color: '#111113', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle = {
  fontSize: 13, fontWeight: 500, color: '#111113', display: 'block', marginBottom: 6,
}
