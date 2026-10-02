// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { downloadDocx, downloadPdf, downloadCsv, downloadXlsx, downloadBrodyXlsx } from '@/lib/downloads'
import { Copy, Download, MoreVertical, ArrowDownToLine, Check } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Badge } from '@/components/badge'
import SendToDropdown from '@/components/integrations/SendToDropdown'
import { Button } from '@/components/button'
import { Heading } from '@/components/heading'
import { Input } from '@/components/input'
import { Text } from '@/components/text'
import { useToast } from '@/components/toast-provider'
import AudioPlayer from '@/components/AudioPlayer'
import WebsiteBuilderOutput from '@/components/workers/WebsiteBuilderOutput'
import BrodyOutput from '@/components/workers/outputs/BrodyOutput'

import { createClient } from '@/lib/supabase/client'
import { getWorkerBySlug } from '@/lib/workers/registry'

// ---------------------------------------------------------------------------
// Download config
// ---------------------------------------------------------------------------
const DOWNLOAD_FORMATS = {
  'customer-support-writer': ['docx', 'pdf', 'csv'],
  'data-cleaner': ['xlsx-cleaned', 'xlsx-changelog', 'pdf-report'],
  'lead-generator': ['csv'],
  'bookkeeping-summarizer': ['pdf', 'xlsx'],
  'kpi-dashboard-writer': ['pdf', 'docx', 'xlsx'],
  'spreadsheet-builder': ['xlsx'],
}

function getDownloadFormats(slug) {
  if (slug in DOWNLOAD_FORMATS) return DOWNLOAD_FORMATS[slug]
  return ['docx', 'pdf']
}

const FORMAT_LABELS = {
  docx: 'Word Document (.docx)',
  pdf: 'PDF Document (.pdf)',
  csv: 'CSV Spreadsheet (.csv)',
  xlsx: 'Excel Spreadsheet (.xlsx)',
  pptx: 'PowerPoint (.pptx)',
  'xlsx-cleaned': 'Cleaned Data (.xlsx)',
  'xlsx-changelog': 'Change Log (.xlsx)',
  'pdf-report': 'Change Report (PDF)',
}



