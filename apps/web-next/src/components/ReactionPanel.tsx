"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Smile, X } from "lucide-react";

interface ReactionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onReact: (reaction: string) => void;
}

const REACTIONS = [
    { emoji: "🎈", label: "balloons", name: "Balloons" },
    { emoji: "🎊", label: "confetti", name: "Confetti" },
    { emoji: "⚡", label: "laser", name: "Laser" },
    { emoji: "🎆", label: "firecracker", name: "Firecracker" },
    { emoji: "🌧️", label: "rain", name: "Rain" },
];

const COOLDOWN_MS = 3000;
const AUTO_DISMISS_MS = 4000;

export function ReactionPanel({ isOpen, onClose, onReact }: ReactionPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [cooldown, setCooldown] = useState(false);
    const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;

        function handleClick(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        }

        const t = setTimeout(() => document.addEventListener("mousedown", handleClick), 50);
        return () => {
            clearTimeout(t);
            document.removeEventListener("mousedown", handleClick);
        };
    }, [isOpen, onClose]);

    // Auto-dismiss after inactivity
    const resetAutoClose = useCallback(() => {
        if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = setTimeout(() => onClose(), AUTO_DISMISS_MS);
    }, [onClose]);

    useEffect(() => {
        if (isOpen) resetAutoClose();
        return () => {
            if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
        };
    }, [isOpen, resetAutoClose]);

    const handleReact = (label: string) => {
        if (cooldown) return;
        onReact(label);
        setCooldown(true);
        setTimeout(() => setCooldown(false), COOLDOWN_MS);
        resetAutoClose();
    };

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            style={{
                position: "absolute",
                bottom: 90,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 100,
                background: "rgba(17,17,17,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: "10px 14px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                animation: "reactionPanelIn 0.2s ease",
            }}
        >
            {REACTIONS.map((r) => (
                <button
                    key={r.label}
                    onClick={() => handleReact(r.label)}
                    disabled={cooldown}
                    title={r.label}
                    style={{
                        background: "none",
                        border: "none",
                        fontSize: 28,
                        cursor: cooldown ? "not-allowed" : "pointer",
                        opacity: cooldown ? 0.4 : 1,
                        borderRadius: 12,
                        padding: "6px 8px",
                        transition: "transform 0.15s, opacity 0.15s, background 0.15s",
                        lineHeight: 1,
                    }}
                    onMouseEnter={(e) => {
                        if (!cooldown) {
                            e.currentTarget.style.transform = "scale(1.3)";
                            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.background = "none";
                    }}
                >
                    {r.emoji}
                </button>
            ))}

            {cooldown && (
                <div
                    style={{
                        position: "absolute",
                        bottom: -20,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 10,
                        color: "#71717a",
                        whiteSpace: "nowrap",
                    }}
                >
                    Cooldown...
                </div>
            )}

            <style jsx>{`
        @keyframes reactionPanelIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
      `}</style>
        </div>
    );
}
