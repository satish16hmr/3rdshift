// @ts-nocheck
import React from 'react'

import WorkerTemplateCards from '@/components/workers/WorkerTemplateCards'
import ModeSelectionCards from '@/components/workers/ModeSelectionCards'
import WorkerModeCards from '@/components/workers/WorkerModeCards'
import CharlieUpgradePage from '@/components/workers/CharlieUpgradePage'

interface ModeAndTemplateSectionProps {
    hasWorkerModes: boolean
    workerModeState: any
    setWorkerModeState: (state: any) => void
    worker: any
    selectedWorkerModeId: any
    setSelectedWorkerModeId: (id: any) => void
    userPlan: any
    setFormValues: React.Dispatch<React.SetStateAction<any>>
    hasModeCredits: boolean
    modeCardState: any
    setModeCardState: (state: any) => void
    heavyCreditsRemaining: number
    planLoading: boolean
    setUpgradeMode: (mode: any) => void
    upgradeMode: any
    formValues: any
    urlMode: any
    setSelectedTemplateId: (id: any) => void
    submitting: boolean
    isBusy: boolean
}

export const ModeAndTemplateSection = ({
    hasWorkerModes,
    workerModeState,
    setWorkerModeState,
    worker,
    selectedWorkerModeId,
    setSelectedWorkerModeId,
    userPlan,
    setFormValues,
    hasModeCredits,
    modeCardState,
    setModeCardState,
    heavyCreditsRemaining,
    planLoading,
    setUpgradeMode,
    upgradeMode,
    formValues,
    urlMode,
    setSelectedTemplateId,
    submitting,
    isBusy
}: ModeAndTemplateSectionProps) => {
    return (
        <>
            {hasWorkerModes && workerModeState === 'cards' && (
                <div className="bg-white p-4 sm:p-6 2xl:h-[calc(100vh-250px)] overflow-auto">
                    <WorkerModeCards
                        header={worker.workerModesHeader || 'Choose a mode'}
                        subtitle={worker.workerModesSubtitle || ''}
                        modes={worker.workerModes || []}
                        selectedId={selectedWorkerModeId}
                        userPlan={userPlan}
                        onModeSelect={(modeId) => {
                            const modeField = worker.workerModeField || 'mode'
                            const modeData = (worker.workerModes || []).find(m => m.id === modeId)
                            const prefill = { [modeField]: modeId }
                            if (modeData?.defaultTone) prefill['tone'] = modeData.defaultTone
                            setFormValues(prev => ({ ...prev, ...prefill }))
                            setSelectedWorkerModeId(modeId)
                            setWorkerModeState('form')
                        }}
                    />
                </div>
            )}

            {hasWorkerModes && workerModeState === 'form' && selectedWorkerModeId && (() => {
                const modeData = (worker.workerModes || []).find(m => m.id === selectedWorkerModeId)
                if (!modeData) return null
                return (
                    <div className="p-4 pb-0!">
                        <div style={{ display: 'flex', flexWrap: "wrap", alignItems: 'center', justifyContent: 'space-between', background: '#F5F5F5', border: '1px solid #E9EAEB', borderRadius: 12, padding: '12px 16px', gap: '6px' }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#181D27' }}>
                                {modeData.icon} {modeData.title}
                            </span>
                            <button
                                className={`${isBusy ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}
                                disabled={isBusy}
                                onClick={() => setWorkerModeState('cards')}
                                style={{ fontSize: 14, color: '#2563EB', cursor: isBusy ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                            >
                                ← Change mode
                            </button>
                        </div>
                    </div>
                )
            })()}

            {hasModeCredits && !hasWorkerModes && modeCardState === 'cards' && (
                <div className="rounded-xl border border-zinc-950/[0.08] bg-white px-8 py-8">
                    <ModeSelectionCards
                        worker={worker}
                        userPlan={userPlan}
                        heavyCredits={heavyCreditsRemaining}
                        planLoading={planLoading}
                        onSelectMode={(modeKey) => {
                            setFormValues(prev => ({ ...prev, course_mode: modeKey }))
                            setModeCardState('form')
                            const url = new URL(window.location.href)
                            url.searchParams.set('mode', modeKey)
                            window.history.replaceState({}, '', url.toString())
                        }}
                        onUpgradeMode={(modeKey) => {
                            setUpgradeMode(modeKey)
                            setModeCardState('upgrade')
                        }}
                    />
                </div>
            )}

            {hasModeCredits && !hasWorkerModes && modeCardState === 'upgrade' && upgradeMode && (
                <div className="rounded-xl border border-zinc-950/[0.08] bg-white px-8 py-8">
                    <CharlieUpgradePage
                        mode={upgradeMode}
                        onBack={() => { setModeCardState('cards'); setUpgradeMode(null) }}
                    />
                </div>
            )}

            {(!hasModeCredits || hasWorkerModes || modeCardState === 'form') && (
                <>
                    {hasModeCredits && !hasWorkerModes && modeCardState === 'form' && (() => {
                        const selectedMode = formValues['course_mode'] || urlMode || 'mini_course'
                        const MODE_LABELS = { mini_course: 'Mini-course / Lead magnet', workshop: 'Workshop', signature: 'Signature course', premium: 'Premium transformation / Cohort', certification: 'Certification / Credential prep' }
                        const MODE_EMOJI = { mini_course: '🎯', workshop: '🎓', signature: '🚀', premium: '💎', certification: '🎖️' }
                        return (
                            <div className="p-4 pb-0">
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', justifyContent: 'space-between', background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: 10, padding: '10px 16px' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>
                                        {MODE_EMOJI[selectedMode]} Building: {MODE_LABELS[selectedMode] || selectedMode}
                                    </span>
                                    <button
                                        disabled={isBusy}
                                        onClick={() => {
                                            if (submitting) return
                                            setModeCardState('cards')
                                            const url = new URL(window.location.href)
                                            url.searchParams.delete('mode')
                                            window.history.replaceState({}, '', url.toString())
                                        }}
                                        style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', fontWeight: 500, padding: '2px 4px', opacity: isBusy ? 0.4 : 1 }}
                                    >
                                        Change mode
                                    </button>
                                </div>
                            </div>
                        )
                    })()}

                    {worker?.hasTemplates && (
                        <WorkerTemplateCards
                            templates={hasModeCredits
                                ? (worker.templates || []).filter(t => {
                                    const selectedMode = formValues['course_mode'] || urlMode
                                    if (!selectedMode) return true
                                    if (selectedMode === 'mini_course' || selectedMode === 'workshop') return t.prefill?.course_mode === 'mini_course' || !t.prefill?.course_mode
                                    return t.prefill?.course_mode === selectedMode || t.prefill?.course_mode === 'signature'
                                })
                                : (worker.templates || [])}
                            userPlan={userPlan}
                            requiresPro={worker?.minPlan !== 'starter' || worker?.taskType === 'heavy'}
                            gridCols={worker.templateGridCols}
                            onSelect={(prefill, templateId) => {
                                setFormValues(prev => ({ ...prev, ...prefill }))
                                setSelectedTemplateId(templateId)
                            }}
                        />
                    )}
                </>
            )}
        </>
    )
}
