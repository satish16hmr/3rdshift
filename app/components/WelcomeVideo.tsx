"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Pause, Play, X } from "lucide-react";
import { useState } from "react";
import ReactPlayer from "react-player";

export default function OnboardingModal() {
    const [open, setOpen] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [hovered, setHovered] = useState(false);
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm px-4" onClick={() => setOpen(false)} />

            <div className="relative z-10 w-full max-w-[95%] sm:max-w-125 md:max-w-150 overflow-hidden rounded-xl bg-white shadow-2xl">
                <div
                    className="group relative aspect-video overflow-hidden"
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                >
                    <ReactPlayer
                        src="/video.mp4"
                        controls={playing}
                        playing={playing}
                        width="100%"
                        height="100%"
                    />

                    {!playing && (
                        <button
                            onClick={() => setPlaying(!playing)}
                            className="cursor-pointer absolute inset-0 flex items-center justify-center"
                        >
                            <div
                                className="flex h-20 w-20 items-center justify-center rounded-full bg-white/25 backdrop-blur-xl shadow-2xl transition-all duration-200"
                            >
                                {playing ? (
                                    <Pause
                                        size={35}
                                        fill="currentColor"
                                        className="text-white"
                                    />
                                ) : (
                                    <Play
                                        size={35}
                                        fill="currentColor"
                                        className="ml-1 text-white"
                                    />
                                )}
                            </div>
                        </button>
                    )}
                </div>
                <div className="px-6 py-7.75 hidden sm:block">
                    <h2 className="text-center text-2xl font-semibold text-zinc-800">
                        Your team is ready. Let's get something done.
                    </h2>

                    <p className="mt-3 text-center text-base leading-6 text-neutral-500">
                        Everything is set up for high-speed collaboration.
                        See who's online or start a new workflow.
                    </p>

                    {/* Actions */}
                    <div className="mt-6 flex items-center justify-center gap-3 bg-zinc-50 border-t border-zinc-200 pt-[25px]">
                        <Button variant='outline'>Pick a quick action</Button>
                        <Button variant='primary'>Browse your team <ArrowRight /></Button>
                    </div>
                </div>
            </div>
        </div>
    );
}