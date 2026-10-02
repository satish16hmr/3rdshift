'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, CloudUpload, File } from 'lucide-react'
import { Button } from './button'

export type FileUploadType = 'video' | 'document' | 'image'

interface FileUploadProps {
  type: FileUploadType
  label?: string
  /** Override the accepted file types shown in the drop zone (e.g. "PDF, DOCX") */
  acceptedTypesLabel?: string
  required?: boolean
  /** Field name passed to upload API so execute-task can distinguish face vs sketch */
  fieldName?: string
  onUploadComplete?: (content: string, fileName: string) => void
  onUploadError?: (error: string) => void
  onClear?: () => void
}

const VIDEO_EXTS = '.mp4,.mov,.webm,.mp3,.wav,.m4a'
const VIDEO_ACCEPTED_LABEL = 'MP4, MOV, WEBM, MP3, WAV, M4A'
const VIDEO_MAX_MB = 500

const DOC_EXTS = '.csv,.xls,.xlsx,.pdf,.txt,.doc,.docx'
const DOC_ACCEPTED_LABEL = 'CSV, XLS, XLSX, PDF, TXT, DOC, DOCX'
const DOC_MAX_MB = 50

const IMAGE_EXTS = 'image/jpeg,image/png,image/jpg,image/webp,.jpg,.jpeg,.png,.webp'
const IMAGE_ACCEPTED_LABEL = 'JPG, PNG'
const IMAGE_MAX_MB = 20

const VIDEO_MIME = new Set([
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
])
const DOC_MIME = new Set([
  'text/csv', 'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const IMAGE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
])

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function getMagicBytes(file: File) {
  const head = await file.slice(0, 4100).arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(head)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function logUploadFailure(context: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[FileUpload] upload failed', context)
  }
}

function parseUploadErrorBody(errorBody: string): { error?: string } {
  try {
    return errorBody ? JSON.parse(errorBody) : {}
  } catch {
    return {}
  }
}

