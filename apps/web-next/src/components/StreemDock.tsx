"use client";

import {
    useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import {
    Mic, MicOff, Video, VideoOff, MonitorUp,
    MessageSquare, PhoneOff, Play, Camera, Users, Smile,
} from "lucide-react";
import { useRoom } from "@/contexts/RoomContext";

// ============================================================
// StreemDock — macOS Dock-style auto-hiding control bar
// ============================================================

interface StreemDockProps {
    onStartStream: () => void;
    onToggleChat: () => void;
    onToggleSidebar: () => void;
    onToggleReactions: () => void;
    sidebarOpen: boolean;
    chatOpen: boolean;
    reactionsOpen: boolean;
    onDockVisibilityChange?: (visible: boolean) => void;
}

// ---- Magnification math (PRD v1.1 — GPU-only transform:scale) ----
const MAX_SCALE = 1.55;   // icon at cursor = 1.55× (visual ~74px, slot stays 48)
const SIGMA = 38;     // Gaussian spread
const MAG_RADIUS = 90;     // px — beyond this, no magnification

function gaussian(d: number): number {
    if (d >= MAG_RADIUS) return 1;
    const g = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
    return 1 + (MAX_SCALE - 1) * g; // 1.0 → 1.55
}

// ---- Touch detection ----
function isTouchDevice(): boolean {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

// ---- Dock Icon Data ----
interface DockIconDef {
    id: string;
    label: string;
    noMagnify?: boolean; // End Call excluded from magnification
}

export function StreemDock({
    onStartStream,
    onToggleChat,
    onToggleSidebar,
    onToggleReactions,
    sidebarOpen,
    chatOpen,
    reactionsOpen,
    onDockVisibilityChange,
}: StreemDockProps) {
    const {
        localUser, toggleMute, toggleVideo, toggleScreenShare,
        isScreenSharing, leaveRoom, switchCamera,
    } = useRoom();

    // ---- Dock state ----
    const [dockVisible, setDockVisible] = useState(true);
    const dockRef = useRef<HTMLDivElement>(null);
    const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialShowDone = useRef(false);
    const isTouch = useRef(false);
    const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // rAF magnification state (no React state — direct DOM writes)
    const mouseXRef = useRef(0);
    const rafScheduledRef = useRef(false);
    const isMagnifyingRef = useRef(false);
    const iconScalesRef = useRef<number[]>([]);

    // Detect touch
    useEffect(() => { isTouch.current = isTouchDevice(); }, []);

    if (!localUser) return null;

    const isMuted = !localUser.hasAudio;
    const isVideoOff = !localUser.hasVideo;

    // Check if any panel is open (guard against hiding)
    const hasOpenMenu = sidebarOpen || chatOpen || reactionsOpen;

    // Inactivity delay: 5s during screen share, 3s normally
    const HIDE_DELAY = isScreenSharing ? 5000 : 3000;

    // ---- Helpers ----
    const dockHasFocus = useCallback(() => {
        if (!dockRef.current) return false;
        return dockRef.current.contains(document.activeElement);
    }, []);

    const showDock = useCallback(() => {
        setDockVisible(true);
    }, []);

    const hideDock = useCallback(() => {
        if (dockHasFocus() || hasOpenMenu) return;
        setDockVisible(false);
    }, [dockHasFocus, hasOpenMenu]);

    // Forward dock visibility to parent (for PiP hide-with-dock sync)
    useEffect(() => {
        onDockVisibilityChange?.(dockVisible);
    }, [dockVisible, onDockVisibilityChange]);

    const resetHideTimer = useCallback(() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        showDock();
        hideTimerRef.current = setTimeout(() => {
            if (!dockHasFocus() && !hasOpenMenu) {
                hideDock();
            }
        }, HIDE_DELAY);
    }, [showDock, hideDock, dockHasFocus, hasOpenMenu, HIDE_DELAY]);

    // ---- Initial 3s show, then hide ----
    useEffect(() => {
        if (initialShowDone.current) return;
        initialShowDone.current = true;
        const t = setTimeout(() => {
            if (!dockHasFocus() && !hasOpenMenu) {
                hideDock();
            }
        }, 3000);
        return () => clearTimeout(t);
    }, [dockHasFocus, hasOpenMenu, hideDock]);

    // ---- Document-level mousemove → reset timer (desktop only) ----
    useEffect(() => {
        if (isTouch.current) return;
        const handler = () => resetHideTimer();
        document.addEventListener("mousemove", handler);
        document.addEventListener("keydown", handler);
        return () => {
            document.removeEventListener("mousemove", handler);
            document.removeEventListener("keydown", handler);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [resetHideTimer]);

    // ---- Keep visible when panel is open ----
    useEffect(() => {
        if (hasOpenMenu) {
            showDock();
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        }
    }, [hasOpenMenu, showDock]);

    // ---- Mobile: tap-anywhere to reveal ----
    useEffect(() => {
        if (!isTouch.current) return;
        const handler = () => {
            showDock();
            if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
            touchTimerRef.current = setTimeout(() => {
                if (!hasOpenMenu) hideDock();
            }, 5000);
        };
        document.addEventListener("touchstart", handler);
        return () => {
            document.removeEventListener("touchstart", handler);
            if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        };
    }, [showDock, hideDock, hasOpenMenu]);

    // ---- rAF-throttled Gaussian magnification (PRD v1.1) ----
    const applyMagnification = useCallback(() => {
        rafScheduledRef.current = false;
        const dock = dockRef.current;
        if (!dock) return;

        // Add magnifying class to suppress CSS transitions during tracking
        if (!isMagnifyingRef.current) {
            dock.classList.add("magnifying");
            isMagnifyingRef.current = true;
        }

        const mouseX = mouseXRef.current;
        iconRefs.current.forEach((icon, i) => {
            if (!icon) return;
            // End Call (last icon) — no magnification
            if (i === iconRefs.current.length - 1) return;

            const rect = icon.getBoundingClientRect();
            const iconCX = rect.left + rect.width / 2;
            const dist = Math.abs(mouseX - iconCX);
            const scale = gaussian(dist);

            // Only write if value actually changed (skip unnecessary compositor work)
            const current = iconScalesRef.current[i] || 1;
            if (Math.abs(current - scale) > 0.001) {
                icon.style.transform = `scale(${scale.toFixed(3)})`;
                iconScalesRef.current[i] = scale;
            }
        });
    }, []);

    const handleDockMouseMove = useCallback((e: React.MouseEvent) => {
        if (isTouch.current) return;
        mouseXRef.current = e.clientX;
        if (!rafScheduledRef.current) {
            rafScheduledRef.current = true;
            requestAnimationFrame(applyMagnification);
        }
    }, [applyMagnification]);

    const handleDockMouseLeave = useCallback(() => {
        const dock = dockRef.current;
        if (dock) dock.classList.remove("magnifying");
        isMagnifyingRef.current = false;
        rafScheduledRef.current = false;
        // Spring back to scale(1) — CSS transition handles the animation
        iconRefs.current.forEach((icon, i) => {
            if (!icon) return;
            if (i === iconRefs.current.length - 1) return;
            icon.style.transform = "scale(1)";
            iconScalesRef.current[i] = 1;
        });
    }, []);

    // ---- Icon definitions (order matches PRD) ----
    const icons = useMemo(() => [
        { id: "mic", label: isMuted ? "Unmute" : "Mute" },
        { id: "camera", label: isVideoOff ? "Camera On" : "Camera Off" },
        { id: "snapshot", label: "Switch Camera" },
        { id: "screenshare", label: "Share Screen" },
        { id: "watchparty", label: "Watch Party" },
        { id: "participants", label: "Participants" },
        { id: "chat", label: "Chat" },
        { id: "reactions", label: "Reactions" },
        { id: "endcall", label: "End Call", noMagnify: true },
    ] as DockIconDef[], [isMuted, isVideoOff]);

    // ---- Button click handlers ----
    const handleClick = useCallback((id: string) => {
        switch (id) {
            case "mic": toggleMute(); break;
            case "camera": toggleVideo(); break;
            case "snapshot": switchCamera(); break;
            case "screenshare": toggleScreenShare(); break;
            case "watchparty": onStartStream(); break;
            case "participants": onToggleSidebar(); break;
            case "chat": onToggleChat(); break;
            case "reactions": onToggleReactions(); break;
            case "endcall":
                leaveRoom();
                window.location.href = "/";
                break;
        }
        // Release focus so dockHasFocus() doesn't block the hide timer
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    }, [toggleMute, toggleVideo, switchCamera, toggleScreenShare, onStartStream, onToggleSidebar, onToggleChat, onToggleReactions, leaveRoom]);

    // ---- Render icon content ----
    const renderIcon = (id: string) => {
        const cls = "w-5 h-5";
        switch (id) {
            case "mic": return isMuted ? <MicOff className={cls} /> : <Mic className={cls} />;
            case "camera": return isVideoOff ? <VideoOff className={cls} /> : <Video className={cls} />;
            case "snapshot": return <Camera className={cls} />;
            case "screenshare": return <MonitorUp className={cls} />;
            case "watchparty": return <Play className={cls} />;
            case "participants": return <Users className={cls} />;
            case "chat": return <MessageSquare className={cls} />;
            case "reactions": return <Smile className={cls} />;
            case "endcall": return <PhoneOff className={cls} />;
            default: return null;
        }
    };

    // ---- Icon background state ----
    const getIconBg = (id: string): string => {
        switch (id) {
            case "mic": return isMuted ? "background: rgba(239,68,68,0.1)" : "";
            case "camera": return isVideoOff ? "background: rgba(239,68,68,0.1)" : "";
            case "screenshare": return isScreenSharing ? "background: rgba(99,102,241,0.2)" : "";
            case "participants": return sidebarOpen ? "background: rgba(99,102,241,0.2)" : "";
            case "chat": return chatOpen ? "background: rgba(99,102,241,0.2)" : "";
            case "reactions": return reactionsOpen ? "background: rgba(234,179,8,0.2)" : "";
            case "endcall": return "background: rgba(239,68,68,0.9)";
            default: return "";
        }
    };

    const getIconColor = (id: string): string => {
        switch (id) {
            case "mic": return isMuted ? "color: #EF4444" : "";
            case "camera": return isVideoOff ? "color: #EF4444" : "";
            case "screenshare": return isScreenSharing ? "color: #818CF8" : "";
            case "participants": return sidebarOpen ? "color: #A5B4FC" : "";
            case "chat": return chatOpen ? "color: #A5B4FC" : "";
            case "reactions": return reactionsOpen ? "color: #FDE047" : "";
            case "endcall": return "color: white";
            default: return "";
        }
    };

    return (
        <>
            {/* ─── Hover Trigger Zone (desktop only) ─── */}
            <div
                className="dock-trigger-zone"
                onMouseEnter={showDock}
            />

            {/* ─── Status Strip (visible when dock hidden) ─── */}
            <div
                className={`dock-status-strip ${!dockVisible ? "visible" : ""}`}
                onClick={showDock}
            >
                {isMuted && <div className="status-dot muted" />}
                {isScreenSharing && <div className="status-dot sharing" />}
            </div>

            {/* ─── Dock ─── */}
            <div
                ref={dockRef}
                className={`streeem-dock scrollbar-hide ${!dockVisible ? "dock-hidden" : ""}`}
                onMouseMove={handleDockMouseMove}
                onMouseLeave={handleDockMouseLeave}
                onFocus={showDock}
            >
                {icons.map((icon, i) => {
                    return (
                        <div
                            key={icon.id}
                            ref={(el) => { iconRefs.current[i] = el; }}
                            className={`dock-icon ${icon.noMagnify ? "dock-icon--no-mag" : ""}`}
                            style={{
                                borderRadius: icon.id === "endcall" ? "50%" : 12,
                                ...(getIconBg(icon.id) ? { background: getIconBg(icon.id).replace("background: ", "") } : {}),
                                ...(getIconColor(icon.id) ? { color: getIconColor(icon.id).replace("color: ", "") } : {}),
                            }}
                            onClick={() => handleClick(icon.id)}
                            tabIndex={0}
                            role="button"
                            aria-label={icon.label}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleClick(icon.id);
                                }
                            }}
                        >
                            {renderIcon(icon.id)}
                            <span className="dock-tooltip">{icon.label}</span>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
