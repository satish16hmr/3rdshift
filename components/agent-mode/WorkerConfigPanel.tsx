// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import WorkerModeCards from '@/components/workers/WorkerModeCards'
import { workers as workerRegistry } from '@/lib/workers/registry'
import { getMissingRequiredFields, isFieldVisible, isPlaceholderValue as isSharedPlaceholderValue } from '@/lib/workers/required-fields'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Textarea } from '../textarea'
import Image from 'next/image'

export function isPlaceholderValue(val) {
  return !val || (typeof val === 'string' && (!val.trim() || isSharedPlaceholderValue(val)))
}

function getWorkerMeta(workerSlug) {
  return workerRegistry.find(w => w.slug === workerSlug)
}

function getCompletionStatus(workerSlug, config, settings = {}) {
  const missing = getMissingRequiredFields(workerSlug, settings).map(field => field.name)
  return { complete: missing.length === 0, missingFields: missing }
}

/**
 * getWorkerCompletionStatus — given a slug + current form settings,
 * returns { complete: bool, missingFields: string[] }
 */
export async function getWorkerCompletionStatus(workerSlug, formSettings = {}) {
  const mod = await import('@/lib/workers/configs')
  const config = mod.getWorkerFormConfig(workerSlug)
  if (!config) return { complete: true, missingFields: [] }
  return getCompletionStatus(workerSlug, config, formSettings)
}

/**
 * WorkerConfigPanel — renders the standard form fields for a worker inline
 * inside the chain builder. Uses the same form config as manual tasks.
 * Saves settings back via onChange callback.
 * onCompletionChange(complete: bool) fires whenever completion status changes.
 */
