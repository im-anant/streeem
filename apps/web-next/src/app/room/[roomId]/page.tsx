"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Share2, Copy, Check } from "lucide-react";
import Link from "next/link";
import { VideoGrid } from "@/components/VideoGrid";
import { StreemDock } from "@/components/StreemDock";
import { ParticipantSidebar } from "@/components/ParticipantSidebar";
import { PipTile } from "@/components/PipTile";
import { VideoPlayer } from "@/components/VideoPlayer";
import { StreamInputModal } from "@/components/StreamInputModal";
import { useRoom } from "@/contexts/RoomContext";
import { VideoCard } from "@/components/VideoCard";
import { ChatOverlay } from "@/components/ChatOverlay";
import { ReactionPanel } from "@/components/ReactionPanel";
import { CinematicIdleRoom } from "@/components/CinematicIdleRoom";
import { TileReactionCanvasHandle } from "@/components/TileReactionCanvas";
import { useGestureDetection, type GestureEvent } from "@/hooks/useGestureDetection";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { GameOverlay } from "@/features/app/GameOverlay";
import { WatchPartyPicker } from "@/components/WatchParty/WatchPartyPicker";
import { WatchPartyPlayer } from "@/components/WatchParty/WatchPartyPlayer";
import { useWatchPartySync } from "@/hooks/useWatchPartySync";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