// ---------------------------------------------------------------------------
// PPTX output — for Mack
// ---------------------------------------------------------------------------
function PptxOutput({ output }) {
  const { downloadUrl, fileName, slideCount, slideSummary, expiresAt, presentationTitle } = output || {}
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null
  const slideLines = (slideSummary || '').split('\n').filter(Boolean)

  return (
    <div className="mt-8 space-y-5">
      {/* 48h notice */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
        <span className="text-lg">⏱️</span>
        <Text className="!text-amber-800 !text-sm">
          <span className="font-semibold">Download within 48 hours.</span>
          {expiryDate && ` File expires ${expiryDate}.`}
        </Text>
      </div>

      {/* Download card */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-950/[0.08] bg-white px-6 py-5">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">📊</span>
          <div>
            <p className="font-semibold text-zinc-950">{fileName || 'presentation.pptx'}</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {slideCount} slides · PowerPoint (.pptx)
            </p>
          </div>
        </div>
        <a
          href={downloadUrl}
          download={fileName || 'presentation.pptx'}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5v7m0 0L4.5 6m2.5 2.5L9.5 6M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download .pptx
        </a>
      </div>

      {/* Slide preview list */}
      {slideLines.length > 0 && (
        <div className="rounded-xl border border-zinc-950/[0.08] bg-white overflow-hidden">
          <div className="border-b border-zinc-950/[0.06] px-6 py-4">
            <p className="text-sm font-semibold text-zinc-950">Slide Structure</p>
          </div>
          <div className="divide-y divide-zinc-950/[0.04]">
            {slideLines.map((line, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-600">
                  {i + 1}
                </span>
                <p className="text-sm text-zinc-700">{line.replace(/^Slide \d+: /, '')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image grid — for Jude and Reed
// ---------------------------------------------------------------------------
function ImageOutput({ output, workerSlug }) {
  const images = output?.images || []
  const expiresAt = output?.expiresAt
  const isThumbnail = output?.isThumbnail
  const size = output?.size || '1024×1024'

  const handleDownload = async (url, index) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${workerSlug}-image-${index + 1}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, '_blank')
    }
  }

  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null

  return (
    <div className="mt-8 space-y-6">
      {/* 48h notice */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
        <span className="text-lg">⏱️</span>
        <Text className="!text-amber-800 !text-sm">
          <span className="font-semibold">Download within 48 hours.</span>
          {expiryDate && ` Images expire ${expiryDate}.`}
        </Text>
      </div>

      {/* Size info */}
      <div className="flex items-center gap-2">
        <Text className="text-sm text-zinc-500">
          {isThumbnail ? 'YouTube Thumbnail · 1280×720' : `Size: ${size}`} · {images.length} image{images.length !== 1 ? 's' : ''} generated
        </Text>
      </div>

      {/* Image grid */}
      <div className={`grid gap-6 ${images.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {images.map((img, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-zinc-950/[0.08] bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`Generated image ${i + 1}`}
              className="w-full object-cover"
              style={{ aspectRatio: isThumbnail ? '16/9' : '1/1' }}
            />
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-950/[0.06]">
              <Text className="text-xs text-zinc-400 truncate max-w-[60%]">
                Image {i + 1}
              </Text>
              <button
                onClick={() => handleDownload(img.url, i)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1.5v6m0 0L4 5.5m2 2l2-2M2 9.5v.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Clips output — for Joe
// ---------------------------------------------------------------------------
function ClipsOutput({ output }) {
  const { clips = [], platform, expiresAt, hasVideo, totalClips } = output || {}
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null

  function formatDuration(secs) {
    if (!secs) return ''
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  function formatTimestamp(secs) {
    if (secs === undefined || secs === null) return ''
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="mt-8 space-y-5">
      {hasVideo && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <span className="text-lg">⏱️</span>
          <Text className="!text-amber-800 !text-sm">
            <span className="font-semibold">Download within 48 hours.</span>
            {expiryDate && ` Clips expire ${expiryDate}.`}
          </Text>
        </div>
      )}
      {platform && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Platform:</span>
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{platform}</span>
          <span className="text-sm text-zinc-500">{totalClips} clips identified</span>
        </div>
      )}
      <div className="space-y-3">
        {clips.map((clip, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-zinc-950/[0.08] bg-white px-5 py-4">
            <div className="shrink-0">
              {clip.thumbnailUrl ? (
                <img src={clip.thumbnailUrl} alt={`Clip ${clip.clipNumber} thumbnail`} className="h-16 w-28 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-zinc-100">
                  <span className="text-2xl">🎬</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-950">Clip {clip.clipNumber}</p>
              <p className="mt-0.5 text-sm text-zinc-600 line-clamp-2">{clip.description}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {formatTimestamp(clip.startSeconds)} to {formatTimestamp(clip.endSeconds)} · {formatDuration(clip.duration)}
              </p>
            </div>
            {clip.downloadUrl ? (
              <a href={clip.downloadUrl} download={`clip-${clip.clipNumber}.mp4`} className="shrink-0 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5v7m0 0L4.5 6m2.5 2.5L9.5 6M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download
              </a>
            ) : (
              <span className="shrink-0 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-400">
                {formatTimestamp(clip.startSeconds)}
              </span>
            )}
          </div>
        ))}
      </div>
      {!hasVideo && clips.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4">
          <p className="text-sm font-medium text-zinc-700">Clip timestamps identified</p>
          <p className="mt-1 text-sm text-zinc-500">Video file was not available for extraction. Use the timestamps above to manually cut clips from your original video.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Captions output — for Tess
// ---------------------------------------------------------------------------
function CaptionsOutput({ output }) {
  const { outputType, downloadUrl, fileName, captionStyle, previewContent, srtContent, expiresAt } = output || {}
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null
  const isBurnedIn = outputType === 'burned-video'
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(srtContent || previewContent || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
        <span className="text-lg">⏱️</span>
        <Text className="!text-amber-800 !text-sm">
          <span className="font-semibold">Download within 48 hours.</span>
          {expiryDate && ` File expires ${expiryDate}.`}
        </Text>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-zinc-950/[0.08] bg-white px-6 py-5">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
            {isBurnedIn ? '🎬' : '💬'}
          </span>
          <div>
            <p className="font-semibold text-zinc-950">{fileName || (isBurnedIn ? 'captioned-video.mp4' : 'captions.srt')}</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isBurnedIn ? 'Video with burned-in captions' : outputType === 'vtt' ? 'WebVTT subtitle file' : 'SRT subtitle file'} · {captionStyle}
            </p>
          </div>
        </div>
        {downloadUrl ? (
          <a href={downloadUrl} download={fileName || 'captions.srt'} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5v7m0 0L4.5 6m2.5 2.5L9.5 6M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download
          </a>
        ) : (
          <button onClick={handleCopy} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      {!isBurnedIn && (previewContent || srtContent) && (
        <div className="rounded-xl border border-zinc-950/[0.08] bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-950/[0.06] px-6 py-4">
            <p className="text-sm font-semibold text-zinc-950">Caption Preview</p>
            <button onClick={handleCopy} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              {copied ? 'Copied!' : 'Copy all'}
            </button>
          </div>
          <pre className="overflow-x-auto px-6 py-4 text-xs text-zinc-600 font-mono leading-relaxed max-h-64 overflow-y-auto">
            {previewContent || srtContent}
          </pre>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Markdown output — for text workers
// ---------------------------------------------------------------------------
function TextOutput({ text }) {
  // Use marked with GFM (GitHub Flavored Markdown) — handles tables, strikethrough, etc.
  const rawHtml = marked.parse(text || '', { breaks: true, gfm: true })
  const html = typeof window !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml

  // Wrap table tags in a scrollable div wrapper to prevent the container from stretching horizontally
  const wrappedHtml = typeof html === 'string'
    ? html
      .replace(
        /<table([^>]*)/g,
        '<div style="overflow-x:auto; overflow-y:hidden; border-radius:10px; border:1px solid #e4e4e7; margin:16px 0;"><table$1'
      )
      .replace(/<\/table>/g, '</table></div>')
    : html

  return (
    <div className="mt-8 rounded-xl border border-zinc-950/[0.08] bg-white px-6 py-6 md:px-10 md:py-10 max-h-[calc(100vh-350px)] overflow-y-auto overflow-x-hidden">
      <div
        className="prose prose-zinc max-w-none text-base/7 prose-table:border-collapse prose-td:border prose-td:border-zinc-200 prose-td:px-3 prose-td:py-2 prose-th:border prose-th:border-zinc-200 prose-th:px-3 prose-th:py-2 prose-th:bg-zinc-50 prose-th:font-semibold"
        dangerouslySetInnerHTML={{ __html: wrappedHtml }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TaskResultByIdPage() {
  const { showToast } = useToast()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [refineText, setRefineText] = useState('')
  const refining = false
  const params = useParams()
  const rawTaskId = params?.id
  const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId
  const [downloading, setDownloading] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const downloadRef = useRef(null)



  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // D7 fix: fetch by task ID allowing workspace member access.
      // Old query: .eq('user_id', session.user.id) — teammates saw task in list but got "not found" on open.
      // New query: try own task first, then try workspace-scoped task.
      let data = null
      if (taskId) {
        // Try own task first (fast path)
        const { data: ownTask } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (ownTask) {
          data = ownTask
        } else {
          // Try workspace-scoped: user must be a member of the workspace the task belongs to
          const { data: wsTask } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .not('workspace_id', 'is', null)
            .maybeSingle()
          if (wsTask?.workspace_id) {
            // Verify caller is a member of that workspace
            const { data: membership } = await supabase
              .from('workspace_members')
              .select('id')
              .eq('workspace_id', wsTask.workspace_id)
              .eq('user_id', session.user.id)
              .maybeSingle()
            if (membership) data = wsTask
          }
        }
      } else {
        // No task ID — get latest own task
        const { data: latestTask } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', session.user.id)
          .in('status', ['completed', 'processing', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        data = latestTask
      }

      setTask(data)
      setLoading(false)

      // If still processing, poll until complete
      if (data?.status === 'processing' || data?.status === 'pending') {
        const poll = setInterval(async () => {
          const { data: updated } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', data.id)
            .single()
          if (updated?.status === 'completed' || updated?.status === 'failed') {
            setTask(updated)
            clearInterval(poll)
          }
        }, 2000)
        return () => clearInterval(poll)
      }
    }
    load()
  }, [taskId])

  const handleDownload = async (format) => {
    setDownloadOpen(false)
    setDownloading(true)
    try {
      const slug = task?.worker_slug || ''
      const tid = task?.id || ''

      if (slug === 'kpi-dashboard-writer') {
        const brodyContent = task?.output?.text || ''
        const brodyTitle = task?.input?.business_description || 'Key Metrics Framework'
        if (format === 'pdf') {
          await downloadPdf(brodyContent, slug, tid)
        } else if (format === 'docx') {
          await downloadDocx(brodyContent, slug, tid)
        } else if (format === 'xlsx') {
          await downloadBrodyXlsx(task?.output?.text || '', tid, task?.output?.metricData)
        }
      } else if (format === 'docx') {
        await downloadDocx(task?.output?.text || '', slug, tid)
      } else if (format === 'pdf') {
        await downloadPdf(task?.output?.text || '', slug, tid)
      } else if (format === 'csv') {
        await downloadCsv(task?.output?.text || '', slug, tid)
      } else if (format === 'xlsx') {
        await downloadXlsx(task?.output?.text || '', slug, tid)
      }
      showToast({ title: 'Download started', variant: 'success' })
    } catch (err) {
      console.error('Download failed', err)
      showToast({ title: 'Download failed', variant: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) {
        setDownloadOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const worker = task ? getWorkerBySlug(task.worker_slug) : null
  const SLOW_WORKERS = new Set([
    'course-outline-builder', 'whitepaper-writer', 'seo-strategist', 'creative-editor',
    'business-plan-writer', 'legal-document-drafter', 'market-research-analyst',
    'research-assistant', 'pitch-deck-writer', 'presentation-builder', 'content-writer',
    'script-writer', 'email-marketing-strategist', 'competitor-analyst', 'content-strategist',
    'report-writer', 'training-material-writer', 'spreadsheet-builder', 'data-cleaner',
    'kpi-dashboard-writer', 'product-naming-specialist', 'technical-writer', 'video-repurposer',
  ])
  const isSlowWorker = task?.worker_slug ? SLOW_WORKERS.has(task.worker_slug) : false

  const isImageTask = task?.output_format === 'images' || task?.output?.format === 'images'
  const isPptxTask = task?.output_format === 'pptx' || task?.output?.format === 'pptx'
  const isClipsTask = task?.output_format === 'clips' || task?.output?.format === 'clips'
  const isCaptionsTask = task?.output_format === 'captions' || task?.output?.format === 'captions'
  const isAudioTask = task?.output?.format === 'audio' || task?.output?.format === 'dubbing_pending'
  const isDubbingPending = task?.output?.format === 'dubbing_pending'
  const isWebsiteTask = task?.worker_slug === 'website-builder' || task?.output?.isWebsiteBuilder === true
  const outputText = task?.output?.text || ''

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
          <Text>Loading result…</Text>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Text>No task found.</Text>
        <Button color="blue" href="/dashboard/team">Browse workers</Button>
      </div>
    )
  }

  const isProcessing = task.status === 'processing' || task.status === 'pending'

  return (
    <>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="text-zinc-400 transition-colors hover:text-zinc-600">Dashboard</Link>
        <span className="text-zinc-300">›</span>
        <Link href="/dashboard/tasks" className="text-zinc-400 transition-colors hover:text-zinc-600">My Tasks</Link>
        <span className="text-zinc-300">›</span>
        <span className="font-medium text-zinc-950">Task Result</span>
      </nav>

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-2xl">
            {worker?.emoji || '🤖'}
          </span>
          <div>
            <Heading>{worker?.personaName ? `${worker.personaName} · ${task.worker_title_at_creation || worker.name}` : (task.worker_title_at_creation || worker?.name || task.worker_slug)}</Heading>
            <div className="mt-1.5 flex items-center gap-2.5">
              <Badge color={task.status === 'completed' ? (task.output_status === 'potentially_truncated' ? 'yellow' : 'green') : task.status === 'failed' ? 'red' : 'yellow'}>
                {task.status === 'completed' ? (task.output_status === 'potentially_truncated' ? 'Partial' : 'Completed') : task.status === 'failed' ? 'Failed' : 'Processing…'}
              </Badge>
              <Text>{worker?.category || ''}</Text>
            </div>
          </div>
        </div>

        {/* Actions — text workers only (not website — has its own export panel) */}
        {!isImageTask && !isClipsTask && !isCaptionsTask && !isAudioTask && !isWebsiteTask && task.status === 'completed' && (
          <div className="flex items-center gap-2">
            <Button outline onClick={() => {
              navigator.clipboard?.writeText(outputText)
              showToast({ title: 'Copied to clipboard', variant: 'success' })
              setCopied(true)
              setTimeout(() => setCopied(false), 3000)
            }}>
              {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>

            {/* Download Dropdown */}
            <div className="relative" ref={downloadRef}>
              <Button outline onClick={() => setDownloadOpen(!downloadOpen)} disabled={downloading}>
                <Download className="size-4" />
                {downloading ? 'Downloading...' : 'Download'}
              </Button>
              {downloadOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[200px] border border-zinc-200 bg-white shadow-lg rounded-xl z-50 overflow-hidden text-sm">
                  {getDownloadFormats(task.worker_slug).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => handleDownload(fmt)}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 transition-colors text-zinc-700"
                    >
                      {FORMAT_LABELS[fmt] || fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send To */}
            <SendToDropdown
              taskId={task.id}
              title={((['topic', 'subject', 'title', 'keyword', 'company_name', 'product_name', 'task_description', 'task_input'].map(k => task.input?.[k]).find(v => typeof v === 'string' && v?.length > 3) || Object.values(task.input || {}).find(v => typeof v === 'string' && v?.length > 3))?.slice?.(0, 60))}
            />
          </div>
        )}
        {/* Image/Clip/Caption/Website tasks special buttons REMOVED as per user request to keep only Copy/Download/SendTo in header */}
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-950/[0.08] bg-white py-16">
          <div className="size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
          <Text className="font-medium">
            {isImageTask ? 'Generating images…' : isClipsTask ? 'Extracting video clips…' : isCaptionsTask ? 'Generating captions…' : isDubbingPending ? 'Tala is translating your content…' : isWebsiteTask ? 'Silas is building your website…' : 'Running task…'}
          </Text>
          <Text className="text-sm text-zinc-400">
            {isDubbingPending ? 'Translation usually takes 2–5 minutes. Hang tight.' : isSlowWorker ? 'This usually takes 60–90 seconds' : 'This usually takes 15–30 seconds'}
          </Text>
        </div>
      )}

      {/* Failed state */}
      {task.status === 'failed' && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-8 py-8">
          <p className="font-semibold text-red-700">Task failed</p>
          <p className="mt-1 text-sm text-red-600">{task.error_message || 'An unexpected error occurred.'}</p>
          <Button className="mt-4" href={`/dashboard/team/${task.worker_slug}`}>Try again →</Button>
        </div>
      )}

      {/* PPTX output */}
      {!isProcessing && task.status === 'completed' && isPptxTask && (
        <PptxOutput output={task.output} />
      )}

      {/* Image output */}
      {!isProcessing && task.status === 'completed' && isImageTask && (
        <ImageOutput output={task.output} workerSlug={task.worker_slug} />
      )}

      {/* Clips output */}
      {!isProcessing && task.status === 'completed' && isClipsTask && (
        <ClipsOutput output={task.output} />
      )}

      {/* Captions output */}
      {!isProcessing && task.status === 'completed' && isCaptionsTask && (
        <CaptionsOutput output={task.output} />
      )}

      {/* Website builder output — Silas (website-builder) */}
      {!isProcessing && task.status === 'completed' && isWebsiteTask && (
        <WebsiteBuilderOutput task={task} />
      )}

      {/* Text output */}
      {/* Audio output — Clay, Koa, Tala */}
      {!isProcessing && task.status === 'completed' && isAudioTask && (task.output?.audio_url || task.output?.audio_path) && (
        <div className="mt-8 space-y-4">
          <AudioPlayer
            audioUrl={task.output.audio_url}
            audioPath={task.output.audio_path}
            taskId={task.id}
            fileName={task.output.audio_filename || 'audio.mp3'}
            label={
              task.worker_slug === 'voiceover-artist'
                ? `Voiceover · ${task.output.voice || 'Professional Male'}`
                : task.worker_slug === 'sound-effects-designer'
                  ? 'Sound Effect'
                  : `Dubbed Audio · ${task.output.source_language || 'English'} → ${task.output.target_language || 'Spanish'}`
            }
          />
          {outputText && (
            <div className="rounded-xl border border-zinc-950/[0.08] bg-white px-6 py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Reference</p>
              <div className="prose prose-sm max-w-none text-zinc-700">
                <p>{outputText.replace(/\*\*/g, '').split('\n\n').slice(1).join('\n\n')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!isProcessing && task.status === 'completed' && !isImageTask && !isPptxTask && !isClipsTask && !isCaptionsTask && !isAudioTask && !isWebsiteTask && outputText && (
        <>
          {task.worker_slug === 'kpi-dashboard-writer' ? (
            <BrodyOutput output={task.output} isEditable={false} className="mt-8 rounded-xl border border-zinc-950/[0.08] bg-white px-6 py-6 md:px-10 md:py-10" />
          ) : (
            <TextOutput text={outputText} />
          )}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-950/[0.08] bg-white px-5 py-3.5">
            <Input
              name="refine"
              className="flex-1"
              placeholder={`Ask ${worker?.personaName || worker?.name?.split(' ')[0] || 'the worker'} to refine…`}
              value={refineText}
              onChange={e => setRefineText(e.target.value)}
              disabled={refining}
            />
            <Button color="blue" disabled={refining || !refineText.trim()}>
              {refining ? 'Refining…' : 'Refine'}
            </Button>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-5">
          <Link href={`/dashboard/team/${task.worker_slug}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Submit another task
          </Link>
          <Link href="/dashboard/team" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Browse workers
          </Link>
        </div>
        <span className="text-xs text-zinc-400">Task ID: {task.id?.slice(0, 8)}</span>
      </div>
    </>
  )
}
