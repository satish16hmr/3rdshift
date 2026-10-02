'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Loader } from '@/components/loader'
import { parseVideoOutput, downloadFromUrl } from '@/lib/media-output/parsers'
import { MarkdownBlock } from './MarkdownBlock'

export function VideoPlayer({ output }: { output: string }) {
  const [downloading, setDownloading] = useState(false)
  const { videoUrl, text } = parseVideoOutput(output)

  return (
    <div className="space-y-4">
      <MarkdownBlock text={text} className="prose prose-sm max-w-none text-zinc-800 mb-2" />

      {videoUrl ? (
        <div className="rounded-xl border border-zinc-200 bg-black overflow-hidden">
          <video controls className="w-full aspect-video" src={videoUrl} preload="metadata" />
          <div className="p-3 bg-zinc-50 border-t border-zinc-200">
            <button
              onClick={() => {
                setDownloading(true)
                downloadFromUrl(videoUrl, 'video.mp4')
                setTimeout(() => setDownloading(false), 1000)
              }}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {downloading ? (
                <Loader size={3} className="!size-3.5" />
              ) : (
                <Download className="size-3.5" />
              )}
              Download Video
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">No video found in output.</p>
        </div>
      )}
    </div>
  )
}
