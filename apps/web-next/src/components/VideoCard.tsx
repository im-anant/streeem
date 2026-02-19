import { Participant } from "@/types";
import { Mic, MicOff, User } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TileReactionCanvas, TileReactionCanvasHandle } from "./TileReactionCanvas";

interface VideoCardProps {
    participant: Participant;
    className?: string;
    canvasRef?: React.Ref<TileReactionCanvasHandle | null>;
}

import { useEffect, useRef } from "react";
import { useRoom } from "@/contexts/RoomContext";

export function VideoCard({ participant, className, canvasRef }: VideoCardProps) {
    const { localStream } = useRoom();
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const stream = participant.isLocal ? localStream : participant.stream;
        const videoEl = videoRef.current;

        if (stream && videoEl) {
            // Only update srcObject if strictly necessary to avoid flickering
            if (videoEl.srcObject !== stream) {
                videoEl.srcObject = stream;
            }

            // Explicitly attempt playback
            videoEl.play()
                .then(() => {
                    console.log(`[VideoCard] Playing ${participant.name}. RS: ${videoEl.readyState}, Paused: ${videoEl.paused}`);
                })
                .catch(e => {
                    console.error("VideoCard play failed:", e);
                    console.log(`[VideoCard] Play failed state. RS: ${videoEl.readyState}, Paused: ${videoEl.paused}`);
                });
        }
    }, [localStream, participant.stream, participant.isLocal]);

    return (
        <div
            className={twMerge(
                "relative group overflow-hidden bg-zinc-900 rounded-xl border border-zinc-800",
                participant.isSpeaking && "ring-2 ring-indigo-500",
                className
            )}
        >
            {/* Video Placeholder / Stream */}
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                {/* Always keep video element mounted to preserve srcObject */}
                {((participant.isLocal && localStream) || (!participant.isLocal && participant.stream)) && (
                    <video
                        ref={videoRef}
                        autoPlay
                        muted={participant.isLocal || !participant.hasAudio}
                        playsInline
                        className={clsx(
                            "w-full h-full object-cover",
                            participant.isLocal && "transform -scale-x-100",
                            !participant.hasVideo && "hidden"
                        )}
                    />
                )}

                {/* Show avatar when video is off or no stream */}
                {!participant.hasVideo || (participant.isLocal ? !localStream : !participant.stream) ? (
                    <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center">
                        <User className="h-8 w-8 text-zinc-500" />
                    </div>
                ) : null}

                {/* Loading state when hasVideo but no stream yet */}
                {participant.hasVideo && (participant.isLocal ? !localStream : !participant.stream) && (
                    <div className="w-full h-full bg-zinc-800 animate-pulse flex items-center justify-center text-zinc-700">
                        {participant.isLocal ? "Camera Loading..." : "Remote Stream Loading..."}
                    </div>
                )}
            </div>

            {/* Per-tile reaction canvas overlay */}
            <TileReactionCanvas ref={canvasRef as any} />

            {/* Overlay Info */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 max-w-[80%]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
                    <span className="text-sm font-medium text-white truncate max-w-[120px]">
                        {participant.name} {participant.isLocal && "(You)"}
                    </span>
                    {participant.hasAudio ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    ) : (
                        <MicOff className="w-3 h-3 text-red-400" />
                    )}
                </div>
            </div>
        </div>
    );
}
