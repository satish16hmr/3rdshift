// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

import { RadioGroup, Radio } from '@/components/radio'
import { Button } from '@/components/ui/button'

const SETUP_STEPS = [
    { id: 'create_task', label: 'Create new task' },
    { id: 'create_workflow', label: 'Create new workflow', href: '/dashboard/agent-mode/playbooks' },
    { id: 'connect_tools', label: 'Connect your favorite tools', href: '/dashboard/settings/integration' },
    { id: 'invite_team', label: 'Invite your team', href: '/dashboard/settings/invite-members' },
]

export function CompleteSetupWidget() {
    const router = useRouter()

    const [selectedStep, setSelectedStep] = useState('create_task')
    const [collapsed, setCollapsed] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    if (dismissed) return null

    return (
        <div className="w-[290px] min-[390px]:w-80 overflow-hidden rounded-xl bg-white shadow-lg">
            {/* Header */}
            <button
                onClick={() => setCollapsed(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-6 py-3 bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer"
            >
                <div className="text-left">
                    <p className="text-lg font-medium mb-1">Complete setup</p>
                    <p className="text-xs text-[#F2F2F2]">Finish setting up your workspace</p>
                </div>
                <ChevronDown
                    className={clsx('size-4 shrink-0 transition-transform', collapsed && '-rotate-90')}
                />
            </button>

            {/* Steps */}
            {!collapsed && (
                <RadioGroup
                    value={selectedStep}
                    onChange={setSelectedStep}
                    className="space-y-3 p-4"
                >
                    {SETUP_STEPS.map(step => (
                        <button
                            key={step.id}
                            type="button"
                            onClick={() => {
                                setSelectedStep(step.id)

                                if (step.id === 'create_task') {
                                    window.dispatchEvent(new Event('open-worker-picker'))
                                    return
                                }

                                router.push(step.href)
                            }}
                            className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-50 transition-colors group border border-gray-200 rounded-lg cursor-pointer"
                        >
                            <Radio value={step.id} color="blue" />

                            <span
                                className='flex-1 text-sm font-medium text-zinc-800'
                            >
                                {step.label}
                            </span>

                            <ChevronRight className="size-4 text-zinc-800 group-hover:text-zinc-900 transition-colors" />
                        </button>
                    ))}
                </RadioGroup>
            )}

            {/* Footer */}
            {!collapsed && (
                <div className="border-t border-zinc-200 bg-zinc-100 px-6 py-3">
                    <Button
                        variant="outline"
                        onClick={() => setDismissed(true)}
                        className="w-full!"
                    >
                        Dismiss guide
                    </Button>
                </div>
            )}
        </div>
    )
}