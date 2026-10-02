// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getStoredWorkspaceId } from '@/lib/workspace-client'
import { getWorkspaceInitials } from '@/lib/initials'

function processLogo(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const maxSize = 512
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.88
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image load failed'))
    }
    img.src = objectUrl
  })
}

interface CompanyLogoUploadProps {
  logoUrl: string | null
  workspaceName?: string
  onUpdate: (url: string | null) => void
}

export default function CompanyLogoUpload({ logoUrl, workspaceName = '', onUpdate }: CompanyLogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(logoUrl || null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setPreviewUrl(logoUrl || null)
  }, [logoUrl])

  const initials = getWorkspaceInitials(workspaceName)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('Only JPG, PNG, or WebP files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Max file size is 5MB.')
      return
    }

    setError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const blob = await processLogo(file)
      const storedWorkspaceId = getStoredWorkspaceId()
      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': blob.type || 'image/jpeg',
      }
      if (storedWorkspaceId) headers['x-workspace-id'] = storedWorkspaceId
      const res = await fetch('/api/upload-company-logo', {
        method: 'POST',
        headers,
        body: blob,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Upload failed')

      setPreviewUrl(json.logoUrl)
      onUpdate?.(json.logoUrl)
      window.dispatchEvent(new CustomEvent('company-logo-updated', { detail: { logoUrl: json.logoUrl } }))
    } catch (err) {
      console.error('Company logo upload error:', err)
      setError('Upload failed — please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const storedWorkspaceId = getStoredWorkspaceId()
      const headers = { 'Authorization': `Bearer ${session.access_token}` }
      if (storedWorkspaceId) headers['x-workspace-id'] = storedWorkspaceId

      const res = await fetch('/api/upload-company-logo', {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error('Remove failed')

      setPreviewUrl(null)
      onUpdate?.(null)
      window.dispatchEvent(new CustomEvent('company-logo-updated', { detail: { logoUrl: null } }))
    } catch (err) {
      console.error('Company logo remove error:', err)
      setError('Remove failed — please try again.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || removing}
          className="relative flex size-10 items-center justify-center rounded-md bg-white text-zinc-600 shadow-sm border border-[#E5E5E5] transition group-hover:text-blue-600 group-hover:ring-blue-200  overflow-hidden p-1 cursor-pointer!"
          aria-label="Upload company logo"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Company logo"
              className="size-full object-cover rounded-full overflow-hidden"
              onError={() => setPreviewUrl(null)}
            />
          ) : (
            <div className="size-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-semibold select-none rounded-full">
              {initials}
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
              <div className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}

        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || removing}
              className="text-sm font-semibold text-blue-500 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Uploading…' : previewUrl ? 'Change logo' : 'Upload logo'}
            </button>
            {previewUrl && !uploading && (
              <>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={uploading || removing}
                  className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </>
            )}
          </div>
          {error
            ? <p className="mt-1 text-xs text-red-500">{error}</p>
            : <p className="mt-1 text-xs text-neutral-500!">JPG, PNG or WebP · max 5MB</p>
          }
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
