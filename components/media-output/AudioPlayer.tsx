'use client'

import { useState } from 'react'
import { Download, Volume2 } from 'lucide-react'
import { Loader } from '@/components/loader'
import { MarkdownBlock } from './MarkdownBlock'
import { parseAudioOutput, downloadFromUrl } from '@/lib/media-output/parsers'

export function AudioPlayer({ output }: { output: string }) {
  const [downloading, setDownloading] = useState(false)
  const { audioUrl, text } = parseAudioOutput(output)

  return (
    <div className="space-y-4">
      <MarkdownBlock text={text} className="prose prose-sm max-w-none text-zinc-800 mb-2" />

      {audioUrl ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center size-8 rounded-full bg-blue-100 shrink-0">
              <Volume2 className="size-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-zinc-700">Audio Output</span>
          </div>
          <audio controls className="w-full h-10 rounded-lg" src={audioUrl} preload="metadata" />
          <button
            onClick={() => {
              setDownloading(true)
              downloadFromUrl(audioUrl, 'audio.mp3')
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
            Download Audio
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">No audio found in output.</p>
        </div>
      )}
    </div>
  )
}
