// @ts-nocheck
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import JpgFilePng from '@/public/images/onboarding/jpgFile.png'
import { ArrowRight, Camera, CloudUpload, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from './ui/button'
import { createClient } from '@/lib/supabase/client'

// Center-crop to 256x256 JPEG at 80% quality — no library needed
function processAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = typeof window !== 'undefined'
  ? new window.Image()
  : null

  if (!img) return reject(new Error('Image not available'))

    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256
      )
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/jpeg',
        0.8
      )
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = URL.createObjectURL(file)
  })
}

// ─── Upload Modal ────────────────────────────────────────────────────────────
function UploadModal({ onClose, onFileSelect, uploading, error }) {
  const [dragging, setDragging] = useState(false)
  const dropRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    if (!dropRef.current?.contains(e.relatedTarget)) {
      setDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    e.target.value = ''
  }
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className='max-[1280px]:fixed z-20 max-[1280px]:inset-0 max-[1280px]:bg-gray-900/50 max-[1280px]:backdrop-blur-[2px] max-[1280px]:flex max-[1280px]:justify-center max-[1280px]:items-center absolute xl:top-59.25 p-4 sm:px-6' onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl w-full sm:w-89.5 lg:w-140 shadow-[0px_3px_3px_-1.5px_#0A0D120A,0px_8px_8px_-4px_#0A0D1208,0px_20px_24px_-4px_#0A0D1214] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between py-3 px-6 bg-zinc-50">
          <h2 className="text-lg font-semibold text-gray-800">Upload Image</h2>
          <X className="size-4 text-[#A4A7AE] cursor-pointer" onClick={onClose} />
        </div>

        {/* Drop zone */}
        <div className="px-6 py-4 md:py-5 border-y border-zinc-200">
          <div
            ref={dropRef}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center gap-3
              rounded-xl border-2 px-6 py-4 cursor-pointer
              transition-all duration-200 select-none
              ${dragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-blue-500 bg-white hover:bg-blue-50/50'
              }
              ${uploading ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            {/* Upload icon */}
            <div className="flex items-center justify-center size-10 rounded-lg border border-zinc-200 shadow-[0px_1px_2px_0px_#1018280D,_0px_-2px_0px_0px_#0A0D120D_inset,_0px_0px_0px_1px_#0A0D122E_inset] me-3">
              {uploading ? (
                <div className="size-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
              ) : (
                <CloudUpload className="size-5 text-gray-600" />
              )}
            </div>

            {/* Text */}
            <div className="flex items-center gap-1 w-full">
              <div className="text-center flex-1">
                <p className="text-sm text-neutral-500">
                  <span className="font-semibold text-blue-500 hover:text-blue-600">
                    {uploading ? 'Uploading…' : 'Click to upload'}
                  </span>
                  {!uploading && <span className="text-gray-500"> or drag and drop</span>}
                </p>
                <p className="mt-1 text-xs text-neutral-500">SVG, PNG, JPG or GIF (max. 800×400px)</p>
              </div>

              {/* Floating file icon decoration */}
              {!uploading && (
                <Image src={JpgFilePng} alt='JPG File' width={40} height={40} className='hidden lg:flex' />
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-3 text-xs text-red-500 text-center">{error}</p>
          )}
        </div>
        <div className='items-center justify-between w-full bg-zinc-50 p-6 max-[1280px]:flex hidden'>
          <Button variant='outline'
            onClick={onClose}
            className='bg-white'
          >
            Cancel
          </Button>
          <Button
            variant='primary'
            className='bg-[#2B5DE5]'
          >
            Next <ArrowRight />
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.svg,.gif,image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AvatarUpload({
  initials,
  avatarUrl,
  onUpdate,
  avatarClassName,
  uploadBtn = true,
  variant = 'default',
}) {
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(avatarUrl || null)
  const [modalOpen, setModalOpen] = useState(false)
  const fileInputRef = useRef(null)

  // Sync when avatarUrl prop loads async
  useEffect(() => {
    setPreviewUrl(avatarUrl || null)
  }, [avatarUrl])

  const uploadFile = async (file) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
    if (!allowed.includes(file.type)) {
      setError('Only JPG, PNG, WebP, SVG, or GIF files are allowed.')
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

      const blob = await processAvatar(file)

      const res = await fetch('/api/upload-avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'image/jpeg' },
        body: blob,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')

      setPreviewUrl(json.avatarUrl)
      onUpdate?.(json.avatarUrl)
      setModalOpen(false)
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatarUrl: json.avatarUrl } }))
    } catch (err) {
      console.error('Avatar upload error:', err)
      setError('Upload failed — please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await uploadFile(file)
  }

  const handleModalFileSelect = async (file) => {
    await uploadFile(file)
  }

  const handleAvatarClick = () => {
    if (variant === 'uploadModal') {
      setModalOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/upload-avatar', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Remove failed')

      setPreviewUrl(null)
      onUpdate?.(null)
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatarUrl: null } }))
    } catch (err) {
      console.error('Avatar remove error:', err)
      setError('Remove failed — please try again.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      {/* Upload Modal (variant="uploadModal") */}
      {variant === 'uploadModal' && modalOpen && (
        <UploadModal
          onClose={() => { setModalOpen(false); setError(null) }}
          onFileSelect={handleModalFileSelect}
          uploading={uploading}
          error={error}
        />
      )}

      <div>
        <div className="flex items-center gap-3">
          {/* Clickable avatar */}
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading || removing}
            className="relative group flex-shrink-0"
            aria-label="Upload profile photo"
          >
            <div className={`${avatarClassName} relative size-11 rounded-full overflow-hidden transition-opacity group-hover:opacity-75 group-disabled:opacity-50 cursor-pointer`}>
              {previewUrl ? (
                <img src={previewUrl} alt="Profile photo" className="size-full object-cover" onError={() => setPreviewUrl(null)} />
              ) : (
                <div className="size-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xl font-semibold select-none">
                  {initials}
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <div className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              )}
            </div>
            {/* Camera icon overlay */}
            {!uploading && (
              <div className="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full cursor-pointer bg-zinc-100 border border-zinc-200">
                <Camera className='size-3 text-black' />
              </div>
            )}
          </button>

          {/* Action links */}
          {uploadBtn && (
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploading || removing}
                  className="text-sm font-semibold text-blue-500 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {uploading ? 'Uploading…' : 'Change photo'}
                </button>
                {previewUrl && !uploading && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={uploading || removing}
                    className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {removing ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
              {error && variant !== 'uploadModal'
                ? <p className="mt-0.5 text-xs text-red-500">{error}</p>
                : <p className="mt-0.5 text-xs text-neutral-500!">Your personal account information and login credentials.</p>
              }
            </div>
          )}
        </div>

        {/* Hidden input for default variant */}
        {variant !== 'uploadModal' && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        )}
      </div>
    </>
  )
}