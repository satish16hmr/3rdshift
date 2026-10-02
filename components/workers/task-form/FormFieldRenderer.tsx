// @ts-nocheck
import React from 'react'

import { Field, Label, Description } from '@/components/fieldset'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Textarea } from '@/components/textarea'
import FileUpload from '@/components/ui/file-upload'
import AudioFileUpload from '@/components/AudioFileUpload'

const MAX_CHARS = 2000

interface FormFieldRendererCtx {
    formValues: any
    slug: any
    isShowroom: boolean
    updateField: (name: string, value: any) => void
    updateMultiSelect: (name: string, option: string, checked: boolean) => void
    setUploadedContent: React.Dispatch<React.SetStateAction<any>>
    audioUploadsRef: React.MutableRefObject<any>
    setAudioUploads: React.Dispatch<React.SetStateAction<any>>
    fieldErrors: any
    charCounts: any
    setCharCounts: React.Dispatch<React.SetStateAction<any>>
    creditCost: number
    worker: any
}

export const renderFormField = (field: any, ctx: FormFieldRendererCtx) => {
    const {
        formValues,
        slug,
        isShowroom,
        updateField,
        updateMultiSelect,
        setUploadedContent,
        audioUploadsRef,
        setAudioUploads,
        fieldErrors = {},
        charCounts,
        setCharCounts,
        creditCost,
        worker
    } = ctx

    const { name, label, type, placeholder, options, required } = field
    const optLabel = !required ? <span className="ml-1 font-normal text-zinc-400">(optional)</span> : null

    if (field.showWhen) {
        const depValue = formValues[field.showWhen.field]
        const depStr = depValue === true ? 'true' : depValue === false ? 'false' : (depValue || '')
        const showWhenMatches = Array.isArray(field.showWhen.value)
            ? field.showWhen.value.includes(depStr)
            : depStr === field.showWhen.value
        if (!showWhenMatches) {
            return null
        }
    }

    if (type === 'file-upload') {
        return (
            <div key={name}>
                <FileUpload
                    type={field.uploadType || 'document'}
                    label={label}
                    acceptedTypesLabel={field.acceptedTypesLabel}
                    required={required}
                    fieldName={name}
                    onUploadComplete={(content) => {
                        setUploadedContent(prev => ({ ...prev, [name]: content }))
                    }}
                    onUploadError={() => {
                        // setError handled by parent
                    }}
                    onClear={() => {
                        setUploadedContent(prev => {
                            const next = { ...prev }
                            delete next[name]
                            return next
                        })
                    }}
                />
                {field.hint && (
                    (worker?.catClass === 'wc-vi' && field.hint.toLowerCase().includes('real people')) ? (
                        <div className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <span className="shrink-0 text-amber-500" aria-hidden>⚠️</span>
                            <p className="text-xs font-medium text-amber-800 leading-relaxed">
                                <strong>Product and brand images only.</strong> Photos of real people are likely to be rejected by the video engine and will consume {creditCost} credit{creditCost === 1 ? '' : 's'} without producing a video. Uploading a real person&apos;s photo is a common cause of failed generations.
                            </p>
                        </div>
                    ) : (
                        <p className="mt-1.5 text-sm text-neutral-500">{field.hint}</p>
                    )
                )}
                {fieldErrors?.[name] && (
                    <p className="mt-1.5 text-sm text-red-500">{fieldErrors[name]}</p>
                )}
            </div>
        )
    }

    if (type === 'audio-upload') {
        return (
            <Field key={name}>
                <Label className="text-sm! font-medium! text-[#414651]!">{label}{optLabel}</Label>
                <div className="mt-2">
                    <AudioFileUpload
                        workerSlug={slug}
                        label={placeholder || 'Drop your audio or video file here'}
                        onUpload={(data) => {
                            if (data) {
                                audioUploadsRef.current = { ...audioUploadsRef.current, [name]: data }
                                setAudioUploads(prev => ({ ...prev, [name]: data }))
                            } else {
                                const next = { ...audioUploadsRef.current }; delete next[name]
                                audioUploadsRef.current = next
                                setAudioUploads(prev => { const n2 = { ...prev }; delete n2[name]; return n2 })
                            }
                        }}
                        onError={() => {
                            // setError handled by parent
                        }}
                    />
                </div>
                {field.hint && (
                    <p className="mt-1.5 text-sm text-neutral-500">{field.hint}</p>
                )}
                {fieldErrors?.[name] && (
                    <p className="mt-1 text-sm text-red-500">{fieldErrors[name]}</p>
                )}
            </Field>
        )
    }

    if (type === 'select') {
        if (name === 'voice' && slug === 'voiceover-artist') {
            const PREVIEW_MAP = {
                'Professional Male': 'professional-male',
                'Professional Female': 'professional-female',
                'Friendly Male': 'friendly-male',
                'Friendly Female': 'friendly-female',
                'British Male': 'british-male',
                'British Female': 'british-female',
                'Deep Male': 'deep-male',
                'Calm Female': 'calm-female',
                'Young Male': 'young-male',
                'Young Female': 'young-female',
                'Dark & Mysterious Male': 'dark-mysterious-male',
                'Soulful Female': 'soulful-female',
            }
            return (
                <Field key={name}>
                    <Label className="text-sm! font-medium! text-[#414651]!">{label}{optLabel}</Label>
                    <div className="mt-2 space-y-1.5">
                        {options?.map(opt => {
                            const isSelected = (formValues[name] || 'Professional Male') === opt
                            const previewFile = PREVIEW_MAP[opt]
                            return (
                                <div
                                    key={opt}
                                    onClick={() => updateField(name, opt)}
                                    className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition ${isSelected
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`size-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-600' : 'border-zinc-300'
                                            }`}>
                                            {isSelected && <div className="size-2 rounded-full bg-blue-600" />}
                                        </div>
                                        <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-zinc-700'}`}>{opt}</span>
                                    </div>
                                    {previewFile && (
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation()
                                                const audio = new Audio(`/voice-previews/${previewFile}.mp3`)
                                                audio.play()
                                            }}
                                            className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
                                        >
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                <path d="M2.5 1.5L8.5 5L2.5 8.5V1.5Z" fill="currentColor" />
                                            </svg>
                                            Preview
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {fieldErrors?.[name] && (
                        <p className="mt-1.5 text-sm text-red-500">{fieldErrors[name]}</p>
                    )}
                </Field>
            )
        }

        return (
            <Field key={name}>
                <Label className="text-sm! font-medium! text-[#414651]!">{label}{optLabel}</Label>
                <Select name={name} value={formValues[name] ?? field.defaultValue ?? ''} disabled={isShowroom} style={isShowroom ? { background: '#f0f0f0', cursor: 'not-allowed', color: '#9ca3af', borderColor: '#e5e7eb' } : {}} onChange={e => {
                    updateField(name, e.target.value)
                }}>
                    <option value="">Select...</option>
                    {options?.map(opt => {
                        const optVal = typeof opt === 'object' ? opt.value : opt
                        const optLabel = typeof opt === 'object' ? opt.label : opt
                        return <option key={optVal} value={optVal}>{optLabel}</option>
                    })}
                </Select>
                {field.hint && (
                    <p className="mt-1.5 text-sm text-neutral-500">{field.hint}</p>
                )}
                {fieldErrors?.[name] && (
                    <p className="mt-1.5 text-sm text-red-500">{fieldErrors[name]}</p>
                )}
            </Field>
        )
    }

    if (type === 'multi-select') {
        return (
            <Field key={name}>
                <Label className="text-sm! font-medium! text-[#414651]!">{label}{optLabel}</Label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {options?.map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm! font-medium! text-[#414651]! cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded border-zinc-300"
                                checked={(formValues[name] || []).includes(opt)}
                                onChange={e => updateMultiSelect(name, opt, e.target.checked)}
                            />
                            {opt}
                        </label>
                    ))}
                </div>
                {fieldErrors?.[name] && (
                    <p className="mt-1.5 text-sm text-red-500">{fieldErrors[name]}</p>
                )}
            </Field>
        )
    }

    if (type === 'toggle') {
        return (
            <Field key={name}>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        className="rounded border-zinc-300 h-4 w-4"
                        checked={formValues[name] || false}
                        onChange={e => updateField(name, e.target.checked)}
                    />
                    <span className="text-sm! font-medium! text-[#414651]!">{label}</span>
                </label>
                {fieldErrors?.[name] && (
                    <p className="mt-1 text-sm text-red-500">{fieldErrors[name]}</p>
                )}
            </Field>
        )
    }

    if (type === 'textarea') {
        const val = formValues[name] || ''
        const lineCount = val.split('\n').filter(l => l.trim()).length
        const separatorCount = val.split('---').length - 1
        const maxLines = field.maxLines
        const maxSeparators = field.maxSeparators
        const lineError = maxLines && lineCount > maxLines ? field.maxLinesError || `Maximum ${maxLines} items per task` : null
        const sepError = maxSeparators !== undefined && separatorCount > maxSeparators ? field.maxSeparatorsError || `Maximum ${maxSeparators + 1} items per task` : null
        const fieldError = lineError || sepError || fieldErrors?.[name]
        return (
            <Field key={name}>
                <Label className="text-sm! font-medium! text-[#414651]!">{label}{optLabel}</Label>
                {field.helperText && (
                    <Description className="mb-1">{field.helperText}</Description>
                )}
                <Textarea
                    name={name}
                    rows={4}
                    placeholder={placeholder}
                    value={formValues[name] || ''}
                    onChange={e => {
                        updateField(name, e.target.value)
                        setCharCounts(prev => ({ ...prev, [name]: e.target.value.length }))
                    }}
                    maxLength={MAX_CHARS}
                    disabled={isShowroom}
                    style={isShowroom ? { background: '#f0f0f0', cursor: 'not-allowed', color: '#9ca3af', borderColor: '#e5e7eb' } : {}}
                />
                <div className="flex items-center justify-between mt-1">
                    {fieldError ? (
                        <span className="text-sm text-red-500">{fieldError}</span>
                    ) : (
                        <span />
                    )}
                    <Description className="text-right">
                        {(charCounts[name] || 0).toLocaleString()} / {MAX_CHARS.toLocaleString()}
                    </Description>
                </div>
                {field.hint && (
                    <p className="mt-1.5 text-sm text-neutral-500">{field.hint}</p>
                )}
            </Field>
        )
    }

    return (
        <Field key={name}>
            <Label className="text-sm! font-medium! text-[#414651]!">{label}{optLabel}</Label>
            <Input
                type={type === 'url' ? 'url' : type === 'number' ? 'number' : 'text'}
                name={name}
                placeholder={placeholder}
                value={formValues[name] || ''}
                onChange={e => updateField(name, e.target.value)}
                disabled={isShowroom}
                style={isShowroom ? { background: '#f0f0f0', cursor: 'not-allowed', color: '#9ca3af', borderColor: '#e5e7eb' } : {}}
            />
            {fieldErrors?.[name] && (
                <p className="mt-1 text-sm text-red-500">{fieldErrors[name]}</p>
            )}
        </Field>
    )
}