function RippleButton({ children, className, style, onClick }: { children: React.ReactNode, className?: string, style?: React.CSSProperties, onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
    const [ripples, setRipples] = useState<{ x: number, y: number, id: number }[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newRipple = { x, y, id: Date.now() };
        setRipples(prev => [...prev, newRipple]);

        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 700);

        onClick?.(e);
    };

    return (
        <button
            onClick={handleClick}
            className={cn("relative overflow-hidden", className)}
            style={style}
        >
            <span className="relative z-10 flex items-center gap-2 w-full h-full justify-center">
                {children}
            </span>
            {ripples.map(r => (
                <span
                    key={r.id}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        left: r.x,
                        top: r.y,
                        width: "120px",
                        height: "120px",
                        background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)",
                        transform: "translate(-50%, -50%) scale(0)",
                        animation: "button-ripple-effect 0.6s ease-out forwards",
                        zIndex: 0,
                    }}
                />
            ))}
        </button>
    );
}

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
        sendReaction,
        incomingReactions,
        localStream,
        messages,
        mediaError,
        roomError,
        // Watch Party
        watchPartySession,
        isWatchPartyHost,
        startWatchParty,
        stopWatchParty,
        setPlayback,
        remotePlaybackState,
    } = useRoom();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [participantSidebarCollapsed, setParticipantSidebarCollapsed] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isReactionPanelOpen, setIsReactionPanelOpen] = useState(false);
    const [streamModalOpen, setStreamModalOpen] = useState(false);
    const [watchPartyPickerOpen, setWatchPartyPickerOpen] = useState(false);
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const [appOpen, setAppOpen] = useState(false);
    const [dockVisible, setDockVisible] = useState(true);
    const [linkCopied, setLinkCopied] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [gestureEnabled, setGestureEnabled] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("streeem_gesture_enabled") !== "false";
        }
        return true;
    });
    const [showGestureTooltip, setShowGestureTooltip] = useState(false);

    // Hidden video element for gesture detection — use callback ref
    const [gestureVideoEl, setGestureVideoEl] = useState<HTMLVideoElement | null>(null);
    const gestureVideoRefCb = useCallback((node: HTMLVideoElement | null) => {
        if (node) setGestureVideoEl(node);
    }, []);

    // Per-tile canvas refs — keyed by participant ID
    const canvasRefsMap = useRef<Map<string, React.RefObject<TileReactionCanvasHandle | null>>>(new Map());

    // Get or create a ref for a participant
    const getCanvasRef = useCallback((id: string) => {
        if (!canvasRefsMap.current.has(id)) {
            canvasRefsMap.current.set(id, { current: null } as React.RefObject<TileReactionCanvasHandle | null>);
        }
        return canvasRefsMap.current.get(id)!;
    }, []);

    // Build map for current participants
    const canvasRefs = useMemo(() => {
        const map = new Map<string, React.RefObject<TileReactionCanvasHandle | null>>();
        for (const p of participants) {
            map.set(p.id, getCanvasRef(p.id));
        }
        return map;
    }, [participants, getCanvasRef]);

    // Feed localStream into the hidden video element
    useEffect(() => {
        if (gestureVideoEl && localStream) {
            gestureVideoEl.srcObject = localStream;
            gestureVideoEl.play().catch(() => { });
        }
    }, [localStream, gestureVideoEl]);

    // Gesture detection hook — route to local user's tile canvas
    const handleGesture = useCallback((event: GestureEvent) => {
        sendReaction(event.gesture);
        // Play on local user's tile canvas
        if (localUser) {
            const ref = getCanvasRef(localUser.id);
            ref.current?.playReaction(event.gesture as any, event.origin.x, event.origin.y);
        }
    }, [sendReaction, localUser, getCanvasRef]);

    const { isSupported: gestureSupported, isRunning: gestureRunning } = useGestureDetection({
        videoElement: gestureVideoEl,
        enabled: gestureEnabled,
        hasVideo: !!localUser?.hasVideo,
        onGesture: handleGesture,
    });

    // Route incoming broadcast reactions to correct participant's tile canvas
    useEffect(() => {
        if (incomingReactions.length > 0) {
            const latest = incomingReactions[incomingReactions.length - 1];
            const ref = canvasRefsMap.current.get(latest.userId);
            if (ref?.current) {
                ref.current.playReaction(latest.reaction as any);
            }
        }
    }, [incomingReactions]);

    // Show privacy tooltip on first use
    useEffect(() => {
        if (gestureRunning && !localStorage.getItem("streeem_gesture_tooltip_shown")) {
            setShowGestureTooltip(true);
            localStorage.setItem("streeem_gesture_tooltip_shown", "true");
            const timer = setTimeout(() => setShowGestureTooltip(false), 6000);
            return () => clearTimeout(timer);
        }
    }, [gestureRunning]);

    // Persist gesture toggle
    useEffect(() => {
        localStorage.setItem("streeem_gesture_enabled", String(gestureEnabled));
    }, [gestureEnabled]);

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
    const isContentMode = !!activeStreamUrl || !!activeScreenSharer || !!watchPartySession;

    // --- Computed Groups ---
    const remoteParticipants = useMemo(() => participants.filter(p => !p.isLocal), [participants]);

    // Watch Party sync hook
    const { syncState, handlePlayerEvent } = useWatchPartySync({
        isHost: isWatchPartyHost,
        isActive: !!watchPartySession,
        sendPlaybackState: (state) => {
            setPlayback(state.playing ? "playing" : "paused", state.positionSec);
        },
        remotePlaybackState,
    });

    // Watch Party title for status bar
    const watchPartyTitle = useMemo(() => {
        if (!watchPartySession) return '';
        const { title, contentType, season, episode } = watchPartySession;
        if (contentType === 'tv' && season && episode) {
            return `${title} (S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')})`;
        }
        return title;
    }, [watchPartySession]);

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
        <main className={cn(
            "relative h-dvh w-full overflow-hidden bg-black text-white",
            isContentMode && "streeem-sidebar-active",
            isContentMode && participantSidebarCollapsed && "sidebar-collapsed",
            !!watchPartySession && "watch-party-active"
        )}>
            {mediaError && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur flex items-center gap-2">
                    <span>⚠️ {mediaError}</span>
                </div>
            )}

            {/* Top Right: Share Info */}
            <div className="absolute top-4 right-4 z-[60] flex items-center gap-3">
                <RippleButton
                    onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    className="px-4 py-2 rounded-full text-xs font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                        background: "rgba(255,255,255,0.08)",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 0 20px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.3)",
                    }}
                >
                    {linkCopied ? (
                        <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="hidden sm:inline">Link Copied!</span>
                        </>
                    ) : (
                        <>
                            <Share2 className="w-3 h-3 text-indigo-300" />
                            <span className="hidden sm:inline">Share Link</span>
                        </>
                    )}
                </RippleButton>
                <RippleButton
                    onClick={() => {
                        navigator.clipboard.writeText(roomId);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                    }}
                    className="px-4 py-2 rounded-full text-xs font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                        background: "rgba(255,255,255,0.08)",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 0 20px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.3)",
                    }}
                >
                    {codeCopied ? (
                        <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="hidden sm:inline">Code Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3 text-indigo-300" />
                            <span className="hidden sm:inline">Code: {roomId}</span>
                        </>
                    )}
                </RippleButton>
            </div>

            {/* --- LAYOUT RENDERING --- */}
            {isContentMode ? (
                // ===============
                // CONTENT MODE (Screen Share OR Watch Party)
                // ===============
                <div className="flex flex-row h-full w-full">
                    {/* LEFT: Content area */}
                    <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
                        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-zinc-950 p-4">

                            {activeStreamUrl && !watchPartySession && (
                                // Legacy Watch Party Player (URL-based)
                                <div className="w-full h-full max-w-6xl flex items-center justify-center">
                                    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative bg-black">
                                        <VideoPlayer />
                                        <div className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded-full text-xs font-bold text-white shadow animate-pulse">
                                            LIVE PARTY
                                        </div>
                                    </div>
                                </div>
                            )}

                            {watchPartySession && (
                                // Vidking Watch Party Player
                                <WatchPartyPlayer
                                    embedUrl={watchPartySession.embedUrl}
                                    title={watchPartyTitle}
                                    isHost={isWatchPartyHost}
                                    syncState={syncState}
                                    onPlayerEvent={handlePlayerEvent}
                                />
                            )}

                            {!activeStreamUrl && activeScreenSharer && (
                                // Screen Share View
                                <div className="w-full h-full flex items-center justify-center relative">
                                    <div className="relative w-full h-full max-w-[90%] max-h-[85vh] flex items-center justify-center">
                                        <video
                                            autoPlay
                                            playsInline
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
                    </div>

                    {/* RIGHT: Participant Sidebar */}
                    <ParticipantSidebar
                        participants={participants}
                        localUser={localUser}
                        canvasRefs={canvasRefs}
                        getCanvasRef={getCanvasRef}
                    />
                </div>
            ) : (
                // ===============
                // NORMAL MODE (Grid + Floating)
                // ===============
                <div className="w-full h-full relative">
                    {/* 
                        Layout Logic:
                        - Total Participants = Remote + Local (if exists)
                        - If Total <= 3: Remote Grid + Floating Local
                        - If Total >= 4: All Grid (Local included in grid), No Floating
                     */}

                    {(() => {
                        const totalCount = remoteParticipants.length + (localUser ? 1 : 0);
                        const isLargeGroup = totalCount >= 4;

                        // Participants to show in grid
                        const gridParticipants = isLargeGroup
                            ? (localUser ? [...remoteParticipants, localUser] : remoteParticipants)
                            : remoteParticipants;

                        // Show floating self?
                        const showFloatingSelf = !isLargeGroup && !!localUser;

                        return (
                            <>
                                {/* Main Grid Stage */}
                                <div className={cn("w-full h-full flex items-center justify-center p-2 md:p-4 pb-24 md:pb-24", showFloatingSelf && "pb-24")}>
                                    {totalCount === 1 ? (
                                        // Cinematic Idle Mode — user is alone
                                        <CinematicIdleRoom roomId={roomId} />
                                    ) : gridParticipants.length === 0 && !localUser ? (
                                        // Fallback: No one in room at all
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
                                        // Grid
                                        <VideoGrid participants={gridParticipants} canvasRefs={canvasRefs} />
                                    )}
                                </div>

                                {/* Local Video: Floating PiP with snap-to-corner drag */}
                                {showFloatingSelf && localUser && (
                                    <PipTile
                                        participant={localUser}
                                        canvasRef={getCanvasRef(localUser.id)}
                                        dockVisible={dockVisible}
                                    />
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Streeem Dock — macOS-style auto-hiding controls */}
            <StreemDock
                onStartStream={() => setWatchPartyPickerOpen(true)}
                onToggleChat={() => setIsChatOpen(prev => !prev)}
                onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
                onToggleReactions={() => setIsReactionPanelOpen((prev) => !prev)}
                onToggleApp={() => setAppOpen((prev) => !prev)}
                sidebarOpen={sidebarOpen}
                chatOpen={isChatOpen}
                reactionsOpen={isReactionPanelOpen}
                appOpen={appOpen}
                onDockVisibilityChange={setDockVisible}
                watchPartyActive={!!watchPartySession}
                isWatchPartyHost={isWatchPartyHost}
                onStopWatchParty={() => setShowStopConfirm(true)}
            />

            {/* Reaction Panel (floating above controls) */}
            <ReactionPanel
                isOpen={isReactionPanelOpen}
                onClose={() => setIsReactionPanelOpen(false)}
                onReact={(reaction) => {
                    sendReaction(reaction);
                    // Play on local user's tile
                    if (localUser) {
                        const ref = getCanvasRef(localUser.id);
                        ref.current?.playReaction(reaction as any);
                    }
                    setIsReactionPanelOpen(false);
                }}
            />

            {/* Sidebar toggle — acts as participant list when NOT in content mode */}
            {sidebarOpen && !isContentMode && (
                <aside
                    className="fixed inset-y-0 right-0 z-[100] w-full md:w-[340px] border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-xl"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">Participants ({participants.length})</span>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white">
                            ✕
                        </button>
                    </div>
                    <div className="p-4 space-y-3">
                        {participants.map(p => (
                            <div key={p.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm text-zinc-200">{p.name} {p.isLocal && "(You)"}</span>
                            </div>
                        ))}
                    </div>
                </aside>
            )}

            {/* Overlay Chat v2.1 — input pill + floating message pills */}
            <ChatOverlay
                localUserId={localUser?.id}
                dockVisible={dockVisible}
                chatOpen={isChatOpen}
                onToggleChat={() => setIsChatOpen(prev => !prev)}
            />

            {/* Modals */}
            <StreamInputModal
                open={streamModalOpen}
                onClose={() => setStreamModalOpen(false)}
                onSubmit={(url) => setStreamUrl(url)}
            />

            {/* Watch Party Content Picker */}
            <WatchPartyPicker
                open={watchPartyPickerOpen}
                onClose={() => setWatchPartyPickerOpen(false)}
                onStart={(data) => {
                    startWatchParty(data);
                    setWatchPartyPickerOpen(false);
                }}
            />

            {/* Stop Watch Party Confirmation */}
            {showStopConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-semibold text-white mb-2">Stop Watch Party?</h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            This will end the watch session for everyone in the room.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowStopConfirm(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    stopWatchParty();
                                    setShowStopConfirm(false);
                                }}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg"
                            >
                                Stop Party
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* App Overlay — features/index.html */}
            {FEATURE_FLAGS.APP_ENABLED && (
                <GameOverlay
                    isOpen={appOpen}
                    onClose={() => setAppOpen(false)}
                />
            )}

            {/* Hidden video for gesture detection */}
            <video
                ref={gestureVideoRefCb}
                autoPlay
                playsInline
                muted
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", overflow: "hidden" }}
            />

            {/* Gesture detection status indicator */}
            {gestureSupported && gestureEnabled && (
                <div
                    style={{
                        position: "absolute",
                        top: 16,
                        left: 16,
                        zIndex: 80,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(17,17,17,0.85)",
                        borderRadius: 12,
                        padding: "6px 12px",
                        fontSize: 12,
                        color: gestureRunning ? "#34d399" : "#fbbf24",
                        border: `1px solid ${gestureRunning ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)"}`,
                    }}
                    className="hidden md:flex"
                >
                    <div
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: gestureRunning ? "#34d399" : "#fbbf24",
                            animation: gestureRunning ? "pulse 2s infinite" : "none",
                        }}
                    />
                    {gestureRunning ? "✋ Gesture detection active" : "⏳ Loading gestures..."}
                </div>
            )}

            {/* Privacy tooltip */}
            {showGestureTooltip && (
                <div
                    style={{
                        position: "absolute",
                        top: 56,
                        right: 16,
                        zIndex: 80,
                        background: "rgba(30,30,30,0.95)",
                        borderRadius: 12,
                        padding: "12px 16px",
                        maxWidth: 300,
                        fontSize: 13,
                        color: "#d4d4d8",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                        animation: "chatFadeIn 0.3s ease",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "#fff" }}>🔒 Private gesture detection</div>
                    <div>Your camera is analyzed <strong>locally</strong> to detect hand gestures. Nothing is sent to our servers.</div>
                    <button
                        onClick={() => setShowGestureTooltip(false)}
                        style={{
                            marginTop: 8,
                            background: "rgba(255,255,255,0.1)",
                            border: "none",
                            color: "#a1a1aa",
                            padding: "4px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            cursor: "pointer",
                        }}
                    >
                        Got it
                    </button>
                </div>
            )}

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                @keyframes chatFadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

        </main>
    );
}
