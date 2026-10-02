'use client'

import React, { useState } from 'react'
import { Copy, Check, FileJson } from 'lucide-react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import dynamic from 'next/dynamic'

const TiptapEditor = dynamic(() => import('@/components/TiptapEditor'), {
  ssr: false,
}) as any

export interface BrodyMetricItem {
  name?: string
  title?: string
  metric?: string
  definition?: string
  description?: string
  formula?: string
  calculation?: string
  dataSource?: string
  source?: string
  data_source?: string
  frequency?: string
  period?: string
  target?: string
  goal?: string
  [key: string]: any
}

export interface BrodyMetricCategories {
  northStar?: BrodyMetricItem[]
  inputMetrics?: BrodyMetricItem[]
  outputMetrics?: BrodyMetricItem[]
  guardrailMetrics?: BrodyMetricItem[]
  [key: string]: any
}

export interface ParsedBrodyOutput {
  prose: string
  metricData: BrodyMetricCategories | null
  rawJsonString: string | null
}

/**
 * Extract raw JSON block from Brody's output text and clean prose markdown.
 */
export function parseBrodyOutput(
  rawText: string | null | undefined,
  metricDataProp?: BrodyMetricCategories | null
): ParsedBrodyOutput {
  let prose = (rawText || '').trim()
  let metricData: BrodyMetricCategories | null = metricDataProp || null
  let rawJsonString: string | null = null

  if (prose) {
    // 1. Try matching code block delimiters: ```metric-data, ```metricData, ```json, ```
    const codeBlockRegex = /```(?:metric-data|metricData|json)?\s*([\s\S]*?)```/gi
    let match: RegExpExecArray | null = null
    let lastJsonMatch: string | null = null

    while ((match = codeBlockRegex.exec(prose)) !== null) {
      const codeContent = match[1].trim()
      if (codeContent.startsWith('{') && codeContent.endsWith('}')) {
        try {
          const parsed = JSON.parse(codeContent)
          if (typeof parsed === 'object' && parsed !== null) {
            lastJsonMatch = match[0]
            metricData = parsed
            rawJsonString = JSON.stringify(parsed, null, 2)
          }
        } catch {
          // ignore malformed block
        }
      }
    }

    if (lastJsonMatch) {
      prose = prose.replace(lastJsonMatch, '').trimEnd()
    } else {
      // 2. Fallback: try matching trailing raw JSON object
      const trailingJsonMatch = prose.match(/\n*\s*(\{[\s\S]*\})\s*$/)
      if (trailingJsonMatch) {
        try {
          const parsed = JSON.parse(trailingJsonMatch[1])
          if (typeof parsed === 'object' && parsed !== null && (parsed.northStar || parsed.inputMetrics || parsed.metrics)) {
            metricData = parsed
            rawJsonString = JSON.stringify(parsed, null, 2)
            prose = prose.replace(trailingJsonMatch[0], '').trimEnd()
          }
        } catch {
          // ignore
        }
      }
    }
  }

  if (!rawJsonString && metricData) {
    try {
      rawJsonString = JSON.stringify(metricData, null, 2)
    } catch {
      rawJsonString = null
    }
  }

  return { prose, metricData, rawJsonString }
}

interface BrodyOutputProps {
  output?: string | Record<string, any> | null
  metricData?: BrodyMetricCategories | null
  editorRef?: React.RefObject<any>
  onUpdate?: (html: string) => void
  isEditable?: boolean
  className?: string
}

export default function BrodyOutput({
  output,
  metricData: initialMetricData,
  editorRef,
  onUpdate,
  isEditable = true,
  className = '',
}: BrodyOutputProps) {
  const [showRawData, setShowRawData] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)

  // Extract output string and metricData from props
  const rawText = typeof output === 'string' ? output : output?.text || ''
  const propMetricData = initialMetricData || (typeof output === 'object' && output !== null ? output.metricData : null)

  const { prose, metricData, rawJsonString } = parseBrodyOutput(rawText, propMetricData)

  const handleCopyJson = async () => {
    if (!rawJsonString) return
    try {
      await navigator.clipboard.writeText(rawJsonString)
      setJsonCopied(true)
      setTimeout(() => setJsonCopied(false), 3000)
    } catch {
      // ignore
    }
  }

  // Format prose markdown into clean HTML when not editing
  const proseHtml = React.useMemo(() => {
    if (!prose) return ''
    try {
      const rawHtml = marked.parse(prose, { breaks: true, gfm: true }) as string
      return typeof window !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml
    } catch {
      return prose
    }
  }, [prose])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Prose Markdown Section */}
      {prose && (
        <div className="prose-container">
          {isEditable ? (
            <TiptapEditor
              ref={editorRef}
              initialHtml={proseHtml}
              onUpdate={onUpdate || (() => { })}
              autoSaveMs={30000}
            />
          ) : (
            <div
              className="tiptap-editor-content prose prose-sm prose-zinc max-w-none text-zinc-800
                         prose-headings:font-semibold prose-headings:text-zinc-900
                         prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                         prose-p:leading-relaxed prose-p:text-zinc-700
                         prose-li:text-zinc-700 prose-li:leading-relaxed
                         prose-strong:text-zinc-900 prose-strong:font-semibold
                         prose-code:text-zinc-800 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                         prose-pre:bg-white prose-pre:text-zinc-700 prose-pre:rounded-lg prose-pre:text-xs prose-pre:border prose-pre:border-zinc-100
                         prose-blockquote:border-l-blue-300 prose-blockquote:text-zinc-500
                         prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                         prose-hr:border-zinc-200
                         prose-table:text-sm prose-th:text-zinc-700 prose-td:text-zinc-600"
              dangerouslySetInnerHTML={{ __html: proseHtml }}
            />
          )}
        </div>
      )}

      {/* Integrated View Data Card */}
      {rawJsonString && (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white shadow-2xs overflow-hidden transition-all duration-200">
          <div className={`flex gap-2 ${showRawData ? 'flex-wrap' : 'flex-nowrap'} justify-between items-center px-4 py-3 bg-zinc-50/80`}>
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
                <FileJson className="size-4" />
              </span>
              <div>
                <h4 className="text-xs font-semibold text-zinc-900">Raw Metric Data</h4>
                <p className="text-[11px] font-mono text-zinc-500">raw_metric_data.json</p>
              </div>
            </div>

            <div className={`flex justify-between min-[450px]:w-auto items-center gap-3 ${showRawData ? 'w-full' : 'w-auto'}`}>
              {showRawData && (
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  {jsonCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-zinc-500" />}
                  <span>{jsonCopied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              )}

              <div className="flex items-center gap-2 pl-3 border-l border-zinc-200/80">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showRawData}
                  onClick={() => setShowRawData(!showRawData)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showRawData ? 'bg-blue-600' : 'bg-zinc-300'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${showRawData ? 'translate-x-4' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {showRawData && (
            <div className="border-t border-zinc-200/80 bg-zinc-50/80 p-4">
              <pre className="text-xs font-mono text-zinc-800 overflow-x-auto p-3.5 bg-white border border-zinc-200/80 rounded-lg max-h-96 overflow-y-auto leading-relaxed shadow-2xs">
                {rawJsonString}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
