"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Share2, Copy } from "lucide-react";
import Link from "next/link";
import { VideoGrid } from "@/components/VideoGrid";
import { ControlBar } from "@/components/ControlBar";
import { Sidebar } from "@/components/Sidebar";
import { VideoPlayer } from "@/components/VideoPlayer";
import { StreamInputModal } from "@/components/StreamInputModal";
import { useRoom } from "@/contexts/RoomContext";
import { VideoCard } from "@/components/VideoCard";

export default function RoomPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const {
        participants,
        localUser,
        activeStreamUrl,
        isScreenSharing,
        screenStream,
        joinRoom,
        setStreamUrl,
        toggleScreenShare,
        mediaError,
        roomError
    } = useRoom();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [streamModalOpen, setStreamModalOpen] = useState(false);

    // --- State Logic ---

    // 1. Identify if anyone involves screen sharing
    // Remote participants who are screen sharing
    const remoteScreenShare = useMemo(() => {
        return participants.find(p => p.isScreenSharing && !p.isLocal);
    }, [participants]);

    // Active Screen Share: Remote OR Local
    const activeScreenSharer = remoteScreenShare || (localUser?.isScreenSharing ? localUser : null);

    // 2. Determine Layout Mode
    // Mode: "content" (Screen Share or Watch Party) vs "normal" (Video Call)
    const isContentMode = !!activeStreamUrl || !!activeScreenSharer;

    // --- Computed Groups ---
    const remoteParticipants = useMemo(() => participants.filter(p => !p.isLocal), [participants]);

    // Handle Join Screen
    if (!localUser) {
        return (
            <div className="flex h-dvh w-full items-center justify-center bg-zinc-950">
                <div className="w-full max-w-md space-y-8 rounded-2xl bg-zinc-900/50 p-8 text-center ring-1 ring-white/10 backdrop-blur-xl">
                    <h1 className="text-2xl font-semibold text-white">Join Room</h1>
                    <p className="text-zinc-400">Enter your name to join <span className="text-indigo-400 font-mono">{roomId}</span></p>

                    {roomError && (
                        <div className="bg-red-500/20 text-red-200 p-3 rounded-xl border border-red-500/30">
                            <p>{roomError}</p>
                            <Link href="/" className="text-xs underline hover:text-white mt-1 block">Back to Home</Link>
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const name = fd.get("name") as string;
                            if (name) joinRoom(name, roomId);
                        }}
                        className="flex flex-col gap-4"
                    >
                        <input
                            name="name"
                            placeholder="Your Name"
                            required
                            disabled={!!roomError}
                            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                            autoFocus
                        />
                        <button
                            disabled={!!roomError}
                            className="rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Join Now
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <main className="relative h-dvh w-full overflow-hidden bg-black text-white">
            {mediaError && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur flex items-center gap-2">
                    <span>⚠️ {mediaError}</span>
                </div>
            )}

            {/* Top Right: Share Info */}
            <div className="absolute top-4 right-4 z-[60] flex items-center gap-2">
                <button
                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                    className="bg-zinc-800/80 backdrop-blur px-3 py-1.5 rounded-full text-xs text-white border border-white/10 flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                >
                    <Share2 className="w-3 h-3" />
                    <span className="font-medium hidden sm:inline">Share Link</span>
                </button>
                <button
                    onClick={() => navigator.clipboard.writeText(roomId)}
                    className="bg-zinc-800/80 backdrop-blur px-3 py-1.5 rounded-full text-xs text-white border border-white/10 flex items-center gap-2 hover:bg-zinc-700 transition-colors"
                >
                    <Copy className="w-3 h-3" />
                    <span className="font-medium hidden sm:inline">Code: {roomId}</span>
                </button>
            </div>

            {/* --- LAYOUT RENDERING --- */}
            {isContentMode ? (
                // ===============
                // CONTENT MODE (Screen Share OR Watch Party)
                // ===============
                <div className="flex flex-col h-full w-full">
                    {/* Main Stage */}
                    <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-zinc-950 p-4 pb-[140px]">

                        {activeStreamUrl && (
                            // Watch Party Player
                            <div className="w-full h-full max-w-6xl flex items-center justify-center">
                                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative bg-black">
                                    <VideoPlayer />
                                    <div className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded-full text-xs font-bold text-white shadow animate-pulse">
                                        LIVE PARTY
                                    </div>
                                </div>
                            </div>
                        )}

                        {!activeStreamUrl && activeScreenSharer && (
                            // Screen Share View
                            <div className="w-full h-full flex items-center justify-center relative">
                                <div className="relative w-full h-full max-w-[90%] max-h-[85vh] flex items-center justify-center">
                                    <video
                                        autoPlay
                                        playsInline
                                        // Muted if local share or remote (usually we don't want echoes, but check audio rules)
                                        muted={true}
                                        ref={(v) => {
                                            if (v) {
                                                if (activeScreenSharer.isLocal && screenStream) {
                                                    v.srcObject = screenStream;
                                                } else if (!activeScreenSharer.isLocal && activeScreenSharer.stream) {
                                                    v.srcObject = activeScreenSharer.stream;
                                                }
                                            }
                                        }}
                                        className="w-full h-full object-contain"
                                    />

                                    {/* Label */}
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-full text-sm text-white font-medium border border-white/10">
                                        {activeScreenSharer.isLocal ? "You are sharing your screen" : `${activeScreenSharer.name}'s Screen`}
                                    </div>

                                    {/* Local Stop Button */}
                                    {activeScreenSharer.isLocal && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={toggleScreenShare}
                                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-2xl scale-110"
                                            >
                                                Stop Sharing
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Filmstrip */}
                    <div className="absolute bottom-0 left-0 w-full h-[120px] bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center gap-3 px-4 overflow-x-auto border-t border-white/10">
                        {participants.map(p => (
                            <div key={p.id} className="h-[100px] w-[160px] shrink-0 relative rounded-lg overflow-hidden border border-white/10 bg-zinc-900 group">
                                <VideoCard participant={p} className="w-full h-full object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                                    <p className="text-[10px] font-medium text-white truncate px-1">
                                        {p.name} {p.isLocal && "(You)"}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                // ===============
                // NORMAL MODE (Grid + Floating)
                // ===============
                <div className="w-full h-full relative">
                    {/* Main Stage: Remote Participants */}
                    <div className="w-full h-full flex items-center justify-center p-4 pb-24">
                        {/* pb-24 to ensure controls don't overlap too much if grid is full */}
                        {remoteParticipants.length === 0 ? (
                            // Waiting State
                            <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4">
                                <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative">
                                    <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
                                    <span className="text-4xl relative z-10">👋</span>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-medium text-white">Waiting for others</h3>
                                    <p className="text-sm mt-1 text-zinc-400">Share the room link to invite people</p>
                                </div>
                            </div>
                        ) : (
                            // Remote Grid
                            <VideoGrid participants={remoteParticipants} />
                        )}
                    </div>

                    {/* Local Video: Floating Bottom-Right */}
                    {localUser && (
                        <div className="absolute bottom-6 right-6 w-[280px] aspect-video z-50 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-zinc-900 transition-all hover:scale-105 group">
                            <VideoCard participant={localUser} className="w-full h-full object-cover" />
                            {/* Overlay Name */}
                            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white font-medium group-hover:opacity-100 opacity-0 transition-opacity">
                                You
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Global Controls Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] w-auto max-w-full px-4">
                <ControlBar
                    onStartStream={() => setStreamModalOpen(true)}
                    onToggleChat={() => setSidebarOpen(!sidebarOpen)}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    sidebarOpen={sidebarOpen}
                />
            </div>

            {/* Sidebar */}
            <Sidebar
                open={sidebarOpen}
                participants={participants}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Modals */}
            <StreamInputModal
                open={streamModalOpen}
                onClose={() => setStreamModalOpen(false)}
                onSubmit={(url) => setStreamUrl(url)}
            />

        </main>
    );
}
