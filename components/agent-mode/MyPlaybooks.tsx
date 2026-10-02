// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ChainCard, { ChainCardSkeleton } from './ChainCard'
import ChainBuilder from './ChainBuilder'
import { Heading, Subheading } from '@/components/heading'
import { useToast } from '@/components/toast-provider'

import { agentFetch } from '@/lib/agent-mode/api'
import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { createClient } from '@/lib/supabase/client'

export default function MyPlayBookPage({ onUsePreset }: { onUsePreset?: (preset: any) => void }) {
    const router = useRouter()
    const { showToast } = useToast()
    
    const [playbooks, setPlaybooks] = useState([])
    const [loading, setLoading] = useState(true)
    const [showBuilder, setShowBuilder] = useState(false)
    const [presetToLoad, setPresetToLoad] = useState(null)
    const [savingPlaybook, setSavingPlaybook] = useState(false)
    const [isOwner, setIsOwner] = useState(true)
    const { plan: userPlan } = useWorkspacePlan()

    const load = () => {
        agentFetch('/api/custom-playbooks')
            .then(r => r.json())
            .then(data => { setPlaybooks(data.playbooks ?? []); setLoading(false) })
            .catch(() => setLoading(false))
    }

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                fetch('/api/workspace', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
                    .then(r => r.json())
                    .then(d => { if (d.userRole) setIsOwner(d.userRole === 'owner') })
                    .catch(() => { })
            }
        })
        load()
    }, [])

    // Map a saved playbook into the shape ChainCard expects
    const toChain = (playbook) => ({
        id: playbook.id,
        name: playbook.name,
        description: playbook.description,
        workers: playbook.workers,
        schedule_days: playbook.schedule_days,
        // Playbooks don't have a live status; treat them as inactive drafts
        status: 'inactive',
    })

    const handleEdit = (playbook) => {
        const preset = {
            name: playbook.name,
            workers: playbook.workers,
            default_schedule_days: playbook.schedule_days,
            _editPlaybookId: playbook.id,
        }
        if (onUsePreset) {
            onUsePreset(preset)
        } else {
            setPresetToLoad(preset)
            setShowBuilder(true)
        }
    }

    const handleRunNow = (playbook) => {
        // Run now (deploy) loads the playbook as a new custom chain template
        const preset = {
            name: playbook.name,
            workers: playbook.workers,
            default_schedule_days: playbook.schedule_days,
        }
        if (onUsePreset) {
            onUsePreset(preset)
        } else {
            setPresetToLoad(preset)
            setShowBuilder(true)
        }
    }

    const handleDelete = async (id) => {
        await agentFetch(`/api/custom-playbooks/${id}`, { method: 'DELETE' })
        setPlaybooks(prev => prev.filter(p => p.id !== id))
        showToast({ title: 'Playbook deleted', variant: 'success' })
    }

    const handleChainSaved = (chain) => {
        setShowBuilder(false)
        setPresetToLoad(null)
        showToast({ title: 'Chain saved successfully', variant: 'success' })
    }

    const handleSaveAsPlaybook = async ({ name, workers, schedule_days }) => {
        if (savingPlaybook) return
        setSavingPlaybook(true)
        try {
            const isEditing = !!presetToLoad?._editPlaybookId
            const url = isEditing
                ? `/api/custom-playbooks/${presetToLoad._editPlaybookId}`
                : '/api/custom-playbooks'
            const method = isEditing ? 'PATCH' : 'POST'

            const res = await agentFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, workers, schedule_days }),
            })

            if (res.ok) {
                showToast({ title: isEditing ? 'Playbook updated successfully!' : 'Saved as Playbook!', variant: 'success' })
                setShowBuilder(false)
                setPresetToLoad(null)
                load()
            } else {
                const d = await res.json()
                showToast({ title: d.error || 'Failed to save playbook', variant: 'error' })
            }
        } catch {
            showToast({ title: 'Failed to save playbook', variant: 'error' })
        }
        setSavingPlaybook(false)
    }

    // Pause / Resume are not applicable for saved playbooks but ChainCard requires the props
    const noop = () => { }

    if (loading) {
        return (
            <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                    <ChainCardSkeleton key={i} />
                ))}
            </div>
        )
    }

    if (showBuilder) {
        return (
            <ChainBuilder
                chain={null}
                presetToLoad={presetToLoad}
                onSaved={handleChainSaved}
                onCancel={() => { setShowBuilder(false); setPresetToLoad(null) }}
                userPlan={userPlan}
                onSaveAsPlaybook={userPlan === 'operator' ? handleSaveAsPlaybook : undefined}
            />
        )
    }

    return (
        <div className="space-y-8">

            {/* Page header
            <div>
                <Heading className='text-2xl! text-zinc-800! font-semibold! hidden lg:block'>My Playbooks</Heading>
                <Subheading className='text-neutral-500! text-sm! sm:text-base! font-normal!'>Saved agent chains you can deploy at any time.
                </Subheading>
            </div> */}

            {/* Empty state */}
            {playbooks.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-14 text-center">
                    <p className="text-base font-semibold text-zinc-700 mb-1">
                        No custom playbooks yet
                    </p>
                    <p className="text-sm text-zinc-500">
                        Build a chain and click &quot;Save as Playbook&quot; to save it here.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {playbooks.map(playbook => (
                        <ChainCard
                            key={playbook.id}
                            chain={toChain(playbook)}
                            onEdit={isOwner ? () => handleEdit(playbook) : undefined}
                            onDeploy={() => handleRunNow(playbook)}
                            onPause={noop}
                            onResume={noop}
                            onDelete={isOwner ? () => handleDelete(playbook.id) : undefined}
                            isMyPlayBook={true}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
