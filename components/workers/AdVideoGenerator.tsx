"use client";

import { useState, useRef } from "react";
import { Pause, Play } from "lucide-react";
import Image from "next/image";

interface VideoPreviewProps {
    videoUrl?: string;
    posterImage?: string;
}

export function AdVideoGenerator({
    videoUrl = "/video.mp4",
    posterImage = "/images/adVideoGenerator.jpg",
}: VideoPreviewProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [showPoster, setShowPoster] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
                setShowPoster(false); // Hide poster when video starts playing
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Reset poster when video ends or is reset
    const handleVideoEnd = () => {
        setIsPlaying(false);
        setShowPoster(true); // Show poster again when video ends
    };

    const handleVideoPlay = () => {
        setIsPlaying(true);
        setShowPoster(false);
    };

    const handleVideoPause = () => {
        setIsPlaying(false);
        // Optional: Show poster when paused? Uncomment if you want
        // setShowPoster(true);
    };

    return (
        <div className="flex flex-col items-center justify-center py-21.5 w-full h-full">
            <div
                className="relative w-full max-w-[574px] h-[323px] rounded-lg shadow-xl group aspect-video overflow-hidden bg-black"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Video element - hidden when showing poster */}
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className={`w-full h-full object-cover transition-opacity duration-300`}
                    onError={() => setHasError(true)}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onEnded={handleVideoEnd}
                    preload="metadata"
                />

                {/* Poster Image - shown before video starts */}

                {hasError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                        <p>Video failed to load: {videoUrl}</p>
                    </div>
                )}

                {/* Center Play/Pause Button - Always visible when paused OR on hover */}
                {(!isPlaying || hovered) && !hasError && (
                    <button
                        onClick={togglePlay}
                        className={`absolute inset-0 flex cursor-pointer items-center justify-center transition-all duration-200 z-10 ${isPlaying ? 'bg-black/0 hover:bg-black/20' : 'bg-black/20 hover:bg-black/30'
                            }`}
                    >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/25 backdrop-blur-xl shadow-2xl transition-all duration-200 hover:scale-105">
                            {isPlaying ? (
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
        </div>
    );
}