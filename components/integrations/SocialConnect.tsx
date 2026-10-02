// @ts-nocheck
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/toast-provider'

import { createClient } from '@/lib/supabase/client'


const PROVIDERS = [
  { key: 'linkedin', name: 'LinkedIn', color: '#0A66C2', auth: '/api/auth/linkedin' },
  {
    key: 'meta',
    name: 'Facebook & Instagram',
    auth: '/api/auth/meta',
    subtitle: 'Publish directly to Facebook Pages and Instagram',
  },
]

function connectionErrorMessage(providerName, errorCode) {
  if (providerName === 'LinkedIn' && errorCode === 'setup_required') {
    return 'LinkedIn connection requires setup — contact support.'
  }
  if (providerName === 'Facebook' || providerName === 'Instagram') {
    return 'Facebook/Instagram connection requires setup — contact support.'
  }
  if (errorCode) return `${providerName} connection failed: ${errorCode}`
  return `Could not start ${providerName} connection.`
}

function MetaIconPair() {
  return (
    <div className="flex space-x-2">
      <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
        f
      </div>
      <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
        ◎
      </div>
    </div>
  )
}

export default function SocialConnect() {

  const { showToast } = useToast()
  
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [metaPages, setMetaPages] = useState([])
  const [selectedMetaPage, setSelectedMetaPage] = useState('')
  const [loadingMetaPages, setLoadingMetaPages] = useState(false)

  const popupRef = useRef(null)
  const popupPollRef = useRef(null)

  const getActiveSession = useCallback(async () => {
    if (session?.access_token) return session
    const supabase = createClient()
    const { data: { session: activeSession } } = await supabase.auth.getSession()
    if (activeSession) setSession(activeSession)
    return activeSession
  }, [session])

  const authHeaders = useCallback((activeSession = session) => (
    activeSession ? { Authorization: `Bearer ${activeSession.access_token}` } : {}
  ), [session])

  const loadStatus = useCallback(async (activeSession) => {
    if (!activeSession) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/integrations/social/status', {
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      })
      if (res.ok) {
        const nextStatus = await res.json()
        setStatus(nextStatus)
        if (nextStatus.facebook?.connected) {
          setLoadingMetaPages(true)
          try {
            const pagesRes = await fetch('/api/integrations/meta/pages', {
              headers: { Authorization: `Bearer ${activeSession.access_token}` },
            })
            const pagesData = await pagesRes.json().catch(() => ({}))
            const pages = Array.isArray(pagesData.pages) ? pagesData.pages : []
            setMetaPages(pages)
            setSelectedMetaPage(nextStatus.facebook?.provider_page_id || '')
            if (!nextStatus.facebook?.provider_page_id && pages.length === 1) {
              await fetch('/api/integrations/meta/pages', {
                method: 'POST',
                headers: { Authorization: `Bearer ${activeSession.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_id: pages[0].id }),
              })
              setSelectedMetaPage(pages[0].id)
            }
          } finally {
            setLoadingMetaPages(false)
          }
        } else {
          setMetaPages([])
          setSelectedMetaPage('')
        }
      }
    } catch {
      // Keep the cards usable even if status polling fails.
    } finally {
      setLoading(false)
    }
  }, [])

  const clearPopupPoll = useCallback(() => {
    if (popupPollRef.current) {
      window.clearInterval(popupPollRef.current)
      popupPollRef.current = null
    }
  }, [])

  const finishPopupConnection = useCallback(async ({ provider, status: resultStatus, error }) => {
    clearPopupPoll()
    popupRef.current = null
    setBusy(null)

    const activeSession = await getActiveSession()
    if (activeSession) await loadStatus(activeSession)

    const providerName = PROVIDERS.find((item) => item.key === provider)?.name || (provider === 'meta' ? 'Facebook & Instagram' : 'Integration')
    if (resultStatus === 'success') {
      showToast({ title: `${providerName} connected!`, variant: 'success' })
    } else {
      showToast({ title: connectionErrorMessage(providerName, error), variant: 'error' })
    }
  }, [clearPopupPoll, getActiveSession, loadStatus])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('linkedin_connected')) showToast({ title: 'LinkedIn connected!', variant: 'success' })
    if (params.get('meta_connected')) showToast({ title: 'Facebook/Instagram connected!', variant: 'success' })
    if (params.get('linkedin_error')) showToast({ title: connectionErrorMessage('LinkedIn', params.get('linkedin_error')), variant: 'error' })
    if (params.get('meta_error')) showToast({ title: connectionErrorMessage('Facebook', params.get('meta_error')), variant: 'error' })
    if (params.get('linkedin_connected') || params.get('meta_connected') || params.get('linkedin_error') || params.get('meta_error')) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadStatus(session)
      else setLoading(false)
    })
  }, [loadStatus])

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== '3rdshift:oauth') return
      finishPopupConnection(event.data)
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      clearPopupPoll()
    }
  }, [clearPopupPoll, finishPopupConnection])

  const connect = async (provider) => {
    setBusy(provider.key)
    const width = 640
    const height = 760
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
    const popup = window.open(
      'about:blank',
      `3rdshift-${provider.key}-oauth`,
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )

    if (!popup) {
      setBusy(null)
      showToast({ title: `Could not open ${provider.name} connection popup. Allow pop-ups for 3rdShift and try again.`, variant: 'error' })
      return
    }

    popupRef.current = popup
    popup.document.write('<!doctype html><title>Connecting...</title><body style="font-family:system-ui,sans-serif;padding:24px">Connecting...</body>')
    clearPopupPoll()
    popupPollRef.current = window.setInterval(() => {
      if (popup.closed) {
        clearPopupPoll()
        popupRef.current = null
        setBusy(null)
      }
    }, 500)

    try {
      const activeSession = await getActiveSession()
      if (!activeSession) {
        popup.close()
        showToast({ title: `Could not start ${provider.name} connection. Please refresh and try again.`, variant: 'error' })
        return
      }

      const res = await fetch(provider.auth, {
        method: 'POST',
        headers: { ...authHeaders(activeSession), 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.key }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.url) {
        popup.location.href = data.url
        return
      }
      popup.close()
      showToast({ title: data.error || connectionErrorMessage(provider.name, data.code), variant: 'error' })
    } catch (error) {
      console.error(`[integrations] Failed to start ${provider.key} connection`, error)
      popup.close()
      showToast({ title: connectionErrorMessage(provider.name), variant: 'error' })
    }
    setBusy(null)
  }

  const disconnect = async (provider) => {
    setBusy(provider.key)
    try {
      const activeSession = await getActiveSession()
      if (!activeSession) {
        showToast({ title: `Could not disconnect ${provider.name}. Please refresh and try again.`, variant: 'error' })
        return
      }

      const providersToDisconnect = provider.key === 'meta' ? ['facebook', 'instagram'] : [provider.key]
      for (const providerKey of providersToDisconnect) {
        const res = await fetch('/api/integrations/social/disconnect', {
          method: 'POST',
          headers: { ...authHeaders(activeSession), 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: providerKey }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast({ title: data.error || `Could not disconnect ${provider.name}.`, variant: 'error' })
          return
        }
      }

      await loadStatus(activeSession)
      showToast({ title: `${provider.name} disconnected.`, variant: 'success' })
    } catch {
      showToast({ title: `Could not disconnect ${provider.name}.`, variant: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const selectMetaPage = async (pageId) => {
    setSelectedMetaPage(pageId)
    setBusy('meta-page')
    try {
      const activeSession = await getActiveSession()
      if (!activeSession) {
        showToast({ title: 'Could not choose Facebook Page. Please refresh and try again.', variant: 'error' })
        return
      }
      const res = await fetch('/api/integrations/meta/pages', {
        method: 'POST',
        headers: { ...authHeaders(activeSession), 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ title: data.error || 'Could not choose Facebook Page.', variant: 'error' })
        return
      }
      await loadStatus(activeSession)
      showToast({ title: 'Facebook Page selected.', variant: 'success' })
    } catch {
      showToast({ title: 'Could not choose Facebook Page.', variant: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {PROVIDERS.map((provider) => {
        const connected = provider.key === 'meta'
          ? !!(status.facebook?.connected || status.instagram?.connected)
          : status[provider.key]?.connected
        const name = provider.key === 'meta'
          ? (status.facebook?.name || status.instagram?.name)
          : status[provider.key]?.name
        return (
          <div key={provider.key} className="rounded-xl border border-zinc-950/[0.08] bg-white p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 sm:gap-5">
                    {provider.key === 'meta' ? (
                      <MetaIconPair />
                    ) : (
                      <div className="h-11 w-11 flex items-center justify-center border border-zinc-200 rounded-md font-semibold">
                        in
                      </div>
                    )}
                    <span className={`items-center gap-2 text-sm sm:text-base font-semibold text-[#17B26A] ${connected ? "flex sm:hidden" : "hidden"}`}>
                      <span className="size-2 rounded-full bg-[#17B26A]" />
                      Connected
                    </span>
                  </div>
                  <button
                    onClick={() => disconnect(provider)}
                    disabled={busy === provider.key}
                    className={`text-sm sm:text-base font-semibold text-neutral-500 hover:text-red-500 transition duration-300 cursor-pointer ${connected ? "flex sm:hidden" : "hidden"}`}
                  >
                    {busy === provider.key ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>

                <div>
                  <div className="text-lg font-semibold text-zinc-800 mb-1">{provider.name}</div>
                  <div className="text-sm text-neutral-500">
                    {loading ? 'Checking connection...' : connected ? `Connected${name ? ` as ${name}` : ''}` : (provider.subtitle || `Publish directly to ${provider.name}`)}
                  </div>
                </div>
              </div>
              {connected ? (
                <div className="hidden sm:flex items-center gap-3 sm:gap-5">
                  <span className="flex items-center gap-2 text-sm sm:text-base font-semibold text-[#17B26A]">
                    <span className="size-2 rounded-full bg-[#17B26A]" />
                    Connected
                  </span>
                  <button
                    onClick={() => disconnect(provider)}
                    disabled={busy === provider.key}
                    className="text-sm sm:text-base font-semibold text-neutral-500 hover:text-red-500 transition duration-300 cursor-pointer"
                  >
                    {busy === provider.key ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={() => connect(provider)}
                  disabled={!!busy}
                >
                  {busy === provider.key ? 'Connecting…' : provider.key === 'meta' ? 'Connect' : `Connect ${provider.name}`}
                </Button>
              )}
            </div>

            {provider.key === 'meta' && connected && (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Facebook Page</div>
                    <div className="text-xs text-zinc-500">
                      {loadingMetaPages
                        ? 'Loading Pages...'
                        : metaPages.length
                          ? 'Choose the Page 3rdShift should publish to.'
                          : 'No Facebook Pages were returned for this account.'}
                    </div>
                  </div>
                  {status.instagram?.connected && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Instagram ready</span>
                  )}
                </div>
                {metaPages.length > 0 && (
                  <select
                    value={selectedMetaPage}
                    onChange={(event) => selectMetaPage(event.target.value)}
                    disabled={busy === 'meta-page'}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-60"
                  >
                    <option value="" disabled>Select a Page</option>
                    {metaPages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}{page.instagram_business_account?.username ? ` + @${page.instagram_business_account.username}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {connected && !status.facebook?.provider_page_id && metaPages.length !== 1 && (
                  <p className="mt-2 text-xs text-amber-700">Facebook publishing needs a Page selection before posts can be sent.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
