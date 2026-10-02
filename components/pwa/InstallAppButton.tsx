// @ts-nocheck
'use client'

import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '../ui/skeleton'

function getPlatform() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) return 'chrome'
  if (/Edg/.test(ua)) return 'edge'
  if (/Firefox/.test(ua)) return 'firefox'
  if (/Safari/.test(ua)) return 'safari'
  return 'other'
}

export default function InstallAppButton({ asSection = false }) {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [platform, setPlatform] = useState('unknown')
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let loadingTimer = null
    const detectedPlatform = getPlatform()
    const finishLoading = () => {
      if (loadingTimer) window.clearTimeout(loadingTimer)
      setLoading(false)
    }

    setPlatform(detectedPlatform)

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
      finishLoading()
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      finishLoading()
    }

    const appInstalledHandler = () => {
      setInstalled(true)
      setPrompt(null)
      finishLoading()
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', appInstalledHandler)

    loadingTimer = window.setTimeout(finishLoading, detectedPlatform === 'ios' ? 0 : 350)

    return () => {
      if (loadingTimer) window.clearTimeout(loadingTimer)
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', appInstalledHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIOSInstructions(true)
      return
    }
    if (prompt) {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setPrompt(null)
    }
  }

  const card = installed ? (
    <>
      {
        loading ? (
          <>
            <Skeleton className='min-h-20.5 bg-zinc-100 rounded-xl p-5'>
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-7 w-7 bg-zinc-200 rounded-md"></span>
                <div className="flex flex-col gap-1">
                  <p className="h-5 w-38 sm:w-48 bg-zinc-200 rounded-md"></p>
                  <p className="h-4 w-52 sm:w-56 md:w-66.25 bg-zinc-200 rounded-md"></p>
                </div>
              </div>
            </Skeleton>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-900">3rdShift is installed</p>
              <p className="text-xs text-emerald-700 mt-0.5">You're running the app from your home screen.</p>
            </div>
          </div>
        )
      }
    </>

  ) : (
    loading ? (
      <Skeleton className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-5 sm:gap-4">
          <div className="space-y-1">
            <div className="h-4 w-36 rounded-md bg-zinc-200"></div>
            <div className="h-4 w-64 max-w-full rounded-md bg-zinc-200"></div>
          </div>
          <div className="h-9 w-36 rounded-md bg-zinc-200"></div>
        </div>
      </Skeleton>
    ) : (
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-5 sm:gap-4">
          <div className='space-y-1'>
            <p className="text-sm font-medium text-zinc-800">Install 3rdShift App</p>
            <p className="text-sm text-neutral-500">Add 3rdShift to your home screen for quick access.</p>
          </div>
          <Button
            variant="primary"
            onClick={handleInstall}
          >
            {platform === 'ios' ? 'How to Install' : 'Install 3rdShift'}
          </Button>
        </div>

        {/* iOS instructions inline */}
        {showIOSInstructions && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">Add to Home Screen on iOS</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Tap the <strong>Share</strong> button at the bottom of Safari</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> in the top right</li>
            </ol>
            <button onClick={() => setShowIOSInstructions(false)} className="mt-2 text-xs text-blue-500 hover:underline">Dismiss</button>
          </div>
        )}
      </div>
    )
  )

  if (!asSection) return card

  return (
    <>
      <section className="space-y-3 sm:space-y-4 lg:space-y-5">
        <div>
          <Subheading className="text-lg! text-zinc-800!">App</Subheading>
          <Text className="mt-1 text-neutral-500!">
            Install 3rdShift on your device for faster access.
          </Text>
        </div>
        {card}
      </section>
    </>
  )
}
