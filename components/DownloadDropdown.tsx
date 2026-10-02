'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import { Loader } from '@/components/loader'
import * as Popover from '@radix-ui/react-popover'
import { useToast } from '@/components/toast-provider'
import {
  downloadDocx,
  downloadPdf,
  downloadCsv,
  downloadXlsx,
  downloadPptx,
  downloadResumeDocx,
  downloadResumePdf,
  downloadBrodyXlsx,
  downloadCadeXlsx,
  downloadCadeCleanedXlsx,
  downloadCadeCleanedCsv,
  downloadCaraCsv
} from '@/lib/downloads'
import { stripMediaForDownload } from '@/lib/media-output/parsers'

const DOWNLOAD_FORMATS: Record<string, string[]> = {
  'customer-support-writer': ['docx', 'pdf', 'csv'],
  'data-cleaner': ['xlsx-cleaned', 'xlsx-changelog', 'pdf-report'],
  'lead-generator': ['csv'],
  'bookkeeping-summarizer': ['pdf', 'xlsx'],
  'kpi-dashboard-writer': ['pdf', 'docx', 'xlsx'],
  'spreadsheet-builder': ['xlsx'],
  'pitch-deck-writer': ['pptx', 'pdf', 'docx'],
  'presentation-builder': ['pptx', 'pdf', 'docx'],
  'thumbnail-designer': [],
  'logo-concept-generator': [],
  'social-media-graphics-designer': [],
  'customer-review-responder': [],
  'product-video-creator': [],
  'b-roll-generator': [],
  'scene-director': [],
  'ad-creative-generator': [],
  'voiceover-artist': [],
  'sound-effects-designer': [],
  'image-cleanup': [],
  'website-builder': [],
  'personal-brand-strategist': [],
}

function getDownloadFormats(slug: string): string[] {
  if (slug in DOWNLOAD_FORMATS) return DOWNLOAD_FORMATS[slug]
  return ['docx', 'pdf']
}

const FORMAT_LABELS: Record<string, string> = {
  docx: '📄 Download as Word (.docx)',
  pdf: '📋 Download as PDF',
  csv: '📊 Download as CSV',
  xlsx: '📈 Download as Excel (.xlsx)',
  pptx: '📽️ Download as PowerPoint',
  'xlsx-cleaned': '🧹 Cleaned Data (.xlsx)',
  'csv-cleaned': '🧹 Cleaned Data (.csv)',
  'xlsx-changelog': '📋 Change Log (.xlsx)',
  'pdf-report': '📄 Change Report (PDF)',
  txt: '📝 Plain Text (.txt)',
  md: '📝 Markdown (.md)',
}

function getCadeDownloadFormats(outputFormatPref: string): string[] {
  const csvPrefs = ['Cleaned CSV + change report', 'Match the original file format']
  const cleanedFmt = csvPrefs.includes(outputFormatPref) ? 'csv-cleaned' : 'xlsx-cleaned'
  return [cleanedFmt, 'xlsx-changelog', 'pdf-report']
}

export interface DownloadDropdownProps {
  content: string
  slug: string
  taskId: string
  settings?: Record<string, any>
  taskOutput?: Record<string, any>
  variant?: 'icon' | 'button' | 'menu' | 'border-button'
  align?: 'left' | 'right'
  className?: string
  buttonStyle?: React.CSSProperties
  onDownloadingChange?: (downloading: boolean) => void
}

