import React from 'react'

interface PptxOutputProps {
  output: {
    downloadUrl?: string
    fileName?: string
    slideCount?: number | string
    slideSummary?: string
    expiresAt?: string
  } | null
}

export default function PptxOutput({ output }: PptxOutputProps) {
  const { downloadUrl, fileName, slideCount, slideSummary, expiresAt } = output || {}
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null
  const slideLines = (slideSummary || '').split('\n').filter(Boolean)

  return (
    <div className="mt-8 space-y-5">
      {/* 48h notice */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
        <span className="text-lg">⏱️</span>
        <p className="text-amber-800 text-sm">
          <span className="font-semibold">Download within 48 hours.</span>
          {expiryDate && ` File expires ${expiryDate}.`}
        </p>
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
          Download
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
                <span className="flex size-6 items-center justify-center rounded bg-blue-50 text-[10px] font-bold text-blue-600">
                  {i + 1}
                </span>
                <p className="text-sm text-zinc-600 line-clamp-1">{line}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