export default function WorkerConfigPanel({ workerSlug, formSettings = {}, onChange, onCompletionChange, showValidation = false, avatarSrc, persona, metaName, previousWorkerName = null }) {
  const [formConfig, setFormConfig] = useState(null)
  const [values, setValues] = useState(formSettings)
  const worker = getWorkerMeta(workerSlug)
  const hasWorkerModes = !!(worker?.workerModeField && worker?.workerModes?.length)

  useEffect(() => {
    import('@/lib/workers/configs').then(mod => {
      const config = mod.getWorkerFormConfig(workerSlug)
      setFormConfig(config)
      // Report initial completion status
      if (onCompletionChange && config) {
        onCompletionChange(getCompletionStatus(workerSlug, config, formSettings).complete)
      }
    })
  }, [workerSlug])

  useEffect(() => {
    setValues(formSettings)
  }, [workerSlug])

  const handleChange = (name, value) => {
    const updated = { ...values, [name]: value }
    setValues(updated)
    onChange(updated)
    // Recheck completion
    if (onCompletionChange && formConfig) {
      onCompletionChange(getCompletionStatus(workerSlug, formConfig, updated).complete)
    }
  }

  if (!formConfig) {
    return (
      <div className="h-[65vh] flex flex-col items-center justify-center py-4 text-center text-sm text-zinc-400">
        <div className="size-5 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600 mx-auto mb-2" />
        Loading form...
      </div>
    )
  }

  const allFields = formConfig.sections?.flatMap(s => s.fields ?? []) ?? []
  const selectedModeId = hasWorkerModes
    ? (values[worker.workerModeField] || '')
    : ''
  const visibleFields = allFields.filter(field => (
    field.type !== 'file-upload' &&
    isFieldVisible(field.showWhen, values, formConfig)
  ))

  if (!hasWorkerModes && visibleFields.length === 0) {
    return <p className="text-sm text-zinc-500 italic">This worker has no configurable settings.</p>
  }

  return (
    <div className="space-y-6">
      {hasWorkerModes && (
        <WorkerModeCards
          header={worker.workerModesHeader || 'Choose a mode'}
          subtitle={worker.workerModesSubtitle || ''}
          modes={worker.workerModes || []}
          selectedId={selectedModeId}
          userPlan="operator"
          onModeSelect={(modeId) => handleChange(worker.workerModeField, modeId)}
        />
      )}

      <div className='border border-zinc-200 rounded-xl'>
        <div className="flex items-center gap-3 py-3 px-4 sm:px-6 border-b border-zinc-200">
          <Image
            src={avatarSrc}
            alt={persona}
            className="w-10 h-10 rounded-full object-cover bg-zinc-100 border border-zinc-200"
            onError={(e) => {
              e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="%23f4f4f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20" fill="%23717680">🤖</text></svg>`
            }}
            width={10}
            height={10}
          />

          <div>
            <p className="text-sm font-medium text-zinc-800 w-full truncate">
              {persona}
            </p>

            <p className="text-sm text-neutral-500 w-full truncate">
              {metaName}
            </p>
          </div>
        </div>
        <div className="pb-3 px-4 sm:px-6">
          {
            previousWorkerName && (
              <div className='mt-4 sm:mt-5'>
                <div className="bg-[#F5F8FF] cursor-not-allowed border border-zinc-200 text-sm font-medium text-zinc-950 flex justify-between items-center px-4 py-3.25 rounded-xl gap-2 flex-wrap">
                  <p className="block text-sm font-medium text-zinc-950">Input</p>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-zinc-950">Locked, Will use {previousWorkerName}'s output</p>
                    <svg width="16" height="16" viewBox="0 0 16 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 21C1.45 21 0.979333 20.8043 0.588 20.413C0.196666 20.0217 0.000666667 19.5507 0 19V9C0 8.45 0.196 7.97933 0.588 7.588C0.98 7.19667 1.45067 7.00067 2 7H3V5C3 3.61667 3.48767 2.43767 4.463 1.463C5.43833 0.488334 6.61733 0.000667349 8 6.82594e-07C9.38267 -0.000665984 10.562 0.487001 11.538 1.463C12.514 2.439 13.0013 3.618 13 5V7H14C14.55 7 15.021 7.196 15.413 7.588C15.805 7.98 16.0007 8.45067 16 9V19C16 19.55 15.8043 20.021 15.413 20.413C15.0217 20.805 14.5507 21.0007 14 21H2ZM9.413 15.413C9.80433 15.021 10 14.55 10 14C10 13.45 9.80433 12.9793 9.413 12.588C9.02167 12.1967 8.55067 12.0007 8 12C7.44933 11.9993 6.97867 12.1953 6.588 12.588C6.19733 12.9807 6.00133 13.4513 6 14C5.99867 14.5487 6.19467 15.0197 6.588 15.413C6.98133 15.8063 7.452 16.002 8 16C8.548 15.998 9.019 15.8023 9.413 15.413ZM5 7H11V5C11 4.16667 10.7083 3.45833 10.125 2.875C9.54167 2.29167 8.83333 2 8 2C7.16667 2 6.45833 2.29167 5.875 2.875C5.29167 3.45833 5 4.16667 5 5V7Z" fill="black" />
                    </svg>

                  </div>
                </div>
              </div>
            )
          }
          {visibleFields.map(field => {
            if (hasWorkerModes && field.name === worker.workerModeField) return null

            const value = values[field.name] ?? (field.required ? '' : field.defaultValue ?? '')
            const isEmpty = field.required && isPlaceholderValue(value)
            const showError = showValidation && isEmpty
            const borderClass = showError
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-zinc-200 focus:border-blue-500 focus:ring-blue-500'

            const isCheckboxType = field.type === 'toggle' || field.type === 'checkbox'
            const isMultiSelectType = field.type === 'multiselect' || field.type === 'multi-select'

            if (isCheckboxType) {
              const isChecked = Boolean(value === true || value === 'true')
              return (
                <div key={field.name} className='mt-4 sm:mt-5'>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-300 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={isChecked}
                      onChange={e => handleChange(field.name, e.target.checked ? 'true' : 'false')}
                    />
                    <span className="text-sm font-medium text-[#414651]">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </span>
                  </label>
                  {field.hint && (
                    <p className="mt-1 text-xs text-zinc-500 ml-7">{field.hint}</p>
                  )}
                  {showError && (
                    <p className="mt-1 text-xs text-red-500">This field is required</p>
                  )}
                </div>
              )
            }

            if (isMultiSelectType) {
              const selectedValues = Array.isArray(value) ? value : (typeof value === 'string' && value ? value.split(',') : [])
              const handleMultiChange = (optVal: string, checked: boolean) => {
                let next: string[]
                if (checked) {
                  next = [...selectedValues, optVal]
                } else {
                  next = selectedValues.filter(v => v !== optVal)
                }
                handleChange(field.name, next)
              }
              return (
                <div key={field.name} className='mt-4 sm:mt-5'>
                  <label className="block text-sm font-medium text-[#414651] mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {(field.options ?? []).map((opt: any, index: number) => {
                      const optVal = typeof opt === 'object' ? opt.value : opt
                      const optLabel = typeof opt === 'object' ? opt.label : opt
                      const isChecked = selectedValues.includes(optVal)
                      return (
                        <label key={index} className="flex items-center gap-2 text-sm font-medium text-[#414651] cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={isChecked}
                            onChange={e => handleMultiChange(optVal, e.target.checked)}
                          />
                          <span>{optLabel}</span>
                        </label>
                      )
                    })}
                  </div>
                  {field.hint && (
                    <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p>
                  )}
                  {showError && (
                    <p className="mt-1 text-xs text-red-500">This field is required</p>
                  )}
                </div>
              )
            }

            return (
              <div key={field.name} className='mt-4 sm:mt-5'>

                <label className="block text-sm font-medium text-[#414651] mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <Textarea
                    rows={field.rows ?? 3}
                    value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder ?? ''}
                    className={`resize-none ${borderClass}`}
                  />
                ) : field.type === 'select' ? (
                  <Select
                    value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    className={`${borderClass}`}
                  >
                    <option value="">Select...</option>
                    {(field.options ?? []).map((opt, index) => {
                      const val = typeof opt === 'object' ? opt.value : opt
                      const label = typeof opt === 'object' ? opt.label : opt
                      const truncatedLabel = label.length > 26 ? `${label.slice(0, 24)}...` : label
                      return (
                        <option key={index} value={val} title={label}>
                          {truncatedLabel}
                        </option>
                      )
                    })}
                  </Select>
                ) : field.type === 'number' ? (
                  <Input
                    type="number"
                    value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder ?? ''}
                    className={`${borderClass}`}
                  />
                ) : (
                  <Input
                    type="text"
                    value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder ?? ''}
                    className={`${borderClass}`}
                  />
                )}
                {field.hint && (
                  <p className="mt-1.5 text-xs text-zinc-500">{field.hint}</p>
                )}
                {showError && (
                  <p className="mt-1 text-xs text-red-500">This field is required</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
