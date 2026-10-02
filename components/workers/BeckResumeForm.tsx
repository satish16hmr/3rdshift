// @ts-nocheck
'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/ui/file-upload'

const MAX_PASTE_CHARS = 5000
const MAX_JD_CHARS = 3000

const TEMPLATE_OPTIONS = [
  { value: 'classic', label: 'Classic', desc: 'Serif font, traditional styling. Most conservative.' },
  { value: 'modern', label: 'Modern', desc: 'Sans-serif, navy accents, extra whitespace.' },
  { value: 'simple', label: 'Simple', desc: 'Minimal, no accents, pure type hierarchy.' },
]

export default function BeckResumeForm({ worker, slug, userPlan, planLoading, heavyCreditsRemaining, activeWorkspaceId, onTaskCreated }) {
  const router = useRouter()
  const [inputMethod, setInputMethod] = useState(null) // 'paste' | 'upload' | 'fresh'
  const [linkedinText, setLinkedinText] = useState('')
  const [uploadedContent, setUploadedContent] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState(null)

  // Contact fields (all modes)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')

  // Fresh / review fields
  const [targetRole, setTargetRole] = useState('')
  const [experience, setExperience] = useState('')
  const [education, setEducation] = useState('')
  const [skills, setSkills] = useState('')
  const [achievements, setAchievements] = useState('')

  // Shared fields
  const [jobDescription, setJobDescription] = useState('')
  const [template, setTemplate] = useState('classic')

  const [submitting, setSubmitting] = useState(false)
  const [submitSeconds, setSubmitSeconds] = useState(0)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async () => {
    setError('')
    setFieldErrors({})

    // Validation
    const newErrors: Record<string, string> = {}
    if (!inputMethod) { newErrors.inputMethod = 'Choose how you want to start first.' }
    if (!fullName.trim()) newErrors.fullName = 'Full name is required.'
    if (!email.trim()) newErrors.email = 'Email is required.'
    if (!phone.trim()) newErrors.phone = 'Phone number is required.'
    if (!location.trim()) newErrors.location = 'Location is required.'
    if (inputMethod === 'paste' && !linkedinText.trim()) newErrors.linkedinText = 'Paste your LinkedIn profile or career history to continue.'
    if (inputMethod === 'upload' && !uploadedContent) newErrors.uploadedResume = 'Upload your resume file to continue.'
    if (inputMethod === 'fresh' && !experience.trim()) newErrors.experience = 'Add your work experience to continue.'

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
        input_method: inputMethod,
        tone: 'Professional',
        template: template,
        job_description: jobDescription.trim() || '',
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        location: location.trim(),
      }

      if (inputMethod === 'paste') {
        inputObj.linkedin_text = linkedinText.trim()
      } else if (inputMethod === 'upload') {
        inputObj.uploaded_resume = uploadedContent
        inputObj.uploaded_resume_filename = uploadedFileName || 'resume'
      } else {
        inputObj.target_role = targetRole.trim()
        inputObj.experience = experience.trim()
        inputObj.education = education.trim()
        inputObj.skills = skills.trim()
        inputObj.achievements = achievements.trim()
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

  const methodCards = [
    {
      id: 'paste',
      icon: '📋',
      title: 'Paste LinkedIn / Bio',
      desc: 'Copy your LinkedIn profile or describe your career history',
    },
    {
      id: 'upload',
      icon: '📄',
      title: 'Upload Resume',
      desc: 'Upload an existing resume — Beck rewrites it better',
    },
    {
      id: 'fresh',
      icon: '✍️',
      title: 'Start Fresh',
      desc: 'Fill in your info manually and Beck builds from scratch',
    },
  ]

  const inputSelected = inputMethod !== null

  return (
    <div className='p-4 sm:p-6'>
      {/* Step 1: Input method */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', marginBottom: 12 }}>
          How do you want to build your resume?
        </p>
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5'>
          {methodCards.map(card => {
            const selected = inputMethod === card.id
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => { setInputMethod(card.id); setError(''); setFieldErrors({}) }}
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
        {fieldErrors.inputMethod && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{fieldErrors.inputMethod}</p>}
      </div>

      {/* Step 2: Contact fields — shown for all modes once method is selected */}
      {inputSelected && (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111113', marginBottom: 12 }}>Your contact info</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Chen"
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value)
                    setFieldErrors(prev => { if (!prev.fullName) return prev; const next = { ...prev }; delete next.fullName; return next })
                  }}
                  style={inputStyle}
                />
                {fieldErrors.fullName && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.fullName}</p>}
              </div>
              <div>
                <label style={labelStyle}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="email"
                  placeholder="e.g. sarah@email.com"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    setFieldErrors(prev => { if (!prev.email) return prev; const next = { ...prev }; delete next.email; return next })
                  }}
                  className='w-full border border-gray-300 rounded-lg px-2 h-[43px] text-sm text-[#111113] outline-none box-border'
                />
                {fieldErrors.email && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.email}</p>}
              </div>
              <div>
                <label style={labelStyle}>Phone <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="tel"
                  placeholder="e.g. (312) 555-0192"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value)
                    setFieldErrors(prev => { if (!prev.phone) return prev; const next = { ...prev }; delete next.phone; return next })
                  }}
                  style={inputStyle}
                />
                {fieldErrors.phone && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.phone}</p>}
              </div>
              <div>
                <label style={labelStyle}>Location <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Chicago, IL"
                  value={location}
                  onChange={e => {
                    setLocation(e.target.value)
                    setFieldErrors(prev => { if (!prev.location) return prev; const next = { ...prev }; delete next.location; return next })
                  }}
                  style={inputStyle}
                />
                {fieldErrors.location && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.location}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Input content */}
      {inputMethod === 'paste' && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#111113', display: 'block', marginBottom: 6 }}>
            LinkedIn Profile or Career History <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            rows={10}
            placeholder="Go to your LinkedIn profile, select all the text on the page, and paste it here. Or just describe your experience in your own words — Beck will organize it."
            value={linkedinText}
            maxLength={MAX_PASTE_CHARS}
            onChange={e => {
              setLinkedinText(e.target.value)
              setFieldErrors(prev => { if (!prev.linkedinText) return prev; const next = { ...prev }; delete next.linkedinText; return next })
            }}
            style={textareaStyle}
          />
          {fieldErrors.linkedinText && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.linkedinText}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>{linkedinText.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()}</span>
          </div>
        </div>
      )}

      {inputMethod === 'upload' && (
        <div style={{ marginBottom: 24 }}>
          <FileUpload
            type="document"
            label="Resume File"
            acceptedTypesLabel="PDF, DOCX, TXT"
            required={true}
            fieldName="uploaded_resume"
            onUploadComplete={(content, fileName) => {
              setUploadedContent(content)
              setUploadedFileName(fileName)
              setFieldErrors(prev => { if (!prev.uploadedResume) return prev; const next = { ...prev }; delete next.uploadedResume; return next })
            }}
            onUploadError={(err) => setError(`Upload failed: ${err}`)}
            onClear={() => {
              setUploadedContent(null)
              setUploadedFileName(null)
            }}
          />
          {fieldErrors.uploadedResume && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.uploadedResume}</p>}
          <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>
            Beck reads your existing resume, extracts your experience, and rewrites it stronger.
          </p>
        </div>
      )}

      {inputMethod === 'fresh' && (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>Target Role</label>
            <input
              type="text"
              placeholder="e.g. Product Manager at a SaaS startup"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Work Experience <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              rows={8}
              placeholder="List your jobs, titles, dates, and key responsibilities or achievements. Don't worry about formatting — Beck handles that."
              value={experience}
              onChange={e => {
                setExperience(e.target.value)
                setFieldErrors(prev => { if (!prev.experience) return prev; const next = { ...prev }; delete next.experience; return next })
              }}
              style={textareaStyle}
            />
            {fieldErrors.experience && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.experience}</p>}
          </div>
          <div>
            <label style={{ ...labelStyle, ...optionalLabel }}>Education</label>
            <input
              type="text"
              placeholder="Degree, school, graduation year"
              value={education}
              onChange={e => setEducation(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, ...optionalLabel }}>Key Skills</label>
            <input
              type="text"
              placeholder="e.g. Python, Figma, SQL, project management"
              value={skills}
              onChange={e => setSkills(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, ...optionalLabel }}>Key Achievements</label>
            <textarea
              rows={3}
              placeholder="Any standout results, awards, or metrics"
              value={achievements}
              onChange={e => setAchievements(e.target.value)}
              style={textareaStyle}
            />
          </div>
        </div>
      )}

      {/* Step 4: Job description + template (shown once method selected) */}
      {inputSelected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 24 }}>
            <label style={{ ...labelStyle, ...optionalLabel }}>
              Target Job Description
              <span style={{ fontSize: 11, fontWeight: 400, color: '#2563eb', marginLeft: 8, background: '#eff6ff', padding: '2px 8px', borderRadius: 20 }}>
                Unlocks job-tailored resume
              </span>
            </label>
            <textarea
              rows={5}
              placeholder="Paste the job description or listing here. Beck will tailor your resume to match this role's keywords, skills, and requirements — and rearrange your experience to lead with what matters most."
              value={jobDescription}
              maxLength={MAX_JD_CHARS}
              onChange={e => setJobDescription(e.target.value)}
              style={textareaStyle}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>{jobDescription.length.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Resume Template</label>
            <div className='grid grid-cols-2 min-[500px]:grid-cols-3 gap-2.5'>
              {TEMPLATE_OPTIONS.map(opt => {
                const selected = template === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTemplate(opt.value)}
                    style={{
                      flex: 1,
                      border: selected ? '2px solid #2563eb' : '1.5px solid rgba(0,0,0,0.1)',
                      borderRadius: 10,
                      padding: '12px 10px',
                      background: selected ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all 150ms',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: selected ? '#1d4ed8' : '#111113', marginBottom: 3 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      {inputSelected && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 20 }}>
          {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#71717a' }}>
              <span style={{ fontWeight: 600, color: '#111113' }}>Included on all plans · Downloads as PDF + DOCX</span>
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
                  Building resume…
                </>
              ) : 'Build My Resume →'}
            </button>
          </div>

          {submitting && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#a1a1aa' }}>Beck is on it…</p>
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

// Shared inline styles
const textareaStyle = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.15)',
  padding: '10px 12px',
  fontSize: 14,
  color: '#111113',
  fontFamily: 'inherit',
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
  color: '#111113',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.15)',
  padding: '10px 12px',
  fontSize: 14,
  color: '#111113',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 13,
  fontWeight: 500,
  color: '#111113',
  display: 'block',
  marginBottom: 6,
}

const optionalLabel = {
  // applied alongside labelStyle to show (optional)
}
