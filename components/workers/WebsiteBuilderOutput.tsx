// @ts-nocheck
'use client'
// WebsiteBuilderOutput — Silas (website-builder) result UI
// Handles: live preview iframe, section refinement, section add/delete/reorder,
// ZIP download, WordPress push, Google Drive push, generate alternative version.

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStoredWorkspaceId } from '@/lib/workspace-client'
import Link from 'next/link'
import { Button } from '../ui/button'
import { Select } from '@/components/select'
import { Loader } from '@/components/loader'
import { useToast } from '@/components/toast-provider'

// ── Section management helpers ────────────────────────────────────────────

function assembleSite(artifact) {
  if (!artifact?.sections) return ''
  const sections = Object.values(artifact.sections).sort((a, b) => a.order - b.order)
  const sectionsHtml = sections.map(s => s.html || '').join('\n')
  const sectionsCss = sections.map(s => s.css || '').filter(Boolean).join('\n')
  const tailwindTag = artifact.shared?.tailwind_cdn !== false
    ? '<script src="https://cdn.tailwindcss.com"></script>'
    : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${tailwindTag}
${artifact.shared?.head_html || ''}
<style>
${artifact.shared?.global_css || ''}
${sectionsCss}
</style>
</head>
<body>
${sectionsHtml}
<script>
${artifact.shared?.global_js || ''}
</script>
</body>
</html>`
}

const PREVIEW_WIDTHS = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

const PAGE_TYPE_LABELS = {
  landing: 'Landing Page',
  coming_soon: 'Coming Soon',
  lead_magnet: 'Lead Magnet',
  sales_page: 'Sales Page',
  service_business: 'Service Business Page',
}

const SECTION_TYPES = [
  'hero', 'features', 'pricing', 'faq', 'cta', 'footer', 'testimonials',
  'social_proof', 'about', 'services', 'process', 'contact', 'email_capture',
  'pain_agitation', 'interest', 'desire', 'guarantee', 'risk_reversal', 'urgency',
]

export default function WebsiteBuilderOutput({ task, onTaskUpdate, isPanel = false }) {
  const output = task?.output || {}
  const initialArtifact = output.artifact || null
  const businessName = output.businessName || task?.input?.business_name || 'Your Business'
  const businessDescription = task?.input?.business_description || ''
  const pageType = output.pageType || task?.input?.page_type || 'landing'
  const { showToast } = useToast()

  const [sessionKey] = useState(() => Math.random().toString(36).substring(7))
  const [artifact, setArtifact] = useState(initialArtifact)
  const [assembledHtml, setAssembledHtml] = useState(() => assembleSite(initialArtifact))
  const [previewDevice, setPreviewDevice] = useState('desktop')

  // Section refinement state
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [refinementInput, setRefinementInput] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState('')

  // Section add state
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionType, setNewSectionType] = useState('testimonials')

  // Export state
  const [exportLoading, setExportLoading] = useState(null)
  const [exportResult, setExportResult] = useState(null)
  const exportTimeoutRef = useRef<any>(null)

  const showExportResult = useCallback((result) => {
    setExportResult(result)
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current)
      exportTimeoutRef.current = null
    }
    // Automatically clear any success result after 1 minute (60,000 ms)
    if (result && result.type === 'success') {
      exportTimeoutRef.current = setTimeout(() => {
        setExportResult(null)
        exportTimeoutRef.current = null
      }, 60000)
    }
  }, [])

  // New version state
  const [generatingNew, setGeneratingNew] = useState(false)

  const iframeRef = useRef(null)

  // Refresh iframe with updated HTML
  const refreshPreview = useCallback((html) => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
    }
  }, [])

  // Sync preview iframe initially and on changes to assembledHtml
  useEffect(() => {
    refreshPreview(assembledHtml)
  }, [assembledHtml, refreshPreview])

  // ── Auth headers helper ────────────────────────────────────────────────
  const getAuthHeaders = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not authenticated. Please refresh and try again.')
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    const wsId = getStoredWorkspaceId()
    if (wsId) headers['x-workspace-id'] = wsId
    return headers
  }, [])

  const updateArtifactAndPreview = useCallback(async (newArtifact) => {
    const newHtml = assembleSite(newArtifact)
    setArtifact(newArtifact)
    setAssembledHtml(newHtml)
    refreshPreview(newHtml)

    try {
      const headers = await getAuthHeaders()
      await fetch('/api/website-builder/save-artifact', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: task.id,
          artifact: newArtifact,
          assembledHtml: newHtml,
        }),
      })
    } catch (err) {
      console.error('Failed to save website artifact:', err)
    }
  }, [task.id, getAuthHeaders, refreshPreview])

  // Sorted sections for dropdown
  const sortedSections = artifact
    ? Object.entries(artifact.sections || {}).sort(([_, a], [__, b]) => a.order - b.order)
    : []

  const sectionsKey = artifact
    ? Object.entries(artifact.sections || {}).map(([id, s]) => `${id}:${s.order}:${s.version || 1}`).join(',')
    : ''

  // ── Section refinement ──────────────────────────────────────────────────
  const handleRefine = async () => {
    if (!selectedSectionId || !refinementInput.trim()) return
    setRefining(true)
    setRefineError('')

    try {
      const headers = await getAuthHeaders()

      const currentSection = artifact.sections[selectedSectionId]
      if (!currentSection) throw new Error('Section not found')

      // Phase 4: server derives pageType, businessName, businessDescription, currentSection, shared from task record
      const res = await fetch('/api/website-builder/refine-section', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: task.id,
          sectionId: selectedSectionId,
          refinementRequest: refinementInput.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refinement failed')

      // Merge updated section back into artifact
      const newArtifact = {
        ...artifact,
        sections: {
          ...artifact.sections,
          [selectedSectionId]: {
            ...artifact.sections[selectedSectionId],
            html: data.html,
            css: data.css,
            version: (artifact.sections[selectedSectionId].version || 1) + 1,
          },
        },
      }
      updateArtifactAndPreview(newArtifact)
      setRefinementInput('')
    } catch (err) {
      setRefineError(err.message)
    } finally {
      setRefining(false)
    }
  }

  // ── Add new section ─────────────────────────────────────────────────────
  const handleAddSection = async () => {
    setAddingSection(true)
    setRefineError('')

    try {
      const headers = await getAuthHeaders()
      const maxOrder = Math.max(...Object.values(artifact.sections).map(s => s.order))

      // Phase 4: server derives pageType, businessName, shared, existingSections from task record
      const res = await fetch('/api/website-builder/add-section', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: task.id,
          sectionType: newSectionType,
          insertAfterOrder: maxOrder,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Add section failed')

      const newSectionId = data.section_id || `${newSectionType}_${Date.now()}`
      const newArtifact = {
        ...artifact,
        sections: {
          ...artifact.sections,
          [newSectionId]: {
            type: data.type || newSectionType,
            order: maxOrder + 1,
            label: data.label || newSectionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            html: data.html,
            css: data.css || '',
            version: 1,
          },
        },
      }
      updateArtifactAndPreview(newArtifact)
    } catch (err) {
      setRefineError(err.message)
    } finally {
      setAddingSection(false)
    }
  }

  // ── Delete section ──────────────────────────────────────────────────────
  const handleDeleteSection = (sectionId) => {
    if (!confirm(`Delete the "${artifact.sections[sectionId]?.label || sectionId}" section?`)) return
    const newSections = { ...artifact.sections }
    delete newSections[sectionId]
    // Re-number orders
    Object.values(newSections).sort((a, b) => a.order - b.order).forEach((s, i) => { s.order = i + 1 })
    const newArtifact = { ...artifact, sections: newSections }
    updateArtifactAndPreview(newArtifact)
    if (selectedSectionId === sectionId) setSelectedSectionId('')
  }

  // ── Move section up/down ────────────────────────────────────────────────
  const handleMoveSection = (sectionId, direction) => {
    const sorted = Object.entries(artifact.sections).sort(([_, a], [__, b]) => a.order - b.order)
    const idx = sorted.findIndex(([id]) => id === sectionId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const newSections = { ...artifact.sections }
    const currentOrder = newSections[sorted[idx][0]].order
    const swapOrder = newSections[sorted[swapIdx][0]].order
    newSections[sorted[idx][0]] = { ...newSections[sorted[idx][0]], order: swapOrder }
    newSections[sorted[swapIdx][0]] = { ...newSections[sorted[swapIdx][0]], order: currentOrder }
    const newArtifact = { ...artifact, sections: newSections }
    updateArtifactAndPreview(newArtifact)
  }

  // ── ZIP download ────────────────────────────────────────────────────────
  const handleDownloadZip = async () => {
    setExportLoading('zip')
    showExportResult(null)
    showToast({
      title: 'Building ZIP...',
      description: 'Generating your website bundle. Please wait...',
      variant: 'default',
      durationMs: 8000,
    })
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/website-builder/download-zip', {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskId: task.id, artifact, assembledHtml, businessName, pageType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ZIP generation failed')

      // Trigger download
      const a = document.createElement('a')
      a.href = data.downloadUrl
      a.download = `${businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-website.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      showToast({
        title: 'ZIP file downloaded!',
        description: 'Website files bundle is ready.',
        variant: 'success',
      })
    } catch (err) {
      showToast({
        title: 'ZIP download failed',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setExportLoading(null)
    }
  }

  // ── Copy HTML ───────────────────────────────────────────────────────────
  const handleCopyHtml = () => {
    navigator.clipboard?.writeText(assembledHtml)
    showToast({
      title: 'Full HTML copied to clipboard.',
      variant: 'success',
    })
  }

  // ── WordPress push ──────────────────────────────────────────────────────
  const handleWordPressPush = async () => {
    setExportLoading('wp')
    showExportResult(null)
    showToast({
      title: 'Pushing to WordPress...',
      description: 'Creating draft page...',
      variant: 'default',
      durationMs: 8000,
    })
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/website-builder/push-wordpress', {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskId: task.id, assembledHtml, businessName, pageType }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.not_connected) throw new Error('WordPress not connected. Add it in Settings → Integrations.')
        if (data.upgrade_required) throw new Error('WordPress push requires a Pro plan or higher.')
        throw new Error(data.error || 'WordPress push failed')
      }
      showExportResult({ type: 'success', message: `✅ Pushed to WordPress as draft. `, editUrl: data.edit_url })
      showToast({
        title: 'Pushed to WordPress!',
        description: 'Draft page created successfully.',
        variant: 'success',
      })
    } catch (err) {
      showExportResult({ type: 'error', message: err.message })
      showToast({
        title: 'WordPress push failed',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setExportLoading(null)
    }
  }

  // ── Google Drive push ───────────────────────────────────────────────────
  const handleDrivePush = async () => {
    setExportLoading('drive')
    showExportResult(null)
    showToast({
      title: 'Saving to Google Drive...',
      description: 'Uploading website files...',
      variant: 'default',
      durationMs: 8000,
    })
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/website-builder/push-gdrive', {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskId: task.id, assembledHtml, businessName, pageType }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.not_connected) throw new Error('Google Drive not connected. Add it in Settings → Integrations.')
        throw new Error(data.error || 'Google Drive push failed')
      }
      showExportResult({ type: 'success', message: `✅ Saved to Google Drive.`, folderUrl: data.folder_url })
      showToast({
        title: 'Saved to Google Drive!',
        description: 'Your folder and files are saved.',
        variant: 'success',
      })
    } catch (err) {
      showExportResult({ type: 'error', message: err.message })
      showToast({
        title: 'Google Drive push failed',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setExportLoading(null)
    }
  }

  if (!artifact) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <svg
              className="h-6 w-6 text-zinc-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.172 9.172a4 4 0 015.656 0m0 5.656a4 4 0 01-5.656 0M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.02 0l-.707.707M6.343 17.657l-.707.707"
              />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-zinc-800">
            Artifact not found
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            We couldn’t load this website artifact. It may have been deleted or not generated yet.
          </p>

          <Button
            onClick={() => window.location.reload()}
            className='mt-8'
            variant='primary'
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-6 w-full">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">
            {businessName} — {PAGE_TYPE_LABELS[pageType] || 'Website'}
          </h3>
          <p className="text-sm text-zinc-500 mt-0.5">{sortedSections.length} sections · {(assembledHtml.length / 1024).toFixed(0)}KB</p>
        </div>
        <button
          onClick={() => {
            const blob = new Blob([assembledHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
          }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium bg-transparent border-none cursor-pointer p-0"
        >
          Open in new tab ↗
        </button>
      </div>

      {/* ── Live preview ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        {/* Preview toolbar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50 gap-2">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Preview</span>
          <div className="flex items-center gap-1">
            {['desktop', 'tablet', 'mobile'].map(d => (
              <button
                key={d}
                onClick={() => setPreviewDevice(d)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  background: previewDevice === d ? '#2563eb' : 'transparent',
                  color: previewDevice === d ? 'white' : '#71717a',
                  transition: 'all 0.1s',
                }}
              >
                {d === 'desktop' ? '🖥' : d === 'tablet' ? '📱' : '📲'} {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {/* iframe container */}
        <div
          style={{
            overflowX: previewDevice !== 'desktop' ? 'auto' : 'hidden',
            background: '#f4f4f5',
            padding: previewDevice !== 'desktop' ? '16px' : '0',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <iframe
            key={`${sessionKey}-${sectionsKey}`}
            ref={iframeRef}
            srcDoc=""
            onLoad={() => refreshPreview(assembledHtml)}
            title="Website preview"
            style={{
              width: PREVIEW_WIDTHS[previewDevice],
              maxWidth: PREVIEW_WIDTHS[previewDevice],
              height: isPanel ? '400px' : '600px',
              border: 'none',
              borderRadius: previewDevice !== 'desktop' ? '12px' : '0',
              boxShadow: previewDevice !== 'desktop' ? '0 4px 24px rgba(0,0,0,0.12)' : 'none',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* ── Section list + management ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="px-3 sm:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-sm font-semibold text-zinc-700">Sections</span>
          <span className="text-xs text-zinc-400">Reorder or delete (free · no credits)</span>
        </div>
        <div className="divide-y divide-zinc-100">
          {sortedSections.map(([id, section], idx) => (
            <div key={id} className="flex items-center gap-3 px-3 sm:px-5 py-3 cursor-pointer">
              <span className="text-xs text-zinc-400 w-5 text-center shrink-0">{section.order}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-zinc-800 truncate block sm:inline">
                    {section.label || section.type}
                  </span>
                  {section.version > 1 && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                      v{section.version}
                    </span>
                  )}
                  <span className="hidden sm:inline-block text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full shrink-0">
                    {section.type}
                  </span>
                </div>
                <div className="sm:hidden text-[10px] text-zinc-400 mt-0.5 truncate font-mono">
                  {section.type}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleMoveSection(id, 'up')}
                  disabled={idx === 0}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-20 hover:bg-zinc-100 transition cursor-pointer"
                  title="Move up"
                >↑</button>
                <button
                  onClick={() => handleMoveSection(id, 'down')}
                  disabled={idx === sortedSections.length - 1}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-20 hover:bg-zinc-100 transition cursor-pointer"
                  title="Move down"
                >↓</button>
                <button
                  onClick={() => {
                    setSelectedSectionId(id)
                    document.getElementById('refine-input')?.focus()
                  }}
                  className="p-1 rounded text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition text-xs font-medium px-2 cursor-pointer"
                  title="Refine this section"
                >Refine</button>
                <button
                  onClick={() => handleDeleteSection(id)}
                  className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  title="Delete section"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
        {/* Add section */}
        <div className="px-3 sm:px-5 py-3.5 border-t border-zinc-100 bg-zinc-50 flex flex-wrap items-center gap-3 rounded-b-2xl">
          <Select
            value={newSectionType}
            onChange={e => setNewSectionType(e.target.value)}
            className="flex-1 min-w-[200px]"
          >
            {SECTION_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </Select>
          <button
            onClick={handleAddSection}
            disabled={addingSection}
            className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50 cursor-pointer"
          >
            {addingSection ? '⏳ Adding…' : '+ Add Section'}
            <span className="text-xs text-zinc-400">1cr</span>
          </button>
        </div>
      </div>

      {/* ── Section refinement ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="px-3 sm:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50 rounded-t-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-sm font-semibold text-zinc-700">Refine a Section</span>
          <span className="text-xs text-zinc-400">1 credit per refinement · other sections stay unchanged</span>
        </div>
        <div className="p-3 sm:p-5 space-y-3 rounded-b-2xl">
          <div className="flex gap-3">
            <Select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              placeholder="Select a section to refine…"
              className="flex-1"
            >
              {sortedSections.map(([id, section]) => (
                <option key={id} value={id}>
                  {section.order}. {section.label || section.type}
                  {section.version > 1 ? ` (v${section.version})` : ''}
                </option>
              ))}
            </Select>
          </div>
          <textarea
            id="refine-input"
            value={refinementInput}
            onChange={e => setRefinementInput(e.target.value)}
            placeholder='What would you like to change? e.g. "Make the headline bolder and add a rocket emoji" or "Change the call-to-action button to orange" or "Add a second benefit bullet point about time savings"'
            rows={3}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {refineError && (
            <p className="text-sm text-red-600">{refineError}</p>
          )}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-xs text-zinc-400">Only the selected section is regenerated. All other sections stay byte-for-byte identical.</p>
            <button
              onClick={handleRefine}
              disabled={refining || !selectedSectionId || !refinementInput.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {refining ? '⏳ Refining…' : '✨ Refine Section · 1 credit'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Export options ── */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-3 sm:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-sm font-semibold text-zinc-700">Export</span>
          <span className="text-xs text-zinc-400">No hosting — you own the files</span>
        </div>
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* ZIP download */}
            <button
              onClick={handleDownloadZip}
              disabled={exportLoading === 'zip'}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-4 text-center hover:bg-zinc-50 transition disabled:opacity-50 cursor-pointer min-h-[116px] justify-center"
            >
              {exportLoading === 'zip' ? (
                <Loader size={6} className="text-blue-600" />
              ) : (
                <span className="text-2xl">📦</span>
              )}
              <span className="text-xs font-semibold text-zinc-700">{exportLoading === 'zip' ? 'Building…' : 'Download ZIP'}</span>
              <span className="text-[10px] text-zinc-400 leading-normal">HTML + CSS + JS + README</span>
            </button>

            {/* Copy HTML */}
            <button
              onClick={handleCopyHtml}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-4 text-center hover:bg-zinc-50 transition cursor-pointer min-h-[116px] justify-center"
            >
              <span className="text-2xl">📋</span>
              <span className="text-xs font-semibold text-zinc-700">Copy HTML</span>
              <span className="text-[10px] text-zinc-400 leading-normal">Single file, inline CSS/JS</span>
            </button>

            {/* WordPress push */}
            <button
              onClick={handleWordPressPush}
              disabled={exportLoading === 'wp'}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-4 text-center hover:bg-zinc-50 transition disabled:opacity-50 cursor-pointer min-h-[116px] justify-center"
            >
              {exportLoading === 'wp' ? (
                <Loader size={6} className="text-blue-600" />
              ) : (
                <span className="text-2xl">🔵</span>
              )}
              <span className="text-xs font-semibold text-zinc-700">{exportLoading === 'wp' ? 'Pushing…' : 'Push to WordPress'}</span>
              <span className="text-[10px] text-zinc-400 leading-normal">Creates draft Page</span>
            </button>

            {/* Google Drive push */}
            <button
              onClick={handleDrivePush}
              disabled={exportLoading === 'drive'}
              className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-4 text-center hover:bg-zinc-50 transition disabled:opacity-50 cursor-pointer min-h-[116px] justify-center"
            >
              {exportLoading === 'drive' ? (
                <Loader size={6} className="text-blue-600" />
              ) : (
                <span className="text-2xl">📁</span>
              )}
              <span className="text-xs font-semibold text-zinc-700">{exportLoading === 'drive' ? 'Saving…' : 'Google Drive'}</span>
              <span className="text-[10px] text-zinc-400 leading-normal">Folder with all files</span>
            </button>
          </div>

          {/* Export result */}
          {exportResult && (
            <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${exportResult.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
              {exportResult.message}
              {exportResult.editUrl && (
                <Link href={exportResult.editUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline font-medium">
                  Edit in WordPress →
                </Link>
              )}
              {exportResult.folderUrl && (
                <Link href={exportResult.folderUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline font-medium">
                  Open in Drive →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Placeholders notice ── */}
      {output.artifact?.placeholders_added?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 sm:px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Placeholders to replace before publishing</p>
          <ul className="space-y-1">
            {output.artifact.placeholders_added.map((p, i) => (
              <li key={i} className="text-sm text-amber-700">• {p}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
