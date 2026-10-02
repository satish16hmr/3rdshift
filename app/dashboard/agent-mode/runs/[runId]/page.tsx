// @ts-nocheck
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ArrowLeft, Download, Copy, CheckCircle2, Loader2, XCircle, Clock, AlertTriangle, ChevronDown, Check } from 'lucide-react'

import Image from 'next/image'
import dynamic from 'next/dynamic'

import { Loader } from '@/components/loader'
import { useToast } from '@/components/toast-provider'
import { AudioPlayer, VideoPlayer, ImageGallery } from '@/components/media-output'
import DownloadDropdown from '@/components/DownloadDropdown'
import BrodyOutput from '@/components/workers/outputs/BrodyOutput'

import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { downloadDocx, downloadPdf } from '@/lib/downloads'
import { hasAudioLink, hasVideoLink, downloadTextAsFile, toHtml, parseMediaTaskId, stripMediaForDownload, slugifyLabel } from '@/lib/media-output/parsers'

const TiptapEditor = dynamic(() => import('@/components/TiptapEditor'), {
  ssr: false,
}) as any

interface WorkerResult {
  worker_id: string
  position: number
  status: 'completed' | 'failed' | 'skipped'
  output?: string
  provider?: string
  error?: string
  credits_consumed: { light: number; heavy: number }
  credits_refunded: { light: number; heavy: number }
  started_at?: string
  completed_at?: string
}

interface RunData {
  id: string
  chain_id: string
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'pending_rescue'
  trigger_type: string
  worker_results: WorkerResult[]
  started_at: string
  completed_at?: string
  total_light_consumed: number
  total_heavy_consumed: number
  total_light_refunded: number
  total_heavy_refunded: number
  agent_mode_chains?: {
    name: string
    workers: { worker_id: string; position: number }[]
  }
}

