'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from './ui/button'
import { useToast } from '@/components/toast-provider'
import { Loader } from '@/components/loader'

interface ThumbsRatingProps {
  workerSlug: string
  taskId: string
  workerName?: string
  initialRating?: boolean | null
  initialFeedback?: string
  onRated?: () => void
}

export function StarRating({ workerSlug, taskId, workerName, initialRating, initialFeedback, onRated }: ThumbsRatingProps) {
  const { showToast } = useToast()
  const [selected, setSelected] = useState<boolean | null>(initialRating ?? null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState(initialFeedback || '')
  const [submitted, setSubmitted] = useState(initialRating !== undefined && initialRating !== null)
  const [submitting, setSubmitting] = useState(false)

  const handleThumbsUp = async () => {
    setSelected(true)
    setShowFeedback(false)
    await submit(true, '')
  }

  const handleThumbsDown = () => {
    setSelected(false)
    setShowFeedback(true)
  }

  const submit = async (rating: boolean, feedbackText: string) => {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/rate-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ workerSlug, taskId, rating, feedback: feedbackText.trim() || null }),
      })
      if (res.ok) {
        setSubmitted(true)
        showToast({ title: 'Feedback submitted. Thank you!', variant: 'success' })
        onRated?.()
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('rate-worker failed:', res.status, err)
        showToast({ title: 'Failed to submit rating. Please try again.', variant: 'error' })
      }
    } catch (e) {
      console.error('rate-worker error:', e)
      showToast({ title: 'Error submitting rating.', variant: 'error' })
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 7.5L5.5 9.5L10.5 4.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-sm font-medium text-emerald-800">
          Thanks — your feedback helps improve future results.
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-950/[0.08] bg-white px-6 py-5">
      <p className="text-sm font-semibold text-zinc-950">How was this result?</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          onClick={handleThumbsUp}
          disabled={submitting}
          variant="outline"
          aria-label="Thumbs up"
        >
          {submitting && selected === true ? (
            <Loader size={4} className="!size-4 text-zinc-800" />
          ) : (
            <ThumbsUp className='h-4' />
          )}
          <span>Good</span>
        </Button>
        <Button
          onClick={handleThumbsDown}
          disabled={submitting}
          // className={`cursor-pointer flex items-center gap-1 sm:gap-2 rounded-lg border px-2 sm:px-4 py-2 text-sm font-medium transition-all focus:outline-none disabled:opacity-60
          //   ${selected === false
          //     ? 'border-red-400 bg-red-50 text-red-700'
          //     : 'border-zinc-200 bg-white text-zinc-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
          //   }`}
          variant="outline"
          aria-label="Thumbs down"
        ><ThumbsDown className='h-4' />
          <span>Needs work</span>
        </Button>
      </div>

      {showFeedback && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="What would you change? (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(false, feedback) }}
            maxLength={200}
            autoFocus
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button
            variant="primary"
            onClick={() => submit(false, feedback)}
            disabled={submitting}
          >
            Submit
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setShowFeedback(false)
              setFeedback('')
              setSelected(null)
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
