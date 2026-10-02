// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { getStoredWorkspaceId } from '@/lib/workspace-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MemoryPanel from './MemoryPanel'
import { Button } from '../ui/button'
import { Paperclip, Pin, Send, X } from 'lucide-react'
import { Textarea } from '../textarea'
import Image from 'next/image'
import { getWorkerAvatarSrcBySlug } from '@/lib/worker-avatars'


// ---------------------------------------------------------------------------
// Inline markdown — bold, italic, code
// ---------------------------------------------------------------------------
function InlineMarkdown({ text, isUser }) {
  if (!text) return null
  // Strip internal metadata from visible message (storage paths, field tags)
  const cleanText = text
    .replace(/\[Image attached: \[STORAGE_PATH:[^\]]+\](\s*\[FIELD:[^\]]+\])?\]/g, '📎 Image attached')
    .replace(/\[STORAGE_PATH:[^\]]+\]/g, '')
    .replace(/\[FIELD:[^\]]+\]/g, '')
    .trim()
  const parts = cleanText.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={i}>{part.slice(1, -1)}</em>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className={`rounded px-1 py-0.5 text-xs font-mono ${isUser ? 'bg-blue-500' : 'bg-zinc-100'}`}>{part.slice(1, -1)}</code>
        return part.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>{line}{j < arr.length - 1 ? <br /> : null}</span>
        ))
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// LennyRunButton — runs task same way as form Submit button
// Same 3-step flow: insert task → execute-task → navigate to result page
// ---------------------------------------------------------------------------
function LennyRunButton({ msg, session }) {
  const router = useRouter()
  const [state, setState] = useState('idle') // idle | loading | done | no_credits | error
  const [taskId, setTaskId] = useState(null)
  const [teamUpdateId, setTeamUpdateId] = useState(msg?._isVirtual ? msg.id : null)
  const [credits, setCredits] = useState(null)
  const [isStale, setIsStale] = useState(false)
  const [parsedIcp, setParsedIcp] = useState(null)

  useEffect(() => {
    if (msg?._isVirtual || !session || !msg?.id) return
    const supabase = createClient()
    // Find the team_updates row for this chat message to get parsed_icp
    supabase
      .from('team_updates')
      .select('id, source_data, created_at')
      .eq('chat_message_id', msg.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTeamUpdateId(data.id)
          const age = Date.now() - new Date(data.created_at).getTime()
          setIsStale(age > 7 * 24 * 60 * 60 * 1000)
          const icp = data.source_data?.parsed_icp
          if (icp) setParsedIcp(icp)
        }
      })
    // Check available credits (monthly plan bucket + active top-ups)
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!currentSession) return
      fetch('/api/workspace', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      })
        .then((r) => r.json())
        .then((d) => setCredits(d.ownerCredits?.available_credits_remaining ?? d.ownerCredits?.heavy_credits_remaining ?? 0))
        .catch(() => setCredits(null))
    })
  }, [msg?.id, session])

  const handleRun = async () => {
    if (!parsedIcp && !msg?._isVirtual) return
    if (!session) return
    setState('loading')

    try {
      const supabase = createClient()
      const { data: { session: freshSession } } = await supabase.auth.getSession()
      const activeSession = freshSession || session

      // Build input from parsed_icp — same fields Lenny's form uses
      const inputObj = {
        target_industry: parsedIcp?.industry || '',
        job_titles: parsedIcp?.job_titles || '',
        location: parsedIcp?.location || 'United States',
        company_size: parsedIcp?.company_size || '',
        exclude_companies: '',
      }

      // Step 1: Create task through the server-side task creation API so plan,
      // billing-access, resolution, mode, light-limit, and ledger gates all run.
      const createRes = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeSession.access_token}` },
        body: JSON.stringify({
          worker_slug: 'lead-generator',
          workspace_id: getStoredWorkspaceId(),
          input: inputObj,
        }),
      })
      const taskData = await createRes.json().catch(() => null)

      if (!createRes.ok || !(taskData?.taskId || taskData?.task_id)) {
        setState('error')
        return
      }

      setTaskId((taskData.taskId || taskData.task_id))

      // Step 2: Execute — same fetch call as form handleSubmit
      const res = await fetch('/api/execute-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeSession.access_token}` },
        body: JSON.stringify({ taskId: (taskData.taskId || taskData.task_id) }),
      })

      // Step 3: Navigate to result — same URL as form handleSubmit
      setState('done')
      // Brief delay so customer sees "done" state before navigating
      setTimeout(() => {
        router.push(`/dashboard/tasks/result?taskId=${(taskData.taskId || taskData.task_id)}`)
      }, 800)
    } catch {
      setState('error')
    }
  }

  // Check credits from state or assume ok if not loaded yet
  const creditsOk = credits === null || credits >= 5

  if (!creditsOk) {
    return (
      <a href="/dashboard/settings/billing"
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 transition-colors">
        🔒 Upgrade to run this search →
      </a>
    )
  }

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
        ✅ Running — taking you to results…
      </span>
    )
  }

  if (state === 'loading') {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600">
        <span className="size-3 animate-spin rounded-full border border-blue-300 border-t-blue-600" />
        Running search…
      </span>
    )
  }

  if (state === 'error') {
    return (
      <span className="text-xs text-red-500 font-medium">
        Search failed — try again or use the Form tab.
      </span>
    )
  }

  // Idle — show the button
  const notReady = !parsedIcp && !msg?._isVirtual
  return (
    <div className="space-y-1">
      {isStale && (
        <p className="text-[10px] text-zinc-400">Lead data is a week old — running a fresh search</p>
      )}
      <button
        onClick={handleRun}
        disabled={notReady}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
      >
        🗒️ Run Lenny — get the full lead list → (5 credits)
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeliverableCard — appears inline in chat stream
// ---------------------------------------------------------------------------
const IMAGE_WORKERS = new Set(['thumbnail-designer', 'logo-concept-generator', 'social-media-graphics-designer'])
const NON_HUMANIZABLE_SLUGS = new Set([
  'thumbnail-designer', 'logo-concept-generator', 'social-media-graphics-designer',
  'lead-generator', 'data-cleaner', 'bookkeeping-summarizer', 'spreadsheet-builder',
  'presentation-builder', 'caption-subtitle-creator', 'video-clip-creator', 'data-analyst',
  'kpi-dashboard-writer', // Brody — structured framework, not prose
  // Formal-document workers — humanizing degrades quality/professionalism
  'resume-writer', 'cover-letter-writer', 'proposal-writer', 'legal-document-drafter',
  'standard-operating-procedure-writer', 'whitepaper-writer',
  'business-plan-writer', 'automation-blueprint-writer',
  // Video + audio structured output workers
  'video-repurposer', 'transcription-specialist', 'meeting-notes-writer',
  // E-commerce copy — platform-specific structure must stay intact
  'product-description-writer',
])

function DeliverableCard({ taskId, onRefine, userPlan, session }) {
  const [task, setTask] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [humanizing, setHumanizing] = useState(false)
  const [humanizedText, setHumanizedText] = useState(null)
  const [viewMode, setViewMode] = useState('original') // 'original' | 'humanized'

  useEffect(() => {
    if (!taskId) return
    const supabase = createClient()
    const load = () => supabase.from('tasks').select('id, worker_slug, status, output, input').eq('id', taskId).single()
      .then(({ data }) => {
        setTask(data)
        if (data?.status === 'pending' || data?.status === 'processing') {
          setTimeout(load, 3000)
        }
      })
    load()
  }, [taskId])

  if (!task) return null

  const isImage = IMAGE_WORKERS.has(task.worker_slug)
  const isProcessing = task.status === 'pending' || task.status === 'processing'
  const isReed = task.worker_slug === 'thumbnail-designer'

  const images = task.output?.images || []
  const imageCount = images.length
  // For non-Reed workers: show full preview + thumbnail strip
  // For Reed: no direct preview (text overlay applied on result page) — show count label
  const previewImages = !isReed && imageCount > 0 ? images : []
  const activeImageUrl = previewImages[selectedIndex]?.url || null

  // Text preview — strip markdown, extract title + body
  const textContent = task.output?.text || task.output?.content || ''
  const stripMarkdown = (str) => str
    .replace(/^#{1,6}\s+/gm, '')   // headings
    .replace(/^[-*]{3,}\s*$/gm, '') // horizontal rules
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // bold/italic
    .replace(/`([^`]+)`/g, '$1')    // inline code
    .replace(/^[-*+]\s+/gm, '')     // list bullets
    .replace(/^\d+\.\s+/gm, '')     // numbered lists
    .trim()
  const getPreviewLines = (str) => {
    if (!str || typeof str !== 'string') return null
    const lines = str.split('\n').map(l => stripMarkdown(l)).filter(l => l.length > 2)
    if (!lines.length) return null
    return { title: lines[0].slice(0, 80) + (lines[0].length > 80 ? '…' : ''), body: lines.slice(1).join(' ').slice(0, 100) + (lines.slice(1).join(' ').length > 100 ? '…' : '') }
  }
  const textPreview = getPreviewLines(textContent)

  if (isProcessing) {
    return (
      <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3.5 max-w-sm">
        <div className="flex items-center gap-2.5">
          <div className="size-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 shrink-0" />
          <p className="text-xs font-medium text-blue-700">Generating your deliverable…</p>
        </div>
      </div>
    )
  }

  if (task.status === 'failed') {
    return (
      <div className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 max-w-sm">
        <p className="text-xs text-red-600">Generation failed. Try again via the form.</p>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden max-w-sm">

      {/* Main image preview — non-Reed image workers */}
      {isImage && activeImageUrl && (
        <img
          src={activeImageUrl}
          alt={`Generated image ${selectedIndex + 1}`}
          className="w-full object-contain"
          style={{ display: 'block', maxHeight: 260, background: '#fafafa' }}
        />
      )}

      {/* Thumbnail strip — only when multiple images exist */}
      {isImage && previewImages.length > 1 && (
        <div className="flex gap-1.5 px-3 pt-2.5 pb-1">
          {previewImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`relative flex-1 overflow-hidden rounded-md border-2 transition-all ${i === selectedIndex
                ? 'border-blue-500 shadow-sm'
                : 'border-zinc-200 opacity-60 hover:opacity-90'
                }`}
              style={{ aspectRatio: '1/1', background: '#f4f4f5' }}
            >
              <img
                src={img.url}
                alt={`Option ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="p-3.5">
        {/* Text preview */}
        {!isImage && textPreview && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-zinc-900 leading-snug">{textPreview.title}</p>
            {textPreview.body && <p className="text-xs text-zinc-500 leading-relaxed mt-0.5 line-clamp-2">{textPreview.body}</p>}
          </div>
        )}

        {/* Reed: show count — only mention text overlay if headline_text was actually set */}
        {isReed && isImage && imageCount > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-sm">🖼️</div>
            <p className="text-xs font-semibold text-zinc-900">
              {imageCount} thumbnail{imageCount !== 1 ? 's' : ''} ready —{' '}
              {task.input?.headline_text
                ? 'click to view with text overlay'
                : 'click to view'}
            </p>
          </div>
        )}

        {!textPreview && !activeImageUrl && !isReed && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-sm">📄</div>
            <p className="text-xs font-semibold text-zinc-900">Deliverable ready</p>
          </div>
        )}

        {/* Original / Humanized toggle — only after humanization */}
        {humanizedText && !isImage && (
          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 mb-2 w-fit">
            <button
              onClick={() => setViewMode('original')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'original' ? 'white' : 'transparent',
                color: viewMode === 'original' ? '#111113' : '#71717a',
                boxShadow: viewMode === 'original' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Original
            </button>
            <button
              onClick={() => setViewMode('humanized')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'humanized' ? 'white' : 'transparent',
                color: viewMode === 'humanized' ? '#111113' : '#71717a',
                boxShadow: viewMode === 'humanized' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              ✨ Humanized
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/tasks/result?taskId=${task.id}`}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
            {isImage && imageCount > 1 ? `View All ${imageCount} → Download` : 'View & Download →'}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------
function ChatMessage({ msg, onRefine, onOpenForm, onConfirmChain, userPlan, session, slug, worker }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    // Chain proposal confirmation button
    if (msg.content?.startsWith('PENDING_CHAIN:')) {
      let proposal = null
      try { proposal = JSON.parse(msg.content.replace('PENDING_CHAIN:', '')) } catch { }
      if (proposal && onConfirmChain) {
        return (
          <div className="flex justify-center py-2">
            <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm max-w-xs text-center">
              <p className="font-semibold text-purple-900 mb-1 text-xs">Chain ready to run</p>
              <p className="text-purple-700 text-xs mb-3">{proposal.members.join(' → ')}</p>
              <button
                onClick={() => onConfirmChain(proposal)}
                className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
              >
                ⚡ Confirm & Run Chain →
              </button>
            </div>
          </div>
        )
      }
    }
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-zinc-400 bg-white border border-zinc-100 rounded-full px-3 py-1 shadow-sm">{msg.content}</span>
      </div>
    )
  }

  const messageDate = new Date(msg.created_at || Date.now())

  const dayName = messageDate.toLocaleDateString('en-US', {
    weekday: 'long',
  })

  const time = messageDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Display the worker's role/title (e.g., "Content-writer") instead of slug
  // For user messages, show "You"
  const displayRole = isUser
    ? 'You'
    : (worker?.personaName || worker?.name || slug)

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Header row with role and time on same line */}
      <div className={`flex items-baseline gap-2 w-full justify-between max-w-[88%]`}>
        <p className="text-xs font-medium text-zinc-600">{displayRole}</p>
        <p className="text-xs text-neutral-500">
          {dayName} {time}
        </p>
      </div>

      {/* Message bubble */}
      <div className={`max-w-[88%] w-full ${isUser ? '' : 'mr-auto'}`}>
        <div className={`px-4 py-2.5 text-sm leading-relaxed ${isUser
          ? 'bg-[#374151] text-white rounded-2xl rounded-tr-none'
          : msg.content?.startsWith('💡')
            ? 'bg-[#FAFAFA] border border-blue-200 text-zinc-900 rounded-2xl rounded-tl-none shadow-sm'
            : msg.content?.startsWith('⭐')
              ? 'bg-amber-50 border border-amber-200 text-zinc-900 rounded-2xl rounded-tl-none shadow-sm'
              : 'bg-[#FAFAFA] border border-zinc-200 text-zinc-900 rounded-2xl rounded-tl-none shadow-sm'
          }`}>
          {msg.content === '[LENNY_RUN_BUTTON]' ? (
            <LennyRunButton msg={{ id: msg._team_update_id, _isVirtual: true }} session={session} />
          ) : (
            <InlineMarkdown text={msg.content?.replace('\n\n[Take action →]', '')} isUser={isUser} />
          )}
          {!isUser && msg.content?.includes('[Take action →]') && (
            <div className="mt-2.5 pt-2 border-t border-blue-100">
              {slug === 'lead-generator' ? (
                <LennyRunButton msg={msg} session={session} />
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                  Reply below to take action ↓
                </span>
              )}
            </div>
          )}
        </div>

        {msg.deliverable_id && (
          <DeliverableCard taskId={msg.deliverable_id} onRefine={onRefine} userPlan={userPlan} session={session} />
        )}

        {/* Shay auto-context: inline grid image preview */}
        {msg._shayGridUrl && (
          <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm max-w-xs">
            <img
              src={msg._shayGridUrl}
              alt="Your logo concepts"
              className="w-full object-contain"
              style={{ display: 'block', background: '#ffffff' }}
            />
            <div className="px-3 py-2 border-t border-zinc-100">
              <p className="text-[10px] text-zinc-400">4 concepts · 2×2 grid</p>
            </div>
          </div>
        )}

        {/* Open Form button — shown when member suggests using the form */}
        {!isUser && onOpenForm && msg.content?.toLowerCase().includes('open form') && (
          <button
            onClick={onOpenForm}
            className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            📋 Open Form →
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DateDivider
// ---------------------------------------------------------------------------
function DateDivider({ date }) {
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const d = new Date(date)
  const label = d.toDateString() === today.toDateString() ? 'Today'
    : d.toDateString() === yesterday.toDateString() ? 'Yesterday'
      : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <>
      {/* <div className="flex items-center gap-3 py-0 mb-5!">
        <div className="flex-1 h-px bg-zinc-100" />
        <span className="text-[11px] font-medium text-zinc-400 whitespace-nowrap">{label}</span>
        <div className="flex-1 h-px bg-zinc-100" />
      </div> */}
    </>
  )
}

// ---------------------------------------------------------------------------
// MonthlyUsageBanner — shows counter at 50%+, warning at 90%+, blocked at 100%
// ---------------------------------------------------------------------------
function MonthlyUsageBanner({ used, limit, resetDate, plan }) {
  if (!limit || used === null || used === undefined) return null
  const pct = Math.round((used / limit) * 100)
  if (pct < 50) return null
  const isHit = used >= limit
  const isWarn = !isHit && pct >= 90
  const resetLabel = resetDate
    ? new Date(resetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : 'your next billing date'
  if (isHit) {
    return (
      <div className="mx-5 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-zinc-900">Monthly chat limit reached ({used.toLocaleString()}/{limit.toLocaleString()})</p>
            <p className="text-xs text-zinc-500 mt-0.5">Resets {resetLabel}. Forms and tasks still work normally.</p>
          </div>
          {plan === 'starter' && (
            <Link href="/dashboard/settings/billing"
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap">
              Upgrade →
            </Link>
          )}
        </div>
      </div>
    )
  }
  if (isWarn) {
    return (
      <div className="mx-5 mb-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2.5">
        <p className="text-xs text-zinc-700">
          Approaching monthly chat limit — <span className="font-semibold">{used.toLocaleString()} / {limit.toLocaleString()}</span> messages. Resets {resetLabel}.
        </p>
      </div>
    )
  }
  // 50–89%: small counter
  return (
    <div className="mx-5 mb-2">
      <p className="text-[11px] text-zinc-400 text-right">{used.toLocaleString()} / {limit.toLocaleString()} messages this month</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
// Chain confirmation keywords
const CONFIRM_WORDS = ['yes', 'go', 'confirm', 'do it', 'kick it off', 'sounds good', 'let\'s go', 'yep', 'yeah', 'ok', 'okay']

export default function TeamMemberChat({ worker, slug, initialTaskId, onOpenForm }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const { plan: wsPlan, loading: wsPlanLoading } = useWorkspacePlan()
  const [userPlan, setUserPlan] = useState(null) // null = loading
  const [session, setSession] = useState(null)
  const [monthlyUsed, setMonthlyUsed] = useState(null)     // messages used this billing period
  const [monthlyLimit, setMonthlyLimit] = useState(null)    // cap for current plan
  const [monthlyResetDate, setMonthlyResetDate] = useState(null) // billing reset date ISO string
  const [monthlyLimitHit, setMonthlyLimitHit] = useState(false)
  const [error, setError] = useState('')
  const [pendingChain, setPendingChain] = useState(null) // chain proposal waiting for confirmation
  const [chainRunning, setChainRunning] = useState(false)
  const generatingDeliverableRef = useRef(false) // debounce double-trigger
  const [attachedImage, setAttachedImage] = useState(null) // { storagePath, fileName, preview }
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const memberName = worker?.personaName || slug
  const memberTitle = worker?.name || slug
  const workerEmoji = worker?.emoji || '🤖'
  const avatarSrc = getWorkerAvatarSrcBySlug(slug)

  // Sync userPlan from workspace hook once loaded
  useEffect(() => {
    if (!wsPlanLoading && wsPlan) setUserPlan(wsPlan)
  }, [wsPlan, wsPlanLoading])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // Always get a fresh session first — never rely on stale state
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return
      if (!s) { setLoading(false); return }
      setSession(s)

      // Plan is handled by useWorkspacePlan hook — set once it's loaded
      // Still need to check starter rate limits from profile
      supabase.from('profiles').select('plan, is_founding_member, founding_tier').eq('id', s.user.id).single()
        .then(({ data }) => {
          if (cancelled) return
          // Load monthly usage for counter/warning display
          const profilePlan = data?.is_founding_member ? (data.founding_tier || 'starter') : (data?.plan || 'starter')
          const PLAN_LIMITS = { starter: 150, pro: 1000, operator: 1500 }
          const planLimit = PLAN_LIMITS[profilePlan] ?? 150
          setMonthlyLimit(planLimit)
          // Load billing reset date
          supabase.from('profiles').select('heavy_credits_reset_at').eq('id', s.user.id).single()
            .then(({ data: pd }) => {
              if (cancelled) return
              const resetAt = pd?.heavy_credits_reset_at ? new Date(pd.heavy_credits_reset_at) : null
              if (resetAt) setMonthlyResetDate(resetAt.toISOString())
              const windowStart = resetAt
                ? new Date(resetAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
              supabase.from('chat_rate_limits')
                .select('msg_count').eq('user_id', s.user.id).eq('member_id', 'all')
                .eq('window_type', 'month').gte('window_start', windowStart).maybeSingle()
                .then(({ data: rateData }) => {
                  if (cancelled) return
                  const used = rateData?.msg_count ?? 0
                  setMonthlyUsed(used)
                  if (used >= planLimit) setMonthlyLimitHit(true)
                })
            })
        })

      // Load chat history
      try {
        const res = await fetch(`/api/chat/history/${slug}?limit=50`, {
          headers: { 'Authorization': `Bearer ${s.access_token}` },
        })
        if (cancelled) return
        const data = res.ok ? await res.json() : { messages: [] }
        let history = data.messages ?? []

        // Fire first-chat intro if this is a brand-new conversation
        if (history.length === 0 && !initialTaskId) {
          const introRes = await fetch('/api/chat/intro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.access_token}` },
            body: JSON.stringify({ member_id: slug }),
          })
          if (introRes.ok) {
            const introData = await introRes.json()
            if (introData.intro) {
              history = [introData.intro]
            }
          }
        }

        setMessages(history)
        setLoading(false)

        // Auto-context: Shay logo grid — always inject regardless of history length
        // (uses localStorage to prevent duplicate on refresh)
        if (initialTaskId && slug === 'logo-concept-generator') {
          const seenKey = `shay-context-seeded:${initialTaskId}`
          const alreadySeeded = typeof window !== 'undefined' && localStorage.getItem(seenKey)
          if (!alreadySeeded) {
            const { data: task } = await supabase.from('tasks')
              .select('worker_slug, input, output, status').eq('id', initialTaskId).single()
            if (!cancelled && task?.status === 'completed' && task.worker_slug === 'logo-concept-generator') {
              const gridUrl = task.output?.images?.[0]?.url || null
              const inp = task.input || {}
              const brandName = inp.brand_name || ''
              const industry = inp.industry || ''
              const style = Array.isArray(inp.style) ? inp.style.join(', ') : (inp.style || '')
              const colors = inp.colors || ''
              const includeSymbols = inp.include_symbols || ''

              const autoMsg = `Here are the 4 logo concepts I just created for you:\n\nBrand: ${brandName}${industry ? `\nIndustry: ${industry}` : ''}${style ? `\nStyle: ${style}` : ''}${colors ? `\nColors: ${colors}` : ''}${includeSymbols ? `\nSymbols: ${includeSymbols}` : ''}\n\nWhich concept do you want to refine? Tell me the number and what you'd like to change — colors, icon style, typography, anything.`

              // Save to DB so Haiku can see brand context when customer replies
              // (no metadata column — just save the content which includes brand brief)
              if (!cancelled) {
                const { data: savedMsg } = await supabase
                  .from('team_chat_messages')
                  .insert({
                    user_id: s.user.id,
                    member_id: slug,
                    role: 'member',
                    content: autoMsg,
                  })
                  .select('id, role, content, created_at')
                  .single()

                // Show with grid image attached (local _shayGridUrl flag)
                const displayMsg = {
                  ...(savedMsg || { id: `shay-context-${initialTaskId}`, role: 'member', content: autoMsg, created_at: new Date().toISOString() }),
                  _shayGridUrl: gridUrl,
                }
                setMessages(prev => [...prev, displayMsg])
                localStorage.setItem(seenKey, '1')
              }
            }
          }
          // Auto-context for other workers — only on empty history
        } else if (initialTaskId && history.length === 0) {
          const { data: task } = await supabase.from('tasks')
            .select('worker_slug, input, output, status').eq('id', initialTaskId).single()
          if (task?.status === 'completed') {
            const topicKey = Object.keys(task.input || {}).find(k =>
              ['topic', 'subject', 'title', 'company_name', 'product_name', 'keyword'].includes(k))
            const summary = topicKey ? `"${task.input[topicKey]}"` : 'your recent task'
            const { data: { session: fresh } } = await supabase.auth.getSession()
            if (fresh) {
              const r = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${fresh.access_token}` },
                body: JSON.stringify({ member_id: slug, message: `__context__:task_complete:${initialTaskId}:${summary}` }),
              })
              if (r.ok) {
                const d = await r.json()
                if (!cancelled) setMessages([{ id: d.id, role: 'member', content: d.content, created_at: new Date().toISOString() }])
              }
            }
          }
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })

    // Keep session fresh on token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, refreshed) => {
      if (refreshed && !cancelled) setSession(refreshed)
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [slug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text && !attachedImage) return
    if (sending || !session || monthlyLimitHit) return
    setSending(true); setError('')

    // Always get a fresh session token before sending — avoids Unauthorized on expired sessions
    const supabaseClient = createClient()
    const { data: { session: freshSession } } = await supabaseClient.auth.getSession()
    if (freshSession && freshSession.access_token !== session?.access_token) {
      setSession(freshSession)
    }
    const activeSession = freshSession || session

    // Build message with optional image attachment
    const messageWithImage = attachedImage
      ? `${text ? text + '\n\n' : ''}[Image attached: ${attachedImage.content}]`
      : text
    // Always show "📎 Image attached" when there's an attachment, alongside any text
    const displayText = attachedImage
      ? `${text ? text + '\n\n' : ''}📎 Image attached`
      : text
    setInput('')
    const prevImage = attachedImage
    setAttachedImage(null)

    const optimistic = { id: `tmp-${Date.now()}`, role: 'user', content: displayText, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, optimistic])

    try {
      // If replying to a Lenny proactive suggestion, inject ICP context
      let messagePayload = { member_id: slug, message: messageWithImage }
      if (slug === 'lead-generator') {
        const lastWorkerMsg = [...messages].reverse().find(m => m.role === 'member' || m.role === 'assistant')
        if (lastWorkerMsg?.content?.startsWith('💡')) {
          // Find team_updates row for this message to get parsed_icp
          try {
            const supabaseClient2 = createClient()
            const { data: tu } = await supabaseClient2
              .from('team_updates')
              .select('id, source_data, suggestion_text')
              .eq('chat_message_id', lastWorkerMsg.id)
              .single()
            if (tu?.source_data?.parsed_icp) {
              const icp = tu.source_data.parsed_icp
              // Inject ICP context as a hidden prefix the API uses but the customer never sees
              messagePayload = {
                member_id: slug,
                message: messageWithImage,
                proactive_context: {
                  team_update_id: tu.id,
                  suggestion_text: tu.suggestion_text,
                  parsed_icp: icp,
                }
              }
            }
          } catch { }
        }
      }

      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeSession?.access_token || session?.access_token}` },
        body: JSON.stringify(messagePayload),
      })
      const data = await res.json()

      if (res.status === 429) {
        // Monthly cap hit
        setMonthlyLimitHit(true)
        if (monthlyLimit) setMonthlyUsed(monthlyLimit) // show as full
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        setInput(text); setSending(false); return
      }
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        setInput(text); setSending(false); return
      }

      // Check if user confirmed a pending chain
      const isConfirm = pendingChain && CONFIRM_WORDS.some(w => text.toLowerCase().trim().startsWith(w))

      const memberMsg = { id: data.id, role: 'member', content: data.content, created_at: new Date().toISOString() }
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimistic.id),
        { ...optimistic, id: `u-${Date.now()}` },
        memberMsg,
      ])

      // If member returned a chain proposal, store it
      if (data.chain_proposal) {
        setPendingChain(data.chain_proposal)
      }

      // If deliverable task was created, execute it from the client (avoids Vercel self-call issues)
      if (data.trigger_deliverable && data.new_task_id && !generatingDeliverableRef.current) {
        generatingDeliverableRef.current = true
        const token = activeSession?.access_token || session?.access_token
        // Call execute-task from the browser with the user's own fresh JWT
        fetch('/api/execute-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ taskId: data.new_task_id }),
        }).then(() => {
          // Execute-task completed (or timed out) — reload chat to show result
          pollForDeliverable(activeSession, data.new_task_id)
        }).catch(() => {
          generatingDeliverableRef.current = false
          setError('Generation failed. Try using the Form tab for reliable results.')
        })
      } else if (data.trigger_deliverable && !data.new_task_id) {
        // Task creation failed server-side — reload to show error
        const histRes = await fetch(`/api/chat/history/${slug}?limit=50`, {
          headers: { 'Authorization': `Bearer ${activeSession?.access_token || session?.access_token}` },
        })
        if (histRes.ok) {
          const histData = await histRes.json()
          setMessages(histData.messages ?? [])
        }
      }

      // If Lenny confirmed he's running the search, append a virtual message
      // with the execution button so customer can click once to run
      if (data.trigger_lenny_search && data.proactive_team_update_id) {
        setMessages(prev => [
          ...prev,
          {
            id: `lenny-run-btn-${Date.now()}`,
            role: 'member',
            content: '[LENNY_RUN_BUTTON]',
            created_at: new Date().toISOString(),
            _team_update_id: data.proactive_team_update_id,
          }
        ])
      }

      // Check for PENDING_CHAIN in new messages from history reload
      // (set by the API after extracting member slugs)

      // If user confirmed chain, trigger it
      if (isConfirm && pendingChain) {
        const chainToRun = pendingChain
        setPendingChain(null)
        setChainRunning(true)
        triggerChain(chainToRun)
      }

      // Monthly usage tracking handled server-side via /api/chat/send (429 response path)
    } catch {
      setError('Failed to send. Please try again.')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setInput(text)
    }
    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, sending, session, slug, monthlyLimitHit, userPlan])

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    if (!file.type.startsWith('image/')) { setError('Only image files are supported'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB'); return }

    setUploading(true)
    setError('')
    try {
      // Get fresh token for upload
      const { data: { session: uploadSession } } = await createClient().auth.getSession()
      const uploadToken = uploadSession?.access_token || session?.access_token
      if (!uploadToken) { setError('Not signed in'); setUploading(false); return }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'image')
      formData.append('fieldName', 'chat-upload')

      const res = await fetch('/api/upload-file', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${uploadToken}` },
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.storagePath) {
        // Create preview URL
        const preview = URL.createObjectURL(file)
        setAttachedImage({ storagePath: data.storagePath, fileName: file.name, preview, content: data.content })
      } else {
        setError('Upload failed. Please try again.')
      }
    } catch {
      setError('Upload failed. Please try again.')
    }
    setUploading(false)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const triggerChain = async (chainRequest) => {
    if (!session) return
    const memberSlugs = Array.isArray(chainRequest) ? chainRequest : (chainRequest?.members ?? [])
    const chainContext = !Array.isArray(chainRequest) ? (chainRequest?.source_context || chainRequest?.description || '') : ''
    if (!memberSlugs.length) return
    // Show running indicator in chat
    const runningMsg = { id: `chain-running-${Date.now()}`, role: 'system', content: `⚡ Running chain: ${memberSlugs.join(' → ')}…`, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, runningMsg])

    try {
      const res = await fetch('/api/chat/trigger-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeSession?.access_token || session?.access_token}` },
        body: JSON.stringify({
          member_id: slug,
          chain: memberSlugs.map(id => ({ worker_id: id })),
          context: chainContext,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setMessages(prev => [
          ...prev.filter(m => m.id !== runningMsg.id),
          { id: `err-${Date.now()}`, role: 'system', content: `❌ Chain failed: ${d.error || 'Unknown error'}`, created_at: new Date().toISOString() }
        ])
      } else {
        // Remove running indicator — the individual deliverable messages were already posted to DB
        // Reload chat history to show them
        setMessages(prev => prev.filter(m => m.id !== runningMsg.id))
        const histRes = await fetch(`/api/chat/history/${slug}?limit=50`, {
          headers: { 'Authorization': `Bearer ${activeSession?.access_token || session?.access_token}` },
        })
        if (histRes.ok) {
          const histData = await histRes.json()
          setMessages(histData.messages ?? [])
        }
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== runningMsg.id))
      setError('Chain execution failed. Please try again.')
    }
    setChainRunning(false)
  }

  const pollForDeliverable = async (activeSession, taskId) => {
    const token = activeSession?.access_token || session?.access_token
    if (!token || !taskId) { generatingDeliverableRef.current = false; return }

    // Poll the specific task status every 3s for up to 5 minutes
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      if (attempts > 100) {
        clearInterval(poll)
        generatingDeliverableRef.current = false
        setError('Generation timed out. Check My Tasks or try using the Form.')
        return
      }
      try {
        const supabase = createClient()
        const { data: task } = await supabase.from('tasks').select('status').eq('id', taskId).single()
        if (task?.status === 'completed' || task?.status === 'failed') {
          clearInterval(poll)
          generatingDeliverableRef.current = false
          // Reload chat to show the deliverable card / error
          const histRes = await fetch(`/api/chat/history/${slug}?limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` },
          })
          if (histRes.ok) {
            const histData = await histRes.json()
            setMessages(histData.messages ?? [])
          }
        }
      } catch {
        clearInterval(poll)
        generatingDeliverableRef.current = false
      }
    }, 3000)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleRefine = (taskId) => {
    setInput(`I'd like to refine the deliverable`)
    inputRef.current?.focus()
  }

  // Group by date, deduplicating deliverable_id (only show first card per task)
  const seenDeliverableIds = new Set()
  const grouped = messages.reduce((acc, msg, i) => {
    // Skip duplicate deliverable cards — same task_id, different message
    if (msg.deliverable_id) {
      if (seenDeliverableIds.has(msg.deliverable_id)) return acc
      seenDeliverableIds.add(msg.deliverable_id)
    }
    const date = (msg.created_at || new Date().toISOString()).split('T')[0]
    const prev = acc.length > 0 ? acc[acc.length - 1] : null
    const prevDate = prev?.type === 'message' ? (prev.msg.created_at || '').split('T')[0] : prev?.date
    if (date !== prevDate) acc.push({ type: 'divider', date, key: `d-${date}-${i}` })
    acc.push({ type: 'message', msg, key: msg.id || `m-${i}` })
    return acc
  }, [])

  // Input disabled when monthly cap is hit — forms still work, only chat blocked
  const inputDisabled = sending || chainRunning || monthlyLimitHit

  return (
    <div className="flex flex-col justify-between bg-white rounded-xl h-[calc(100vh-240px)]">
      {/* ── Header ── */}
      {/* {
        messages.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-lg border border-blue-100">
                  {workerEmoji}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5 items-center justify-center rounded-full bg-emerald-400 ring-1 ring-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-950 leading-tight">{memberName}</p>
                <p className="text-xs text-zinc-400 leading-tight">{memberTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenForm?.()}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Use Form
              </button>
              <Link href={`/dashboard/tasks?member=${slug}`}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
                Past tasks →
              </Link>
            </div>
          </div>
        )
      } */}

      {/* ── Messages ── */}
      <div className="overflow-auto p-4 sm:p-6 min-h-0 h-[calc(100vh-380px)] space-y-7.5" style={{ background: '#fafafa' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex size-20 items-center justify-center rounded-full text-3xl mb-5 border border-blue-100 shadow-sm overflow-hidden">
              {avatarSrc ? (
                <Image
                  src={avatarSrc}
                  alt={`${memberName} avatar`}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              ) : (
                workerEmoji
              )}
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-zinc-800 mb-1.5 sm:mb-3">Chat with {memberName}</p>
            <p className="text-sm sm:text-base text-neutral-500 leading-relaxed max-w-[427px]">
              {worker?.description || `Chat with ${memberName} to get started.`}
            </p>
          </div>
        ) : (
          <>
            {grouped.map(item =>
              item.type === 'divider'
                ? <DateDivider key={item.key} date={item.date} />
                : <ChatMessage key={item.key} msg={item.msg} onRefine={handleRefine} onOpenForm={onOpenForm} onConfirmChain={(members) => { setChainRunning(true); triggerChain(members) }} userPlan={userPlan} session={session} slug={slug} worker={worker} />
            )}

            {/* Typing / generating indicator */}
            {(sending || generatingDeliverableRef.current) && (
              <div className="flex items-end gap-2">
                <div className="flex flex-col items-start gap-1">
                  <div className="rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                    {generatingDeliverableRef.current ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{memberName} is creating your deliverable</span>
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="size-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="size-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {generatingDeliverableRef.current && (
                    <span className="text-[10px] text-zinc-400 px-1">This takes ~60 seconds</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Chain running indicator ── */}
      {chainRunning && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-100 px-4 py-2.5 text-xs font-medium text-purple-700">
          <div className="size-3 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
          Chain running — team members are working…
        </div>
      )}

      {/* —— Monthly usage counter/warning/blocked banner —— */}
      <MonthlyUsageBanner
        used={monthlyUsed}
        limit={monthlyLimit}
        resetDate={monthlyResetDate}
        plan={userPlan}
      />

      {/* ── Error ── */}
      {error && (
        <p className="px-5 pb-2 text-xs text-red-500">{error}</p>
      )}

      {/* ── Memory panel — Pro/Operator only ── */}
      {(userPlan === null || loading) ? (
        // Skeleton while plan is loading
        <div className="border-y border-zinc-200 px-6 py-5 flex items-center justify-between">
          <div className="h-3.5 w-16 rounded bg-zinc-200 animate-pulse" />
          <div className="flex gap-2 items-center">
            <div className="size-4 rounded bg-zinc-200 animate-pulse" />
            <div className="size-4 rounded bg-zinc-200 animate-pulse" />
          </div>
        </div>
      ) : (userPlan === 'pro' || userPlan === 'operator') && session ? (
        <MemoryPanel slug={slug} session={session} />
      ) : null}

      {/* ── Input ── */}
      <div className="px-4 sm:px-6 py-4 bg-white">
        {/* Image attachment preview */}
        <div className="flex flex-wrap gap-2">
          {attachedImage && (
            <div className="mb-5 mt-1 flex items-center gap-1 rounded-lg bg-[#F5F5F5] border border-zinc-200 p-1 pr-4">
              <Image src={attachedImage.preview} alt={attachedImage.fileName} className="size-8 rounded-md object-cover" width={32} height={32} />
              <p className="text-xs text-[#09090B] truncate">{attachedImage.fileName}</p>
              <button onClick={() => setAttachedImage(null)} className="text-zinc-400 hover:text-zinc-600 ml-2">
                <X className="size-4 cursor-pointer" />
              </button>
            </div>
          )}
        </div>

        <div className={`flex items-center gap-2 rounded-xl transition-all ${inputDisabled
          ? 'bg-zinc-50'
          : 'bg-white focus-within:border-blue-400 focus-within'
          }`}>
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          {/* Attachment button — hidden for Shay (uploads distort logo output) */}
          {slug !== 'logo-concept-generator' && <Button variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || inputDisabled}
            className="shrink-0 text-[#414651] transition-colors disabled:opacity-30 mb-0.5 size-11!"
            title="Attach image"
          >
            {uploading
              ? <div className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
              : <Paperclip className='size-4' />
            }
          </Button>}
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={inputDisabled}
            placeholder={
              !session ? 'Sign in to chat'
                : monthlyLimitHit ? 'Monthly limit reached — forms still work'
                  : `Message ${memberName}…`
            }
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            }}
            className='h-11! resize-none!'
            textareaClassName="h-11! p-2"
          />
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!input.trim() || inputDisabled}
            className="size-11 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {sending
              ? <div className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
              : <Send className='size-4' />
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
