// @ts-nocheck
'use client'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/badge'
import { CircleUserRound, Dot, Search, Users, X } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { getWorkerAvatarSrcBySlug } from '@/lib/worker-avatars'

// ─── Skeleton primitives ──────────────────────────────────────────────────────

function Bone({
    width = '100%',
    height = 12,
    radius = 6,
    style = {},
}: {
    width?: string | number
    height?: number
    radius?: number
    style?: React.CSSProperties
}) {
    return (
        <div
            className="animate-pulse bg-zinc-200"
            style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
        />
    )
}

function ModalRowSkeleton() {
    return (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-zinc-200 p-4">
            {/* Avatar */}
            <Bone width={40} height={40} radius={9999} />

            {/* Text block */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Bone width={80} height={18} />
                    <Bone width={4} height={4} radius={9999} style={{ opacity: 0.4 }} />
                    <Bone width={120} height={18} />
                </div>
                <Bone width="75%" height={20} />
            </div>

            {/* Category badge */}
            <Bone width={72} height={22} radius={9999} style={{ flexShrink: 0 }} />
        </div>
    )
}

function ModalResultsSkeleton() {
    return (
        <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
                <ModalRowSkeleton key={i} />
            ))}
        </div>
    )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function TeamSearchModal({
    open,
    onClose,
    search,
    setSearch,
    workers,
    categories,
    activeCategory,
    setActiveCategory,
    loading = false, // ← pass true while workers are being fetched
    name,
}) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="4xl"
            className="flex flex-col overflow-hidden p-0 bg-zinc-100! max-[900px]:w-[90.5%] lg:min-w-[57.5%] h-[608px]!"
        >
            {/* Search Header */}
            <div className="p-2.5">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                    <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search Team Members..."
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <X
                        className="size-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                        onClick={onClose}
                    />
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
                    {loading ? (
                        // Skeleton pills while loading
                        [36, 80, 90, 76, 100, 84, 110, 112, 68, 78].map((w, i) => (
                            <Bone key={i} width={w} height={28} radius={9999} style={{ flexShrink: 0 }} />
                        ))
                    ) : (
                        categories.map((cat) => (
                            <Badge
                                key={cat}
                                onClick={() => {
                                    setActiveCategory((prev) => {
                                        if (cat === 'All') return ['All']
                                        const next = prev.includes(cat)
                                            ? prev.filter((c) => c !== cat)
                                            : [...prev.filter((c) => c !== 'All'), cat]
                                        return next.length === 0 ? ['All'] : next
                                    })
                                }}
                                className={`cursor-pointer whitespace-nowrap rounded-full! px-4 py-1.5 ${activeCategory.includes(cat)
                                    ? 'bg-blue-50! border! border-blue-500! text-blue-500!'
                                    : 'bg-white! text-zinc-700!'
                                    }`}
                            >
                                {cat}
                            </Badge>
                        ))
                    )}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2 min-h-0">

                {/* ── Skeleton state ── */}
                {loading && <ModalResultsSkeleton />}

                {/* ── Loaded + has results ── */}
                {!loading && workers.length > 0 && (
                    <div className="space-y-2.5">
                        {workers.map((worker) => {
                            const avatar = getWorkerAvatarSrcBySlug(worker.slug)
                            return (
                                <Link
                                    key={worker.slug}
                                    href={`/dashboard/team/${worker.slug}`}
                                    onClick={onClose}
                                    className="relative flex items-start gap-3 bg-white rounded-xl border border-zinc-200 p-4 transition-all hover:border-blue-500 hover:bg-blue-50"
                                >
                                    <div className="size-10 shrink-0 overflow-hidden rounded-full border">
                                        <Image
                                            src={avatar}
                                            alt={worker.name}
                                            width={40}
                                            height={40}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col md:flex-row md:items-center md:gap-1">
                                            <h4 className="font-semibold text-blue-500 text-sm md:text-xl mb-1">
                                                {worker.personaName || worker.name}
                                            </h4>
                                            <Dot className="size-5 text-[#181818] hidden md:flex" />
                                            <p className="font-normal text-[#181818] text-xs md:text-lg mb-1">
                                                {worker.name}
                                            </p>
                                        </div>
                                        <p className="line-clamp-2 sm:line-clamp-1 truncate text-xs sm:text-sm text-neutral-500">
                                            {worker.description}
                                        </p>
                                    </div>

                                    <Badge
                                        color="zinc"
                                        className="bg-white! border! border-zinc-300! text-xs! max-md:absolute max-md:top-2 max-md:right-2"
                                    >
                                        {worker.category}
                                    </Badge>
                                </Link>
                            )
                        })}
                    </div>
                )}

                {/* ── Loaded + empty ── */}
                {!loading && workers.length === 0 && (
                    <div className="flex h-[420px] flex-col items-center justify-center">
                        <div className="relative">
                            <div className="flex flex-col justify-center items-center gap-3 mb-8">
                                <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
                                    <CircleUserRound className="size-4 text-[#E0E1E3]" />
                                    <div className="flex flex-col gap-2 flex-1">
                                        <span className="left-6 top-2 h-1.5 w-20 rounded bg-[#E0E1E3]" />
                                        <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
                                    </div>
                                </div>
                                <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
                                    <CircleUserRound className="size-6 text-[#71717A]" />
                                    <div className="flex flex-col gap-2 flex-1">
                                        <span className="left-6 top-2 h-1.5 w-24 rounded bg-[#A4A7AE]" />
                                        <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
                                    </div>
                                </div>
                                <div className="flex items-center w-fit py-2 px-2.5 gap-3 rounded-md border border-zinc-200 bg-white shadow-sm">
                                    <CircleUserRound className="size-4 text-[#E0E1E3]" />
                                    <div className="flex flex-col gap-2 flex-1">
                                        <span className="left-6 top-2 h-1.5 w-20 rounded bg-[#E0E1E3]" />
                                        <span className="left-6 top-2 h-1.5 w-9 rounded bg-[#F5F5F5]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h3 className="text-lg font-semibold text-zinc-900 my-3 text-center">
                            No team member&apos;s match your search.
                        </h3>

                        <button
                            onClick={() => {
                                setSearch('')
                                setActiveCategory('All')
                            }}
                            className="rounded-lg shadow-xs border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                        >
                            Clear filter
                        </button>
                    </div>
                )}
            </div>
        </Dialog>
    )
}