export default function DownloadDropdown({
  content,
  slug,
  taskId,
  settings = {},
  taskOutput,
  variant = 'icon',
  align = 'right',
  className = '',
  buttonStyle = {},
  onDownloadingChange
}: DownloadDropdownProps) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null)
  const { showToast } = useToast()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onDownloadingChange?.(downloading)
  }, [downloading, onDownloadingChange])

  // Close dropdown on outside click
  // useEffect(() => {
  //   function handleClickOutside(e: MouseEvent) {
  //     if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
  //       setDownloadOpen(false)
  //     }
  //   }
  //   document.addEventListener('mousedown', handleClickOutside)
  //   return () => document.removeEventListener('mousedown', handleClickOutside)
  // }, [])

  const isCombined = slug === 'combined-report'

  // Determine available formats
  const formats = isCombined
    ? (() => {
      const base = ['pdf', 'docx', 'txt', 'md']
      // Check for table data: has at least two lines starting with |
      const lines = (content || '').split('\n')
      let tableLineCount = 0
      let hasTable = false
      for (const line of lines) {
        if (line.trim().startsWith('|') && line.includes('|')) {
          tableLineCount++
          if (tableLineCount >= 2) {
            hasTable = true
            break
          }
        }
      }
      return hasTable ? [...base, 'xlsx'] : base
    })()
    : slug === 'data-cleaner'
      ? getCadeDownloadFormats(settings?.output_format || '')
      : slug === 'customer-support-writer'
        ? (() => {
          const agentTypes = ['Canned Responses', 'Complaint Responses', 'Refund Templates']
          const raw = settings?.content_type || ''
          const selected = Array.isArray(raw)
            ? raw
            : typeof raw === 'string'
              ? raw.split(',').map(s => s.trim()).filter(Boolean)
              : []
          const isAgentFacing = selected.some(t => agentTypes.includes(t))
          return isAgentFacing ? ['docx', 'pdf', 'csv'] : ['docx', 'pdf']
        })()
        : getDownloadFormats(slug)

  if (formats.length === 0) return null

  const handleDownloadFormat = async (format: string) => {
    setDownloadingFormat(format)
    setDownloading(true)
    try {
      if (isCombined) {
        // Strip media from combined content for non-xlsx formats
        const cleanContent = format === 'xlsx' ? content : stripMediaForDownload(content)
        const baseFilename = `combined-report-${taskId?.slice(0, 8) || 'run'}`

        if (format === 'pdf') {
          await downloadPdf(cleanContent, 'combined-report', taskId)
        } else if (format === 'docx') {
          await downloadDocx(cleanContent, 'combined-report', taskId)
        } else if (format === 'txt') {
          const blob = new Blob([cleanContent], { type: 'text/plain;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${baseFilename}.txt`
          a.click()
          URL.revokeObjectURL(url)
        } else if (format === 'md') {
          const blob = new Blob([cleanContent], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${baseFilename}.md`
          a.click()
          URL.revokeObjectURL(url)
        } else if (format === 'xlsx') {
          await downloadXlsx(cleanContent, 'combined-report', taskId)
        }
        showToast({ title: 'Download completed successfully!', variant: 'success' })
        return
      }
      // Brody (kpi-dashboard-writer): PDF via /api/report-pdf, DOCX via downloadDocx, XLSX via downloadXlsx
      if (slug === 'kpi-dashboard-writer') {
        const brodyTitle = settings.business_description
          ? `Key Metrics Framework - ${settings.business_description.slice(0, 50)}`
          : 'Key Metrics Framework'
        if (format === 'pdf') {
          const supabase = (await import('@/lib/supabase/client')).createClient()
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token || ''
          const res = await fetch('/api/report-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content, title: brodyTitle, taskId, workerSlug: slug }),
          })
          if (!res.ok) throw new Error('PDF generation failed')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `kpi-framework-${taskId?.slice(0, 8) || 'brody'}.pdf`
          a.click()
          URL.revokeObjectURL(url)
        } else if (format === 'docx') {
          await downloadDocx(content, slug, taskId)
        } else if (format === 'xlsx') {
          await downloadBrodyXlsx(content, taskId, (taskOutput?.metricData as any) ?? null)
        }
        showToast({ title: 'Download completed successfully!', variant: 'success' })
        return
      }

      // Bella (bookkeeping-summarizer): PDF via /api/report-pdf, XLSX via existing downloadXlsx
      if (slug === 'bookkeeping-summarizer') {
        const bellaTitle = settings.time_period ? `Bookkeeping Summary - ${settings.time_period}` : 'Bookkeeping Summary'
        if (format === 'pdf') {
          const supabase = (await import('@/lib/supabase/client')).createClient()
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token || ''
          const res = await fetch('/api/report-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content, title: bellaTitle, taskId, workerSlug: slug }),
          })
          if (!res.ok) throw new Error('PDF generation failed')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `bookkeeping-${taskId?.slice(0, 8) || 'summary'}.pdf`
          a.click()
          URL.revokeObjectURL(url)
        } else if (format === 'xlsx') {
          await downloadXlsx(content, slug, taskId)
        }
        showToast({ title: 'Download completed successfully!', variant: 'success' })
        return
      }

      // Cade (data-cleaner): 3 distinct files
      if (slug === 'data-cleaner') {
        const dataType = settings.data_type || 'Data'
        const cadeTitle = `Data Cleaning Report - ${dataType}`
        const idPart = taskId?.slice(0, 8) || 'report'

        if (format === 'pdf-report') {
          const supabase = (await import('@/lib/supabase/client')).createClient()
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token || ''
          const res = await fetch('/api/report-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content, title: cadeTitle, taskId, workerSlug: slug }),
          })
          if (!res.ok) throw new Error('PDF generation failed')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `data-cleaner-${idPart}-report.pdf`
          a.click()
          URL.revokeObjectURL(url)
        } else if (format === 'xlsx-cleaned') {
          await downloadCadeCleanedXlsx(content, taskId)
        } else if (format === 'csv-cleaned') {
          downloadCadeCleanedCsv(content, taskId)
        } else if (format === 'xlsx-changelog') {
          await downloadCadeXlsx(content, taskId, (taskOutput?.cadeData as any) ?? null)
        }
        showToast({ title: 'Download completed successfully!', variant: 'success' })
        return
      }

      // Beck (resume-writer)
      if (slug === 'resume-writer') {
        const resumeTemplate = settings.template || 'classic'
        if (format === 'docx') {
          await downloadResumeDocx(content, taskId, resumeTemplate)
        } else if (format === 'pdf') {
          const supabase = (await import('@/lib/supabase/client')).createClient()
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token || ''
          await downloadResumePdf(content, taskId, resumeTemplate, token)
        }
        showToast({ title: 'Download completed successfully!', variant: 'success' })
        return
      }

      if (format === 'docx') await downloadDocx(content, slug, taskId)
      else if (format === 'pdf') await downloadPdf(content, slug, taskId)
      else if (format === 'csv' && slug === 'customer-support-writer') {
        downloadCaraCsv(content, settings, taskId)
      }
      else if (format === 'csv') downloadCsv(content, slug, taskId)
      else if (format === 'xlsx') await downloadXlsx(content, slug, taskId)
      else if (format === 'pptx') await downloadPptx(content, slug, taskId)

      showToast({ title: 'Download completed successfully!', variant: 'success' })
    } catch (err) {
      console.error('Download failed:', err)
      showToast({ title: 'Download failed. Please try again.', variant: 'error' })
    } finally {
      setDownloading(false)
      setDownloadingFormat(null)
      setDownloadOpen(false)
    }
  }

  return (
    <Popover.Root open={downloadOpen} onOpenChange={setDownloadOpen}>
      <Popover.Trigger asChild>
        <div ref={dropdownRef} className={`download-dropdown-container relative ${className}`}>
          {variant === 'icon' ? (
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              disabled={downloading}
              className="flex items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors cursor-pointer size-9 disabled:opacity-50"
              title="Download Options"
              style={buttonStyle}
            >
              {downloading ? (
                <Loader size={4} className="!size-4" />
              ) : (
                <Download className="size-4" />
              )}
            </button>
          ) : variant === 'border-button' ? (
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer disabled:opacity-50"
              style={{
                ...(downloading ? { fontSize: '10px' } : {}),
                ...buttonStyle,
              }}
            >
              {downloading ? (
                <Loader size={4} className="!size-4 shrink-0" />
              ) : (
                <Download className="size-3.5 shrink-0" />
              )}
              {downloading ? 'Downloading...' : 'Download'}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-0.5 text-zinc-500">
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : variant === 'menu' ? (
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              disabled={downloading}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              style={buttonStyle}
            >
              {downloading ? (
                <Loader size={4} className="!size-4" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M7 1.5v7m0 0L4.5 6m2.5 2.5L9.5 6M2 11h10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {downloading ? 'Downloading…' : 'Download'}
            </button>
          ) : (
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              disabled={downloading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                background: downloading ? '#3b82f6aa' : '#2563eb',
                fontSize: downloading ? '10px' : '14px',
                height: "37px",
                fontWeight: '600',
                color: 'white',
                cursor: downloading ? 'not-allowed' : 'pointer',
                opacity: downloading ? 0.7 : 1,
                whiteSpace: 'nowrap',
                transition: 'background 0.15s',
                ...buttonStyle,
                ...(downloading ? { fontSize: '10px' } : {}),
              }}
              onMouseEnter={(e) => {
                if (!downloading && !buttonStyle.background) e.currentTarget.style.background = '#1d4ed8'
              }}
              onMouseLeave={(e) => {
                if (!downloading && !buttonStyle.background) e.currentTarget.style.background = '#2563eb'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1.5v7m0 0L4.5 6m2.5 2.5L9.5 6M2 11h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {downloading ? 'Downloading…' : 'Download'}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: '2px' }}>
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align={align === 'right' ? 'end' : 'start'}
          sideOffset={6}
          collisionPadding={16}
          className="z-[100] min-w-[200px] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {formats.map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleDownloadFormat(fmt)}
              disabled={downloading}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors cursor-pointer disabled:opacity-60"
            >
              {downloadingFormat === fmt ? (
                <Loader size={3} className="!size-3.5 flex-shrink-0" />
              ) : null}
              {FORMAT_LABELS[fmt] || fmt}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
