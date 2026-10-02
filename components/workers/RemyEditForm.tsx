// @ts-nocheck
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/ui/file-upload'
import { Select } from '@/components/select'

const MAX_CHARS = 10000

const OUTPUT_FORMAT_OPTIONS = ['General', 'Blog Post', 'Email', 'Landing Page', 'Newsletter', 'Social Post', 'Script']
const TONE_OPTIONS = ['Friendly', 'Professional', 'Witty', 'Conversational']
const FEEDBACK_TYPE_OPTIONS = ['All of the Above', 'Overall Quality', 'Clarity & Flow', 'Persuasiveness', 'Tone & Voice', 'Structure']
const FEEDBACK_STYLE_OPTIONS = ['Brutally Honest', 'Constructive', 'Encouraging']

const modeCards = [
  {
    id: 'polish',
    icon: '✍️',
    title: 'Polish My Draft',
    desc: 'Rough draft or half-finished content — Remy rewrites it clean',
  },
  {
    id: 'organize',
    icon: '🗂️',
    title: 'Organize My Notes',
    desc: 'Scattered notes or brain dump — Remy turns it into structured content',
  },
  {
    id: 'feedback',
    icon: '🔍',
    title: 'Give Me Feedback',
    desc: 'Finished writing — Remy reads it and gives honest critique',
  },
]

// Paste / Upload toggle used in Polish and Feedback modes
function InputMethodToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {['paste', 'upload'].map(method => (
        <button
          key={method}
          type="button"
          onClick={() => onChange(method)}
          style={{
            padding: '6px 16px',
            borderRadius: 20,
            border: value === method ? '1.5px solid #2563eb' : '1.5px solid rgba(0,0,0,0.12)',
            background: value === method ? '#eff6ff' : '#fff',
            color: value === method ? '#1d4ed8' : '#71717a',
            fontSize: 13,
            fontWeight: value === method ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 120ms',
          }}
        >
          {method === 'paste' ? '📋 Paste text' : '📄 Upload file'}
        </button>
      ))}
    </div>
  )
}