const STATUS_CONFIG = {
  queued: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-100', label: 'Queued' },
  running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Completed' },
  partial: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Partial' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
  pending_rescue: { icon: Loader2, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Retrying' },
  skipped: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-100', label: 'Skipped' },
}

function getWorkerStatus(
  workerResults: WorkerResult[],
  workerId: string,
  position: number,
  runStatus: string
): 'completed' | 'running' | 'failed' | 'skipped' | 'queued' {
  const result = workerResults.find(r => r.worker_id === workerId && r.position === position)
  if (result) return result.status === 'skipped' ? 'skipped' : result.status
  // No result yet — if run is still active, figure out if this worker is next
  if (runStatus === 'running' || runStatus === 'queued') {
    const completedCount = workerResults.filter(r => r.status === 'completed' || r.status === 'failed' || r.status === 'skipped').length
    if (position === completedCount + 1) return 'running'
    return 'queued'
  }
  return 'queued'
}

interface StepProps {
  name: string
  role?: string
  avatarSrc?: string
  status: 'completed' | 'running' | 'failed' | 'skipped' | 'queued'
  isSelected?: boolean
  isFinish?: boolean
  onClick?: () => void
}

function StepperItem({ name, role, avatarSrc, status, isSelected, isFinish, onClick }: StepProps) {
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued
  const StatusIcon = statusCfg.icon
  const isClickable = status === 'completed' || status === 'failed' || isFinish
  const showRing = status === 'completed' && isFinish && isSelected

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`cursor-pointer flex flex-col min-w-[170px] sm:min-w-[190px] rounded-[12px] border md:border-none bg-white p-2 md:p-0 md:ring-0 shadow-xs transition-all duration-200 select-none border-zinc-200 hover:border-zinc-300 hover:shadow-xs`}>
      {/* Top progress line inside the card */}
      <div className={`h-1 w-full rounded-full ${status === 'completed' ? 'bg-blue-600' : 'bg-zinc-200'}`} />

      {/* Stepper info */}
      <div className="flex items-center gap-3 mt-3.5">
        {avatarSrc ? (
          <div className={`relative size-10 shrink-0 overflow-hidden rounded-full border ${status === 'running' ? 'border-blue-100' : 'border-zinc-100'}`}>
            <Image
              src={avatarSrc}
              alt={name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 ${status === 'completed' && isFinish ? "bg-blue-500 ring-[3px] ring-[#6290F2] ring-offset-2 -mt-[5px]" : "bg-zinc-300"}`}>
            <div className="size-2.5 rounded-full bg-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate leading-snug ${isSelected ? 'font-bold text-blue-600' :
            status === 'running' ? 'text-blue-600' :
              status === 'completed' ? 'text-zinc-900' :
                'text-zinc-500'
            }`}>{name}</p>
          {role && (
            <p className={`text-xs truncate leading-normal  ${isSelected ? 'text-blue-600' :
              status === 'running' ? 'text-blue-600' :
                status === 'completed' ? 'text-zinc-900' :
                  'text-zinc-500'
              }`}>
              {role}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


export default function RunDetailPage() {

  const router = useRouter()
  const { showToast } = useToast()
  const { runId } = useParams<{ runId: string }>()
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [run, setRun] = useState<RunData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] = useState<number | null>(null) // position-based (1-indexed), null = auto-select
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null)

  const editorRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch run data
  const fetchRun = useCallback(async () => {
    try {
      const res = await agentFetch(`/api/agent-mode/runs/${runId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to load run')
        setLoading(false)
        return
      }
      const data = await res.json()
      if (data.run) {
        setRun(data.run)
        setError(null)
      }
    } catch {
      setError('Failed to load run')
    }
    setLoading(false)
  }, [runId])

  // Initial fetch
  useEffect(() => {
    fetchRun()
  }, [fetchRun])

  // Poll while running/queued
  useEffect(() => {
    if (!run || (run.status !== 'running' && run.status !== 'queued' && run.status !== 'pending_rescue')) return
    const interval = setInterval(fetchRun, 3000)
    return () => clearInterval(interval)
  }, [run?.status, fetchRun])

  // Auto-select the latest completed step or the running step
  useEffect(() => {
    if (!run || selectedStep !== null) return
    const chainWorkers = run.agent_mode_chains?.workers ?? []
    const results = run.worker_results ?? []

    // Find last completed worker
    const completedResults = results.filter(r => r.status === 'completed')
    if (completedResults.length > 0) {
      const lastCompleted = completedResults.sort((a, b) => b.position - a.position)[0]
      setSelectedStep(lastCompleted.position)
    }
  }, [run, selectedStep])

  // Scroll logic
  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 2)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      checkScroll()
      const observer = new ResizeObserver(() => checkScroll())
      observer.observe(el)
      return () => observer.disconnect()
    }
  }, [checkScroll, run])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 210
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(checkScroll, 300)
    }
  }

  // Get chain workers (from chain definition, not just results)
  const chainWorkers = run?.agent_mode_chains?.workers ?? []
  const workerResults = run?.worker_results ?? []

  // Build steps array
  const steps = chainWorkers
    .sort((a, b) => a.position - b.position)
    .map(w => {
      const meta = workerRegistry.find(r => r.slug === w.worker_id)
      const status = run ? getWorkerStatus(workerResults, w.worker_id, w.position, run.status) : 'queued'
      return {
        workerId: w.worker_id,
        position: w.position,
        name: meta?.personaName ?? w.worker_id,
        role: meta?.name ?? '',
        avatarSrc: `/images/marketing/workers-figma/${(meta?.personaName ?? w.worker_id).toLowerCase()}.png`,
        emoji: meta?.emoji ?? '🤖',
        outputFormat: meta?.outputFormat ?? 'markdown',
        status,
      }
    })

  // If no chain workers defined, fall back to worker_results
  if (steps.length === 0 && workerResults.length > 0) {
    workerResults.sort((a, b) => a.position - b.position).forEach(r => {
      const meta = workerRegistry.find(reg => reg.slug === r.worker_id)
      steps.push({
        workerId: r.worker_id,
        position: r.position,
        name: meta?.personaName ?? r.worker_id,
        role: meta?.name ?? '',
        avatarSrc: `/images/marketing/workers-figma/${(meta?.personaName ?? r.worker_id).toLowerCase()}.png`,
        emoji: meta?.emoji ?? '🤖',
        outputFormat: meta?.outputFormat ?? 'markdown',
        status: r.status === 'skipped' ? 'skipped' : r.status,
      })
    })
  }

  // Determine if all workers done → show Finish
  const allDone = run && (run.status === 'completed' || run.status === 'partial' || run.status === 'failed')
  const isFinishSelected = selectedStep === -1

  // Get selected worker's result
  const selectedResult = selectedStep && selectedStep > 0
    ? workerResults.find(r => r.position === selectedStep)
    : null
  const selectedWorkerMeta = selectedStep && selectedStep > 0
    ? steps.find(s => s.position === selectedStep)
    : null
  const selectedResultIsLoading = selectedResult != null && (selectedResult.status === 'running' || selectedResult.status === 'queued')

  // Get all completed results for Finish view
  const completedResults = workerResults.filter(r => r.status === 'completed')


  // Copy handler
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast({ title: 'Copied to clipboard!', variant: 'success' })
    } catch (err) {
      showToast({ title: 'Failed to copy to clipboard', variant: 'error' })
    }
  }

  // Download handler
  const handleDownload = (text: string, filename: string) => downloadTextAsFile(text, filename)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-85px)]">
        <div className="flex flex-col items-center gap-3">
          <Loader className='size-6! text-blue-500' />
          <p className="text-sm text-zinc-500">Loading run...</p>
        </div>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="py-8">
        <button
          onClick={() => router.push('/dashboard/agent-mode')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-6 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Workflows
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <XCircle className="mx-auto size-10 text-red-400 mb-3" />
          <p className="text-base font-semibold text-red-800">{error || 'Run not found'}</p>
          <p className="text-sm text-red-600 mt-1">This run may have been deleted or you don't have access.</p>
        </div>
      </div>
    )
  }

  const runStatusCfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.queued
  const RunStatusIcon = runStatusCfg.icon

  return (
    <div>
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h2 className="hidden lg:flex text-2xl font-semibold text-zinc-800">Build a Chain</h2>
        <p className="text-sm sm:text-base text-neutral-500 lg:mt-1">Chain team members together — output from each member flows into the next.</p>
      </div>

      {/* Stepper container with overlay scroll arrows */}
      <div className="relative w-full flex items-center mb-4 sm:mb-6 md:mb-8 select-none group">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute -left-4.5 z-10 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-[0_3px_10px_rgba(0,0,0,0.08)] hover:bg-zinc-50 active:scale-95 transition-all focus:outline-none cursor-pointer text-[#414651]"
          >
            <ChevronLeft className='size-4' />
          </button>
        )}
        {/* Scrollable track */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex-1 overflow-x-auto flex min-w-[151px] sm:min-w-[190px] md:min-w-[237px] w-fit gap-2 md:gap-3 lg:gap-4 no-scrollbar scroll-smooth p-1 bg-[#FAFAFA] border border-zinc-200 rounded-[10px] md:p-0 md:bg-transparent md:border-0 md:rounded-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {steps.map((step) => (
            <StepperItem
              key={step.position}
              name={step.name}
              role={step.role}
              avatarSrc={step.avatarSrc}
              status={step.status}
              isSelected={selectedStep === step.position}
              onClick={() => setSelectedStep(step.position)}
            />
          ))}
          <StepperItem
            name="Finish"
            status={allDone && completedResults.length > 0 ? 'completed' : 'queued'}
            isSelected={isFinishSelected}
            isFinish
            onClick={() => setSelectedStep(-1)}
          />
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute -right-4.5 z-10 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-[0_3px_10px_rgba(0,0,0,0.08)] hover:bg-zinc-50 active:scale-95 transition-all focus:outline-none cursor-pointer text-[#414651]"
          >
            <ChevronRight className='size-4' />
          </button>
        )}
      </div>

      {/* Content area */}
      {(run.status === 'running' || run.status === 'queued') && !selectedResult && !isFinishSelected && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-8 text-center">
          <Loader2 className="mx-auto size-8 text-blue-500 animate-spin mb-3" />
          <p className="text-base font-semibold text-blue-800">
            {run.status === 'queued' ? 'Starting chain...' : 'Running...'}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            {workerResults.filter(r => r.status === 'completed').length} of {steps.length} workers completed
          </p>
        </div>
      )}

      {/* Show Finish view */}
      {isFinishSelected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4 sm:mb-2 flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Final Deliverables</h2>
            {completedResults.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const allOutput = completedResults.map(r => {
                      const meta = workerRegistry.find(reg => reg.slug === r.worker_id)
                      return `## ${meta?.personaName ?? r.worker_id} — ${meta?.name ?? ''}\n\n${r.output}`
                    }).join('\n\n---\n\n')
                    await handleCopy(allOutput)
                    setCopiedAll(true)
                    setTimeout(() => setCopiedAll(false), 3000)
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  {copiedAll ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                  {copiedAll ? 'Copied!' : 'Copy All'}
                </button>
                <DownloadDropdown
                  content={completedResults.map(r => {
                    const meta = workerRegistry.find(reg => reg.slug === r.worker_id)
                    return `## ${meta?.personaName ?? r.worker_id} — ${meta?.name ?? ''}\n\n${r.output}`
                  }).join('\n\n---\n\n')}
                  slug="combined-report"
                  taskId={run.id}
                  variant="border-button"
                  align="right"
                />
              </div>
            )}
          </div>

          {completedResults.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
              <p className="text-sm text-zinc-500">No completed outputs available.</p>
            </div>
          ) : (
            completedResults.map((result) => {
              const meta = workerRegistry.find(reg => reg.slug === result.worker_id)
              return (
                <div key={result.position} className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-xs">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-100">
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-emerald-200">
                      <Image
                        src={`/images/marketing/workers-figma/${(meta?.personaName ?? result.worker_id).toLowerCase()}.png`}
                        alt={meta?.personaName ?? result.worker_id}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{meta?.personaName ?? result.worker_id}</p>
                      <p className="text-xs text-zinc-500">{meta?.name ?? ''}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {!(
                        meta?.outputFormat === 'images' ||
                        meta?.outputFormat === 'clips' ||
                        meta?.categorySlug === 'video' ||
                        (meta?.categorySlug === 'audio-voice' &&
                          meta?.slug !== 'transcription-specialist' &&
                          meta?.slug !== 'meeting-notes-writer')
                      ) && (
                          <button
                            onClick={async () => {
                              await handleCopy(result.output ?? '')
                              setCopiedResultId(result.worker_id)
                              setTimeout(() => setCopiedResultId(null), 3000)
                            }}
                            className="flex items-center justify-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer size-9"
                            title="Copy Output"
                          >
                            {copiedResultId === result.worker_id ? (
                              <Check className="size-4 text-green-600" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>
                        )}
                      {!(
                        meta?.outputFormat === 'images' ||
                        meta?.outputFormat === 'clips' ||
                        meta?.categorySlug === 'video' ||
                        (meta?.categorySlug === 'audio-voice' &&
                          meta?.slug !== 'transcription-specialist' &&
                          meta?.slug !== 'meeting-notes-writer')
                      ) && (
                          <DownloadDropdown
                            content={result.output ?? ''}
                            slug={result.worker_id}
                            taskId={run.id}
                            settings={(() => {
                              const step = chainWorkers.find(w => w.worker_id === result.worker_id)
                              return step ? (step.settings || step.form_settings || {}) : {}
                            })()}
                            variant="icon"
                            align="right"
                          />
                        )}
                    </div>
                  </div>
                  {meta?.outputFormat === 'images' ? (
                    <ImageGallery
                      output={result.output ?? ''}
                      workerSlug={result.worker_id}
                      taskId={parseMediaTaskId(result.output ?? '') || run.id}
                      brandName={(() => {
                        const step = chainWorkers.find(w => w.worker_id === result.worker_id)
                        const settings = step ? (step.settings || step.form_settings || {}) : {}
                        return settings.brand_name || ''
                      })()}
                    />
                  ) : (
                    (() => {
                      const isAudioWorker =
                        meta?.categorySlug === 'audio-voice' &&
                        meta?.slug !== 'transcription-specialist' &&
                        meta?.slug !== 'meeting-notes-writer'
                      const hasAudioUrl = /\[Download audio\]/i.test(result.output ?? '')
                      const isVideoWorker = meta?.categorySlug === 'video'
                      const hasVideoUrl = /\[Download video\]/i.test(result.output ?? '')
                      if (isAudioWorker || hasAudioUrl) {
                        return <AudioPlayer output={result.output ?? ''} />
                      }
                      if (isVideoWorker || hasVideoUrl) {
                        return <VideoPlayer output={result.output ?? ''} />
                      }
                      if (result.worker_id === 'kpi-dashboard-writer') {
                        return <BrodyOutput output={result.output ?? ''} isEditable={false} />
                      }
                      return (
                        <div
                          className="tiptap-editor-content prose prose-sm prose-zinc max-w-none text-zinc-800
                                      prose-headings:font-semibold prose-headings:text-zinc-900
                                      prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                                      prose-p:leading-relaxed prose-p:text-zinc-700
                                      prose-li:text-zinc-700 prose-li:leading-relaxed
                                      prose-strong:text-zinc-900 prose-strong:font-semibold
                                      prose-code:text-zinc-800 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                                      prose-pre:bg-white prose-pre:text-zinc-700 prose-pre:rounded-lg prose-pre:text-xs
                                      prose-pre:border
                                      prose-pre:border-zinc-100
                                      prose-blockquote:border-l-blue-300 prose-blockquote:text-zinc-500
                                      prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                                      prose-hr:border-zinc-200
                                      prose-table:text-sm prose-th:text-zinc-700 prose-td:text-zinc-600"
                          dangerouslySetInnerHTML={{
                            __html: toHtml(result.output ?? '')
                          }}
                        />
                      )
                    })()
                  )}
                </div>
              )
            })
          )}

          {/* Credits summary */}
          {(run.total_light_consumed > 0 || run.total_heavy_consumed > 0) && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
              Credits used: {[
                run.total_light_consumed > 0 ? `${run.total_light_consumed} light` : null,
                run.total_heavy_consumed > 0 ? `${run.total_heavy_consumed} heavy` : null,
              ].filter(Boolean).join(' + ')}
              {(run.total_light_refunded + run.total_heavy_refunded > 0) && (
                <span className="text-emerald-600 ml-1">
                  ({[
                    run.total_light_refunded > 0 ? `${run.total_light_refunded} light` : null,
                    run.total_heavy_refunded > 0 ? `${run.total_heavy_refunded} heavy` : null,
                  ].filter(Boolean).join(' + ')} refunded)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Show selected worker's output */}
      {selectedResult && !isFinishSelected && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs transition-shadow duration-200 hover:shadow-sm">
          {/* Step Header */}
          {selectedResult.status === 'completed' && (
            <div className="flex items-center gap-3 p-4 sm:px-6 sm:pt-6 sm:pb-3 border-b border-zinc-100">
              <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-blue-200">
                <Image
                  src={selectedWorkerMeta?.avatarSrc || `/images/marketing/workers-figma/${selectedResult.worker_id}.png`}
                  alt={selectedWorkerMeta?.name ?? selectedResult.worker_id}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">{selectedWorkerMeta?.name ?? selectedResult.worker_id}</p>
                <p className="text-xs text-zinc-500">{selectedWorkerMeta?.role ?? ''}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!(
                  selectedWorkerMeta?.outputFormat === 'images' ||
                  selectedWorkerMeta?.outputFormat === 'clips' ||
                  selectedWorkerMeta?.categorySlug === 'video' ||
                  (selectedWorkerMeta?.categorySlug === 'audio-voice' &&
                    selectedWorkerMeta?.slug !== 'transcription-specialist' &&
                    selectedWorkerMeta?.slug !== 'meeting-notes-writer')
                ) && (
                  <button
                    onClick={async () => {
                      await handleCopy(selectedResult.output ?? '')
                      setCopiedResultId(selectedResult.worker_id)
                      setTimeout(() => setCopiedResultId(null), 3000)
                    }}
                    className="flex items-center justify-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer size-9"
                    title="Copy Output"
                  >
                    {copiedResultId === selectedResult.worker_id ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                )}
                {!(
                  selectedWorkerMeta?.outputFormat === 'images' ||
                  selectedWorkerMeta?.outputFormat === 'clips' ||
                  selectedWorkerMeta?.categorySlug === 'video' ||
                  (selectedWorkerMeta?.categorySlug === 'audio-voice' &&
                    selectedWorkerMeta?.slug !== 'transcription-specialist' &&
                    selectedWorkerMeta?.slug !== 'meeting-notes-writer')
                ) && (
                  <DownloadDropdown
                    content={selectedResult.output ?? ''}
                    slug={selectedResult.worker_id}
                    taskId={run.id}
                    settings={(() => {
                      const step = chainWorkers.find(w => w.worker_id === selectedResult.worker_id)
                      return step ? (step.settings || step.form_settings || {}) : {}
                    })()}
                    variant="icon"
                    align="right"
                  />
                )}
              </div>
            </div>
          )}
          {/* Output content */}
          <div className="p-4 sm:p-6">
            {selectedResultIsLoading && (
              <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-3">
                  <Loader className="size-6! text-blue-500" />
                  <p className="text-sm text-zinc-400">Loading run data...</p>
                </div>
              </div>
            )}
            {selectedResult.status === 'completed' && selectedResult.output ? (
              (() => {
                const workerReg = workerRegistry.find(r => r.slug === selectedResult.worker_id)
                const isAudioWorker =
                  workerReg?.categorySlug === 'audio-voice' &&
                  workerReg?.slug !== 'transcription-specialist' &&
                  workerReg?.slug !== 'meeting-notes-writer'
                const isVideoWorker = workerReg?.categorySlug === 'video'

                if (isAudioWorker || hasAudioLink(selectedResult.output ?? '')) {
                  return <AudioPlayer output={selectedResult.output ?? ''} />
                }
                if (isVideoWorker || hasVideoLink(selectedResult.output ?? '')) {
                  return <VideoPlayer output={selectedResult.output ?? ''} />
                }
                if (selectedWorkerMeta?.outputFormat === 'images') {
                  return (
                    <ImageGallery
                      output={selectedResult.output ?? ''}
                      workerSlug={selectedResult.worker_id}
                      taskId={parseMediaTaskId(selectedResult.output ?? '') || run.id}
                      brandName={(() => {
                        const step = chainWorkers.find(w => w.worker_id === selectedResult.worker_id)
                        const settings = step ? (step.settings || step.form_settings || {}) : {}
                        return settings.brand_name || ''
                      })()}
                    />
                  )
                }
                if (selectedResult.worker_id === 'kpi-dashboard-writer') {
                  return (
                    <BrodyOutput
                      output={selectedResult.output ?? ''}
                      editorRef={editorRef}
                      isEditable={true}
                    />
                  )
                }
                if (selectedWorkerMeta?.outputFormat === 'markdown' || selectedWorkerMeta?.outputFormat === 'html') {
                  return (
                    <TiptapEditor
                      ref={editorRef}
                      initialHtml={toHtml(selectedResult.output ?? '')}
                      onUpdate={() => { }}
                      autoSaveMs={500}
                    />
                  )
                }
                return (
                  <div className="prose prose-sm max-w-none text-zinc-800 whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedResult.output}
                  </div>
                )
              })()
            ) : selectedResult.status === 'failed' ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-800 mb-1">Worker Failed</p>
                <p className="text-sm text-red-600">{selectedResult.error ?? 'An unknown error occurred'}</p>
              </div>
            ) : selectedResult.status === 'skipped' ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm text-zinc-500 italic">Skipped — upstream team member failed</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* If no step selected and run is done but nothing is selected yet */}
      {!selectedResult && !isFinishSelected && allDone && (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-zinc-500">Click a step above to view its output, or click Finish for all deliverables.</p>
        </div>
      )}
    </div>
  )
}
