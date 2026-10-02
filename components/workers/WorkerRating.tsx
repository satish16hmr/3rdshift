'use client'

import React, { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'
import { Loader } from '@/components/loader'

interface WorkerRatingProps {
    currentTask: any
    showToast?: (msg: string) => void
    className?: string
}


export default function WorkerRating({
    currentTask,
    showToast: propShowToast,
    className = '',
}: WorkerRatingProps) {
    const { showToast } = useToast()
    const [ratingSubmitting, setRatingSubmitting] = useState(false)
    const [ratingSubmitted, setRatingSubmitted] = useState(false)
    const [selectedRating, setSelectedRating] = useState<boolean | null>(null)
    const [showFeedback, setShowFeedback] = useState(false)
    const [feedback, setFeedback] = useState('')

    const handleRate = async (rating: boolean) => {
        if (!currentTask?.id || ratingSubmitting || ratingSubmitted) return

        if (rating === false && !showFeedback) {
            setSelectedRating(false)
            setShowFeedback(true)
            return
        }

        setRatingSubmitting(true)
        setSelectedRating(rating)

        try {
            const supabase = createClient()
            const {
                data: { session },
            } = await supabase.auth.getSession()

            const res = await fetch('/api/rate-worker', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({
                    workerSlug: currentTask.worker_slug,
                    taskId: currentTask.id,
                    rating,
                    feedback: rating === false ? feedback.trim() || null : null,
                }),
            })

            if (res.ok) {
                setRatingSubmitted(true)
                showToast({ title: 'Feedback submitted. Thank you!', variant: 'success' })
                propShowToast?.('Feedback submitted. Thank you!')
            } else {
                const err = await res.json().catch(() => ({}))
                console.error('Rate worker failed:', err)
                showToast({ title: 'Failed to submit rating. Please try again.', variant: 'error' })
                propShowToast?.('Failed to submit rating. Please try again.')
                // Reset so they can try again
                if (rating === true) setSelectedRating(null)
            }
        } catch (e) {
            console.error('Rate worker error:', e)
            showToast({ title: 'Error submitting rating.', variant: 'error' })
            propShowToast?.('Error submitting rating.')
            setSelectedRating(null)
        } finally {
            setRatingSubmitting(false)
        }
    }

    if (ratingSubmitted) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <span className="text-sm font-medium text-zinc-500">
                    {selectedRating ? '👍 Thanks for your feedback!' : '👎 Thanks for your feedback!'}
                </span>
            </div>
        )
    }

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <span className="text-sm sm:text-xs font-medium text-zinc-800">
                    How was this result?
                </span>
                <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3 max-[390px]:w-full">
                    <Button
                        variant="outline"
                        className="cursor-pointer max-[390px]:w-full!"
                        onClick={() => handleRate(true)}
                        disabled={ratingSubmitting}
                    >
                        {ratingSubmitting && selectedRating === true ? (
                            <Loader size={4} className="!size-4 text-zinc-800" />
                        ) : (
                            <ThumbsUp className="size-4" />
                        )}
                        Good
                    </Button>

                    <Button
                        variant="outline"
                        className="cursor-pointer max-[390px]:w-full!"
                        onClick={() => handleRate(false)}
                        disabled={ratingSubmitting}
                    >
                        {ratingSubmitting && selectedRating === false && !showFeedback ? (
                            <Loader size={4} className="!size-4 text-zinc-800" />
                        ) : (
                            <ThumbsDown className="size-4" />
                        )}
                        Needs work
                    </Button>
                </div>
            </div>

            {showFeedback && (
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        placeholder="What would you change? (optional)"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRate(false) }}
                        maxLength={200}
                        autoFocus
                        className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <Button
                        variant="primary"
                        onClick={() => handleRate(false)}
                        disabled={ratingSubmitting}
                    >
                        Submit
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setShowFeedback(false)
                            setFeedback('')
                            setSelectedRating(null)
                        }}
                        disabled={ratingSubmitting}
                    >
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    )
}
