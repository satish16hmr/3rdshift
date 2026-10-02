// components/toast-provider.tsx
'use client'

import { createContext, useContext, useRef, useState } from 'react'
import * as Toast from '@radix-ui/react-toast'

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'destructive'
type ShowToastArg =
    | string
    | {
        title: string
        description?: string
        variant?: ToastVariant
        durationMs?: number
    }

const ToastContext = createContext<any>(null)

export function useToast() {
    return useContext(ToastContext)
}

export function ToastProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState<string | undefined>(undefined)
    const [variant, setVariant] = useState<ToastVariant>('default')
    const timerRef = useRef<number | null>(null)

    const clearTimer = () => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }

    const showToast = (opts: ShowToastArg) => {
        // support simple string for legacy callers
        if (typeof opts === 'string') {
            setTitle(opts)
            setDescription(undefined)
            setVariant('default')
            setOpen(true)
            clearTimer()
            timerRef.current = window.setTimeout(() => setOpen(false), 4000)
            return
        }

        const { title: t, description: d, variant: v = 'default', durationMs = 4000 } = opts
        setTitle(t)
        setDescription(d)
        setVariant(v)
        setOpen(true)

        clearTimer()
        timerRef.current = window.setTimeout(() => setOpen(false), durationMs)
    }

    const variantClasses: Record<ToastVariant, string> = {
        default:
            'bg-slate-900 text-white border border-slate-800',
        success:
            'bg-emerald-600 text-white border border-emerald-700',
        error:
            'bg-red-600 text-white border border-red-700',
        destructive:
            'bg-red-700 text-white border border-red-800',
        warning:
            'bg-amber-500 text-slate-900 border border-amber-600',
    }

    return (
        <ToastContext.Provider value={{ showToast }}>
            <Toast.Provider swipeDirection="right">
                {children}

                <Toast.Root
                    open={open}
                    onOpenChange={(o) => {
                        setOpen(o)
                        if (!o) clearTimer()
                    }}
                    className={
                        // small, responsive toast with variant-aware styles
                        `pointer-events-auto fixed right-4 top-4 z-[100] w-80 max-w-[90vw] rounded-md px-3 py-1.5 shadow-lg ${variantClasses[variant]}`
                    }
                    aria-live="polite"
                >
                    <div className="flex items-center gap-3">
                        {/* optional small icon per variant */}
                        <div className="flex-shrink-0 mt-0.5">
                            {variant === 'success' ? (
                                <span aria-hidden className="text-white">✓</span>
                            ) : variant === 'error' || variant === 'destructive' ? (
                                <span aria-hidden className="text-white">⚠</span>
                            ) : variant === 'warning' ? (
                                <span aria-hidden className="text-slate-900">!</span>
                            ) : (
                                <span aria-hidden className="text-white">i</span>
                            )}
                        </div>

                        <div className="flex-1">
                            <Toast.Title className="font-medium text-sm leading-tight">
                                {title}
                            </Toast.Title>
                            {description ? (
                                <Toast.Description className="mt-1 text-xs opacity-90">
                                    {description}
                                </Toast.Description>
                            ) : null}
                        </div>

                        <div className="ml-2 flex items-center">
                            <Toast.Close
                                aria-label="Close"
                                className="inline-flex cursor-pointer items-center justify-center rounded-md p-1 hover:brightness-90"
                            >
                                <span aria-hidden>✕</span>
                            </Toast.Close>
                        </div>
                    </div>
                </Toast.Root>

                <Toast.Viewport className="fixed top-4 right-4 z-[100]" />
            </Toast.Provider>
        </ToastContext.Provider>
    )
}