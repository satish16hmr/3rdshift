// @ts-nocheck
import React from 'react'
import Link from 'next/link'
import { LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UpgradeModal } from '@/components/upgrade-modal'
import { Text } from '@/components/text'

interface TaskSubmitFooterProps {
    slug: any
    worker: any
    workerPersona: string
    userPlan: any
    planLoading: boolean
    isLocked: boolean
    isShowroom: boolean
    isStarterBlockedHeavy: boolean
    selectedMode: any
    updateField: (name: string, value: any) => void
    showroomUpgradeOpen: boolean
    setShowroomUpgradeOpen: (open: boolean) => void
    error: any
    insufficientCredits: boolean
    creditCost: number
    heavyCreditsRemaining: number
    computedFooterText: string
    handleSubmit: () => void
    submitting: boolean
    completedTaskId: any
    currentTask: any
    submitLabel: string
    submitSeconds: number
    generationEstimateText: string
}

export const TaskSubmitFooter = ({
    slug,
    worker,
    workerPersona,
    userPlan,
    planLoading,
    isLocked,
    isShowroom,
    isStarterBlockedHeavy,
    selectedMode,
    updateField,
    showroomUpgradeOpen,
    setShowroomUpgradeOpen,
    error,
    insufficientCredits,
    creditCost,
    heavyCreditsRemaining,
    computedFooterText,
    handleSubmit,
    submitting,
    completedTaskId,
    currentTask,
    submitLabel,
    submitSeconds,
    generationEstimateText
}: TaskSubmitFooterProps) => {
    if (slug === 'resume-writer' || slug === 'creative-editor' || slug === 'bookkeeping-summarizer') {
        return null
    }

    const isBusy = submitting || (completedTaskId && (!currentTask || ['processing', 'pending', 'queued'].includes(currentTask.status)))

    return (
        <div className="border-t border-zinc-950/5 p-4 sticky bottom-0 left-0 bg-white z-10 overflow-visible">
            {planLoading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 h-9">
                    <LoaderCircle className="animate-spin h-4 w-4" />
                    Loading…
                </div>
            ) : isLocked ? (
                <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '10px', padding: '16px 20px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#111113', margin: '0 0 4px' }}>
                        🔒 {workerPersona} is part of {worker?.minPlan === 'operator' ? 'Operator' : 'Pro+'}
                    </p>
                    <p style={{ fontSize: '13px', color: '#71717a', margin: '0 0 14px', lineHeight: 1.6 }}>
                        {worker?.minPlan === 'operator' && userPlan === 'pro'
                            ? `Upgrade to Operator to use ${workerPersona} and unlock the full team.`
                            : worker?.minPlan === 'operator'
                                ? `${workerPersona} requires an Operator plan ($199/mo).`
                                : `Upgrade to Pro to use ${workerPersona} and unlock the full team.`}
                    </p>
                    <Link
                        href="/dashboard/settings/billing"
                        style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '10px 20px', borderRadius: '8px', textDecoration: 'none' }}
                    >
                        {worker?.minPlan === 'operator' ? 'Upgrade to Operator →' : 'Upgrade to Pro →'}
                    </Link>
                </div>
            ) : isShowroom ? (
                <>
                    {worker.modeCredits ? (
                        <div style={{ background: '#f8faff', border: '1px solid #dbeafe', borderRadius: '10px', padding: '18px 20px', marginBottom: 4 }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111113', margin: '0 0 6px' }}>
                                {selectedMode === 'certification' ? 'Certification prep' : selectedMode === 'premium' ? 'Premium cohort program' : 'Signature course'} mode requires 2 credits.
                            </p>
                            <p style={{ fontSize: '13px', color: '#52525b', margin: '0 0 12px', lineHeight: 1.6 }}>
                                Starter doesn't include heavy credits — that's a Pro feature.
                            </p>
                            <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px 14px', marginBottom: 14, fontSize: '13px', color: '#1d4ed8', lineHeight: 1.7 }}>
                                <strong>The math:</strong> Pro costs $79/mo. One Signature course at $297 with 3 students = $891. Charlie paid for itself.
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <a
                                    href={`/dashboard/settings/billing?source=charlie-${selectedMode}`}
                                    style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '10px 18px', borderRadius: '8px', textDecoration: 'none' }}
                                >
                                    Upgrade to Pro — Run {selectedMode === 'certification' ? 'Certification' : selectedMode === 'premium' ? 'Premium' : 'Signature'} Mode →
                                </a>
                                <button
                                    onClick={() => updateField('course_mode', 'mini_course')}
                                    style={{ background: 'transparent', color: '#2563eb', fontSize: '13px', fontWeight: 500, padding: '10px 14px', borderRadius: '8px', border: '1px solid #bfdbfe', cursor: 'pointer' }}
                                >
                                    Switch to Mini-course (free) →
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p style={{ fontSize: 13, color: '#a1a1aa', textAlign: 'center', marginBottom: 16 }}>
                                Preview mode — upgrade to Pro to start using {workerPersona}.
                            </p>
                            <div className="flex items-center justify-between">
                                <span style={{ fontSize: 13, color: '#71717a' }}>
                                    Pro+ required ·{' '}
                                    <Link href="/dashboard/team" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                                        40 AI workers are included on Starter →
                                    </Link>
                                </span>
                                <Button color="blue" onClick={() => setShowroomUpgradeOpen(true)}>
                                    Upgrade to Pro →
                                </Button>
                            </div>
                            <UpgradeModal open={showroomUpgradeOpen} onClose={() => setShowroomUpgradeOpen(false)} currentPlan="starter" requiredTier="pro" />
                        </>
                    )}
                </>
            ) : isStarterBlockedHeavy ? (
                <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '10px', padding: '16px 20px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#111113', margin: '0 0 4px' }}>
                        {workerPersona} is a Pro+ team member.
                    </p>
                    <p style={{ fontSize: '13px', color: '#71717a', margin: '0 0 14px', lineHeight: 1.6 }}>
                        Upgrade to Pro to unlock {workerPersona} and the rest of our premium team members.
                    </p>
                    <Link
                        href="/dashboard/settings/billing"
                        style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '10px 20px', borderRadius: '8px', textDecoration: 'none' }}
                    >
                        Upgrade to Pro →
                    </Link>
                </div>
            ) : (
                <>
                    {error && <p className="mb-3 text-sm text-red-500 whitespace-pre-line">{error}</p>}

                    {insufficientCredits && (
                        <div style={{ background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: '10px', padding: '16px 20px', marginBottom: '12px' }}>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: '#111113', margin: '0 0 4px' }}>⚠️ Not enough credits</p>
                            <p style={{ fontSize: '13px', color: '#71717a', margin: '0 0 12px', lineHeight: 1.6 }}>
                                This task costs <strong>{creditCost} credit{creditCost !== 1 ? 's' : ''}</strong>. You have <strong>{heavyCreditsRemaining}</strong> remaining.
                                {userPlan === 'operator'
                                    ? ' Your credits reset at the start of your next billing cycle, or pick up a credit pack now.'
                                    : userPlan === 'pro'
                                        ? ' Credits reset at the start of your next billing cycle. Upgrade to Operator for 150 credits/month plus top-up packs.'
                                        : ''}
                            </p>
                            <a
                                href="/dashboard/settings/billing"
                                style={{ display: 'inline-block', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '7px', textDecoration: 'none' }}
                            >
                                {userPlan === 'operator' ? 'Get More Credits →' : 'Upgrade to Operator →'}
                            </a>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <Text>
                                    <span className="font-medium text-zinc-950">{computedFooterText}</span>
                                </Text>
                            </div>
                            <Button variant="primary" onClick={handleSubmit} disabled={isBusy || insufficientCredits}>
                                {isBusy ? (
                                    <span className="flex items-center gap-2">
                                        <LoaderCircle className='animate-spin' />
                                        Working...
                                    </span>
                                ) : `${submitLabel} →`}
                            </Button>
                        </div>

                        {isBusy && (
                            <div className="text-sm text-zinc-500 text-right space-y-1">
                                {submitSeconds >= 5 && (
                                    worker?.catClass === 'wc-vi'
                                        ? <p className="text-zinc-400">Video generation takes 2–4 minutes. Please stay on this page.</p>
                                        : <p className="text-zinc-400">It's {generationEstimateText}.</p>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
