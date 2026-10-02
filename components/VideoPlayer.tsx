// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'

interface VideoPlayerProps {
  videoUrl?: string
  fileName?: string
  label?: string
  className?: string
}

export default function VideoPlayer({ videoUrl, fileName, label, className }: VideoPlayerProps) {
  const videoRef = useRef(null)
  const scrubberRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => { setDuration(video.duration); setLoading(false) }
    const onTime = () => setCurrentTime(video.currentTime)
    const onEnded = () => setPlaying(false)
    const onError = () => { setError('Could not load video.'); setLoading(false) }
    const onCanPlay = () => setLoading(false)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnded)
    video.addEventListener('error', onError)
    video.addEventListener('canplay', onCanPlay)
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('error', onError)
      video.removeEventListener('canplay', onCanPlay)
    }
  }, [videoUrl])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play(); setPlaying(true) }
  }

  const handleSeek = (e) => {
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const handleVolume = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) videoRef.current.volume = val
  }

  const handleDownload = async () => {
    try {
      const res = await fetch(videoUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = fileName || 'video.mp4'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { window.open(videoUrl, '_blank') }
  }

  const toggleFullscreen = () => {
    const v = videoRef.current
    if (!v) return
    if (!document.fullscreenElement) v.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`rounded-xl border border-zinc-950/[0.08] overflow-hidden bg-white w-[60%] mx-auto ${className}`}>
      <div
        className="relative bg-zinc-100 cursor-pointer"
        style={{ aspectRatio: '16/9' }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          preload="metadata"
          className="w-full h-full object-contain"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
          </div>
        )}
        {!loading && !playing && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm transition hover:scale-105">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4.5 3L15 9L4.5 15V3Z" fill="#111113" />
              </svg>
            </div>
          </div>
        )}
        {!loading && (
          <div className="absolute bottom-3 right-3 rounded-md border border-zinc-200 bg-white/90 backdrop-blur-sm px-2 py-0.5">
            <span className="text-xs tabular-nums text-zinc-500">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      {!error && (
        <div className="border-t border-zinc-950/[0.06] px-4 py-3 space-y-2.5">
          {/* Scrubber */}
          <div
            ref={scrubberRef}
            className="group relative h-1 w-full cursor-pointer rounded-full bg-zinc-200"
            onClick={handleSeek}
          >
            <div
              className="absolute left-0 top-0 h-1 rounded-full bg-blue-500"
              style={{ width: `${progress}%` }}
            />
            {/* Thumb dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full bg-blue-500 border-2 border-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress}%` }}
            />
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between gap-3">

            {/* Left: play + time + volume */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="flex cursor-pointer size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50"
              >
                {playing ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
                    <rect x="8.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 1.5L13 7L3 12.5V1.5Z" fill="currentColor" />
                  </svg>
                )}
              </button>

              <span className="text-xs tabular-nums text-zinc-400 hidden sm:block">
                {fmt(currentTime)} / {fmt(duration)}
              </span>

              {/* Volume */}
              <div className="hidden sm:flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-400 shrink-0">
                  <path d="M2 5h2.5L8 2v10L4.5 9H2V5zM10 4.5a3.5 3.5 0 010 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={volume}
                  onChange={handleVolume}
                  className="w-16 accent-blue-500"
                  style={{ height: '4px' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition hover:text-zinc-700 hover:bg-zinc-50"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1h3.5M1 1v3.5M11 1h-3.5M11 1v3.5M1 11h3.5M1 11v-3.5M11 11h-3.5M11 11v-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1.5v6M6 7.5L3.5 5M6 7.5L8.5 5M1.5 10.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download MP4
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="border-t border-zinc-950/[0.06] px-4 py-3">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {label && (
        <div className="px-4 pb-3">
          <p className="text-xs text-zinc-400">{label}</p>
        </div>
      )}
    </div>
  )
}
