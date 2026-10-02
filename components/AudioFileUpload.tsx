// @ts-nocheck
'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4', '.mov', '.webm']
const ACCEPTED_MIME_TYPES = [
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'video/mp4', 'video/quicktime', 'video/webm', 'audio/webm',
]
const MAX_BYTES = 100 * 1024 * 1024 // 100MB

/**
 * AudioFileUpload
 * Handles drag-and-drop + click-to-upload for audio/video files.
 * On successful upload, calls onUpload({ url, fileName, sizeBytes }).
 *
 * Props:
 *   workerSlug: string
 *   onUpload: ({ url, fileName, path, sizeBytes }) => void
 *   onError: (message: string) => void
 *   label: string (optional)
 *   accept: string (optional override)
 */
export default function AudioFileUpload({ workerSlug, onUpload, onError, label }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState(null)
  const inputRef = useRef(null)

  const validate = (file) => {
    const name = file.name.toLowerCase()
    const mime = file.type
    const hasExt = ACCEPTED_EXTENSIONS.some(e => name.endsWith(e))
    const hasMime = ACCEPTED_MIME_TYPES.includes(mime)
    // Trust extension even if MIME is blank/generic (common with iOS/Android video files)
    const mimeIsGeneric = !mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream'

    if (!hasExt && !hasMime && !mimeIsGeneric) {
      return 'Unsupported file type. Please upload MP3, WAV, M4A, MP4, MOV, or WEBM.'
    }
    if (!hasExt && !hasMime) {
      return 'Unsupported file type. Please upload MP3, WAV, M4A, MP4, MOV, or WEBM.'
    }
    if (file.size > MAX_BYTES) {
      return 'File too large. Maximum size is 100MB.'
    }
    return null
  }


  const getMagicBytes = async (file) => {
    const head = await file.slice(0, 4100).arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(head)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  const getDurationSeconds = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('audio')
    el.preload = 'metadata'
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration || 0) }
    el.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
    el.src = url
  })

  const upload = async (file) => {
    const validationError = validate(file)
    if (validationError) {
      onError?.(validationError)
      return
    }

    setUploading(true)
    setProgress(10)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        onError?.('Not logged in. Please refresh and try again.')
        setUploading(false)
        return
      }

      const authHeader = { 'Authorization': `Bearer ${session.access_token}` }

      // Step 1: Get a presigned upload URL from server (no file bytes sent to Next.js)
      const signRes = await fetch('/api/upload-audio-sign', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign-upload',
          fileName: file.name,
          workerSlug,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          magicBytes: await getMagicBytes(file),
        }),
      })
      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}))
        throw new Error(err.error || 'Could not initiate upload')
      }
      const { uploadUrl, storagePath } = await signRes.json()

      setProgress(20)

      // Step 2: Upload file directly to Supabase via presigned URL (bypasses Next.js body limit)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: file,
      })
      if (!putRes.ok) {
        const errText = await putRes.text().catch(() => putRes.statusText)
        throw new Error(`Upload failed: ${errText}`)
      }

      setProgress(85)

      // Step 3: Get a signed download URL from server
      const dlRes = await fetch('/api/upload-audio-sign', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign-download', storagePath }),
      })
      if (!dlRes.ok) throw new Error('Could not generate file URL')
      const { url } = await dlRes.json()

      setProgress(100)
      setUploadedFile({ name: file.name, size: file.size })
      const durationSeconds = await getDurationSeconds(file).catch(() => 0)
      onUpload?.({
        url,
        fileName: file.name,
        path: storagePath,
        sizeBytes: file.size,
        durationSeconds,
      })
    } catch (err) {
      onError?.(err.message || 'Upload failed. Please try again.')
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }

  const formatSize = (bytes) => {
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  // Uploaded state
  if (uploadedFile && !uploading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-lg">✅</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-950 truncate">{uploadedFile.name}</p>
          <p className="text-xs text-zinc-500">{formatSize(uploadedFile.size)} · Ready to process</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setUploadedFile(null)
            setProgress(0)
            onUpload?.(null)
          }}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition cursor-pointer ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white'
        }`}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,audio/*,video/mp4,video/quicktime,video/webm"
          onChange={handleChange}
        />

        {uploading ? (
          <>
            <div className="mb-3 size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
            <p className="text-sm font-medium text-zinc-700">Uploading…</p>
            <div className="mt-3 w-full max-w-xs rounded-full bg-zinc-200 h-1.5">
              <div
                className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-400">{progress}%</p>
          </>
        ) : (
          <>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-xl">
              🎵
            </div>
            <p className="text-sm font-medium text-zinc-700">
              {label || 'Drop your audio or video file here'}
            </p>
            <p className="mt-1 text-xs text-zinc-400">or click to browse</p>
            <p className="mt-3 text-xs text-zinc-400">MP3, WAV, M4A, MP4, MOV, WEBM · Max 100MB</p>
          </>
        )}
      </div>
    </div>
  )
}
