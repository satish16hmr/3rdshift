import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Copy, Save } from 'lucide-react'

import DownloadDropdown from '@/components/DownloadDropdown'
import SendToDropdown from '@/components/integrations/SendToDropdown'

import { createClient } from '@/lib/supabase/client'

interface MobileActionsDropdownProps {
  task: any
  worker: any
  isImageTask: boolean
  isClipsTask: boolean
  isCaptionsTask: boolean
  isPptxTask: boolean
  isAudioTask: boolean
  isVideoTask: boolean
  isLeadsTask: boolean
  isWebsiteTask: boolean
  isEditorWorker: boolean
  editorRef: React.RefObject<any>
  getEditorContent: () => string
  getEditorHTML: () => string
  showToast: (msg: string) => void
  isHumanizable: boolean
  humanizing: boolean
  humanizedText: string
  handleHumanize: () => void
  refining: boolean
  setRefining: (v: boolean) => void
  setDownloading: (v: boolean) => void
  handleSave?: any;
  saving?: any;
  currentTask?: any
}

export default function MobileActionsDropdown({
  task,
  worker,
  isImageTask,
  isClipsTask,
  isCaptionsTask,
  isPptxTask,
  isAudioTask,
  isVideoTask,
  isLeadsTask,
  isWebsiteTask,
  isEditorWorker,
  editorRef,
  getEditorContent,
  getEditorHTML,
  showToast,
  isHumanizable,
  humanizing,
  humanizedText,
  handleHumanize,
  refining,
  setRefining,
  setDownloading,
  handleSave,
  saving,
  currentTask
}: MobileActionsDropdownProps) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Element;
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !target.closest('.send-to-portal-element') &&
        !target.closest('[role="dialog"]')
      ) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative xl:hidden" ref={mobileMenuRef}>
      <button
        className='cursor-pointer'
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <MoreVertical className="size-4 text-zinc-600" />
      </button>

      {mobileMenuOpen && (
        <div className="absolute right-0 top-full mt-2 min-w-[200px] lg:min-w-[260px] rounded-xl border border-zinc-200 bg-white shadow-lg z-50">
          <div className="py-2">
            <button
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
              onClick={handleSave}
              disabled={saving || !currentTask?.id}
            >
              {saving ? (
                <div className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
              ) : (
                <Save className="size-4" />
              )}
              Save
            </button>
            {/* Copy button */}
            {!isImageTask && !isClipsTask && !isCaptionsTask && !isPptxTask && !isAudioTask && !isVideoTask && !isLeadsTask && !isWebsiteTask && (
              <button
                onClick={async () => {
                  if (isEditorWorker && editorRef?.current) {
                    const html = editorRef.current.getHTML()
                    const plain = editorRef.current.getText()
                    try {
                      if (typeof ClipboardItem !== 'undefined') {
                        await navigator.clipboard.write([
                          new ClipboardItem({
                            'text/html': new Blob([html || ''], { type: 'text/html' }),
                            'text/plain': new Blob([plain || ''], { type: 'text/plain' }),
                          })
                        ])
                        showToast('Copied to clipboard')
                      } else {
                        navigator.clipboard?.writeText(plain || '')
                        showToast('Copied to clipboard')
                      }
                    } catch {
                      navigator.clipboard?.writeText(plain || '')
                      showToast('Copied to clipboard')
                    }
                  } else {
                    const textToCopy = getEditorContent()
                    navigator.clipboard?.writeText(textToCopy)
                    showToast('Copied to clipboard')
                  }
                  setMobileMenuOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
              >
                <Copy className="size-4" />
                Copy
              </button>
            )}

            {/* Download button with nested options */}
            {!isImageTask && !isClipsTask && !isCaptionsTask && !isPptxTask && !isAudioTask && !isLeadsTask && !isWebsiteTask && (
              <DownloadDropdown
                content={isEditorWorker
                  ? (getEditorHTML() || task?.output?.text || '')
                  : (task?.output?.text) || ''
                }
                slug={task?.worker_slug || ''}
                taskId={task?.id || ''}
                settings={task?.input || {}}
                variant="menu"
                align="right"
                onDownloadingChange={setDownloading}
              />
            )}

            {/* Chat button */}
            <button
              onClick={() => {
                router.push(`/dashboard/team/${task?.worker_slug}?tab=chat&taskId=${task.id}`)
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
            >
              💬
              <span>Chat with {worker?.personaName || worker?.name?.split(' ')[0] || 'them'}</span>
            </button>

            {/* Resume/Cover letter special buttons */}
            {task?.worker_slug === 'resume-writer' && (
              <button
                onClick={() => {
                  router.push('/dashboard/team/resume-writer')
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
              >
                ✉️
                <span>Write cover letter with Beck</span>
              </button>
            )}

            {task?.worker_slug === 'cover-letter-writer' && (
              <button
                onClick={() => {
                  router.push('/dashboard/team/resume-writer')
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
              >
                📄
                <span>Write resume with Beck</span>
              </button>
            )}

            {/* Send To dropdown - simplified version */}
            {!isWebsiteTask && task?.id && (
              <div className="border-t border-zinc-100 my-1 pt-3 px-4">
                <SendToDropdown
                  taskId={task?.id}
                  workerSlug={task?.worker_slug}
                  title={((['topic', 'subject', 'title', 'keyword', 'company_name', 'product_name', 'task_description', 'task_input'].map(k => task?.input?.[k]).find(v => typeof v === 'string' && v?.length > 3) || Object.values(task?.input || {}).find(v => typeof v === 'string' && v?.length > 3))?.slice?.(0, 60))}
                />
              </div>
            )}

            {/* Humanize button */}
            {isHumanizable && (
              <button
                onClick={() => {
                  handleHumanize()
                  setMobileMenuOpen(false)
                }}
                disabled={humanizing || !!humanizedText}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                {humanizing ? (
                  <>
                    <div className="size-4 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
                    Humanizing…
                  </>
                ) : humanizedText ? (
                  <>
                    ✨
                    <span>Humanized</span>
                  </>
                ) : (
                  <>
                    ✨
                    <span>Humanize</span>
                  </>
                )}
              </button>
            )}

            {/* Refine for image tasks */}
            {isImageTask && task?.worker_slug !== 'logo-concept-generator' && (
              <button
                onClick={async () => {
                  if (refining) return
                  setRefining(true)
                  try {
                    const supabase = createClient()
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) return
                    const varRes = await fetch('/api/tasks/refine', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                      body: JSON.stringify({
                        original_task_id: task.id,
                        refine_input: { ...(task.input || {}), _refine_variation: true },
                      }),
                    })
                    if (!varRes.ok) { setRefining(false); return }
                    const varData = await varRes.json()
                    router.push(`/dashboard/tasks/result?taskId=${varData.taskId}`)
                  } catch { setRefining(false) }
                  setMobileMenuOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
              >
                🔄
                <span>{refining ? 'Refining…' : 'Refine'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
