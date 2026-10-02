// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, Reorder } from 'framer-motion'
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { useRouter } from 'next/navigation'
import {
  X,
  GripVertical,
  ArrowRight,
  Plus,
  Save,
  AlertCircle,
  CreditCard,
  Layers2,
  Coins,
  CircleCheckBig
} from 'lucide-react'

import { z } from 'zod'
import { Input } from '@/components/input'
import { RadioGroup, Radio } from '@/components/radio'
import SchedulePicker from '@/src/components/SchedulePicker'
import { Dialog, DialogTitle, DialogBody } from '@/components/dialog'
import WorkerPicker from './WorkerPicker'
import WorkerConfigPanel, { getWorkerCompletionStatus, isPlaceholderValue } from './WorkerConfigPanel'
import { Button } from '../ui/button'
import { Loader } from '../loader'
import CreditProjection from './CreditProjection'
import Tabs from '../Tabs'
import { useToast } from '@/components/toast-provider'

import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { getMissingWorkerModeFields, getWorkerCreditCost } from '@/lib/agent-mode/types'

const DAY_LABELS = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun'
}

const RECURRING_DAYS_UI = [
  { day: 'sunday', label: 'S' },
  { day: 'monday', label: 'M' },
  { day: 'tuesday', label: 'T' },
  { day: 'wednesday', label: 'W' },
  { day: 'thursday', label: 'T' },
  { day: 'friday', label: 'F' },
  { day: 'saturday', label: 'S' }
]

const scheduleTabs = [
  { label: 'One time', value: 'one-time' },
  { label: 'Recurring', value: 'recurring' }
]

const chainSchema = z.object({
  name: z.string().trim().min(1, 'Give your workflow a name.'),
  workers: z.array(z.any()).min(2, 'Add at least 2 team members to the workflow.'),
})

function getWorkerMeta(slug) {
  return workerRegistry.find(w => w.slug === slug)
}

function getCreditLabel(worker) {
  const missingModes = getMissingWorkerModeFields([worker])
  if (missingModes.length > 0) return 'Choose a mode'
  const cost = getWorkerCreditCost(worker.worker_id, worker.form_settings ?? {}, { requireMode: true })
  const heavyLabel = cost.heavy > 0 ? `${cost.heavy} credit${cost.heavy > 1 ? 's' : ''}` : null
  const lightLabel = cost.light > 0 ? `${cost.light} light task${cost.light > 1 ? 's' : ''}` : null
  return [heavyLabel, lightLabel].filter(Boolean).join(' + ') || 'Choose a mode'
}

function withDefaultMode(worker) {
  const meta = getWorkerMeta(worker.worker_id)
  if (meta?.workerModeField && meta?.workerModesDefault) {
    return {
      ...worker,
      form_settings: {
        [meta.workerModeField]: meta.workerModesDefault,
        ...(worker.form_settings ?? {}),
      }
    }
  }
  return worker
}

function getWorkerDescription(w, meta) {
  if (!w.form_settings) return meta?.description ?? ''

  // Look for any detailed text fields in form_settings (exclude system config keys)
  const configKeys = ['mode', 'article_card', 'seo_mode', 'email_type', 'hiring_mode', 'post_type', 'content_type', 'page_type', 'script_mode']
  const values = Object.entries(w.form_settings)
    .filter(([k]) => !configKeys.includes(k))
    .map(([, v]) => v)

  const longText = values.find(v => typeof v === 'string' && v.length > 15)
  if (longText) return longText

  const firstText = values.find(v => typeof v === 'string' && v.trim().length > 0)
  if (firstText) return firstText

  return meta?.description ?? ''
}

function findDuplicateWorker(ws: any[]) {
  const seen = new Set()
  for (const w of ws) {
    if (seen.has(w.worker_id)) {
      return w.worker_id
    }
    seen.add(w.worker_id)
  }
  return null
}

