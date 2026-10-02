import React from 'react'
import { ArrowDownToLine } from 'lucide-react'

interface Clip {
  clipNumber?: number
  thumbnailUrl?: string
  description?: string
  startSeconds?: number
  endSeconds?: number
  duration?: number
  downloadUrl?: string
}

interface ClipsOutputProps {
  output: {
    clips?: Clip[]
    platform?: string
    expiresAt?: string
    hasVideo?: boolean
    totalClips?: number
  } | null
}

export default function ClipsOutput({ output }: ClipsOutputProps) {
  const { clips = [], platform, expiresAt, hasVideo, totalClips } = output || {}
  const [failedThumbnails, setFailedThumbnails] = React.useState<Record<number, boolean>>({})
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }) : null

  function formatDuration(secs?: number) {
    if (!secs) return ''
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  function formatTimestamp(secs?: number) {
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
          <p className="text-amber-800 text-sm">
            <span className="font-semibold">Download within 48 hours.</span>
            {expiryDate && ` Clips expire ${expiryDate}.`}
          </p>
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
              {clip.thumbnailUrl && !failedThumbnails[i] ? (
                <img
                  src={clip.thumbnailUrl}
                  alt={`Clip ${clip.clipNumber} thumbnail`}
                  onError={() => setFailedThumbnails(prev => ({ ...prev, [i]: true }))}
                  className="h-16 w-28 rounded-lg object-cover"
                />
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
            {clip.downloadUrl && (
              <a href={clip.downloadUrl} download={`clip-${clip.clipNumber}.mp4`} className="shrink-0 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                <ArrowDownToLine className="size-4" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