export default function FileUpload({
  type,
  label,
  acceptedTypesLabel,
  required,
  fieldName,
  onUploadComplete,
  onUploadError,
  onClear,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isVideo = type === 'video'
  const isImage = type === 'image'
  const acceptAttr = isVideo ? VIDEO_EXTS : isImage ? IMAGE_EXTS : DOC_EXTS
  const acceptedLabel = acceptedTypesLabel ?? (isVideo ? VIDEO_ACCEPTED_LABEL : isImage ? IMAGE_ACCEPTED_LABEL : DOC_ACCEPTED_LABEL)
  const maxMB = isVideo ? VIDEO_MAX_MB : isImage ? IMAGE_MAX_MB : DOC_MAX_MB
  const allowedMime = isVideo ? VIDEO_MIME : isImage ? IMAGE_MIME : DOC_MIME
  const extPattern = useMemo(
    () => (isVideo ? /\.(mp4|mov|webm|mp3|wav|m4a)$/i : isImage ? /\.(jpg|jpeg|png)$/i : /\.(csv|xls|xlsx|pdf|txt|doc|docx)$/i),
    [isVideo, isImage]
  )

  const validate = useCallback((f: File): string | null => {
    if (!allowedMime.has(f.type) && !extPattern.test(f.name)) {
      return `Wrong file type. Accepted: ${acceptedLabel}`
    }
    if (f.size > maxMB * 1024 * 1024) {
      return `File too large. Max ${maxMB}MB`
    }
    return null
  }, [acceptedLabel, allowedMime, extPattern, maxMB])

  const processFile = useCallback(async (f: File) => {
    const err = validate(f)
    if (err) {
      setErrorMsg(err)
      setStatus('error')
      setFile(null)
      onUploadError?.(err)
      return
    }

    setFile(f)
    setStatus('uploading')
    setProgress(0)
    setErrorMsg('')

    const interval = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 18, 88))
    }, 350)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

      if (type === 'image') {
        if (!session?.access_token) {
          throw new Error('Upload failed')
        }

        const signRes = await fetch('/api/upload-image-sign', {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sign-upload',
            fileName: f.name,
            fileSize: f.size,
            mimeType: f.type,
            fieldName,
            magicBytes: await getMagicBytes(f),
          }),
        })

        if (!signRes.ok) {
          const errorBody = await signRes.text().catch(() => '')
          logUploadFailure({ endpoint: '/api/upload-image-sign', status: signRes.status, body: errorBody.slice(0, 500), fileName: f.name, fileSize: f.size, mimeType: f.type })
          const data = parseUploadErrorBody(errorBody)
          throw new Error(data.error || 'Upload failed')
        }

        const { uploadUrl, storagePath } = await signRes.json()
        setProgress(25)

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': f.type || 'image/jpeg' },
          body: f,
        })

        if (!putRes.ok) {
          const errorBody = await putRes.text().catch(() => '')
          logUploadFailure({ endpoint: 'supabase-storage-signed-upload', status: putRes.status, body: errorBody.slice(0, 500), fileName: f.name, fileSize: f.size, mimeType: f.type })
          throw new Error('Upload failed')
        }

        setProgress(85)

        const dlRes = await fetch('/api/upload-image-sign', {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sign-download', storagePath, fieldName }),
        })

        if (!dlRes.ok) {
          const errorBody = await dlRes.text().catch(() => '')
          logUploadFailure({ endpoint: '/api/upload-image-sign', status: dlRes.status, body: errorBody.slice(0, 500), fileName: f.name, storagePath })
          const data = parseUploadErrorBody(errorBody)
          throw new Error(data.error || 'Upload failed')
        }

        await dlRes.json()
        const content = `[STORAGE_PATH: ${storagePath}]${fieldName ? ` [FIELD: ${fieldName}]` : ''}`
        clearInterval(interval)
        setProgress(100)
        setStatus('done')
        onUploadComplete?.(content, f.name)
        return
      }

      if (type === 'document') {
        if (!session?.access_token) {
          throw new Error('Upload failed')
        }

        const signRes = await fetch('/api/upload-doc-sign', {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sign-upload',
            fileName: f.name,
            fileSize: f.size,
            mimeType: f.type,
            fieldName,
            magicBytes: await getMagicBytes(f),
          }),
        })

        if (!signRes.ok) {
          const errorBody = await signRes.text().catch(() => '')
          logUploadFailure({ endpoint: '/api/upload-doc-sign', status: signRes.status, body: errorBody.slice(0, 500), fileName: f.name, fileSize: f.size, mimeType: f.type })
          const data = parseUploadErrorBody(errorBody)
          throw new Error(data.error || 'Upload failed')
        }

        const { uploadUrl, storagePath } = await signRes.json()
        setProgress(25)

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': f.type || 'application/octet-stream' },
          body: f,
        })

        if (!putRes.ok) {
          const errorBody = await putRes.text().catch(() => '')
          logUploadFailure({ endpoint: 'supabase-storage-signed-upload', status: putRes.status, body: errorBody.slice(0, 500), fileName: f.name, fileSize: f.size, mimeType: f.type })
          throw new Error('Upload failed')
        }

        setProgress(85)

        const dlRes = await fetch('/api/upload-doc-sign', {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sign-download', storagePath, fieldName }),
        })

        if (!dlRes.ok) {
          const errorBody = await dlRes.text().catch(() => '')
          logUploadFailure({ endpoint: '/api/upload-doc-sign', status: dlRes.status, body: errorBody.slice(0, 500), fileName: f.name, storagePath })
          const data = parseUploadErrorBody(errorBody)
          throw new Error(data.error || 'Upload failed')
        }

        await dlRes.json()
        const content = `[STORAGE_PATH: ${storagePath}]${fieldName ? ` [FIELD: ${fieldName}]` : ''}`
        clearInterval(interval)
        setProgress(100)
        setStatus('done')
        onUploadComplete?.(content, f.name)
        return
      }

      const formData = new FormData()
      formData.append('file', f)
      formData.append('type', type)
      if (fieldName) formData.append('fieldName', fieldName)

      const res = await fetch('/api/upload-file', {
        method: 'POST',
        headers: authHeader,
        body: formData,
      })

      clearInterval(interval)

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        logUploadFailure({ endpoint: '/api/upload-file', status: res.status, body: errorBody.slice(0, 500), fileName: f.name, fileSize: f.size, mimeType: f.type })
        const data = parseUploadErrorBody(errorBody)
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      setProgress(100)
      setStatus('done')
      onUploadComplete?.(data.content, f.name)
    } catch (e: unknown) {
      clearInterval(interval)
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setErrorMsg(msg)
      setStatus('error')
      onUploadError?.(msg)
    }
  }, [type, fieldName, onUploadComplete, onUploadError, validate])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleClear = () => {
    setFile(null)
    setStatus('idle')
    setProgress(0)
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
    onClear?.()
  }

  const displayLabel = label || (isVideo ? 'Upload video or audio' : 'Upload file')
  const optionalLabel = !required ? (
    <span style={{ marginLeft: 4, fontWeight: 400, color: 'rgba(17,17,19,0.4)' }}>(optional)</span>
  ) : null

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#414651', display: 'block' }}>
          {displayLabel}{optionalLabel}
        </label>
        {status === 'done' && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              fontSize: 12,
              color: 'rgba(17,17,19,0.4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(17,17,19,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(17,17,19,0.4)')}
          >
            Remove
          </button>
        )}
      </div>

      {/* Drop zone — idle or error */}
      {(status === 'idle' || status === 'error') && (
        <>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: dragging
                ? '2px solid #2563eb'
                : status === 'error'
                  ? '1.5px solid rgba(239,68,68,0.5)'
                  : '1.5px solid rgba(0,0,0,0.15)',
              borderRadius: 10,
              padding: '16px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              background: status === 'error'
                ? 'rgba(239,68,68,0.02)'
                : '#fff',
              transition: 'border-color 150ms, background 150ms',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={acceptAttr}
              style={{ display: 'none' }}
              onChange={handleChange}
            />
            <Button variant="outline" className='bg-white! size-10! p-0!'>
              <CloudUpload className='size-4 text-neutral-500' />
            </Button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 400, color: '#535862', margin: 0 }}>
                <span style={{ color: '#2563eb', fontWeight: 600 }}>Click to upload{" "}</span>
                or drag and drop
              </p>
              <p style={{ fontSize: 14, fontWeight: 400, color: '#535862', margin: 0 }}>
                {acceptedLabel} · Max {maxMB}MB
              </p>
            </div>
          </div>
          {status === 'error' && errorMsg && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: '6px 0 0' }}>{errorMsg}</p>
          )}
        </>
      )}

      {/* Uploading state */}
      {status === 'uploading' && file && (
        <div
          style={{
            border: '1.5px solid #6290F2',
            borderRadius: 12,
            padding: '16px',
            background: '#fff',
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <File className='size-5 text-[#A4A7AE]' />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className='text-sm font-medium text-[#414651]'>{file.name}</p>
              <p className='text-sm text-neutral-500'>
                {formatBytes(file.size)}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* <p style={{ fontSize: 12, color: 'rgba(17,17,19,0.5)', margin: 0 }}>
              {isVideo ? 'Uploading & transcribing…' : 'Uploading & parsing…'}
            </p> */}
            <div style={{
              height: 4, width: '100%', borderRadius: 99,
              background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                borderRadius: 99,
                background: '#2563eb',
                width: `${progress}%`,
                transition: 'width 300ms ease',
                boxShadow: '0 0 6px rgba(37,99,235,0.4)',
              }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#414651', margin: 0 }}>
              {Math.round(progress)}%
            </p>
          </div>
        </div>
      )}

      {/* Done state */}
      {status === 'done' && file && (
        <div
          style={{
            border: '1.5px solid #6290F2',
            borderRadius: 12,
            padding: '16px',
            background: '#F5F8FF',
          }}
        >
          <div className="flex justify-between gap-2">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <File className='size-5 text-[#A4A7AE]' />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className='text-sm font-medium text-[#414651]'>{file.name}</p>
                <p className='text-sm text-neutral-500'>
                  {formatBytes(file.size)}
                </p>
              </div>
            </div>
            <div className='size-4 bg-blue-500 rounded-sm flex items-center justify-center'>
              <Check className='size-3 text-white' />
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* <p style={{ fontSize: 12, color: 'rgba(17,17,19,0.5)', margin: 0 }}>
              {isVideo ? 'Uploading & transcribing…' : 'Uploading & parsing…'}
            </p> */}
            <div style={{
              height: 4, width: '100%', borderRadius: 99,
              background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                borderRadius: 99,
                background: '#2563eb',
                width: "100%",
                transition: 'width 300ms ease',
                boxShadow: '0 0 6px rgba(37,99,235,0.4)',
              }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#414651', margin: 0 }}>
              100%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