export default function ChainBuilder({ chain, presetToLoad, onSaved, onCancel, userPlan, onSaveAsPlaybook }) {
  const [chainName, setChainName] = useState(chain?.name ?? '')
  const [workers, setWorkers] = useState(() =>
    (chain?.workers ?? []).map((w, idx) => ({ ...w, id: w.id || `${w.worker_id}-${idx}-${Date.now()}` }))
  )
  const [scheduleDays, setScheduleDays] = useState(chain?.schedule_days ?? [])
  const [scheduleType, setScheduleType] = useState(chain?.schedule_days?.length ? 'recurring' : 'one-time')
  const [oneTimeDate, setOneTimeDate] = useState('')
  const [repeatInterval, setRepeatInterval] = useState('1')
  const [repeatUnit, setRepeatUnit] = useState('week')
  const [endsType, setEndsType] = useState<'never' | 'on'>('never')
  const [endDate, setEndDate] = useState('')
  const [showWorkerPicker, setShowWorkerPicker] = useState(false)
  const [expandedConfig, setExpandedConfig] = useState(null) // position index — also drives dialog open state
  const [saving, setSaving] = useState(false)
  const [runningNow, setRunningNow] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savingPlaybook, setSavingPlaybook] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [workerCompletion, setWorkerCompletion] = useState({}) // idx -> bool
  const [showValidation, setShowValidation] = useState(false)
  const router = useRouter();
  const toastContext = useToast();
  const showToast = toastContext?.showToast;
  const lastAdjacentErrorRef = useRef<string | null>(null);
  const [drawerDraft, setDrawerDraft] = useState<Record<string, any> | null>(null)
  const [axis, setAxis] = useState<'x' | 'y'>('x')
  const workersRef = useRef(workers)
  useEffect(() => {
    workersRef.current = workers
  }, [workers])
  const dragStartWorkersRef = useRef<any>(null)
  const constraintsRef = useRef(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)')
    const updateAxis = () => {
      setAxis(mediaQuery.matches ? 'y' : 'x')
    }
    updateAxis()
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateAxis)
      return () => mediaQuery.removeEventListener('change', updateAxis)
    } else {
      mediaQuery.addListener(updateAxis)
      return () => mediaQuery.removeListener(updateAxis)
    }
  }, [])

  const openDrawer = (idx: number) => {
    setDrawerDraft({ ...(workers[idx].form_settings ?? {}) })
    setExpandedConfig(idx)
  }

  const closeDrawer = () => {
    setDrawerDraft(null)
    setExpandedConfig(null)
  }

  // Load preset if provided
  useEffect(() => {
    if (presetToLoad) {
      setChainName(presetToLoad.name)
      setNameError(false)
      setWorkers((presetToLoad.workers ?? []).map((w, idx) => ({
        ...withDefaultMode(w),
        id: `${w.worker_id}-${idx}-${Date.now()}`
      })))
      setScheduleDays(presetToLoad.default_schedule_days ?? [])
      setScheduleType(presetToLoad.default_schedule_days?.length ? 'recurring' : 'one-time')
    }
  }, [presetToLoad])

  useEffect(() => {
    let cancelled = false
    async function updateCompletion() {
      const entries = await Promise.all(workers.map(async (worker, idx) => {
        const status = await getWorkerCompletionStatus(worker.worker_id, worker.form_settings ?? {})
        return [idx, status.complete]
      }))
      if (!cancelled) setWorkerCompletion(Object.fromEntries(entries))
    }
    updateCompletion()
    return () => { cancelled = true }
  }, [workers])

  const addWorker = (workerSlug) => {
    if (workers.length >= 5) {
      const msg = 'Workflows can have a maximum of 5 team members.'
      setError(msg)
      showToast?.({ title: msg, variant: 'error' })
      return
    }
    if (workers.some(w => w.worker_id === workerSlug)) {
      const name = getWorkerMeta(workerSlug)?.personaName ?? getWorkerMeta(workerSlug)?.name ?? workerSlug
      const msg = `${name} is already in this workflow.`
      setError(msg)
      showToast?.({
        title: msg,
        variant: 'error'
      })
      return
    }
    setError('')
    lastAdjacentErrorRef.current = null
    const newWorker = withDefaultMode({
      id: `${workerSlug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      worker_id: workerSlug,
      position: workers.length + 1,
      form_settings: {}
    })
    setWorkers([...workers, newWorker])
    setShowWorkerPicker(false)
  }

  const removeWorker = (idx) => {
    const updated = workers.filter((_, i) => i !== idx).map((w, i) => ({ ...w, position: i + 1 }))
    setWorkers(updated)
    if (expandedConfig === idx) setExpandedConfig(null)

    const duplicateSlug = findDuplicateWorker(updated)

    if (duplicateSlug) {
      const name = getWorkerMeta(duplicateSlug)?.personaName ?? getWorkerMeta(duplicateSlug)?.name ?? duplicateSlug
      const msg = `${name} is already in this workflow.`
      setError(msg)
      showToast?.({
        title: msg,
        variant: 'error'
      })
    } else {
      setError('')
      lastAdjacentErrorRef.current = null
    }
  }

  const updateFormSettings = (idx, settings) => {
    setWorkers(workers.map((w, i) => i === idx ? { ...w, form_settings: settings } : w))
  }

  const setStepComplete = (idx, complete) => {
    setWorkerCompletion(prev => ({ ...prev, [idx]: complete }))
  }

  // A step with no required fields is always complete
  const allStepsComplete = workers.every((_, idx) => workerCompletion[idx] !== false)

  // Strip placeholder values before running
  const sanitizeWorkers = (ws) => ws.map(w => ({
    ...w,
    form_settings: Object.fromEntries(
      Object.entries(w.form_settings ?? {}).filter(([, v]) => !isPlaceholderValue(v))
    ),
  }))

  const toggleDay = (day) => {
    setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSave = async (activateSchedule = false, runNow = false) => {
    const validation = chainSchema.safeParse({
      name: chainName,
      workers,
    })

    if (!validation.success) {
      const { fieldErrors } = validation.error.flatten()

      if (fieldErrors.name) {
        setNameError(fieldErrors.name[0]!)
        showToast?.({ title: fieldErrors.name[0]!, variant: 'error' })
        return
      }

      if (fieldErrors.workers) {
        setError(fieldErrors.workers[0]!)
        showToast?.({ title: fieldErrors.workers[0]!, variant: 'error' })
        return
      }
    }

    setNameError(null)

    const duplicateSlug = findDuplicateWorker(workers)
    if (duplicateSlug) {
      const dupeeName = getWorkerMeta(duplicateSlug)?.personaName ?? getWorkerMeta(duplicateSlug)?.name ?? duplicateSlug
      const msg = `${dupeeName} is already in this workflow.`
      setError(msg)
      showToast?.({
        title: msg,
        variant: 'error'
      })
      return
    }

    const missingModes = getMissingWorkerModeFields(workers)
    if (missingModes.length > 0) {
      setShowValidation(true)
      setError('Choose a mode.')
      const firstMissingIndex = workers.findIndex((worker, idx) => {
        const missing = missingModes[0]
        return (worker.position ?? idx + 1) === missing.position && worker.worker_id === missing.worker_id
      })
      if (firstMissingIndex >= 0) setExpandedConfig(firstMissingIndex)
      return
    }

    // Validate all required inputs before running
    if (runNow || activateSchedule) {
      const completionEntries = await Promise.all(workers.map(async (worker, idx) => {
        const status = await getWorkerCompletionStatus(worker.worker_id, worker.form_settings ?? {})
        return [idx, status.complete]
      }))
      const nextCompletion = Object.fromEntries(completionEntries)
      setWorkerCompletion(nextCompletion)
      const hasIncompleteSteps = completionEntries.some(([, complete]) => !complete)

      if (hasIncompleteSteps) {
        setShowValidation(true)
        setError('Fill in all required fields before running. Steps with missing inputs are highlighted in red.')
        // Auto-expand (open dialog for) first incomplete step
        const firstIncomplete = workers.findIndex((_, idx) => nextCompletion[idx] === false)
        if (firstIncomplete >= 0) setExpandedConfig(firstIncomplete)
        return
      }
    }

    if (runNow) {
      setRunningNow(true)
    } else if (activateSchedule) {
      setSaving(true)
    } else {
      setSavingDraft(true)
    }
    setError('')
    setShowValidation(false)

    try {
      const status = activateSchedule ? 'active' : 'inactive'

      const url = chain?.id
        ? `/api/agent-mode/chains/${chain.id}`
        : '/api/agent-mode/chains'

      const method = chain?.id ? 'PUT' : 'POST'

      const cleanWorkers = sanitizeWorkers(workers)
      // Save empty schedule array if scheduleType is one-time
      const activeDays = scheduleType === 'recurring' ? scheduleDays : []

      const res = await agentFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: chainName.trim(),
          workers: cleanWorkers,
          schedule_days: activeDays,
          status,
          preset_id: presetToLoad?.id ?? chain?.preset_id ?? null,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }

      // If Run Now, trigger execution
      if (runNow && data.chain?.id) {
        const runRes = await agentFetch(
          `/api/agent-mode/chains/${data.chain.id}/run`,
          {
            method: 'POST',
          }
        )

        const runData = await runRes.json()

        if (!runRes.ok) {
          setError(runData.error ?? 'Failed to start run')
          return
        }

        if (runData.runId) {
          router.push(`/dashboard/agent-mode/runs/${runData.runId}`)
          return
        }

        if (runData.run?.id) {
          router.push(`/dashboard/agent-mode/runs/${runData.run.id}`)
          return
        }

        router.push('/dashboard/agent-mode/runs')
        return
      }

      onSaved(data.chain)
    } catch (error) {
      console.error(error)
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
      setRunningNow(false)
      setSavingDraft(false)
    }
  }

  const hasSchedule = scheduleType === 'recurring' && scheduleDays.length > 0

  const currentWorker = expandedConfig !== null
    ? workers[expandedConfig]
    : null

  const currentMeta = currentWorker
    ? getWorkerMeta(currentWorker.worker_id)
    : null

  return (
    <div>
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h2 className="hidden lg:flex text-2xl font-semibold text-zinc-800">{chain?.id ? 'Edit Workflow' : 'Build a Workflow'}</h2>
        <p className="text-sm sm:text-base text-neutral-500 lg:mt-1">Connect team members in a workflow — output from each member flows into the next.</p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
          <h3 className="lg:text-lg font-semibold text-zinc-800">General</h3>
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-5">
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Workflow name</label>
            <Input
              type="text"
              placeholder="e.g. Weekly Content Pipeline"
              value={chainName}
              className="mt-1.5"
              onChange={e => {
                setChainName(e.target.value)
                if (nameError) {
                  setNameError(false)
                  // setError('')
                }
              }}
              error={nameError}
            />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
          <h3 className="lg:text-lg font-semibold text-zinc-800">Workflow</h3>

          <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-5 max-h-[602px] overflow-y-auto">
            <div className="sm:overflow-x-auto overscroll-x-contain scrollbar-none flex flex-col sm:flex-row gap-3 sm:w-full snap-x snap-mandatory sm:snap-none">
              <Reorder.Group
                ref={constraintsRef}
                as="div"
                axis={axis}
                values={workers}
                onReorder={(newWorkers) => {
                  const updated = newWorkers.map((w, i) => ({ ...w, position: i + 1 }))
                  setWorkers(updated)

                  const duplicateSlug = findDuplicateWorker(updated)

                  if (duplicateSlug) {
                    const name = getWorkerMeta(duplicateSlug)?.personaName ?? getWorkerMeta(duplicateSlug)?.name ?? duplicateSlug
                    const msg = `${name} is already in this workflow.`
                    setError(msg)
                    if (lastAdjacentErrorRef.current !== duplicateSlug) {
                      lastAdjacentErrorRef.current = duplicateSlug
                      showToast?.({
                        title: msg,
                        variant: 'error'
                      })
                    }
                  } else {
                    setError('')
                    lastAdjacentErrorRef.current = null
                  }
                }}
                className="flex flex-col sm:flex-row items-center gap-3 py-1 w-full sm:w-fit"
              >
                {workers.map((w, idx) => {
                  const meta = getWorkerMeta(w.worker_id)
                  const persona = meta?.personaName ?? w.worker_id
                  const avatarSrc = `/images/marketing/workers-figma/${persona.toLowerCase()}.png`
                  const isConfigured = workerCompletion[idx] === true
                  const desc = getWorkerDescription(w, meta)

                  return (
                    <div
                      key={w.id}
                      className={`flex flex-col sm:flex-row items-center gap-3 max-sm:w-full ${idx === 0 ? 'snap-start' : ''}`}
                    >
                      <Reorder.Item
                        as="div"
                        key={w.id}
                        value={w}
                        dragConstraints={constraintsRef}
                        className="w-full sm:w-auto select-none cursor-grab active:cursor-grabbing touch-none"
                        onDragStart={() => {
                          dragStartWorkersRef.current = [...workersRef.current]
                        }}
                        onDragEnd={() => {
                          dragStartWorkersRef.current = null
                        }}
                      >
                        <div
                          className={`relative flex flex-col
                  w-full sm:w-60
                  h-[270px]
                  rounded-xl border bg-white p-5
                  shadow-xs transition-shadow duration-200
      ${!isConfigured
                              ? 'border-red-400 ring-2 ring-red-400/20'
                              : 'border-zinc-300 hover:border-zinc-300 hover:shadow-md'
                            }`}
                        >
                          {/* Drag Handle */}
                          <div className="absolute left-3 top-3 text-zinc-300 hover:text-zinc-500 cursor-grab touch-none">
                            <GripVertical className="size-4" />
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => removeWorker(idx)}
                            className="absolute right-3 top-3 text-zinc-300 hover:text-red-500 cursor-pointer p-0.5 rounded-full hover:bg-zinc-50"
                            aria-label="Remove team member"
                          >
                            <X className="size-4" />
                          </button>

                          {/* Header (Avatar + Name & Role) */}
                          <div className="flex items-center gap-3 mt-3">
                            <img
                              src={avatarSrc}
                              alt={persona}
                              className="w-10 h-10 rounded-full object-cover bg-zinc-50 border border-zinc-100"
                              onError={(e) => {
                                e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="%23717680">🤖</text></svg>`
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-800 truncate">
                                {persona}
                              </p>
                              <p className="text-xs text-neutral-500 truncate">
                                {meta?.name ?? ''}
                              </p>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-[#D9D9D9] my-3" />

                          {/* Description */}
                          <p className="text-xs text-neutral-500 leading-relaxed line-clamp-3 flex-1 min-h-[77px]">
                            {desc}
                          </p>

                          {isConfigured ? (
                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                className="size-9 shrink-0 p-0 flex items-center justify-center"
                                onClick={() => openDrawer(idx)}
                              >
                                <Pencil className="text-neutral-500 size-4" />
                              </Button>
                              <Button
                                className="py-2 px-4 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 text-[#079455]! bg-emerald-50! cursor-not-allowed opacity-80 w-[calc(100%-40px)]!"
                                variant="outline"
                                disabled
                              >
                                <CircleCheckBig className="size-4" />
                                <span>Configured</span>
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => openDrawer(idx)}
                              className="mt-3 w-full py-2 px-4 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                              variant="outline"
                            >
                              <span>Configure</span>
                            </Button>
                          )}

                          {/* Credit label */}
                          <div className="mt-2.25 flex items-center justify-center gap-1.5">
                            <Coins className="size-3.5 text-neutral-500" />
                            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              {getCreditLabel(w)}
                            </span>
                          </div>
                        </div>
                      </Reorder.Item>

                      {/* Arrow between team members */}
                      {idx < workers.length - 1 && (
                        <div className="flex items-center justify-center px-2 shrink-0 select-none">
                          <ArrowRight className="size-5 text-zinc-400 max-sm:rotate-90" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </Reorder.Group>

              {workers.length < 5 && (
                <div className="inline-flex flex-col sm:flex-row items-center w-full sm:w-fit gap-3 py-1 snap-end">                  {workers.length > 0 && (
                  <div className="flex items-center justify-center shrink-0 select-none">
                    <ArrowRight className="size-5 text-zinc-400 max-sm:rotate-90" />
                  </div>
                )}
                  <button
                    onClick={() => setShowWorkerPicker(true)}
                    className={`
              group flex flex-col items-center justify-center
    w-full sm:w-31.5 rounded-xl border border-dashed
              border-zinc-300 bg-white
              hover:border-blue-500 hover:bg-blue-50/20
              transition-all cursor-pointer
              text-zinc-400 hover:text-blue-500
    ${workers.length > 0 ? 'min-h-[270px]' : 'min-h-54.75'}
            `}
                  >
                    <Plus className="size-7" />
                    <span className="mt-2 text-sm font-medium">
                      Add Member
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Worker config — now rendered inside a Dialog */}
        <>
          <div
            className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${expandedConfig !== null ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            onClick={() => setExpandedConfig(null)}
          />

          {/* Drawer */}
          <div
            className={`fixed top-0 right-0 h-full w-full max-w-3xl bg-white z-[110] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${expandedConfig !== null ? 'translate-x-0' : 'translate-x-full'
              }`}
          >
            {expandedConfig !== null && workers[expandedConfig] && (
              <>
                {/* Drawer header */}
                <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-zinc-200 shrink-0">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" className="size-10! md:size-12! hidden sm:flex">
                      <Layers2 className="size-6 text-[#414651]!" />
                    </Button>
                    <h3 className="lg:text-lg font-semibold text-zinc-800">Config Worker</h3>
                  </div>
                  <button
                    onClick={() => setExpandedConfig(null)}
                    className="text-zinc-400 hover:text-zinc-600 text-xl leading-none cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Drawer body */}
                <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
                  <WorkerConfigPanel
                    workerSlug={workers[expandedConfig].worker_id}
                    formSettings={drawerDraft ?? workers[expandedConfig].form_settings}
                    onChange={(settings) => setDrawerDraft(settings)}   // ← writes to draft only
                    onCompletionChange={() => { }}
                    showValidation={showValidation}
                    avatarSrc={`/images/marketing/workers-figma/${(currentMeta?.personaName ?? currentWorker?.worker_id ?? '').toLowerCase()}.png`}
                    persona={currentMeta?.personaName ?? currentWorker?.worker_id}
                    metaName={currentMeta?.name}
                    previousWorkerName={expandedConfig > 0 ? (getWorkerMeta(workers[expandedConfig - 1].worker_id)?.personaName ?? workers[expandedConfig - 1].worker_id) : null}
                  />
                </div>

                {/* Apply button */}
                <div className="shrink-0 border-t border-zinc-200 px-6 py-4 flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setExpandedConfig(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (expandedConfig !== null) {
                        const nextSettings = drawerDraft ?? workers[expandedConfig].form_settings ?? {}
                        const missingModes = getMissingWorkerModeFields([
                          { ...workers[expandedConfig], form_settings: nextSettings },
                        ])
                        if (missingModes.length > 0) {
                          setShowValidation(true)
                          setStepComplete(expandedConfig, false)
                          setError('Choose a mode.')
                          return
                        }
                        const completion = await getWorkerCompletionStatus(workers[expandedConfig].worker_id, nextSettings)
                        if (!completion.complete) {
                          setShowValidation(true)
                          setStepComplete(expandedConfig, false)
                          setError('Fill in all required fields before applying. Missing inputs are highlighted in red.')
                          return
                        }
                        updateFormSettings(expandedConfig, nextSettings)  // ← commits to workers state
                        setStepComplete(expandedConfig, true)
                      }
                      closeDrawer()
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </>
            )}
          </div>
        </>

        {/* Schedule section */}
        <div className="rounded-xl border border-zinc-200 p-4 space-y-4 relative">
          {/* Toggle segmented control selector in top-right */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-0">
            <div>
              <h3 className="lg:text-lg font-semibold text-zinc-800 hidden lg:flex">Schedule (optional)</h3>
              <h3 className="font-semibold text-zinc-800 lg:hidden">Schedule</h3>
            </div>
            <Tabs
              tabs={scheduleTabs}
              activeTab={scheduleType}
              onChange={(val) => setScheduleType(val as 'one-time' | 'recurring')}
              tabClassName='text-xs sm:text-sm'
            />
          </div>

          <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-5">
            {scheduleType === 'one-time' ? (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Select Your Date
                </label>
                <SchedulePicker
                  value={oneTimeDate}
                  onChange={setOneTimeDate}
                  selectRange={true}
                  useMobileDialog={true}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">
                    Start Date
                  </label>
                  <SchedulePicker
                    value={oneTimeDate}
                    onChange={setOneTimeDate}
                    useMobileDialog={true}
                  />
                </div>

                {/* Repeat every */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">
                    Repeat every
                  </label>
                  <div className="flex gap-2">
                    <Select.Root
                      value={repeatInterval}
                      onValueChange={setRepeatInterval}
                    >
                      <Select.Trigger
                        className="
      inline-flex h-9 w-14 items-center justify-between
      rounded-md border border-zinc-200 bg-white
      px-3 text-sm font-semibold text-zinc-800
      shadow-sm outline-none cursor-pointer!
    "
                      >
                        <Select.Value />
                        <Select.Icon>
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        </Select.Icon>
                      </Select.Trigger>

                      <Select.Portal>
                        <Select.Content
                          position="popper"
                          sideOffset={4}
                          className="
        z-50 overflow-hidden rounded-lg
        border border-zinc-200 bg-white
        shadow-xl h-[256px] w-[96px]
      "
                        >
                          <Select.Viewport className="p-1">
                            {Array.from({ length: 30 }, (_, i) => String(i + 1)).map((n) => (
                              <Select.Item
                                key={n}
                                value={n}
                                className="
              relative flex h-9 cursor-pointer
              select-none items-center justify-between rounded-md
              px-3 text-sm text-zinc-800
              outline-none
              data-[highlighted]:bg-zinc-100 cursor-pointer!
            "
                              >
                                <Select.ItemText>{n}</Select.ItemText>

                                <Select.ItemIndicator>
                                  <Check className="h-4 w-4 text-blue-500" />
                                </Select.ItemIndicator>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                    <Select.Root
                      value={repeatUnit}
                      onValueChange={setRepeatUnit}
                    >
                      <Select.Trigger
                        className="
      inline-flex h-9 w-24 items-center justify-between
      rounded-md border border-zinc-200 bg-white
      px-3 text-sm font-semibold text-zinc-800
      shadow-sm outline-none cursor-pointer!
    "
                      >
                        <Select.Value />
                        <Select.Icon>
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        </Select.Icon>
                      </Select.Trigger>

                      <Select.Portal>
                        <Select.Content
                          position="popper"
                          sideOffset={4}
                          className="
          z-50 overflow-hidden rounded-lg
        border border-zinc-200 bg-white
        shadow-xl w-[96px]
      "
                        >
                          <Select.Viewport className="p-1">
                            {["day", "week", "month", "year"].map((unit) => (
                              <Select.Item
                                key={unit}
                                value={unit}
                                className="
              relative flex h-9 cursor-pointer!
              select-none items-center justify-between rounded-md
              px-3 text-sm text-zinc-800
              outline-none
              data-[highlighted]:bg-zinc-100
            "
                              >
                                <Select.ItemText>{unit}</Select.ItemText>

                                <Select.ItemIndicator>
                                  <Check className="h-4 w-4 text-blue-500" />
                                </Select.ItemIndicator>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                </div>

                {/* Repeat on */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">
                    Repeat on
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {RECURRING_DAYS_UI.map(({ day, label }) => {
                      const isSelected = scheduleDays.includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`w-8 h-8 rounded-full border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-white border-zinc-300 text-zinc-600 hover:border-zinc-300'
                            }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Ends */}
                <div className="space-y-2.5">
                  <label className="block text-sm font-medium text-zinc-700">
                    Ends
                  </label>
                  <RadioGroup
                    value={endsType}
                    onChange={(val) => setEndsType(val)}
                    className="space-y-3"
                  >
                    {/* Never */}
                    <div className="flex items-center gap-2.5">
                      <Radio
                        value="never"
                        color="blue"
                        className="cursor-pointer"
                      />
                      <span onClick={() => setEndsType('never')} className="cursor-pointer text-sm font-semibold text-zinc-700 select-none">
                        Never
                      </span>
                    </div>

                    {/* On */}
                    <div className="flex items-center gap-2.5">
                      <Radio
                        value="on"
                        color="blue"
                        className="cursor-pointer"
                      />
                      <span onClick={() => setEndsType('on')} className="cursor-pointer text-sm font-semibold text-zinc-700 select-none">
                        On
                      </span>
                      <div className={endsType === 'on' ? 'opacity-100 transition-opacity duration-200' : 'opacity-40 pointer-events-none'}>
                        <SchedulePicker
                          value={endDate}
                          onChange={setEndDate}
                          useMobileDialog={true}
                        />
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Credit projection */}
        {workers.length >= 2 && (
          <div className="rounded-xl border border-zinc-200 p-4 space-y-4">
            <h3 className="text-base lg:text-lg font-semibold text-zinc-800">Projected Credit Usage</h3>
            <CreditProjection workers={workers} scheduleDays={scheduleType === 'recurring' ? scheduleDays : []} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm text-red-700 flex items-start gap-2 shadow-2xs">
            <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-zinc-100 sm:bg-white sm:rounded-xl sm:border border-zinc-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
          <div className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
            {workers.length >= 2 && (
              <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-200/50 rounded-md px-2 py-1">
                <CreditCard className="size-3.5 text-zinc-400" />
                <span>Cost Projected per Run</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-stretch sm:items-center gap-2 w-full md:w-auto">
            {/* Run Now */}
            <Button
              onClick={() => handleSave(false, true)}
              variant="outline"
              className="bg-white flex items-center justify-center gap-2"
              disabled={runningNow || savingDraft || savingPlaybook || saving || !allStepsComplete || workers.length < 2}
              title={!allStepsComplete ? 'Fill in all required fields to run' : ''}
            >
              {runningNow && <Loader size={4} />}
              <span>Run Now</span>
            </Button>

            <Button
              onClick={() => handleSave(false)}
              disabled={runningNow || savingDraft || savingPlaybook || saving}
              variant="outline"
              className="bg-white flex items-center justify-center gap-2"
            >
              {savingDraft && <Loader size={4} />}
              <span className='hidden sm:flex'>Save as Draft</span>
              <span className='sm:hidden flex items-center gap-1'>
                {!savingDraft && <Save className='size-4' />}
                <span>Draft</span>
              </span>
            </Button>

            {/* Save as Playbook */}
            {userPlan === 'operator' && onSaveAsPlaybook && workers.length > 0 && chainName.trim() && (
              <Button
                onClick={async () => {
                  setSavingPlaybook(true)
                  try {
                    await onSaveAsPlaybook({ name: chainName, workers, schedule_days: scheduleType === 'recurring' ? scheduleDays : [] })
                  } catch (e) {
                    console.error(e)
                  } finally {
                    setSavingPlaybook(false)
                  }
                }}
                disabled={runningNow || savingDraft || savingPlaybook || saving}
                variant="outline"
                className='border-blue-500 bg-[#F5F8FF] text-blue-500 flex items-center justify-center gap-2'
              >
                {savingPlaybook ? <Loader size={4} /> : <Save className="size-4" />}
                <span className='hidden sm:flex'>Save as Playbook</span>
                <span className='sm:hidden flex items-center gap-1'>Playbook</span>
              </Button>
            )}

            {/* Activate Workflow (shown if recurring schedule is set) */}
            {hasSchedule && (
              <Button
                onClick={() => handleSave(true)}
                disabled={runningNow || savingDraft || savingPlaybook || saving || !allStepsComplete}
                title={!allStepsComplete ? 'Fill in all required fields to activate' : ''}
                variant='outline'
                className='bg-white flex items-center justify-center gap-2'
              >
                {saving && <Loader size={4} />}
                <span>Activate Workflow</span>
              </Button>
            )}

            <Button
              onClick={onCancel}
              variant="outline"
              className='bg-white'
              disabled={runningNow || savingDraft || savingPlaybook || saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Worker picker modal */}
      <WorkerPicker
        open={showWorkerPicker}
        onSelect={addWorker}
        onClose={() => setShowWorkerPicker(false)}
        existingWorkers={workers}
        onlyChainCompatible={true}
      />
    </div>
  )
}