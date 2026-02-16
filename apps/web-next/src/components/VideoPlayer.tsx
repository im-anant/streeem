"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { useRoom } from "@/contexts/RoomContext";

export function VideoPlayer() {
    const { activeStreamUrl, playbackState, currentTime, setPlayback } = useRoom();
    const playerRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const lastSeekTime = useRef<number>(0);
    const [hasError, setHasError] = useState(false);

    // Reset error when URL changes
    useEffect(() => {
        setHasError(false);
        setIsReady(false);
    }, [activeStreamUrl]);

    // Check if playable
    const isPlayable = (ReactPlayer as any).canPlay ? (ReactPlayer as any).canPlay(activeStreamUrl) : true;

    // Sync Logic: Explicitly control the internal player
    useEffect(() => {
        if (!playerRef.current || !isReady || hasError) return;

        const internalPlayer = playerRef.current.getInternalPlayer();

        // 1. YouTube Player API
        if (internalPlayer && typeof internalPlayer.playVideo === 'function') {
            if (playbackState === "playing") {
                // YouTube state: 1 = playing, 2 = paused
                const state = internalPlayer.getPlayerState();
                if (state !== 1 && state !== 3) { // 3 = buffering
                    internalPlayer.playVideo();
                }
            } else if (playbackState === "paused") {
                const state = internalPlayer.getPlayerState();
                if (state === 1) {
                    internalPlayer.pauseVideo();
                }
            }
        }
        // 2. HTML5 Video (MP4, etc)
        else {
            const videoElement = internalPlayer as HTMLVideoElement;
            if (videoElement && typeof videoElement.play === 'function') {
                if (playbackState === "playing" && videoElement.paused) {
                    videoElement.play().catch(e => console.error("Play failed:", e));
                } else if (playbackState === "paused" && !videoElement.paused) {
                    videoElement.pause();
                }
            }
        }

        // 3. Sync Time (Seek)
        // We defer seek to ReactPlayer's declarative prop usually, but for sync we might need imperative
        const current = playerRef.current.getCurrentTime();
        if (Math.abs(current - currentTime) > 2) {
            // Prevent seek loops
            if (Math.abs(currentTime - lastSeekTime.current) > 1) {
                playerRef.current.seekTo(currentTime, 'seconds');
                lastSeekTime.current = currentTime;
            }
        }
    }, [playbackState, currentTime, isReady, hasError]);

    if (!activeStreamUrl) return null;

    if (!isPlayable || hasError) {
        return (
            <div className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                    <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-white font-medium mb-2">Cannot Play URL</h3>
                <p className="text-zinc-400 text-sm mb-6 max-w-xs">
                    This URL cannot be played directly. Use <strong>Screen Share</strong> to stream this content instead.
                </p>
            </div>
        );
    }

    // Cast to any to avoid type issues with ReactPlayer props
    const ReactPlayerAny = ReactPlayer as any;

    return (
        <div className="relative w-full h-full bg-black rounded-lg overflow-hidden group">
            <ReactPlayerAny
                ref={playerRef}
                url={activeStreamUrl}
                width="100%"
                height="100%"
                // We rely on imperative logic for play/pause to ensure sync
                playing={playbackState === "playing"}
                controls={true}
                onReady={() => setIsReady(true)}
                onPlay={() => {
                    if (playbackState !== "playing") {
                        setPlayback("playing", playerRef.current?.getCurrentTime() || 0);
                    }
                }}
                onPause={() => {
                    if (playbackState !== "paused") {
                        setPlayback("paused", playerRef.current?.getCurrentTime() || 0);
                    }
                }}
                onError={(e: any) => {
                    console.error("ReactPlayer Error:", e);
                    setHasError(true);
                }}
                config={{
                    youtube: {
                        playerVars: { showinfo: 1, controls: 0 }
                    } as any
                }}
            />

            {/* Custom Sync Overlay */}
            {!isReady && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                </div>
            )}
        </div>
    );
}
