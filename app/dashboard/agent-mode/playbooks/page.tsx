// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Volume2,
    FileText,
    ShoppingBasket,
    PenTool,
    MapPin,
    Users,
    DollarSign,
    Building2,
    Mail,
    ClipboardList,
    Home,
    Truck,
    Target,
    Calendar,
    Sparkles,
    Play,
    X,
    CreditCard,
    CirclePlay
} from 'lucide-react'
import TopUsersPng from '@/public/images/agentMode/playbook/topUsers.png'
import PlayBookVectorPng from '@/public/images/agentMode/playbook/playbook-vector.png'
import Image from 'next/image'

import { Dialog } from '@/components/dialog'
import PresetsTab from '@/components/agent-mode/PresetsTab'
import { Heading, Subheading } from '@/components/heading'
import ChainBuilder from '@/components/agent-mode/ChainBuilder'
import { Button } from '@/components/ui/button'
import MyPlayBookPage from '@/components/agent-mode/MyPlaybooks'
import Tabs from '@/components/Tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/toast-provider'

import { useWorkspacePlan } from '@/lib/hooks/useWorkspacePlan'
import { agentFetch } from '@/lib/agent-mode/api'
import { workers as workerRegistry } from '@/lib/workers/registry'

const CATEGORY_DISPLAY = {
    content_creator: 'Content Creator',
    ecommerce: 'Ecommerce',
    agency: 'Agency',
    saas_startup: 'SaaS / Startup',
    recruiting: 'Recruiting',
    local_business: 'Local Business',
    multi_purpose: 'Multi-Purpose',
}

const FILTER_TABS = [
    { id: 'All', label: 'All' },
    { id: 'content_creator', label: 'Content Creator' },
    { id: 'ecommerce', label: 'Ecommerce' },
    { id: 'agency', label: 'Agency' },
    { id: 'saas_startup', label: 'SaaS / Startup' },
    { id: 'recruiting', label: 'Recruiting' },
    { id: 'local_business', label: 'Local Business' },
    { id: 'multi_purpose', label: 'Multi-Purpose' },
]

const PLAYBOOK_TABS = ['Browse', 'Saved'] as const
type PlaybookTab = typeof PLAYBOOK_TABS[number]

function getPresetIcon(name: string) {
    const n = name.toLowerCase()
    if (n.includes('brand voice')) return Volume2
    if (n.includes('client reporting')) return FileText
    if (n.includes('pricing') || n.includes('competitive intel')) return ShoppingBasket
    if (n.includes('course launch')) return PenTool
    if (n.includes('customer review')) return MapPin
    if (n.includes('hiring')) return Users
    if (n.includes('investor readiness')) return DollarSign
    if (n.includes('local authority')) return Building2
    if (n.includes('newsletter')) return Mail
    if (n.includes('onboarding')) return ClipboardList
    if (n.includes('open house') || n.includes('event promo')) return Home
    if (n.includes('product launch')) return Truck
    if (n.includes('positioning')) return Target
    if (n.includes('weekly content') || n.includes('marketing engine')) return Calendar
    return Sparkles
}

