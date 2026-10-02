'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { Button } from '@/components/ui/button'

import { Dialog, DialogTitle } from '@/components/dialog'
import { apiFetch } from '@/lib/api-fetch'

export default function DeleteAccount() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleOpen = () => {
    setConfirmText('')
    setSubscriptionError(null)
    setShowModal(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleClose = () => {
    if (submitting) return
    setShowModal(false)
    setConfirmText('')
  }

  const handleConfirm = async () => {
    if (confirmText !== 'DELETE' || submitting) return
    setSubmitting(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await apiFetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (res.ok) {
        setDone(true)
        // Sign out after short delay
        setTimeout(async () => {
          await supabase.auth.signOut()
          router.push('/account-deletion-requested')
        }, 1500)
      } else {
        const json = await res.json()
        if (json.error === 'active_subscription') {
          setSubscriptionError(json.message)
          setSubmitting(false)
        } else {
          alert(json.error || 'Failed to submit deletion request. Please try again.')
          setSubmitting(false)
        }
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="space-y-3 sm:space-y-4 lg:space-y-5">
        <div>
          <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Danger Zone</Subheading>
          <Text className="mt-1 text-neutral-500!">
            Permanently delete your account and all associated data.
          </Text>
        </div>
        <div className="rounded-2xl border border-red-600 bg-[#FEE4E2] p-4 sm:p-5 md:p-6">
          <p className="text-base sm:text-lg font-semibold text-red-600 mb-1">Delete My Account</p>
          <p className="text-sm text-red-600 mb-3 sm:mb-4 md:mb-5">
            Submit a deletion request. We’ll process it within 7 business days and email you when complete.
          </p>
          <Button
            variant="destructive"
            onClick={handleOpen}
          >
            Delete My Account
          </Button>
        </div>
      </section>

      {/* Confirmation Modal */}
      <Dialog backdropClassName='bg-black/50! transition-none!' className="max-w-[90%]! sm:max-w-120! p-4! sm:p-5! md:p-6! transition-none!" open={showModal} onClose={handleClose} size="md">
        {done ? (
          <div className="text-center py-4">
            <p className="text-lg font-semibold text-zinc-950 mb-2">Request submitted.</p>
            <p className="text-sm text-zinc-500">Signing you out…</p>
          </div>
        ) : (
          <>
            <DialogTitle className="text-base! sm:text-lg! md:text-xl! font-bold! text-[#111113]! mb-2!">Delete your account?</DialogTitle>

            {subscriptionError ? (
              // ── Active subscription — block deletion ──
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                  <p className="text-sm font-medium text-amber-900 mb-1">Active subscription</p>
                  <p className="text-sm text-amber-800">{subscriptionError}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    Close
                  </button>
                  <a
                    href="/dashboard/settings/billing"
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors text-center cursor-pointer"
                  >
                    Go to Billing
                  </a>
                </div>
              </>
            ) : (
              // ── No active subscription — show delete form ──
              <>
                <p className="text-sm text-zinc-600 mb-4">
                  Your deletion request will be submitted for review. We’ll process it within 7 business days and email you at your registered address when complete. Cancel your subscription in Billing before submitting if you have an active plan.
                </p>
                <p className="text-sm text-zinc-700 mb-2 font-medium">
                  Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-950 placeholder:text-zinc-300 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 mb-4 font-mono"
                  onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
                  disabled={submitting}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    disabled={submitting}
                    className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirm}
                    disabled={confirmText !== 'DELETE' || submitting}
                    className="flex-1"
                  >
                    {submitting ? 'Submitting…' : 'Delete My Account'}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Dialog>
    </>
  )
}