export default function RemyEditForm({ worker, slug, userPlan, planLoading, heavyCreditsRemaining, activeWorkspaceId, onTaskCreated }) {
  const router = useRouter()
  const [mode, setMode] = useState(null)

  // Polish My Draft fields
  const [polishMethod, setPolishMethod] = useState('paste')
  const [draftContent, setDraftContent] = useState('')
  const [draftUploadedContent, setDraftUploadedContent] = useState(null)
  const [draftUploadedFileName, setDraftUploadedFileName] = useState(null)
  const [outputFormat, setOutputFormat] = useState('General')
  const [tone, setTone] = useState('Friendly')

  // Organize My Notes fields (paste-only)
  const [notesContent, setNotesContent] = useState('')
  const [notesOutputFormat, setNotesOutputFormat] = useState('General')
  const [notesTone, setNotesTone] = useState('Friendly')
  const [notesGoal, setNotesGoal] = useState('')

  // Give Me Feedback fields
  const [feedbackMethod, setFeedbackMethod] = useState('paste')
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackUploadedContent, setFeedbackUploadedContent] = useState(null)
  const [feedbackUploadedFileName, setFeedbackUploadedFileName] = useState(null)
  const [feedbackType, setFeedbackType] = useState('All of the Above')
  const [feedbackStyle, setFeedbackStyle] = useState('Brutally Honest')

  const [submitting, setSubmitting] = useState(false)
  const [submitSeconds, setSubmitSeconds] = useState(0)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async () => {
    setError('')
    setFieldErrors({})

    const newErrors: Record<string, string> = {}
    if (!mode) { newErrors.mode = 'Choose a mode first.' }
    if (mode === 'polish') {
      if (polishMethod === 'paste' && !draftContent.trim()) newErrors.draftContent = 'Paste your draft before submitting.'
      if (polishMethod === 'upload' && !draftUploadedContent) newErrors.draftUploaded = 'Upload your file before submitting.'
    }
    if (mode === 'organize' && !notesContent.trim()) {
      newErrors.notesContent = 'Paste your notes before submitting.'
    }
    if (mode === 'feedback') {
      if (feedbackMethod === 'paste' && !feedbackContent.trim()) newErrors.feedbackContent = 'Paste your writing before submitting.'
      if (feedbackMethod === 'upload' && !feedbackUploadedContent) newErrors.feedbackUploaded = 'Upload your file before submitting.'
    }

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

      let inputObj = { mode }
      if (mode === 'polish') {
        const content = polishMethod === 'upload' ? draftUploadedContent : draftContent.trim()
        inputObj = { mode, draft_content: content, output_format: outputFormat, tone }
      } else if (mode === 'organize') {
        inputObj = { mode, notes_content: notesContent.trim(), output_format: notesOutputFormat, tone: notesTone, goal: notesGoal.trim() }
      } else if (mode === 'feedback') {
        const content = feedbackMethod === 'upload' ? feedbackUploadedContent : feedbackContent.trim()
        inputObj = { mode, feedback_content: content, feedback_type: feedbackType, feedback_style: feedbackStyle }
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
    <div className="p-4 sm:p-6">
      {/* Mode selector */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', marginBottom: 12 }}>
          What do you need help with?
        </p>
        <div className='grid! grid-cols-1! sm:grid-cols-2! md:grid-cols-3! gap-2.5'>
          {modeCards.map(card => {
            const selected = mode === card.id
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => { setMode(card.id); setError(''); setFieldErrors({}) }}
                style={{
                  border: selected ? '2px solid #2563eb' : '1.5px solid rgba(0,0,0,0.1)',
                  borderRadius: 12,
                  padding: '16px 14px',
                  background: selected ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: selected ? '#1d4ed8' : '#111113', marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5 }}>{card.desc}</div>
              </button>
            )
          })}
        </div>
        {fieldErrors.mode && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{fieldErrors.mode}</p>}
      </div>

      {/* Polish My Draft */}
      {mode === 'polish' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Your Draft <span style={{ color: '#ef4444' }}>*</span></label>
            <InputMethodToggle value={polishMethod} onChange={v => { setPolishMethod(v); setDraftUploadedContent(null); setDraftUploadedFileName(null); setDraftContent(''); setFieldErrors({}) }} />
            {polishMethod === 'paste' ? (
              <>
                <textarea
                  rows={12}
                  placeholder="Paste your rough draft, half-written content, or anything that needs rewriting. Remy will rewrite it clean while keeping your voice and ideas intact."
                  value={draftContent}
                  maxLength={MAX_CHARS}
                  onChange={e => {
                    setDraftContent(e.target.value)
                    setFieldErrors(prev => { if (!prev.draftContent) return prev; const next = { ...prev }; delete next.draftContent; return next })
                  }}
                  style={textareaStyle}
                />
                {fieldErrors.draftContent && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.draftContent}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>{draftContent.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <>
                <FileUpload
                  type="document"
                  label="Draft File"
                  acceptedTypesLabel="PDF, DOCX, TXT"
                  required={true}
                  fieldName="draft_file"
                  onUploadComplete={(content, fileName) => {
                    setDraftUploadedContent(content)
                    setDraftUploadedFileName(fileName)
                    setFieldErrors(prev => { if (!prev.draftUploaded) return prev; const next = { ...prev }; delete next.draftUploaded; return next })
                  }}
                  onUploadError={(err) => setError(`Upload failed: ${err}`)}
                  onClear={() => { setDraftUploadedContent(null); setDraftUploadedFileName(null) }}
                />
                {fieldErrors.draftUploaded && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.draftUploaded}</p>}
              </>
            )}
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label style={labelStyle}>Output Format</label>
              <Select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}>
                {OUTPUT_FORMAT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <label style={labelStyle}>Tone</label>
              <Select value={tone} onChange={e => setTone(e.target.value)}>
                {TONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Organize My Notes — paste only */}
      {mode === 'organize' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Your Notes <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              rows={12}
              placeholder="Dump everything here — bullet points, random thoughts, voice memo transcripts, fragments. Remy will organize them into structured, usable content."
              value={notesContent}
              maxLength={MAX_CHARS}
              onChange={e => {
                setNotesContent(e.target.value)
                setFieldErrors(prev => { if (!prev.notesContent) return prev; const next = { ...prev }; delete next.notesContent; return next })
              }}
              style={textareaStyle}
            />
            {fieldErrors.notesContent && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.notesContent}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>{notesContent.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Output Format</label>
              <Select value={notesOutputFormat} onChange={e => setNotesOutputFormat(e.target.value)}>
                {OUTPUT_FORMAT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <label style={labelStyle}>Tone</label>
              <Select value={notesTone} onChange={e => setNotesTone(e.target.value)}>
                {TONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label style={{ ...labelStyle, ...optionalLabelStyle }}>What should the final piece accomplish?</label>
            <input
              type="text"
              placeholder="e.g. convince people to sign up for my course, explain how our product works, introduce my brand story"
              value={notesGoal}
              onChange={e => setNotesGoal(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* Give Me Feedback */}
      {mode === 'feedback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Your Writing <span style={{ color: '#ef4444' }}>*</span></label>
            <InputMethodToggle value={feedbackMethod} onChange={v => { setFeedbackMethod(v); setFeedbackUploadedContent(null); setFeedbackUploadedFileName(null); setFeedbackContent(''); setFieldErrors({}) }} />
            {feedbackMethod === 'paste' ? (
              <>
                <textarea
                  rows={12}
                  placeholder="Paste your writing here. Remy will tell you what's working, what's not, and what to change — without rewriting it for you unless you ask."
                  value={feedbackContent}
                  maxLength={MAX_CHARS}
                  onChange={e => {
                    setFeedbackContent(e.target.value)
                    setFieldErrors(prev => { if (!prev.feedbackContent) return prev; const next = { ...prev }; delete next.feedbackContent; return next })
                  }}
                  style={textareaStyle}
                />
                {fieldErrors.feedbackContent && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.feedbackContent}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>{feedbackContent.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <>
                <FileUpload
                  type="document"
                  label="Writing File"
                  acceptedTypesLabel="PDF, DOCX, TXT"
                  required={true}
                  fieldName="feedback_file"
                  onUploadComplete={(content, fileName) => {
                    setFeedbackUploadedContent(content)
                    setFeedbackUploadedFileName(fileName)
                    setFieldErrors(prev => { if (!prev.feedbackUploaded) return prev; const next = { ...prev }; delete next.feedbackUploaded; return next })
                  }}
                  onUploadError={(err) => setError(`Upload failed: ${err}`)}
                  onClear={() => { setFeedbackUploadedContent(null); setFeedbackUploadedFileName(null) }}
                />
                {fieldErrors.feedbackUploaded && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.feedbackUploaded}</p>}
              </>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>What kind of feedback?</label>
              <Select value={feedbackType} onChange={e => setFeedbackType(e.target.value)}>
                {FEEDBACK_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <label style={labelStyle}>Delivery style</label>
              <Select value={feedbackStyle} onChange={e => setFeedbackStyle(e.target.value)}>
                {FEEDBACK_STYLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      {mode && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 20 }}>
          {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>}
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='font-semibold text-[#111113] max-w-60 text-[13px] '>Included on all plans · Downloads as PDF + DOCX</p>
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
                  Remy is on it…
                </>
              ) : mode === 'feedback' ? 'Get Feedback →' : mode === 'organize' ? 'Organize My Notes →' : 'Polish My Draft →'}
            </button>
          </div>
          {submitting && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#a1a1aa' }}>Remy is reading your work…</p>
              {submitSeconds >= 5 && (
                <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>This usually takes 20–40 seconds</p>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const textareaStyle = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.15)',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#111113',
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
  lineHeight: 1.6,
}

const inputStyle = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.15)',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#111113',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 13,
  fontWeight: 500,
  color: '#111113',
  display: 'block',
  marginBottom: 6,
}

const optionalLabelStyle = {
  color: '#71717a',
}
