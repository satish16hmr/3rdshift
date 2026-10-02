// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import Image from 'next/image'

import { Field, FieldGroup, Label, Description } from '@/components/fieldset'
import { Textarea } from '@/components/textarea'
import BeckResumeForm from '@/components/workers/BeckResumeForm'
import BellaBookkeepingForm from '@/components/workers/BellaBookkeepingForm'
import RemyEditForm from '@/components/workers/RemyEditForm'
import TeamMemberChat from '@/components/chat/TeamMemberChat'

import { renderFormField } from './task-form/FormFieldRenderer'
import { TaskCompletedView } from './task-form/TaskCompletedView'
import { TaskSubmitFooter } from './task-form/TaskSubmitFooter'
import { ModeAndTemplateSection } from './task-form/ModeAndTemplateSection'

import { getRegistryPricedFooterText } from '@/lib/footerPricing'
import { getWorkerAvatarSrcBySlug } from '@/lib/worker-avatars'

const MAX_CHARS = 2000

interface TaskFormLeftPanelProps {
    worker?: any;
    slug?: any;
    formConfig?: any;
    formValues?: any;
    setFormValues?: any;
    charCounts?: any;
    setCharCounts?: any;
    selectedTemplateId?: any;
    setSelectedTemplateId?: any;
    uploadedContent?: any;
    setUploadedContent?: any;
    audioUploads?: any;
    setAudioUploads?: any;
    audioUploadsRef?: any;
    hasModeCredits?: any;
    hasWorkerModes?: any;
    modeCardState?: any;
    setModeCardState?: any;
    upgradeMode?: any;
    setUpgradeMode?: any;
    workerModeState?: any;
    setWorkerModeState?: any;
    selectedWorkerModeId?: any;
    setSelectedWorkerModeId?: any;
    urlMode?: any;
    updateField?: any;
    updateMultiSelect?: any;
    visibleFields?: any;
    requiredFields?: any;
    optionalSection?: any;
    optionalFields?: any;
    isShowroom?: any;
    isLocked?: any;
    isStarterBlockedHeavy?: any;
    insufficientCredits?: any;
    submitting?: any;
    submitSeconds?: any;
    submitLabel?: any;
    creditCost?: any;
    heavyCreditsRemaining?: any;
    generationEstimateText?: any;
    error?: any;
    fieldErrors?: any;
    userPlan?: any;
    planLoading?: any;
    activeWorkspaceId?: any;
    showroomUpgradeOpen?: any;
    setShowroomUpgradeOpen?: any;
    handleSubmit?: any;
    initialTaskId?: any;
    completedTaskId?: any;
    currentTask?: any;
    onCreateNew?: any;
    onAskRefine?: () => void;
    onSeeResult?: () => void;
    onTaskCreated?: (taskId: string) => void;
}