export default function PlaybooksPage() {
    const router = useRouter()
    const { showToast } = useToast()
    const { plan: userPlan } = useWorkspacePlan()

    const [presets, setPresets] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('All')
    const [activeMainTab, setActiveMainTab] = useState('browse')
    const [savedPlaybooks, setSavedPlaybooks] = useState([])
    const [savedLoading, setSavedLoading] = useState(false)
    const [bannerVisible, setBannerVisible] = useState(true)
    const [showBuilder, setShowBuilder] = useState(false)
    const [presetToLoad, setPresetToLoad] = useState(null)
    const [savingPlaybook, setSavingPlaybook] = useState(false)
    const [demoOpen, setDemoOpen] = useState(false)

    useEffect(() => {
        agentFetch('/api/agent-mode/presets')
            .then((r) => r.json())
            .then((data) => {
                setPresets(data.presets ?? [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const dismissBanner = () => {
        setBannerVisible(false)
    }

    const handleUsePreset = (preset) => {
        setPresetToLoad(preset)
        setShowBuilder(true)
    }

    const handleCreateFromScratch = () => {
        setPresetToLoad(null)
        setShowBuilder(true)
    }

    const handleChainSaved = (chain) => {
        setShowBuilder(false)
        setPresetToLoad(null)
        showToast({ title: 'Workflow saved successfully', variant: 'success' })
    }

    const handleSaveAsPlaybook = async ({ name, workers, schedule_days }) => {
        if (savingPlaybook) return
        setSavingPlaybook(true)
        try {
            const res = await agentFetch('/api/custom-playbooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, workers, schedule_days }),
            })
            if (res.ok) {
                showToast({ title: 'Saved as Playbook! Find it in Playbook templates.', variant: 'success' })
                setShowBuilder(false)
                setPresetToLoad(null)
            } else {
                const d = await res.json()
                showToast({ title: d.error || 'Failed to save playbook', variant: 'error' })
            }
        } catch {
            showToast({ title: 'Failed to save playbook', variant: 'error' })
        }
        setSavingPlaybook(false)
    }

    const filtered = activeTab === 'All'
        ? presets
        : presets.filter((p) => p.category === activeTab)

    useEffect(() => {
        window.dispatchEvent(
            new CustomEvent('page-title-override', {
                detail: { title: showBuilder ? 'Build a Playbook' : null }
            })
        )
    }, [showBuilder])

    const scheduleTabs = [
        { label: 'Browse', value: 'browse' },
        { label: 'Saved', value: 'saved' }
    ]
    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                {/* Header Skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-5 w-120" />
                </div>

                {/* Hero Banner Skeleton */}
                <Skeleton className="h-52" />

                {/* Sub-Header & Buttons Skeleton */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                    <Skeleton className="h-6 w-120" />
                    <div className="flex gap-4">
                        <Skeleton className="h-9 w-44" />
                        <Skeleton className="h-9 w-44" />
                        <Skeleton className="h-9 w-44" />
                    </div>
                </div>

                <Skeleton className="h-17.5 w-full" />
                {/* Filter Tabs Skeleton */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
                    ))}
                </div>

                {/* Presets Grid Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-zinc-200 bg-white shadow-xs flex flex-col justify-between">
                            <div className="space-y-4">
                                <div className="h-[215px] bg-zinc-100 rounded-lg flex items-center justify-center">
                                    <div className="size-10 rounded-full bg-zinc-200" />
                                </div>
                                <div className="px-5 space-y-2">
                                    <div className="h-4 w-3/4 bg-zinc-100/80 rounded-md" />
                                    <div className="h-3 w-4/6 bg-zinc-100/80 rounded-md" />
                                    <div className="h-10 w-full bg-zinc-100/80 rounded-md" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4 m-5">
                                <div className="h-7 w-full bg-zinc-100/80 rounded-md" />
                                <div className="h-7 w-full bg-zinc-100/80 rounded-md" />
                                <div className="h-7 w-full bg-zinc-100/80 rounded-md" />
                            </div>
                        </div>
                    ))}
                </div>
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
            {/* <div className="flex gap-2">
                {PLAYBOOK_TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveMainTab(tab)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition
                ${activeMainTab === tab
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div> */}

            <div>
                <Heading className='text-2xl! text-zinc-800! font-semibold! hidden lg:block'>Playbook</Heading>
                <Subheading className='text-neutral-500! text-sm! sm:text-base! font-normal!'>Track and manage all your submitted tasks in one place.</Subheading>
            </div>

            {/* Premium Hero Banner */}
            {bannerVisible && (
                <div className="relative rounded-2xl overflow-hidden bg-cover bg-no-repeat bg-center py-11 px-1 sm:px-5 lg:px-10" style={{ backgroundImage: "url('/images/agentMode/playbook/playbookBg.png')" }}>
                    <Image src={PlayBookVectorPng} alt='playbook-vector' className='absolute top-0 left-20 opacity-45' width={176} height={176} />

                    <div className='relative z-10 flex items-center justify-center xl:justify-between'>
                        <div className="space-y-3 text-center xl:text-left">
                            <h2 className="text-lg sm:text-2xl md:text-[33px] font-medium text-white">
                                70+ team members. 14 categories. One platform.
                            </h2>
                            <Button
                                onClick={() => setDemoOpen(true)}
                                variant='primary'
                                className='border-0 h-10 shadow-[0px_1px_2px_0px_#1018280D,0px_-2px_0px_0px_#0A0D120D_inset,0px_0px_0px_1px_#0A0D122E_inset]'
                            >
                                Watch demo
                                <CirclePlay />
                            </Button>
                        </div>
                        <Image src={TopUsersPng} alt='top-users' width={236} height={124} className='hidden xl:flex' />
                    </div>

                    <Button
                        onClick={dismissBanner}
                        className="absolute top-1 right-1 md:top-3 md:right-3 bg-transparent border-0! px-0 hover:bg-white/20"
                        aria-label="Dismiss banner"
                    >
                        <X className="size-4.5 sm:size-6" />
                    </Button>
                </div>
            )}

            {/* Sub-Header & Action Buttons */}
            <div className="flex flex-wrap justify-between gap-4 pt-1">
                <div>
                    <h3 className="text-lg font-medium text-zinc-800 pb-1">Choose a template and customize it to fit your needs</h3>
                </div>
                <div className="flex flex-wrap gap-4">
                    <Tabs
                        tabs={scheduleTabs}
                        activeTab={activeMainTab}
                        onChange={setActiveMainTab}
                        className='max-[450px]:w-fit'
                        tabClassName="text-sm py-1! max-[450px]:w-fit! max-[450px]:justify-center!"
                        activeTabClassName=''
                    />
                    <Button
                        onClick={handleCreateFromScratch}
                        variant='primary' className='max-[450px]:w-fit'>
                        Create From Scratch
                    </Button>
                </div>
            </div>
            {activeMainTab === 'browse' && (
                <PresetsTab
                    onUsePreset={handleUsePreset}
                    activeTab="All"
                    setActiveTab={() => { }}
                />
            )}

            {activeMainTab === 'saved' && (
                <MyPlayBookPage onUsePreset={handleUsePreset} />
            )}

            <Dialog
                open={demoOpen}
                onClose={setDemoOpen}
                size="4xl"
                className="overflow-hidden p-0! bg-zinc-950! border! border-zinc-800! rounded-2xl! shadow-2xl! max-w-[90%] sm:max-w-[90%] lg:max-w-4xl"
                backdropClassName="backdrop-blur-md!"
            >
                <div className="relative w-full aspect-video bg-zinc-950 rounded-2xl overflow-hidden group">
                    {/* Top gradient overlay to ensure close button visibility */}
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />

                    <button
                        onClick={() => setDemoOpen(false)}
                        className="absolute top-4 right-4 z-50 flex items-center justify-center size-9 rounded-full bg-zinc-900/60 backdrop-blur-md text-zinc-300 hover:text-white border border-white/10 transition-all hover:scale-105 duration-200 focus:outline-none cursor-pointer"
                        aria-label="Close video"
                    >
                        <X className="size-5" />
                    </button>
                    <video
                        src="/WorkflowDemoVideo.mp4"
                        controls
                        autoPlay
                        className="w-full h-full object-contain rounded-2xl"
                    />
                </div>
            </Dialog>
        </div>
    )
}
