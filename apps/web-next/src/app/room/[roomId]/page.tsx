"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VideoGrid } from "@/components/VideoGrid";
import { ControlBar } from "@/components/ControlBar";
import { Sidebar } from "@/components/Sidebar";
import { VideoPlayer } from "@/components/VideoPlayer";
import { StreamInputModal } from "@/components/StreamInputModal";
import { useRoom } from "@/contexts/RoomContext";

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
        toggleMute,
        toggleVideo,
        leaveRoom,
        mediaError
    } = useRoom();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [streamModalOpen, setStreamModalOpen] = useState(false);

    // Computed active view
    const remoteScreenShare = participants.find(p => p.isScreenSharing && !p.isLocal);
    const showSpotlight = activeStreamUrl || isScreenSharing || !!remoteScreenShare;

    // Handle immediate join for demo if localUser is missing but we are on this page?
    // Actually, let's show a "Pre-Join" screen if !localUser

    if (!localUser) {
        return (
            <div className="flex h-dvh w-full items-center justify-center bg-zinc-950">
                <div className="w-full max-w-md space-y-8 rounded-2xl bg-zinc-900/50 p-8 text-center ring-1 ring-white/10 backdrop-blur-xl">
                    <h1 className="text-2xl font-semibold text-white">Join Room</h1>
                    <p className="text-zinc-400">Enter your name to join <span className="text-indigo-400 font-mono">{roomId}</span></p>
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
                            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                        />
                        <button className="rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 transition-all">
                            Join Now
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <main className="relative h-dvh w-full overflow-hidden bg-zinc-950 flex">
            {/* Main Stage */}
            <div className="flex-1 flex flex-col h-full relative transition-all duration-300">
                {mediaError && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur flex items-center gap-2">
                        <span>⚠️ {mediaError}</span>
                    </div>
                )}
                {/* Stream / Spotlight Area */}
                {showSpotlight ? (
                    <div className="flex-1 p-4 flex flex-col gap-4">
                        {/* Cinema Mode Player */}
                        <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl bg-black relative group my-auto max-h-[85vh] ring-1 ring-white/10">
                            {activeStreamUrl ? (
                                <VideoPlayer />
                            ) : isScreenSharing ? (
                                // Local Screen Share
                                <div className="w-full h-full bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                                    {screenStream ? (
                                        <video
                                            autoPlay
                                            playsInline
                                            muted
                                            ref={(v) => { if (v) v.srcObject = screenStream }}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center space-y-4">
                                            <div className="animate-spin w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full" />
                                            <p className="text-zinc-500">Initializing screen share...</p>
                                        </div>
                                    )}

                                    {/* Overlay for Stop Control */}
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                                        <button onClick={toggleScreenShare} className="bg-red-500/90 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-red-600 transition shadow-lg">
                                            Stop Sharing
                                        </button>
                                    </div>
                                </div>
                            ) : remoteScreenShare ? (
                                // Remote Screen Share
                                <div className="w-full h-full bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                                    <video
                                        autoPlay
                                        playsInline
                                        // muted // Don't mute remote screen share usually? But usually it has no audio unless system audio shared.
                                        ref={(v) => {
                                            if (v && remoteScreenShare.stream) {
                                                v.srcObject = remoteScreenShare.stream;
                                            }
                                        }}
                                        className="w-full h-full object-contain"
                                    />
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs text-white border border-white/10">
                                        {remoteScreenShare.name}'s Screen
                                    </div>
                                </div>
                            ) : null}

                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs text-white border border-white/10 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                {activeStreamUrl ? "Synced Watch Party" : "Live Screen Share"}
                            </div>
                        </div>
                        {/* Filmstrip for participants */}
                        <div className="h-40 flex gap-4 overflow-x-auto pb-4 shrink-0 mt-auto w-full px-2 mask-linear-fade">
                            {participants.map(p => (
                                <div key={p.id} className="min-w-[200px] h-full rounded-xl bg-zinc-900 border border-zinc-800 relative overflow-hidden group shadow-lg ring-1 ring-white/5">
                                    {p.stream ? (
                                        <video
                                            autoPlay
                                            playsInline
                                            muted={p.isLocal}
                                            ref={(v) => {
                                                if (v) v.srcObject = p.stream!;
                                            }}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                                            <span className="text-zinc-500 text-sm font-medium">No Video</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-white/10 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/10">
                                                {p.name} {p.isLocal && "(You)"}
                                            </div>
                                            {/* Audio status indicator could go here */}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Grid Mode */
                    <VideoGrid participants={participants} />
                )}

                {/* Floating Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto max-w-full px-4">
                    <ControlBar
                        onStartStream={() => setStreamModalOpen(true)}
                        onToggleChat={() => setSidebarOpen(!sidebarOpen)}
                        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                        sidebarOpen={sidebarOpen}
                    />
                </div>
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
