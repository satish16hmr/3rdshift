// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { getStoredWorkspaceId } from '@/lib/workspace-client'
import { Button } from '../ui/button'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/toast-provider'
import { Loader } from '@/components/loader'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog'
import { Select } from '@/components/select'

// Icons
function GoogleDriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
      <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5A9 9 0 000 53h27.5z" fill="#00AC47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25A9 9 0 0087.3 53H59.8l5.85 11.2z" fill="#EA4335" />
      <path d="M43.65 25L57.4 1.2A9.07 9.07 0 0053 0H34.3c-1.6 0-3.15.45-4.4 1.2z" fill="#00832D" />
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.4 1.2h50.3c1.6 0 3.1-.45 4.4-1.2z" fill="#2684FC" />
      <path d="M73.4 26.5l-12.65-21.8A9 9 0 0057.4 1.2L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00" />
    </svg>
  )
}

function NotionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#000" />
      <path d="M6 5.5h8l4 4V19a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z" fill="white" stroke="white" strokeWidth="0.5" />
      <path d="M14 5.5v4h4" stroke="black" strokeWidth="1" />
    </svg>
  )
}

function MailchimpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#FFE01B" />
      <path d="M12 4c-4.4 0-8 3.1-8 7 0 2.2 1.1 4.1 2.9 5.4-.1.4-.2.9-.2 1.3 0 1.3.7 2.3 1.8 2.3.6 0 1.2-.3 1.7-.8.6.2 1.2.3 1.8.3 4.4 0 8-3.1 8-7S16.4 4 12 4z" fill="#241C15" />
    </svg>
  )
}

function WordPressIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#21759B" />
      <path d="M2 12a10 10 0 1020 0A10 10 0 002 12zm16.9 0l-3.2 9.3A8.5 8.5 0 0012 20.5a8.5 8.5 0 01-6.3-14.1l2.7 7.4 2-6-1.3-1.4A8.5 8.5 0 0112 3.5c1.9 0 3.7.6 5.1 1.7l-.4.1c-.9 0-1.6.8-1.6 1.7 0 .8.5 1.4.9 2 .3.5.7 1.2.7 2.2 0 .7-.3 1.5-.6 2.6l-.8 2.7-2.8-8.4c.5 0 .9-.1.9-.1.4 0 .4-.6 0-.6-1.3.1-2.1.1-2.1.1s-.8 0-2.1-.1c-.4 0-.4.6 0 .6l.9.1 1.3 3.6-1.8 5.5-3-8.9c.5 0 .9-.1.9-.1.4 0 .4-.6 0-.6-1.3.1-2.1.1-2.1.1l-.5-.01A8.5 8.5 0 0118.9 12z" fill="white" />
    </svg>
  )
}

function BufferIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#2C4BFF" />
      <path d="M12.145 7.077a.402.402 0 00-.29 0L5.6 9.7a.307.307 0 000 .57l6.255 2.625a.402.402 0 00.29 0L18.4 10.27a.307.307 0 000-.57l-6.255-2.623zm0 5.486a.402.402 0 00-.29 0L5.6 15.186a.307.307 0 000 .57l6.255 2.625a.402.402 0 00.29 0l6.255-2.625a.307.307 0 000-.57l-6.255-2.623z" fill="white" />
    </svg>
  )
}

