// @ts-nocheck
import React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus, Sparkle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import WorkerRating from '@/components/workers/WorkerRating'

interface TaskCompletedViewProps {
    avatarSrc: string | null
    workerPersona: string
    workerEmoji: string
    worker: any
    slug: any
    onAskRefine: () => void
    onSeeResult: () => void
    currentTask: any
}

export const TaskCompletedView = ({
    avatarSrc,
    workerPersona,
    workerEmoji,
    worker,
    slug,
    onAskRefine,
    onSeeResult,
    currentTask
}: TaskCompletedViewProps) => {
    const router = useRouter()

    return (
        <div
            className="flex flex-col items-center justify-center gap-4"
            style={{ height: 'calc(100vh - 85px)' }}
        >
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-5 text-center">
                    {avatarSrc ? (
                        <div className="relative size-16 rounded-full overflow-hidden border border-zinc-200">
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

                    <div className='px-3'>
                        <h2 className="text-2xl font-semibold text-zinc-900">Completed Task</h2>
                        <p className="text-sm text-neutral-500 mt-3 max-w-xs leading-relaxed">
                            {worker?.description
                                ? `${workerPersona} has finished your task. View the result on the right.`
                                : 'Your task is ready. Check the result panel on the right.'}
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center flex-wrap min-[390px]:flex-nowrap gap-1 sm:gap-3 mt-2 justify-center">
                    {slug !== 'logo-concept-generator' && (
                        <Button
                            variant='outline'
                            onClick={onAskRefine}
                            className='gap-1 sm:gap-2'
                        >
                            Ask {workerPersona} To Refine
                            <Sparkle className="size-4" />
                        </Button>
                    )}

                    <Button
                        onClick={() => router.push('/dashboard/team')}
                        variant='primary'
                        className='gap-1 sm:gap-2'
                    >
                        Create New Task
                        <Plus />
                    </Button>
                </div>
            </div>

            <div className="xl:hidden mt-4 rounded-2xl bg-white overflow-hidden flex flex-col gap-4 justify-end w-full">
                <div className='bg-zinc-50 p-3 border-t border-zinc-200'>
                    {/* See result row */}
                    <div className="flex items-center justify-between pb-3">
                        <p className="text-sm text-zinc-700 font-semibold pl-2">Result</p>
                        <Button
                            variant="outline"
                            className='bg-white'
                            onClick={() => onSeeResult?.()}
                        >
                            See result
                            <ChevronRight />
                        </Button>
                    </div>

                    {/* Rating row */}
                    <WorkerRating
                        currentTask={currentTask}
                        className="py-3 px-4 border border-zinc-200 max-sm:bg-white rounded-lg max-sm:shadow-xs w-full"
                    />
                </div>
            </div>
        </div>
    )
}
