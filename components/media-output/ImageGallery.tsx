'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, Eye, X } from 'lucide-react'
import { Loader } from '@/components/loader'
import { useToast } from '@/components/toast-provider'
import { parseImageOutput, downloadFromUrl, slugifyLabel } from '@/lib/media-output/parsers'

export function ImageGallery({
  output,
  workerSlug,
  taskId,
  brandName
}: {
  output: string
  workerSlug?: string
  taskId?: string
  brandName?: string
}) {
  const { showToast } = useToast()
  const { images } = parseImageOutput(output)
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null)
  const [lightboxLoading, setLightboxLoading] = useState(true)
  const [brandKitLoading, setBrandKitLoading] = useState<Record<number, boolean>>({})
  const [downloadLoading, setDownloadLoading] = useState<Record<number, boolean>>({})
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})

  const openLightbox = (url: string, index: number) => {
    if (failedImages[index]) {
      alert('Image expired or unavailable. Please re-run the task to generate fresh images.')
      return
    }
    setActiveLightboxImg(url)
    setLightboxLoading(true)
  }

  const isShayTask = workerSlug === 'logo-concept-generator'

  const handleBrandKit = async (url: string, index: number, nameOfBrand?: string) => {
    if (failedImages[index]) {
      alert('Logo image expired or unavailable. Please re-run Shay to get fresh images.')
      return
    }
    setBrandKitLoading(prev => ({ ...prev, [index]: true }))
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/shay/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ imageUrl: url, brandName: nameOfBrand || 'logo', conceptIndex: index + 1, taskId, imageIndex: index }),
      })
      const data = await res.json()
      if (data.downloadUrl) {
        const a = document.createElement('a')
        a.href = data.downloadUrl
        a.download = data.fileName || `brand-kit-concept-${index + 1}.zip`
        a.click()
        if (data.vectorizationFailed) {
          alert('Your brand kit is downloading! Note: Vector files (SVG, EPS, PDF) are still processing. Click “Download Brand Kit” again in a minute to get the full kit with vector files.')
        }
      } else {
        alert(`Brand kit failed: ${data.error || 'unknown error'}`)
      }
    } catch (e) {
      alert(`Brand kit generation failed: ${e instanceof Error ? e.message : 'please try again.'}`)
    }
    setBrandKitLoading(prev => ({ ...prev, [index]: false }))
  }

  useEffect(() => {
    if (!activeLightboxImg) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveLightboxImg(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeLightboxImg])

  return (
    <div className="space-y-6 w-full">
      {/* 48h notice */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
        <span className="text-lg">⏱️</span>
        <p className="text-amber-800 text-sm">
          <span className="font-semibold">Download within 48 hours.</span> Images expire 48 hours after generation.
        </p>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {images.map((img, i) => (
            <div
              key={i}
              className="group relative bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col"
            >
              {failedImages[i] ? (
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-50 border-b border-zinc-100 flex flex-col items-center justify-center p-4 text-center">
                  <span className="text-2xl mb-1.5">🖼️</span>
                  <p className="text-xs font-medium text-zinc-600">Image expired or unavailable</p>
                  {img.url?.startsWith('https://') && (
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      Try opening directly ↗
                    </a>
                  )}
                </div>
              ) : (
                <div
                  className="relative aspect-video w-full overflow-hidden bg-zinc-50 border-b border-zinc-100 cursor-pointer"
                  onClick={() => openLightbox(img.url, i)}
                >
                  <img
                    src={img.url}
                    alt={img.label}
                    onError={() => setFailedImages(prev => ({ ...prev, [i]: true }))}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openLightbox(img.url, i) }}
                      className="p-2.5 rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow-sm hover:scale-105 transition-all duration-200 cursor-pointer"
                      title="Preview Image"
                    >
                      <Eye className="size-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (failedImages[i]) {
                          alert('Image expired or unavailable. Please re-run the task to generate fresh images.')
                          return
                        }
                        setDownloadLoading(prev => ({ ...prev, [i]: true }))
                        try {
                          downloadFromUrl(img.url, `${slugifyLabel(img.label)}.png`)
                          showToast?.({ title: 'Download completed successfully!', variant: 'success' })
                        } catch {
                          showToast?.({ title: 'Download failed. Please try again.', variant: 'error' })
                        }
                        setTimeout(() => setDownloadLoading(prev => ({ ...prev, [i]: false })), 1000)
                      }}
                      disabled={!!downloadLoading[i]}
                      className="p-2.5 rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow-sm hover:scale-105 transition-all duration-200 cursor-pointer disabled:opacity-60"
                      title="Download Image"
                    >
                      {downloadLoading[i] ? (
                        <Loader size={5} className="!size-5" />
                      ) : (
                        <Download className="size-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="px-4 py-3 flex flex-wrap gap-2 items-center justify-between bg-white mt-auto">
                <span className="text-sm font-medium text-zinc-700 truncate pr-2">{img.label}</span>
                <div className="flex items-center gap-1.5">
                  {isShayTask && (
                    <button
                      onClick={() => handleBrandKit(img.url, i, brandName)}
                      disabled={!!brandKitLoading[i]}
                      className="cursor-pointer flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {brandKitLoading[i] ? (
                        <span className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      Brand Kit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (failedImages[i]) {
                        alert('Image expired or unavailable. Please re-run the task to generate fresh images.')
                        return
                      }
                      setDownloadLoading(prev => ({ ...prev, [i]: true }))
                      try {
                        downloadFromUrl(img.url, `${slugifyLabel(img.label)}.png`)
                        showToast?.({ title: 'Download completed successfully!', variant: 'success' })
                      } catch {
                        showToast?.({ title: 'Download failed. Please try again.', variant: 'error' })
                      }
                      setTimeout(() => setDownloadLoading(prev => ({ ...prev, [i]: false })), 1000)
                    }}
                    disabled={!!downloadLoading[i]}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {downloadLoading[i] ? (
                      <Loader size={3} className="!size-3.5" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    {isShayTask ? 'PNG' : 'Download'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-500">No images found in output.</p>
        </div>
      )}

      {activeLightboxImg && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-opacity duration-300"
          onClick={() => setActiveLightboxImg(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-2.5 rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 z-20 border border-white/10 cursor-pointer"
            onClick={() => setActiveLightboxImg(null)}
          >
            <X className="size-6" />
          </button>

          {lightboxLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <Loader size={8} className="text-white" />
            </div>
          )}

          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={activeLightboxImg}
              alt="Preview"
              onLoad={() => setLightboxLoading(false)}
              className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10 transition-opacity duration-300 ${lightboxLoading ? 'opacity-0' : 'opacity-100'}`}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