function LinkedInIcon() {
  return <span style={{ width: 14, height: 14, borderRadius: 3, background: '#0A66C2', color: 'white', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>in</span>
}

function FacebookIcon() {
  return <span style={{ width: 14, height: 14, borderRadius: 7, background: '#1877F2', color: 'white', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>f</span>
}

function InstagramIcon() {
  return <span style={{ width: 14, height: 14, borderRadius: 4, background: '#E4405F', color: 'white', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>◎</span>
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SendToDropdown({ taskId, title, workerSlug, iconOnly = false, className = '', cls = '' }: { taskId: string; title?: string; workerSlug?: string; iconOnly?: boolean; className?: string, cls?: string }) {
  const router = useRouter()
  const { showToast } = useToast() || {}
  const { loading: planLoading } = useWorkspacePlan()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [integrations, setIntegrations] = useState({
    google: false,
    notion: false,
    mailchimp: false,
    wordpress: false,
    buffer: false,
    linkedin: false,
    facebook: false,
    instagram: false,
  })
  const [sending, setSending] = useState({})
  const [socialProfiles, setSocialProfiles] = useState({})
  const [bufferChannels, setBufferChannels] = useState([])
  const [showBufferModal, setShowBufferModal] = useState(false)
  const [showLinkedInModal, setShowLinkedInModal] = useState(false)
  const [showFacebookModal, setShowFacebookModal] = useState(false)
  const [linkedInPreview, setLinkedInPreview] = useState(null)
  const [linkedInText, setLinkedInText] = useState('')
  const [facebookPreview, setFacebookPreview] = useState(null)
  const [facebookText, setFacebookText] = useState('')
  const [selectedChannels, setSelectedChannels] = useState([])
  const [scheduleType, setScheduleType] = useState('queue')
  const dropRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastPos = useRef('')
  const [menuPos, setMenuPos] = useState({ top: '0px', left: '0px' })
  const [posReady, setPosReady] = useState(false)

  useEffect(() => {
    if (!open) {
      cancelAnimationFrame(rafRef.current!)
      setPosReady(false)
      lastPos.current = ''
      return
    }
    setPosReady(false)
    const loop = () => {
      if (!dropRef.current) return
      const { bottom, top: bt, left, right } = dropRef.current.getBoundingClientRect()
      const [W, H, mW, mH] = [window.innerWidth, window.innerHeight, 200, 320]
      const l = left + mW <= W - 10 ? left : right - mW >= 10 ? right - mW : Math.max(10, (W - mW) / 2)
      const t = bottom + mH > H && bt - mH >= 10 ? bt - mH - 8 : bottom + 8
      const key = `${l},${t}`
      if (lastPos.current !== key) { lastPos.current = key; setMenuPos({ top: `${t}px`, left: `${l}px` }) }
      setPosReady(true)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current!)
  }, [open])

  // Close on outside click or scroll
  useEffect(() => {
    const close = () => setOpen(false)
    const outside = (e) => {
      if (dropRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', close, { capture: true })
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', close, { capture: true })
    }
  }, [])


  // Load session + check which integrations are connected
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setSession(session)
      const wsId = getStoredWorkspaceId()
      const headers = { Authorization: `Bearer ${session.access_token}` }
      if (wsId) headers['x-workspace-id'] = wsId

      // Check all integrations in parallel
      const [googleRes, notionRes, mailchimpRes, wordpressRes, bufferRes, socialRes] = await Promise.allSettled([
        fetch('/api/save-to-google', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/notion/status', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/mailchimp/status', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/wordpress/status', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/buffer/status', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/integrations/social/status', { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      const bufferData = bufferRes.status === 'fulfilled' ? bufferRes.value : null
      const socialData = socialRes.status === 'fulfilled' ? socialRes.value : null
      if (bufferData?.channels) setBufferChannels(bufferData.channels)
      if (socialData) setSocialProfiles(socialData)

      setIntegrations({
        google: googleRes.status === 'fulfilled' && googleRes.value?.connected,
        notion: notionRes.status === 'fulfilled' && notionRes.value?.connected,
        mailchimp: mailchimpRes.status === 'fulfilled' && mailchimpRes.value?.connected,
        wordpress: wordpressRes.status === 'fulfilled' && wordpressRes.value?.connected,
        buffer: bufferData?.connected || false,
        linkedin: socialData?.linkedin?.connected || false,
        facebook: socialData?.facebook?.connected || false,
        instagram: socialData?.instagram?.connected || false,
      })
    })
  }, [])

  if (planLoading) return null

  const setSendingKey = (key, val) => setSending(p => ({ ...p, [key]: val }))

  const getHeaders = (json = false) => {
    const wsId = getStoredWorkspaceId()
    const h = { Authorization: `Bearer ${session.access_token}` }
    if (wsId) h['x-workspace-id'] = wsId
    if (json) h['Content-Type'] = 'application/json'
    return h
  }

  const handleGoogle = async () => {
    if (!integrations.google) { router.push('/dashboard/settings/integration'); return }
    setSendingKey('google', true)
    try {
      const res = await fetch('/api/save-to-google', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, title }),
      })
      setOpen(false)
      if (res.ok) {
        showToast?.({ title: 'Saved to Google Drive!', variant: 'success' })
      } else {
        const d = await res.json().catch(() => ({}))
        showToast?.({ title: d.error || 'Failed to save to Google Drive', variant: 'error' })
      }
    } catch {
      setOpen(false)
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('google', false)
    }
  }

  const handleNotion = async () => {
    if (!integrations.notion) { router.push('/dashboard/settings/integration'); return }
    setSendingKey('notion', true)
    try {
      const res = await fetch('/api/notion/save', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, title }),
      })
      setOpen(false)
      if (res.ok) {
        showToast?.({ title: 'Sent to Notion!', variant: 'success' })
      } else {
        const d = await res.json().catch(() => ({}))
        showToast?.({ title: d.error || 'Failed to send to Notion', variant: 'error' })
      }
    } catch {
      setOpen(false)
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('notion', false)
    }
  }

  const handleMailchimp = async () => {
    if (!integrations.mailchimp) { router.push('/dashboard/settings/integration'); return }
    setSendingKey('mailchimp', true)
    try {
      const res = await fetch('/api/mailchimp/send', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, title }),
      })
      setOpen(false)
      if (res.ok) {
        showToast?.({ title: 'Sent to Mailchimp!', variant: 'success' })
      } else {
        const d = await res.json().catch(() => ({}))
        showToast?.({ title: d.error || 'Failed to send to Mailchimp', variant: 'error' })
      }
    } catch {
      setOpen(false)
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('mailchimp', false)
    }
  }

  const handleWordPress = async () => {
    if (!integrations.wordpress) { router.push('/dashboard/settings/integration'); return }
    setSendingKey('wordpress', true)
    try {
      const res = await fetch('/api/wordpress/send', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, title }),
      })
      setOpen(false)
      if (res.ok) {
        showToast?.({ title: 'Sent to WordPress!', variant: 'success' })
      } else {
        const d = await res.json().catch(() => ({}))
        showToast?.({ title: d.error || 'Failed to send to WordPress', variant: 'error' })
      }
    } catch {
      setOpen(false)
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('wordpress', false)
    }
  }

  const handleBufferClick = () => {
    if (!integrations.buffer) { router.push('/dashboard/settings/integration'); return }
    setShowBufferModal(true)
    setOpen(false)
  }

  const handleBufferSend = async () => {
    if (selectedChannels.length === 0) return
    setSendingKey('buffer', true)
    try {
      const res = await fetch('/api/buffer/send', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, channel_ids: selectedChannels, schedule_type: scheduleType }),
      })
      if (res.ok) {
        setShowBufferModal(false)
        showToast?.({ title: 'Sent to Buffer!', variant: 'success' })
      } else {
        const d = await res.json().catch(() => ({}))
        showToast?.({ title: d.error || 'Failed to send to Buffer', variant: 'error' })
      }
    } catch {
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('buffer', false)
    }
  }

  const handleLinkedInClick = async () => {
    if (!integrations.linkedin) { router.push('/dashboard/settings/integration'); return }
    setSendingKey('linkedin', true)
    try {
      const res = await fetch('/api/integrations/linkedin/publish', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, preview: true }),
      })
      const data = await res.json().catch(() => ({}))
      setOpen(false)
      if (!res.ok) {
        showToast?.({ title: data.error || 'Could not prepare LinkedIn preview', variant: 'error' })
        return
      }
      setLinkedInPreview(data.preview)
      setLinkedInText(data.preview?.text || '')
      setShowLinkedInModal(true)
    } catch {
      setOpen(false)
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('linkedin', false)
    }
  }

  const handleLinkedInPost = async () => {
    if (!linkedInText.trim()) return
    setSendingKey('linkedin', true)
    try {
      const res = await fetch('/api/integrations/linkedin/publish', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, text: linkedInText, confirm: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowLinkedInModal(false)
        setLinkedInPreview(null)
        showToast?.({ title: 'Posted to LinkedIn!', variant: 'success' })
      } else {
        showToast?.({ title: data.error || 'Failed to send to LinkedIn', variant: 'error' })
      }
    } catch {
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('linkedin', false)
    }
  }

  const handleFacebookClick = async () => {
    if (!integrations.facebook) { router.push('/dashboard/settings/integration'); return }
    setSendingKey('facebook', true)
    try {
      const res = await fetch('/api/integrations/facebook/publish', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, preview: true }),
      })
      const data = await res.json().catch(() => ({}))
      setOpen(false)
      if (!res.ok) {
        showToast?.({ title: data.error || 'Could not prepare Facebook preview', variant: 'error' })
        return
      }
      setFacebookPreview(data.preview)
      setFacebookText(data.preview?.text || '')
      setShowFacebookModal(true)
    } catch {
      setOpen(false)
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('facebook', false)
    }
  }

  const handleFacebookPost = async () => {
    if (!facebookText.trim()) return
    setSendingKey('facebook', true)
    try {
      const res = await fetch('/api/integrations/facebook/publish', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId, text: facebookText, confirm: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowFacebookModal(false)
        setFacebookPreview(null)
        showToast?.({ title: 'Posted to Facebook!', variant: 'success' })
      } else {
        showToast?.({ title: data.error || 'Failed to send to Facebook', variant: 'error' })
      }
    } catch {
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey('facebook', false)
    }
  }

  const handleSocial = (provider, label) => async () => {
    if (!integrations[provider]) { router.push('/dashboard/settings/integration'); return }
    setSendingKey(provider, true)
    try {
      const res = await fetch(`/api/integrations/${provider}/publish`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ taskId }),
      })
      setOpen(false)
      if (res.ok) {
        showToast?.({ title: `Sent to ${label}!`, variant: 'success' })
      } else {
        const d = await res.json().catch(() => ({}))
        showToast?.({ title: d.error || `Failed to send to ${label}`, variant: 'error' })
      }
    } catch {
      setOpen(false)
      showToast?.({ title: 'Something went wrong', variant: 'error' })
    } finally {
      setSendingKey(provider, false)
    }
  }

  const items = [
    { key: 'google', label: 'Google Drive', icon: <GoogleDriveIcon />, action: handleGoogle },
    { key: 'linkedin', label: 'LinkedIn', icon: <LinkedInIcon />, action: handleLinkedInClick },
    { key: 'facebook', label: 'Facebook', icon: <FacebookIcon />, action: handleFacebookClick },
    { key: 'instagram', label: 'Instagram', icon: <InstagramIcon />, action: handleSocial('instagram', 'Instagram') },
    { key: 'notion', label: 'Notion', icon: <NotionIcon />, action: handleNotion },
    { key: 'mailchimp', label: 'Mailchimp', icon: <MailchimpIcon />, action: handleMailchimp },
    { key: 'wordpress', label: 'WordPress', icon: <WordPressIcon />, action: handleWordPress },
    { key: 'buffer', label: 'Buffer', icon: <BufferIcon />, action: handleBufferClick },
  ]

  return (
    <>
      <div ref={dropRef} className={`w-full xl:w-auto ${cls}`} style={{ position: 'relative', display: 'inline-block' }}>
        <Button
          variant="primary"
          onClick={() => setOpen(p => !p)}
          className={`${iconOnly && 'p-0! size-8!'} w-full xl:w-auto`}
        >
          {
            iconOnly ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
              </>
            ) : (
              <div className='flex items-center gap-1'>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
                Send to…
                <ChevronDown className='h-2!' />
              </div>
            )
          }
        </Button>

        {open && typeof document !== 'undefined' && createPortal(
          <div ref={menuRef} className={`send-to-portal-element max-h-[320px] sm:max-h-none overflow-auto sm:overflow-hidden ${className.replace(/(left|right)-[^\s]+/g, '').replace(/min-\[[^\]]+\]:(left|right)-[^\s]+/g, '')}`} style={{
            position: 'fixed',
            zIndex: 999999,
            background: 'white',
            border: '1px solid #e4e4e7',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '200px',
            padding: '6px',
            ...menuPos,
            visibility: posReady ? 'visible' : 'hidden',
          }}>
            {items.map(({ key, label, icon, action }) => (
              <button
                key={key}
                onClick={action}
                disabled={sending[key]}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#111113',
                  cursor: sending[key] ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                  opacity: sending[key] ? 0.6 : 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f4f4f5' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {sending[key] ? (
                  <Loader size={3.5} className="!size-3.5 flex-shrink-0" />
                ) : (
                  icon
                )}
                <span style={{ flex: 1 }}>
                  {sending[key] ? `Sending…` : label}
                </span>
                {!integrations[key] && !sending[key] && (
                  <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: '400' }}>Connect →</span>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* LinkedIn publish confirmation modal */}
      {showLinkedInModal && (
        <div className="send-to-portal-element" style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', padding: '16px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            maxWidth: '640px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111113', margin: '0 0 4px' }}>
                  Review LinkedIn post
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                  Posting to {linkedInPreview?.accountName || socialProfiles.linkedin?.name || 'LinkedIn'}
                </p>
              </div>
              <LinkedInIcon />
            </div>

            {linkedInPreview?.imageUrl && (
              <div style={{ marginBottom: '14px', overflow: 'hidden', borderRadius: '12px', border: '1px solid #e4e4e7', background: '#fafafa' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={linkedInPreview.imageUrl}
                  alt="LinkedIn post attachment preview"
                  style={{ display: 'block', width: '100%', maxHeight: '260px', objectFit: 'contain' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', margin: 0 }}>Post text</p>
              <p style={{ fontSize: '12px', color: linkedInText.length > 2900 ? '#dc2626' : '#a1a1aa', margin: 0 }}>
                {linkedInText.length.toLocaleString()} / 2,900
              </p>
            </div>
            <textarea
              value={linkedInText}
              onChange={e => setLinkedInText(e.target.value)}
              rows={12}
              style={{
                width: '100%', resize: 'vertical', borderRadius: '12px',
                border: '1px solid #e4e4e7', padding: '12px',
                fontSize: '13px', lineHeight: 1.5, color: '#111113',
                outline: 'none', marginBottom: '10px',
              }}
            />
            {linkedInPreview?.trimmed && (
              <p style={{ fontSize: '12px', color: '#71717a', margin: '0 0 16px' }}>
                Trimmed to fit LinkedIn&apos;s 2,900 character limit. Edit this preview before posting.
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowLinkedInModal(false)
                  setLinkedInPreview(null)
                }}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #e4e4e7', background: 'white', fontSize: '13px', fontWeight: '500', color: '#71717a', cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleLinkedInPost}
                disabled={sending.linkedin || !linkedInText.trim() || linkedInText.length > 2900}
                style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#0A66C2', fontSize: '13px', fontWeight: '600', color: 'white', cursor: sending.linkedin || !linkedInText.trim() || linkedInText.length > 2900 ? 'not-allowed' : 'pointer', opacity: sending.linkedin || !linkedInText.trim() || linkedInText.length > 2900 ? 0.5 : 1 }}
              >
                {sending.linkedin ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Facebook publish confirmation modal */}
      {showFacebookModal && (
        <div className="send-to-portal-element" style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', padding: '16px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            maxWidth: '640px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111113', margin: '0 0 4px' }}>
                  Review Facebook post
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                  Posting to {facebookPreview?.accountName || socialProfiles.facebook?.name || 'Facebook Page'}
                </p>
              </div>
              <FacebookIcon />
            </div>

            {facebookPreview?.imageUrl && (
              <div style={{ marginBottom: '14px', overflow: 'hidden', borderRadius: '12px', border: '1px solid #e4e4e7', background: '#fafafa' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={facebookPreview.imageUrl}
                  alt="Facebook post attachment preview"
                  style={{ display: 'block', width: '100%', maxHeight: '260px', objectFit: 'contain' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', margin: 0 }}>Post text</p>
              <p style={{ fontSize: '12px', color: facebookText.length > 63206 ? '#dc2626' : '#a1a1aa', margin: 0 }}>
                {facebookText.length.toLocaleString()} / 63,206
              </p>
            </div>
            <textarea
              value={facebookText}
              onChange={e => setFacebookText(e.target.value)}
              rows={12}
              style={{
                width: '100%', resize: 'vertical', borderRadius: '12px',
                border: '1px solid #e4e4e7', padding: '12px',
                fontSize: '13px', lineHeight: 1.5, color: '#111113',
                outline: 'none', marginBottom: '10px',
              }}
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowFacebookModal(false)
                  setFacebookPreview(null)
                }}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #e4e4e7', background: 'white', fontSize: '13px', fontWeight: '500', color: '#71717a', cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleFacebookPost}
                disabled={sending.facebook || !facebookText.trim() || facebookText.length > 63206}
                style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#1877F2', fontSize: '13px', fontWeight: '600', color: 'white', cursor: sending.facebook || !facebookText.trim() || facebookText.length > 63206 ? 'not-allowed' : 'pointer', opacity: sending.facebook || !facebookText.trim() || facebookText.length > 63206 ? 0.5 : 1 }}
              >
                {sending.facebook ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buffer channel picker modal */}
      <Dialog open={showBufferModal} onClose={setShowBufferModal} size="sm" className="p-4! sm:p-6! max-w-[90%]! sm:max-w-[360px]!">
        <DialogTitle>Send to Buffer</DialogTitle>
        <DialogBody className="mt-2!">
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', marginBottom: '8px' }}>Select channels</p>
            {bufferChannels.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#a1a1aa' }}>No channels found. Connect a social account in Buffer first.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bufferChannels.map(ch => (
                  <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(ch.id)}
                      onChange={() => setSelectedChannels(p => p.includes(ch.id) ? p.filter(c => c !== ch.id) : [...p, ch.id])}
                    />
                    <span style={{ fontSize: '13px', color: '#111113' }}>
                      {ch.service === 'twitter' ? '𝕏' : ch.service === 'instagram' ? '📷' : ch.service === 'linkedin' ? 'in' : ch.service === 'facebook' ? 'f' : '📱'} {ch.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', marginBottom: '6px' }}>Schedule</p>
            <Select
              value={scheduleType}
              onChange={(e: any) => setScheduleType(e.target.value)}
            >
              <option value="queue">Add to Queue</option>
              <option value="now">Share Now</option>
            </Select>
          </div>
        </DialogBody>

        <DialogActions className="mt-6! flex-row!">
          <button
            onClick={() => setShowBufferModal(false)}
            style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #e4e4e7', background: 'white', fontSize: '13px', fontWeight: '500', color: '#71717a', cursor: 'pointer' }}
          >Cancel</button>
          <button
            onClick={handleBufferSend}
            disabled={selectedChannels.length === 0 || sending.buffer}
            style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: '#2C4BFF', fontSize: '13px', fontWeight: '600', color: 'white', cursor: selectedChannels.length === 0 ? 'not-allowed' : 'pointer', opacity: selectedChannels.length === 0 || sending.buffer ? 0.5 : 1 }}
          >
            {sending.buffer ? 'Sending…' : scheduleType === 'now' ? 'Post Now' : 'Add to Queue'}
          </button>
        </DialogActions>
      </Dialog>
    </>
  )
}