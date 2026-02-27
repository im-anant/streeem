"use client";

import {
    useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import {
    Mic, MicOff, Video, VideoOff, MonitorUp,
    MessageSquare, PhoneOff, Play, Camera, Users, Smile, Gamepad2,
} from "lucide-react";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { useRoom } from "@/contexts/RoomContext";

// ============================================================
// StreemDock — macOS Dock-style auto-hiding control bar
// PRD v1.2 — Proximity-zone reveal (desktop) + tap toggle (mobile)
// ============================================================

interface StreemDockProps {
    onStartStream: () => void;
    onToggleChat: () => void;
    onToggleSidebar: () => void;
    onToggleReactions: () => void;
    onToggleApp?: () => void;
    sidebarOpen: boolean;
    chatOpen: boolean;
    reactionsOpen: boolean;
    appOpen?: boolean;
    unreadCount?: number;
    onDockVisibilityChange?: (visible: boolean) => void;
}

// ---- Magnification math (PRD v1.1 — GPU-only transform:scale) ----
const MAX_SCALE = 1.55;   // icon at cursor = 1.55x (visual ~74px, slot stays 48)
const SIGMA = 38;     // Gaussian spread
const MAG_RADIUS = 90;     // px — beyond this, no magnification

function gaussian(d: number): number {
    if (d >= MAG_RADIUS) return 1;
    const g = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
    return 1 + (MAX_SCALE - 1) * g; // 1.0 -> 1.55
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
    className?: string;  // Custom CSS classes (e.g. for responsive hiding)
}

export function StreemDock({
    onStartStream,
    onToggleChat,
    onToggleSidebar,
    onToggleReactions,
    onToggleApp,
    sidebarOpen,
    chatOpen,
    reactionsOpen,
    appOpen = false,
    unreadCount = 0,
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

    // -- Mobile state (PRD v1.2) --
    const mobileDockVisible = useRef(true);
    const initialAutoHideDone = useRef(false);
    const touchStartYRef = useRef(0);

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
    const hasOpenMenu = sidebarOpen || reactionsOpen;

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

    // -- resetHideTimer — only resets the countdown, does NOT reveal dock --
    const resetHideTimer = useCallback(() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (!dockHasFocus() && !hasOpenMenu) {
                hideDock();
            }
        }, HIDE_DELAY);
    }, [hideDock, dockHasFocus, hasOpenMenu, HIDE_DELAY]);

    // ==============================================================
    // DESKTOP: Proximity-Zone Trigger (PRD v1.2 Part 1)
    // ==============================================================

    // -- Initial 3s show, then hide (desktop only) --
    useEffect(() => {
        if (isTouch.current) return;
        if (initialShowDone.current) return;
        initialShowDone.current = true;
        const t = setTimeout(() => {
            if (!dockHasFocus() && !hasOpenMenu) {
                hideDock();
            }
        }, 3000);
        return () => clearTimeout(t);
    }, [dockHasFocus, hasOpenMenu, hideDock]);

    // -- HIDE TIMER system: mousemove anywhere only resets timer --
    // Key fix: mousemove does NOT reveal the dock — it only resets
    // the hide countdown when the dock is already visible.
    useEffect(() => {
        if (isTouch.current) return;
        const handler = () => {
            if (!dockVisible) return;   // dock hidden -> mousemove does NOTHING
            resetHideTimer();           // dock visible -> reset the countdown
        };
        document.addEventListener("mousemove", handler);
        return () => {
            document.removeEventListener("mousemove", handler);
        };
    }, [resetHideTimer, dockVisible]);

    // -- REVEAL TRIGGER: Only from proximity zone mouseenter --
    // The proximity zone div's onMouseEnter fires handleProximityEnter.
    const handleProximityEnter = useCallback(() => {
        if (isTouch.current) return;
        showDock();
        resetHideTimer();
    }, [showDock, resetHideTimer]);

    // -- Keyboard navigation (PRD v1.2 S1.7) --
    // focusin -> show dock, clear timer (stay visible while focused)
    // focusout -> if focus left dock entirely, start hide timer
    useEffect(() => {
        const dock = dockRef.current;
        if (!dock) return;

        const handleFocusIn = () => {
            showDock();
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };

        const handleFocusOut = (e: FocusEvent) => {
            if (!dock.contains(e.relatedTarget as Node)) {
                resetHideTimer();
            }
        };

        dock.addEventListener("focusin", handleFocusIn);
        dock.addEventListener("focusout", handleFocusOut);
        return () => {
            dock.removeEventListener("focusin", handleFocusIn);
            dock.removeEventListener("focusout", handleFocusOut);
        };
    }, [showDock, resetHideTimer]);

    // -- Keep visible when panel is open --
    useEffect(() => {
        if (hasOpenMenu) {
            showDock();
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        }
    }, [hasOpenMenu, showDock]);

    // ==============================================================
    // MOBILE: Tap-Anywhere Toggle (PRD v1.2 Part 2)
    // ==============================================================

    // -- Initial 4s auto-hide (one-time only) --
    useEffect(() => {
        if (!isTouch.current) return;
        if (initialAutoHideDone.current) return;

        const t = setTimeout(() => {
            hideDock();
            mobileDockVisible.current = false;
            initialAutoHideDone.current = true;
        }, 4000);
        return () => clearTimeout(t);
    }, [hideDock]);

    // -- Tap-anywhere toggle --
    // touchstart: record Y for scroll detection
    // touchend: if clean tap (deltaY <= 10px) on content area -> toggle dock
    useEffect(() => {
        if (!isTouch.current) return;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartYRef.current = e.changedTouches[0].clientY;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!initialAutoHideDone.current) return; // ignore during first 4s

            const touchEndY = e.changedTouches[0].clientY;
            const deltaY = Math.abs(touchEndY - touchStartYRef.current);

            // Scroll gesture — ignore
            if (deltaY > 10) return;

            // Tap on dock itself — let button handle it, don't toggle
            if (dockRef.current && dockRef.current.contains(e.target as Node)) return;

            // Tap on PiP tile — let PiP handle it
            const pipTile = document.querySelector(".pip-tile");
            if (pipTile && pipTile.contains(e.target as Node)) return;

            // Clean content-area tap — toggle
            if (mobileDockVisible.current) {
                // Hide dock
                setDockVisible(false);
                mobileDockVisible.current = false;
            } else {
                // Show dock — NO auto-hide timer after manual reveal
                setDockVisible(true);
                mobileDockVisible.current = true;
            }
        };

        document.addEventListener("touchstart", handleTouchStart, { passive: true });
        document.addEventListener("touchend", handleTouchEnd);
        return () => {
            document.removeEventListener("touchstart", handleTouchStart);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, []);

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
        // Reset hide timer while hovering over dock icons
        resetHideTimer();
    }, [applyMagnification, resetHideTimer]);

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
        ...(FEATURE_FLAGS.APP_ENABLED ? [{ id: "app", label: "Play Game", className: "hidden md:flex" }] : []),
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
            case "app": onToggleApp?.(); break;
            case "endcall":
                leaveRoom();
                window.location.href = "/";
                break;
        }
        // Release focus so dockHasFocus() doesn't block the hide timer
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    }, [toggleMute, toggleVideo, switchCamera, toggleScreenShare, onStartStream, onToggleSidebar, onToggleChat, onToggleReactions, onToggleApp, leaveRoom]);

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
            case "app": return <Gamepad2 className={cls} />;
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
            case "app": return appOpen ? "background: rgba(99,102,241,0.2)" : "";
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
            case "app": return appOpen ? "color: #818CF8" : "";
            case "endcall": return "color: white";
            default: return "";
        }
    };

    return (
        <>
            {/* --- Proximity Zone (desktop only, PRD v1.2 S1.3) --- */}
            {/* 120px tall invisible zone at bottom of viewport.
                mouseenter = the ONLY way to reveal the dock when hidden. */}
            <div
                className="dock-proximity-zone"
                onMouseEnter={handleProximityEnter}
            />

            {/* --- Status Strip (visible when dock hidden) --- */}
            <div
                className={`dock-status-strip ${!dockVisible ? "visible" : ""}`}
                onClick={showDock}
            >
                {isMuted && <div className="status-dot muted" />}
                {isScreenSharing && <div className="status-dot sharing" />}
            </div>

            {/* --- Dock --- */}
            <div
                ref={dockRef}
                className={`streeem-dock scrollbar-hide ${!dockVisible ? "dock-hidden" : ""}`}
                onMouseMove={handleDockMouseMove}
                onMouseLeave={handleDockMouseLeave}
            >
                {icons.map((icon, i) => {
                    return (
                        <div
                            key={icon.id}
                            ref={(el) => { iconRefs.current[i] = el; }}
                            className={`dock-icon ${icon.noMagnify ? "dock-icon--no-mag" : ""} ${icon.className || ""}`}
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
                            {icon.id === "chat" && unreadCount > 0 && !chatOpen && (
                                <span key={unreadCount} className="chat-unread-badge">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                            <span className="dock-tooltip">{icon.label}</span>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
