import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CaptionsOutputProps {
  output: {
    outputType?: string
    downloadUrl?: string
    fileName?: string
    captionStyle?: string
    previewContent?: string
    srtContent?: string
    expiresAt?: string
  } | null
}

export default function CaptionsOutput({ output }: CaptionsOutputProps) {
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
        <p className="text-amber-800 text-sm">
          <span className="font-semibold">Download within 48 hours.</span>
          {expiryDate && ` File expires ${expiryDate}.`}
        </p>
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
    </div>
  )
}
