// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * AudioPlayer — used on task result pages for Clay, Koa, and Tala.
 * Props:
 *   audioUrl: string — fallback signed URL to the MP3 file
 *   audioPath: string — durable audio-outputs storage path; preferred
 *   taskId: string — task id used to authorize fresh signed URL creation
 *   fileName: string — download filename
 *   label: string — optional label (e.g. "Voiceover · Professional Male")
 */
export default function AudioPlayer({ audioUrl, audioPath, taskId, fileName, label }) {
  const audioRef = useRef(null)
  const [audioSrc, setAudioSrc] = useState(audioUrl || '')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function refreshSignedUrl() {
      if (!audioPath || !taskId) {
        setAudioSrc(audioUrl || '')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('Missing session')

        const res = await fetch('/api/tasks/audio-output-url', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ taskId, audioPath }),
        })

        if (!res.ok) throw new Error('Could not authorize audio URL')
        const data = await res.json()
        if (!cancelled) setAudioSrc(data.url || '')
      } catch {
        if (!cancelled) {
          if (audioUrl) {
            setAudioSrc(audioUrl)
          } else {
            setError('Could not load audio file.')
            setLoading(false)
          }
        }
      }
    }

    refreshSignedUrl()
    return () => { cancelled = true }
  }, [audioUrl, audioPath, taskId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadedMetadata = () => {
      setDuration(audio.duration)
      setLoading(false)
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => setPlaying(false)
    const onError = () => {
      setError('Could not load audio file.')
      setLoading(false)
    }
    const onCanPlay = () => setLoading(false)

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('canplay', onCanPlay)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('canplay', onCanPlay)
    }
  }, [audioSrc])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);  // browser blocked autoplay or src failed
      }
    }
  }


  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    audio.currentTime = ratio * duration
  }

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleDownload = async () => {
    try {
      const res = await fetch(audioSrc)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = fileName || 'audio.mp3'
      a.click()
      URL.revokeObjectURL(a.href)
      showToast?.({ title: 'Download completed successfully!', variant: 'success' })
    } catch {
      window.open(audioSrc, '_blank')
      showToast?.({ title: 'Download failed. Please try again.', variant: 'error' })
    }
  }

  return (
    <div className="rounded-xl border border-zinc-950/[0.08] bg-white overflow-hidden">
      <audio ref={audioRef} src={audioSrc} preload="metadata" crossOrigin="anonymous" />

      {/* Header */}
      {label && (
        <div className="border-b border-zinc-950/[0.06] px-6 py-4 flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-lg">🎵</span>
          <p className="text-sm font-semibold text-zinc-950">{label}</p>
        </div>
      )}

      <div className="px-6 py-5 space-y-4">
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <>
            {/* Scrubber */}
            <div
              className="relative h-2 w-full cursor-pointer rounded-full bg-zinc-100"
              onClick={handleSeek}
            >
              <div
                className="absolute left-0 top-0 h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-blue-600 shadow transition-all"
                style={{ left: `calc(${progress}% - 7px)` }}
              />
            </div>

            {/* Time + controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  disabled={loading}
                  className="cursor-pointer flex size-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeDasharray="20" strokeDashoffset="10" />
                    </svg>
                  ) : playing ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="3" y="2" width="3" height="10" rx="1" fill="white" />
                      <rect x="8" y="2" width="3" height="10" rx="1" fill="white" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3.5 2.5L12 7L3.5 11.5V2.5Z" fill="white" />
                    </svg>
                  )}
                </button>

                {/* Time */}
                <span className="text-sm tabular-nums text-zinc-500">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Volume */}
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-400 shrink-0">
                    <path d="M1.5 5h2.5L7.5 2v10L4 9H1.5V5z" fill="currentColor" />
                    {volume > 0 && <path d="M9.5 3.5a4.5 4.5 0 010 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />}
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolume}
                    className="w-16 accent-blue-600"
                  />
                </div>

                {/* Download */}
                <button
                  onClick={handleDownload}
                  className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-400"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1.5v6M6 7.5L3.5 5M6 7.5L8.5 5M1.5 10h9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download MP3
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
