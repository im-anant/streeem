"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Users, MicOff } from "lucide-react";
import { Participant } from "@/types";
import { VideoCard } from "./VideoCard";
import { TileReactionCanvasHandle } from "./TileReactionCanvas";

// ============================================================
// ParticipantSidebar — Scener-style right sidebar with stacked
// participant video tiles during screen share / watch party
// ============================================================

interface ParticipantSidebarProps {
    participants: Participant[];
    localUser: Participant | null;
    canvasRefs: Map<string, React.RefObject<TileReactionCanvasHandle | null>>;
    getCanvasRef: (id: string) => React.RefObject<TileReactionCanvasHandle | null>;
}

export function ParticipantSidebar({
    participants,
    localUser,
    canvasRefs,
    getCanvasRef,
}: ParticipantSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    // Sort: local user first, then remotes in join order
    const sortedParticipants = (() => {
        const local = participants.filter(p => p.isLocal);
        const remotes = participants.filter(p => !p.isLocal);
        return [...local, ...remotes];
    })();

    const participantCount = participants.length;

    return (
        <>
            {/* Sidebar */}
            <aside
                className="participant-sidebar"
                style={{
                    width: collapsed ? 0 : 240,
                    opacity: collapsed ? 0 : 1,
                    pointerEvents: collapsed ? "none" : "auto",
                }}
            >
                {/* Header */}
                <div className="participant-sidebar__header">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-semibold text-white">
                            {participantCount} {participantCount === 1 ? "Person" : "People"}
                        </span>
                    </div>
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        aria-label="Collapse sidebar"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Tiles */}
                <div className="participant-sidebar__tiles">
                    {sortedParticipants.map(p => (
                        <div
                            key={p.id}
                            className="participant-sidebar__tile"
                        >
                            <div
                                className="relative w-full overflow-hidden rounded-lg"
                                style={{
                                    aspectRatio: "16/9",
                                    border: p.isSpeaking
                                        ? "2px solid #22C55E"
                                        : "1px solid rgba(255,255,255,0.08)",
                                    transition: "border 150ms ease",
                                }}
                            >
                                <VideoCard
                                    participant={p}
                                    className="w-full h-full rounded-lg"
                                    canvasRef={getCanvasRef(p.id)}
                                />

                                {/* Name label */}
                                <div className="absolute bottom-1 left-1.5 flex items-center gap-1">
                                    <span className="text-[10px] font-medium text-white bg-black/60 backdrop-blur px-1.5 py-0.5 rounded">
                                        {p.name} {p.isLocal && "(You)"}
                                    </span>
                                </div>

                                {/* Muted indicator */}
                                {!p.hasAudio && (
                                    <div className="absolute bottom-1 right-1.5">
                                        <MicOff className="w-3 h-3 text-red-400" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Re-expand button (visible when collapsed) */}
            {collapsed && (
                <button
                    onClick={() => setCollapsed(false)}
                    className="participant-sidebar__expand-btn"
                    aria-label="Expand sidebar"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            )}
        </>
    );
}
