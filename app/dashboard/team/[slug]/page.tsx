// @ts-nocheck
'use client'

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { Heading } from '@/components/heading'
import { Text } from '@/components/text'
import TaskFormLeftPanel from '@/components/workers/TaskFormLeftPanel'
import TaskFormRightPanel from '@/components/workers/TeamRightPanel'
import { ProfileBottomSheet } from '@/components/ProfileBottomSheet'
import { useToast } from '@/components/toast-provider'

import { trackOutputDownloaded } from '@/lib/posthog'
import { validateRequiredFields } from '@/lib/workers/validate-input'
import { createClient } from '@/lib/supabase/client'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { trackTaskSubmitted } from '@/lib/posthog'
import { getWorkerFormConfig, getWorkerPromptConfig } from '@/lib/workers/configs'
import { getWorkerBySlug, DEPRECATED_SLUGS, getGenerationTimeEstimateSeconds, formatGenerationTimeEstimate } from '@/lib/workers/registry'
import { getSelectedMode, getCreditCost } from '@/lib/workers/modeResolver'
import { downloadDocx, downloadPdf, downloadCsv, downloadBrodyXlsx } from '@/lib/downloads'




function TaskFormInner() {
  const params = useParams()
  const slug = params?.slug
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTaskId = searchParams?.get('taskId') || null
  const [completedTaskId, setCompletedTaskId] = useState(initialTaskId || null)
  const [currentTask, setCurrentTask] = useState(null)
  const [currentTaskLoading, setCurrentTaskLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let poll = null
    let cancelled = false

    const load = async () => {
      setCurrentTaskLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        let query = supabase.from('tasks').select('*').eq('user_id', session.user.id)

        if (completedTaskId) {
          query = query.eq('id', completedTaskId)
        } else {
          // Fallback: load the most recent task for this worker
          query = query
            .eq('worker_slug', slug)
            .in('status', ['completed', 'processing', 'pending', 'queued'])
            .order('created_at', { ascending: false })
            .limit(1)
        }

        const { data: taskData } = await (completedTaskId ? query.single() : query.maybeSingle())

        if (cancelled) return
        if (taskData) {
          setCurrentTask(taskData)
          if (['processing', 'pending', 'queued'].includes(taskData.status)) {
            poll = setInterval(async () => {
              const { data: updated } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskData.id)
                .single()

              if (cancelled) {
                if (poll) clearInterval(poll)
                return
              }
              if (updated) {
                setCurrentTask(updated)
                if (['completed', 'failed'].includes(updated.status)) {
                  clearInterval(poll)
                  if (updated.status === 'completed') {
                    showToast('Task completed!')
                  }
                }
              }
            }, 3000)
          }
        } else {
          setCurrentTask(null)
        }
      } finally {
        if (!cancelled) setCurrentTaskLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (poll) clearInterval(poll)
    }
  }, [completedTaskId, slug])

  const worker = getWorkerBySlug(slug)
  const formConfig = getWorkerFormConfig(slug)
  const promptConfig = getWorkerPromptConfig(slug)

  // Redirect immediately if slug is not in the registry
  useEffect(() => {
    if (slug && !worker) {
      if (slug in DEPRECATED_SLUGS) {
        const successor = DEPRECATED_SLUGS[slug]
        if (successor) {
          router.replace(`/dashboard/team/${successor}`)
        } else {
          router.replace('/dashboard/team')
        }
      } else {
        router.replace('/dashboard/team')
      }
    }
  }, [slug, worker, router])



  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/workspace', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      }).then(r => r.json()).then(async d => {
        if (d.activeWorkspaceId) {
          setActiveWorkspaceId(d.activeWorkspaceId)
          const ws = d.workspaces?.find(w => w.id === d.activeWorkspaceId)
          if (d.ownerCredits) {
            setHeavyCreditsRemaining(d.ownerCredits.available_credits_remaining ?? d.ownerCredits.heavy_credits_remaining ?? 0)
          } else {
            const [{ data }, { data: topups }] = await Promise.all([
              supabase.from('profiles').select('heavy_credits_remaining').eq('id', session.user.id).single(),
              supabase.from('credit_topups').select('credits_remaining, expires_at').eq('user_id', session.user.id).gt('credits_remaining', 0),
            ])
            const activeTopups = (topups ?? [])
              .filter((t) => !t.expires_at || new Date(t.expires_at).getTime() > Date.now())
              .reduce((sum, t) => sum + Math.max(Number(t.credits_remaining ?? 0), 0), 0)
            setHeavyCreditsRemaining((data?.heavy_credits_remaining ?? 0) + activeTopups)
          }
        }
      }).catch(() => { })
    })
  }, [])

  // Pre-fill form from URL query params
  const [charCounts, setCharCounts] = useState({})
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitSeconds, setSubmitSeconds] = useState(0)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [uploadedContent, setUploadedContent] = useState({})
  const [audioUploads, setAudioUploads] = useState({})
  const audioUploadsRef = React.useRef({})
  const { plan: userPlan, loading: planLoading } = useWorkspacePlan()
  const [heavyCreditsRemaining, setHeavyCreditsRemaining] = useState(null)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null)
  const editorRef = useRef(null)
  const isEditorWorker = !!(worker && ['markdown', 'html', 'json', 'csv'].includes(worker.outputFormat))
  const [showroomUpgradeOpen, setShowroomUpgradeOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [showRefineInput, setShowRefineInput] = useState(false)
  const { showToast: triggerGlobalToast } = useToast()
  const showToast = useCallback((msg, variant = 'success') => {
    const isError = typeof msg === 'string' && (
      msg.toLowerCase().includes('fail') ||
      msg.toLowerCase().includes('error') ||
      msg.toLowerCase().includes('wrong') ||
      msg.toLowerCase().includes('unable')
    )
    triggerGlobalToast({
      title: msg,
      variant: isError ? 'error' : variant
    })
  }, [triggerGlobalToast])

  const getEditorHTML = () => editorRef.current?.getHTML() || ''
  const getEditorContent = () => editorRef.current?.getText() || ''

  const handleDownload = async (format) => {
    setDownloadOpen(false)
    setDownloading(true)
    try {
      const slug = currentTask?.worker_slug || ''
      const taskId = currentTask?.id || ''
      trackOutputDownloaded(slug, format)

      const content = getEditorHTML() || currentTask?.output?.text || ''

      if (slug === 'kpi-dashboard-writer') {
        const brodyTitle = currentTask?.input?.business_description
          ? `Key Metrics Framework - ${currentTask.input.business_description.slice(0, 50)}`
          : 'Key Metrics Framework'
        if (format === 'pdf') {
          const supabase = (await import('@/lib/supabase/client')).createClient()
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token || ''
          const res = await fetch('/api/report-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content, title: brodyTitle, taskId }),
          })
          if (!res.ok) throw new Error('PDF generation failed')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `kpi-framework-${taskId?.slice(0, 8) || 'brody'}.pdf`
          a.click()
          URL.revokeObjectURL(url)
        } else if (format === 'docx') {
          await downloadDocx(content, slug, taskId)
        } else if (format === 'xlsx') {
          const metricData = currentTask?.output?.metricData || null
          await downloadBrodyXlsx(currentTask?.output?.text || '', taskId, metricData)
        }
      } else if (format === 'docx') {
        await downloadDocx(content, slug, taskId)
      } else if (format === 'pdf') {
        await downloadPdf(content, slug, taskId)
      } else if (format === 'csv') {
        downloadCsv(content, slug, taskId)
      } else if (format === 'txt') {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([getEditorContent()], { type: 'text/plain' }))
        a.download = `${slug}-${taskId.slice(0, 8)}.txt`
        a.click()
      }
    } catch (err) {
      console.error('Download failed', err)
      showToast('Download failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const [refineSubmitting, setRefineSubmitting] = useState(false)

  const handleRefine = async (refineText) => {
    if (!currentTask?.id || !refineText?.trim()) return
    setRefineSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        showToast('Please login to refine')
        return
      }

      const res = await fetch('/api/tasks/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          original_task_id: currentTask.id,
          refine_input: {
            ...(currentTask.input || {}),
            _refine_instruction: refineText
          }
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Refine failed')
      }

      const data = await res.json()
      if (data.taskId) {
        setShowRefineInput(false)
        setCurrentTask(null)
        setCompletedTaskId(data.taskId)
        showToast('Refinement started...')
      }
    } catch (err: any) {
      showToast(err.message || 'Error refining task')
    } finally {
      setRefineSubmitting(false)
    }
  }

  const [formValues, setFormValues] = useState(() => {
    const prefill = {}
    if (searchParams) {
      const fields = ['target_industry', 'job_titles', 'target_role', 'location', 'company_size']
      fields.forEach(f => {
        const v = searchParams.get(f)
        if (v) prefill[f] = v
      })
      const modeParam = searchParams.get('mode')
      if (modeParam && worker?.modeCredits?.[modeParam] !== undefined) {
        prefill['course_mode'] = modeParam
      }
      if (worker?.workerModeField && worker?.workerModes) {
        const fieldParam = searchParams.get(worker.workerModeField) || searchParams.get('mode')
        const validIds = worker.workerModes.map(m => m.id)
        if (fieldParam && validIds.includes(fieldParam)) {
          prefill[worker.workerModeField] = fieldParam
        }
      }

      if (typeof window !== 'undefined') {
        try {
          const ctxKey = `handoff_context_${worker?.slug || slug}`
          const stored = sessionStorage.getItem(ctxKey)
          if (stored) {
            const ctx = JSON.parse(stored)
            Object.assign(prefill, ctx)
            sessionStorage.removeItem(ctxKey)
          }
        } catch (e) { }
      }
    }
    return prefill
  })

  const retryTaskIdParam = searchParams?.get('retryTaskId') || null
  const retryTaskIdRef = useRef(retryTaskIdParam)

  useEffect(() => {
    if (!retryTaskIdParam) return
    const supabase = createClient()
    supabase.from('tasks').select('input, output_status').eq('id', retryTaskIdParam).maybeSingle().then(({ data }) => {
      if (data?.input && typeof data.input === 'object') {
        setFormValues(prev => ({ ...data.input, ...prev }))
      }
    })
  }, [retryTaskIdParam])

  // Automatically clear field-level errors when user modifies input fields
  useEffect(() => {
    setFieldErrors(prev => {
      let changed = false
      const next = { ...prev }
      for (const fieldName of Object.keys(next)) {
        const hasFile = uploadedContent[fieldName] !== undefined
        const hasAudio = audioUploads[fieldName] !== undefined || audioUploadsRef.current[fieldName] !== undefined
        const hasFormVal = formValues[fieldName] !== undefined && formValues[fieldName] !== '' && formValues[fieldName] !== false

        if (hasFile || hasAudio || hasFormVal) {
          delete next[fieldName]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [formValues, uploadedContent, audioUploads])

  const urlMode = searchParams?.get('mode') || null
  const hasModeCredits = !!worker?.modeCredits
  const validUrlMode = (urlMode && worker?.modeCredits && urlMode in worker.modeCredits) ? urlMode : null
  const [modeCardState, setModeCardState] = useState(() => {
    if (!hasModeCredits) return 'form'
    if (validUrlMode) return 'form'
    return 'cards'
  })
  const [upgradeMode, setUpgradeMode] = useState(null)

  const hasWorkerModes = !!(worker?.workerModes?.length)
  const [workerModeState, setWorkerModeState] = useState(() => {
    if (!hasWorkerModes) return 'form'
    if (searchParams && worker?.workerModeField) {
      const paramVal = searchParams.get(worker.workerModeField) || searchParams.get('mode')
      const validIds = worker.workerModes?.map(m => m.id) || []
      if (paramVal && validIds.includes(paramVal)) return 'form'
    }
    return 'cards'
  })
  useEffect(() => {
    if (workerModeState === 'form') {
      window.scrollTo({ top: 0 })
    }
  }, [workerModeState])
  const [selectedWorkerModeId, setSelectedWorkerModeId] = useState(() => {
    if (hasWorkerModes && searchParams && worker?.workerModeField) {
      const paramVal = searchParams.get(worker.workerModeField) || searchParams.get('mode')
      const validIds = worker.workerModes?.map(m => m.id) || []
      if (paramVal && validIds.includes(paramVal)) return paramVal
    }
    return worker?.workerModesDefault || worker?.workerModes?.[0]?.id || null
  })

  // Clear errors when switching modes, templates, or card screens
  useEffect(() => {
    setFieldErrors({})
    setError('')
  }, [
    selectedWorkerModeId,
    workerModeState,
    modeCardState,
    selectedTemplateId,
    formValues?.['course_mode'],
    formValues?.[worker?.workerModeField]
  ])

  const PLAN_LEVEL = { none: 0, starter: 1, pro: 2, operator: 3 }


  const userLevel = PLAN_LEVEL[userPlan] ?? 0
  const requiredLevel = worker ? (PLAN_LEVEL[worker.minPlan] ?? 1) : 1
  const isLocked = !planLoading && userLevel < requiredLevel

  const allFields = formConfig?.sections?.flatMap(s => s.fields) ?? []
  const visibleFields = allFields.filter(f => {
    if (!f.showWhen) return true
    const depValue = formValues[f.showWhen.field]
    const depStr = depValue === true ? 'true' : depValue === false ? 'false' : (depValue || '')
    return Array.isArray(f.showWhen.value)
      ? f.showWhen.value.includes(depStr)
      : depStr === f.showWhen.value
  })
  const requiredFields = formConfig?.sections?.find(s => !s.collapsed)?.fields ?? []
  const optionalSection = formConfig?.sections?.find(s => s.collapsed)
  const optionalFields = optionalSection?.fields ?? []

  const updateField = (name, value) => {
    setFormValues(prev => ({ ...prev, [name]: value }))
  }

  const updateMultiSelect = (name, option, checked) => {
    setFormValues(prev => {
      const current = prev[name] || []
      if (checked) return { ...prev, [name]: [...current, option] }
      return { ...prev, [name]: current.filter(v => v !== option) }
    })
  }

  const handleSubmit = async () => {
    // 1. Build the input object
    const inputObj = {}
    visibleFields.forEach(f => {
      if (f.type === 'file-upload') {
        const uploaded = uploadedContent[f.name]
        if (uploaded) {
          inputObj[f.name] = uploaded
        }
        return
      }
      if (f.type === 'audio-upload') {
        const audioData = audioUploadsRef.current[f.name]
        if (audioData) {
          inputObj['audio_file_url'] = audioData.url
          inputObj['audio_file_name'] = audioData.fileName
          inputObj['audio_file_path'] = audioData.path
        }
        return
      }
      const val = formValues[f.name]
      if (val !== '' && val !== false && val !== null && val !== undefined && !(Array.isArray(val) && val.length === 0)) {
        inputObj[f.name] = Array.isArray(val) ? val.join(', ') : val === true ? 'Yes' : val
      }
    })
    visibleFields.forEach(f => {
      if (f.type === 'select' && f.defaultValue && inputObj[f.name] === undefined) {
        inputObj[f.name] = f.defaultValue
      }
    })
    if (formValues['task_input']) inputObj['task_input'] = formValues['task_input']
    if (hasWorkerModes && worker?.workerModeField && formValues[worker.workerModeField]) {
      inputObj[worker.workerModeField] = formValues[worker.workerModeField]
    }
    if (selectedTemplateId) inputObj['_selected_template_id'] = selectedTemplateId

    // 2. Validate using validateRequiredFields (Zod & Required check)
    const clientValidation = validateRequiredFields(slug, inputObj)
    if (!clientValidation.valid) {
      const newFieldErrors: Record<string, string> = {}
      clientValidation.errors?.forEach(err => {
        const fieldConf = visibleFields.find(f => f.name === err.field)
        const label = fieldConf?.label || err.field

        let finalMsg = err.message
        if (err.message.toLowerCase().includes('is required')) {
          finalMsg = `"${label}" is required.`
        } else if (!err.message.toLowerCase().includes(err.field.toLowerCase()) && !err.message.toLowerCase().includes(label.toLowerCase())) {
          finalMsg = `"${label}": ${err.message}`
        }
        newFieldErrors[err.field] = finalMsg
      })
      setFieldErrors(newFieldErrors)
      setError('')
      return
    }
    setFieldErrors({})

    // 3. Keep specific custom validations (e.g. lead-generator, duration, limits)
    if (worker?.slug === 'lead-generator') {
      const jobTitles = (formValues['job_titles'] || formValues['target_role'] || '').trim()
      const location = (formValues['location'] || '').trim()
      if (!jobTitles) {
        setError('Required — add at least one job title (e.g., CEO, VP Marketing)')
        return
      }
      if (!location) {
        setError('Required — add a location (e.g., United States, California)')
        return
      }
    }

    for (const field of visibleFields) {
      const val = formValues[field.name] || ''
      if (field.maxLines) {
        const lineCount = val.split('\n').filter(l => l.trim()).length
        if (lineCount > field.maxLines) {
          setError(field.maxLinesError || `Maximum ${field.maxLines} items allowed for "${field.label}"`)
          return
        }
      }
      if (field.maxSeparators !== undefined) {
        const separatorCount = val.split('---').length - 1
        if (separatorCount > field.maxSeparators) {
          setError(field.maxSeparatorsError || `Maximum ${field.maxSeparators + 1} items allowed for "${field.label}"`)
          return
        }
      }
    }

    const audioFields = visibleFields.filter(f => f.type === 'audio-upload' && f.required)
    for (const f of audioFields) {
      if (!audioUploadsRef.current[f.name]) {
        setError('Please upload an audio or video file before submitting.')
        return
      }
    }

    if (slug === 'content-translator') {
      const audioData = audioUploadsRef.current['audio_file']
      if (audioData?.durationSeconds && audioData.durationSeconds > 300) {
        setError('Tala supports translations up to 5 minutes. Please trim your audio/video and try again.')
        return
      }
    }

    if (slug === 'meeting-notes-writer') {
      const audioData = audioUploadsRef.current['audio_file']
      if (audioData?.durationSeconds && audioData.durationSeconds > 3600) {
        setError('Dina handles meetings up to 60 minutes. For longer sessions, split your audio into segments or paste a transcript (1 credit) using the text field below.')
        return
      }
    }

    const fileUploadFields = visibleFields.filter(f => f.type === 'file-upload' && f.required)
    for (const f of fileUploadFields) {
      if (!uploadedContent[f.name]) {
        setError(`Please upload a ${f.label.toLowerCase()} before submitting.`)
        return
      }
    }

    // All validation passed, proceed with submit
    setSubmitting(true)
    setSubmitSeconds(0)
    setError('')
    const timerRef = { current: null }
    timerRef.current = setInterval(() => {
      setSubmitSeconds(s => s + 1)
    }, 1000)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); clearInterval(timerRef.current); setSubmitting(false); return }

      const createRes = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          worker_slug: slug,
          input: inputObj,
          workspace_id: activeWorkspaceId || null,
          ...(retryTaskIdRef.current ? { retry_task_id: retryTaskIdRef.current } : {}),
        }),
      })

      if (!createRes.ok) {
        clearInterval(timerRef.current)
        const errBody = await createRes.json().catch(() => ({}))
        setError(errBody.error || 'Failed to create task')
        setSubmitting(false)
        return
      }

      const createData = await createRes.json()
      const taskId = createData.taskId

      if (!taskId) {
        clearInterval(timerRef.current)
        setError('Failed to create task')
        setSubmitting(false)
        return
      }

      trackTaskSubmitted({
        workerSlug: slug,
        mode: formValues[worker?.workerModeField] || undefined,
        taskType: worker?.taskType || 'light',
        creditsCharged: createData.credits_charged ?? worker?.creditCost ?? 0,
      })

      clearInterval(timerRef.current)
      setCurrentTask(null)
      setCompletedTaskId(taskId)
      setSubmitting(false)
    } catch (e) {
      clearInterval(timerRef.current)
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)

  const workerName = worker?.name || slug
  const submitLabelBase = formConfig?.submitLabel || 'Submit Task'
  const taskType = worker?.taskType || 'light'

  if (!worker || !formConfig) {
    return (
      <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-8">
        <Heading>Redirecting...</Heading>
        <Text className="mt-2">This team member is no longer available.</Text>
      </div>
    )
  }

  const modeCreditsMap = worker?.modeCredits
  const selectedMode = getSelectedMode(worker, formValues, searchParams) || null
  const generationEstimateSeconds = getGenerationTimeEstimateSeconds(worker?.slug, selectedMode)
  const generationEstimateText = formatGenerationTimeEstimate(generationEstimateSeconds)
  const submitLabelsMap = formConfig?.submitLabels
  const submitLabel = (submitLabelsMap && selectedMode && submitLabelsMap[selectedMode]) ? submitLabelsMap[selectedMode] : submitLabelBase
  const effectiveCreditCost = getCreditCost(worker, selectedMode)
  const isFreeMode = modeCreditsMap && effectiveCreditCost === 0
  const isShowroom = !planLoading && userPlan === 'starter' && taskType === 'heavy' && !isFreeMode
  const isStarterBlockedHeavy = !planLoading && userPlan === 'starter' && taskType === 'heavy' && !isFreeMode
  const creditCost = effectiveCreditCost
  const insufficientCredits = taskType === 'heavy' && !isFreeMode && heavyCreditsRemaining !== null && heavyCreditsRemaining < creditCost

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5 2xl:gap-7">
      <TaskFormLeftPanel
        worker={worker}
        slug={slug}
        formConfig={formConfig}
        formValues={formValues}
        onSeeResult={() => setBottomSheetOpen(true)}
        setFormValues={setFormValues}
        charCounts={charCounts}
        setCharCounts={setCharCounts}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        uploadedContent={uploadedContent}
        setUploadedContent={setUploadedContent}
        audioUploads={audioUploads}
        setAudioUploads={setAudioUploads}
        audioUploadsRef={audioUploadsRef}
        hasModeCredits={hasModeCredits}
        hasWorkerModes={hasWorkerModes}
        modeCardState={modeCardState}
        setModeCardState={setModeCardState}
        upgradeMode={upgradeMode}
        setUpgradeMode={setUpgradeMode}
        workerModeState={workerModeState}
        setWorkerModeState={setWorkerModeState}
        selectedWorkerModeId={selectedWorkerModeId}
        setSelectedWorkerModeId={setSelectedWorkerModeId}
        urlMode={urlMode}
        updateField={updateField}
        updateMultiSelect={updateMultiSelect}
        visibleFields={visibleFields}
        requiredFields={requiredFields}
        optionalSection={optionalSection}
        optionalFields={optionalFields}
        isShowroom={isShowroom}
        isLocked={isLocked}
        isStarterBlockedHeavy={isStarterBlockedHeavy}
        insufficientCredits={insufficientCredits}
        submitting={submitting}
        submitSeconds={submitSeconds}
        submitLabel={submitLabel}
        creditCost={creditCost}
        heavyCreditsRemaining={heavyCreditsRemaining}
        generationEstimateText={generationEstimateText}
        error={error}
        fieldErrors={fieldErrors}
        userPlan={userPlan}
        planLoading={planLoading}
        activeWorkspaceId={activeWorkspaceId}
        showroomUpgradeOpen={showroomUpgradeOpen}
        setShowroomUpgradeOpen={setShowroomUpgradeOpen}
        handleSubmit={handleSubmit}
        initialTaskId={initialTaskId}
        completedTaskId={completedTaskId}
        currentTask={currentTask}
        onCreateNew={() => { setCompletedTaskId(null); setCurrentTask(null) }}
        onAskRefine={() => { setShowRefineInput(true); setBottomSheetOpen(true) }}
        onTaskCreated={(taskId) => { setCurrentTask(null); setCompletedTaskId(taskId) }}
      />

      <div className="xl:hidden">
        <ProfileBottomSheet
          open={bottomSheetOpen}
          onClose={() => setBottomSheetOpen(false)}
          title="Task Result"
          initialHeight="small"
          snapPoints={{ small: 75, medium: 50, large: 75, full: 100 }}
          resizable={true}
          maxHeight={95}
          showCloseButton={true}
          contentClassName="h-full overflow-hidden flex flex-col"
        >
          <TaskFormRightPanel
            worker={worker}
            workerSlug={slug}
            slug={slug}
            isSubmitting={submitting}
            completedTaskId={completedTaskId}
            currentTask={currentTask}
            currentTaskLoading={currentTaskLoading}
            showToast={showToast}
            editorRef={editorRef}
            isEditorWorker={isEditorWorker}
            downloading={downloading}
            setDownloading={setDownloading}
            downloadOpen={downloadOpen}
            setDownloadOpen={setDownloadOpen}
            handleDownload={handleDownload}
            getEditorHTML={getEditorHTML}
            getEditorContent={getEditorContent}
            onCreateNew={() => { setCompletedTaskId(null); setCurrentTask(null) }}
            showRefineInput={showRefineInput}
            setShowRefineInput={setShowRefineInput}
            onRefine={handleRefine}
            refineSubmitting={refineSubmitting}
          />
        </ProfileBottomSheet>
      </div>

      <div className="hidden xl:block">
        <TaskFormRightPanel
          worker={worker}
          workerSlug={slug}
          slug={slug}
          isSubmitting={submitting}
          completedTaskId={completedTaskId}
          currentTask={currentTask}
          currentTaskLoading={currentTaskLoading}
          showToast={showToast}
          editorRef={editorRef}
          isEditorWorker={isEditorWorker}
          downloading={downloading}
          setDownloading={setDownloading}
          downloadOpen={downloadOpen}
          setDownloadOpen={setDownloadOpen}
          handleDownload={handleDownload}
          getEditorHTML={getEditorHTML}
          getEditorContent={getEditorContent}
          onCreateNew={() => { setCompletedTaskId(null); setCurrentTask(null) }}
          showRefineInput={showRefineInput}
          setShowRefineInput={setShowRefineInput}
          onRefine={handleRefine}
          refineSubmitting={refineSubmitting}
        />
      </div>

      {/* <div className="xl:hidden">
        <TaskFormRightPanel
          worker={worker}
          workerSlug={slug}
          slug={slug}
          isSubmitting={submitting}
          completedTaskId={completedTaskId}
          currentTask={currentTask}
          showToast={showToast}
          editorRef={editorRef}
          isEditorWorker={isEditorWorker}
          downloading={downloading}
          setDownloading={setDownloading}
          downloadOpen={downloadOpen}
          setDownloadOpen={setDownloadOpen}
          handleDownload={handleDownload}
          getEditorHTML={getEditorHTML}
          getEditorContent={getEditorContent}
          onCreateNew={() => { setCompletedTaskId(null); setCurrentTask(null) }}
          showRefineInput={showRefineInput}
          setShowRefineInput={setShowRefineInput}
          onRefine={handleRefine}
          refineSubmitting={refineSubmitting}
        />
      </div> */}
    </div>
  )
}

export default function TaskForm() {
  return (
    <Suspense fallback={null}>
      <TaskFormInner />
    </Suspense>
  )
} 