const TaskFormLeftPanel = ({
    worker,
    slug,
    formConfig,
    formValues,
    setFormValues,
    charCounts,
    setCharCounts,
    selectedTemplateId,
    setSelectedTemplateId,
    uploadedContent,
    setUploadedContent,
    audioUploads,
    setAudioUploads,
    audioUploadsRef,
    hasModeCredits,
    hasWorkerModes,
    modeCardState,
    setModeCardState,
    upgradeMode,
    setUpgradeMode,
    workerModeState,
    setWorkerModeState,
    selectedWorkerModeId,
    setSelectedWorkerModeId,
    urlMode,
    updateField,
    updateMultiSelect,
    visibleFields,
    requiredFields,
    optionalSection,
    optionalFields,
    isShowroom,
    isLocked,
    isStarterBlockedHeavy,
    insufficientCredits,
    submitting,
    submitSeconds,
    submitLabel,
    creditCost,
    heavyCreditsRemaining,
    generationEstimateText,
    error,
    fieldErrors = {},
    userPlan,
    planLoading,
    activeWorkspaceId,
    showroomUpgradeOpen,
    setShowroomUpgradeOpen,
    handleSubmit,
    initialTaskId,
    completedTaskId,
    currentTask,
    onCreateNew,
    onAskRefine,
    onSeeResult,
    onTaskCreated
}: TaskFormLeftPanelProps) => {
    const searchParams = useSearchParams()
    const tabParam = searchParams?.get('tab')

    const [activeTab, setActiveTab] = useState(() => {
        return (tabParam === 'chat' || tabParam === 'form') ? tabParam : 'form'
    })

    useEffect(() => {
        if (tabParam === 'chat' || tabParam === 'form') {
            setActiveTab(tabParam)
        }
    }, [tabParam])

    const workerName = worker?.name || slug
    const workerPersona = worker?.personaName || workerName.split(' ')[0]
    const workerEmoji = worker?.emoji || '🤖'
    const taskType = worker?.taskType || 'light'
    const avatarSrc = getWorkerAvatarSrcBySlug(slug)
    const selectedMode = formValues?.['course_mode'] || urlMode || 'signature'
    const computedFooterText = getRegistryPricedFooterText(formConfig?.footerText, creditCost)
    const router = useRouter()

    const isBusy = submitting || (completedTaskId && (!currentTask || ['processing', 'pending', 'queued'].includes(currentTask.status)))

    const renderField = (field: any) => {
        return renderFormField(field, {
            formValues,
            slug,
            isShowroom,
            updateField,
            updateMultiSelect,
            setUploadedContent,
            audioUploadsRef,
            setAudioUploads,
            fieldErrors,
            charCounts,
            setCharCounts,
            creditCost,
            worker
        })
    }

    return (
        <div
            className="flex flex-col overflow-auto border border-zinc-200 rounded-xl h-full 2xl:h-[calc(100vh-85px)]"
        >
            <div className="bg-zinc-50 px-4 sm:px-6 py-4 border-b border-zinc-200">
                <div className="flex items-center gap-4">
                    <div className="shrink-0">
                        {avatarSrc ? (
                            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-zinc-200">
                                <Image
                                    src={avatarSrc}
                                    alt={`${workerPersona} avatar`}
                                    width={64}
                                    height={64}
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl">
                                {workerEmoji}
                            </div>
                        )}
                    </div>

                    <div>
                        <h1 className="text-xl sm:text-2xl font-medium text-zinc-900">{workerPersona}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[13px] sm:text-sm text-zinc-500">{worker?.category || 'Team Member'}</p>
                            {taskType === 'heavy' && (!worker.modeCredits || !Object.values(worker.modeCredits || {}).some(c => c === 0)) && (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                    PRO+
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 mt-3 w-full bg-zinc-200 border border-zinc-300 p-1 rounded-[10px]">
                    <button
                        onClick={() => setActiveTab('form')}
                        className={`px-4 py-2 h-8.5 text-sm font-semibold rounded-md transition-colors w-[50%] cursor-pointer ${activeTab === 'form'
                            ? 'bg-white text-zinc-700'
                            : 'border-transparent text-zinc-500 hover:text-zinc-900'
                            }`}
                    >
                        Form
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex items-center justify-center gap-2 px-4 py-2 h-8.5 text-sm font-semibold rounded-[6px] transition-colors w-[50%] cursor-pointer ${activeTab === 'chat'
                            ? 'bg-white text-zinc-700'
                            : 'border-transparent text-zinc-500 hover:text-zinc-900'
                            }`}
                    >
                        Chat
                        <span className="inline-flex items-center rounded-md bg-[#F5F8FF] border border-[#8DAFF9] px-1.5 text-xs font-medium text-blue-700 h-[22px] capitalize!">{'new'}</span>
                    </button>
                </div>
            </div>

            {planLoading ? (
                <div className="flex flex-1 items-center justify-center h-full min-h-150 2xl:min-h-none">
                    <LoaderCircle className="size-6 animate-spin text-zinc-400" />
                </div>
            ) : (
                <>
                    {activeTab === 'chat' && (
                        <TeamMemberChat
                            worker={worker}
                            slug={slug}
                            initialTaskId={initialTaskId}
                            onOpenForm={(prefillData) => {
                                setActiveTab('form')
                                if (prefillData && typeof prefillData === 'object') {
                                    setFormValues(prev => ({ ...prev, ...prefillData }))
                                }
                            }}
                        />
                    )}
                    {completedTaskId && currentTask?.status === 'completed' && activeTab === 'form' ? (
                        <TaskCompletedView
                            avatarSrc={avatarSrc}
                            workerPersona={workerPersona}
                            workerEmoji={workerEmoji}
                            worker={worker}
                            slug={slug}
                            onAskRefine={onAskRefine}
                            onSeeResult={onSeeResult}
                            currentTask={currentTask}
                        />
                    ) : (
                        <>
                            {activeTab === 'form' && (
                                <>
                                    <ModeAndTemplateSection
                                        hasWorkerModes={hasWorkerModes}
                                        workerModeState={workerModeState}
                                        setWorkerModeState={setWorkerModeState}
                                        worker={worker}
                                        selectedWorkerModeId={selectedWorkerModeId}
                                        setSelectedWorkerModeId={setSelectedWorkerModeId}
                                        userPlan={userPlan}
                                        setFormValues={setFormValues}
                                        hasModeCredits={hasModeCredits}
                                        modeCardState={modeCardState}
                                        setModeCardState={setModeCardState}
                                        heavyCreditsRemaining={heavyCreditsRemaining}
                                        planLoading={planLoading}
                                        setUpgradeMode={setUpgradeMode}
                                        upgradeMode={upgradeMode}
                                        formValues={formValues}
                                        urlMode={urlMode}
                                        setSelectedTemplateId={setSelectedTemplateId}
                                        submitting={submitting}
                                        isBusy={isBusy}
                                    />

                                    <div id="worker-form-card" className='flex flex-col justify-between h-full' style={(hasModeCredits && !hasWorkerModes && modeCardState !== 'form') || (hasWorkerModes && workerModeState !== 'form') ? { display: 'none' } : {}}>
                                        <div>
                                            {slug === 'bookkeeping-summarizer' ? (
                                                <div style={isShowroom || isLocked ? { pointerEvents: 'none', cursor: 'not-allowed', userSelect: 'none', position: 'relative', borderRadius: 8, overflow: 'hidden' } : {}}>
                                                    {(isShowroom || isLocked) && <div style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'not-allowed', background: 'rgba(249,250,251,0.75)', backdropFilter: 'grayscale(0.3) brightness(0.97)', borderRadius: 8 }} />}
                                                    <BellaBookkeepingForm
                                                        worker={worker}
                                                        slug={slug}
                                                        userPlan={userPlan}
                                                        planLoading={planLoading}
                                                        heavyCreditsRemaining={heavyCreditsRemaining}
                                                        activeWorkspaceId={activeWorkspaceId}
                                                        onTaskCreated={onTaskCreated}
                                                    />
                                                </div>
                                            ) : slug === 'resume-writer' ? (
                                                <div style={isShowroom || isLocked ? { pointerEvents: 'none', cursor: 'not-allowed', userSelect: 'none', position: 'relative', borderRadius: 8, overflow: 'hidden' } : {}}>
                                                    {(isShowroom || isLocked) && <div style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'not-allowed', background: 'rgba(249,250,251,0.75)', backdropFilter: 'grayscale(0.3) brightness(0.97)', borderRadius: 8 }} />}
                                                    <BeckResumeForm
                                                        worker={worker}
                                                        slug={slug}
                                                        userPlan={userPlan}
                                                        planLoading={planLoading}
                                                        heavyCreditsRemaining={heavyCreditsRemaining}
                                                        activeWorkspaceId={activeWorkspaceId}
                                                        onTaskCreated={onTaskCreated}
                                                    />
                                                </div>
                                            ) : slug === 'creative-editor' ? (
                                                <div style={isShowroom || isLocked ? { pointerEvents: 'none', cursor: 'not-allowed', userSelect: 'none', position: 'relative', borderRadius: 8, overflow: 'hidden' } : {}}>
                                                    {(isShowroom || isLocked) && <div style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'not-allowed', background: 'rgba(249,250,251,0.75)', backdropFilter: 'grayscale(0.3) brightness(0.97)', borderRadius: 8 }} />}
                                                    <RemyEditForm
                                                        worker={worker}
                                                        slug={slug}
                                                        userPlan={userPlan}
                                                        planLoading={planLoading}
                                                        heavyCreditsRemaining={heavyCreditsRemaining}
                                                        activeWorkspaceId={activeWorkspaceId}
                                                        onTaskCreated={onTaskCreated}
                                                    />
                                                </div>
                                            ) : (
                                                <FieldGroup>
                                                    <div style={isShowroom ? {
                                                        pointerEvents: 'none',
                                                        cursor: 'not-allowed',
                                                        userSelect: 'none',
                                                        position: 'relative',
                                                        borderRadius: 8,
                                                        overflow: 'hidden',
                                                    } : {}}>
                                                        {isShowroom && <div style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'not-allowed', background: 'rgba(249,250,251,0.75)', backdropFilter: 'grayscale(0.3) brightness(0.97)', borderRadius: 8 }} />}

                                                        <div className='space-y-2.5 p-4 pt-2.5'>
                                                            {formConfig?.sections?.map((section, idx) => {
                                                                if (section.accordion !== undefined) {
                                                                    const isOpenByDefault = section.defaultOpen || false;
                                                                    return (
                                                                        <details
                                                                            key={idx}
                                                                            open={isOpenByDefault}
                                                                            className="border border-zinc-200 rounded-lg"
                                                                            style={{ borderRadius: '8px' }}
                                                                        >
                                                                            <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-4 py-3.5 bg-[#F5F5F5] hover:bg-zinc-100 transition-colors rounded-t-[7px] [details:not([open])_&]:rounded-b-[7px]">
                                                                                <span className="text-sm font-medium text-zinc-800">{section.label}</span>
                                                                                <svg className="section-chevron w-5 h-5 text-black transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                                                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </summary>
                                                                            <div className="px-4 pt-4 pb-5 space-y-4 border-t border-zinc-200">
                                                                                {section.fields.map(renderField)}
                                                                            </div>
                                                                        </details>
                                                                    )
                                                                } else if (section.collapsed) {
                                                                    const detailsProps = section.defaultOpen ? { open: true } : {};

                                                                    return (
                                                                        <details
                                                                            key={idx}
                                                                            {...detailsProps}
                                                                            className="border border-zinc-200 rounded-lg"
                                                                            style={{ borderRadius: '8px' }}
                                                                        >
                                                                            <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-4 py-3.5 bg-[#F5F5F5] hover:bg-zinc-100 transition-colors rounded-t-[7px] [details:not([open])_&]:rounded-b-[7px]">
                                                                                <span className="text-sm font-medium text-zinc-800">{section.label}</span>
                                                                                <svg className="section-chevron w-5 h-5 text-black transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                                                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </summary>
                                                                            <div className="px-4 pt-4 pb-5 space-y-4 border-t border-zinc-200">
                                                                                {section.fields.map(renderField)}
                                                                            </div>
                                                                        </details>
                                                                    )
                                                                } else {
                                                                    return (
                                                                        <div key={idx} className="space-y-4">
                                                                            {section.label && (
                                                                                <h3 className="text-sm font-semibold text-zinc-700 mb-3">{section.label}</h3>
                                                                            )}
                                                                            {section.fields.map(renderField)}
                                                                        </div>
                                                                    )
                                                                }
                                                            })}
                                                        </div>
                                                    </div>
                                                    {!formConfig && (
                                                        <Field>
                                                            <Label className="text-sm! font-medium! text-[#414651]!">What do you need?</Label>
                                                            <Textarea
                                                                name="task_input"
                                                                rows={6}
                                                                placeholder="Describe what you need from this worker..."
                                                                value={formValues['task_input'] || ''}
                                                                onChange={e => {
                                                                    updateField('task_input', e.target.value)
                                                                    setCharCounts(prev => ({ ...prev, task_input: e.target.value.length }))
                                                                }}
                                                                maxLength={MAX_CHARS}
                                                            />
                                                            <Description className="text-right">
                                                                {(charCounts['task_input'] || 0).toLocaleString()} / {MAX_CHARS.toLocaleString()}
                                                            </Description>
                                                        </Field>
                                                    )}
                                                </FieldGroup>
                                            )}
                                        </div>

                                        <TaskSubmitFooter
                                            slug={slug}
                                            worker={worker}
                                            workerPersona={workerPersona}
                                            userPlan={userPlan}
                                            planLoading={planLoading}
                                            isLocked={isLocked}
                                            isShowroom={isShowroom}
                                            isStarterBlockedHeavy={isStarterBlockedHeavy}
                                            selectedMode={selectedMode}
                                            updateField={updateField}
                                            showroomUpgradeOpen={showroomUpgradeOpen}
                                            setShowroomUpgradeOpen={setShowroomUpgradeOpen}
                                            error={error}
                                            insufficientCredits={insufficientCredits}
                                            creditCost={creditCost}
                                            heavyCreditsRemaining={heavyCreditsRemaining}
                                            computedFooterText={computedFooterText}
                                            handleSubmit={handleSubmit}
                                            submitting={submitting}
                                            completedTaskId={completedTaskId}
                                            currentTask={currentTask}
                                            submitLabel={submitLabel}
                                            submitSeconds={submitSeconds}
                                            generationEstimateText={generationEstimateText}
                                        />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    )
}

export default TaskFormLeftPanel