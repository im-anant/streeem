"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { GameIframe } from "./GameIframe";

interface GameOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GameOverlay({ isOpen, onClose }: GameOverlayProps) {
    const [animState, setAnimState] = useState<"entering" | "visible" | "exiting" | "hidden">("hidden");

    // Open/close animation state machine
    useEffect(() => {
        if (isOpen) {
            setAnimState("entering");
            const t = setTimeout(() => setAnimState("visible"), 300);
            return () => clearTimeout(t);
        } else if (animState !== "hidden") {
            setAnimState("exiting");
            const t = setTimeout(() => setAnimState("hidden"), 220);
            return () => clearTimeout(t);
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Escape key closes overlay
    useEffect(() => {
        if (animState === "hidden") return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [animState, onClose]);

    if (animState === "hidden") return null;

    return (
        <div
            className={`game-overlay ${animState === "entering" ? "entering" : ""} ${animState === "exiting" ? "exiting" : ""}`}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 900,
                background: "rgba(0, 0, 0, 0.96)",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Top bar */}
            <div
                style={{
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 16px",
                    background: "rgba(255, 255, 255, 0.04)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    flexShrink: 0,
                }}
            >
                {/* Left: Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: 0.3 }}>
                        Super Hooper
                    </span>
                </div>

                <div style={{ flex: 1 }} />

                {/* Right: Close */}
                <button
                    onClick={onClose}
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(255,255,255,0.08)",
                        color: "#a1a1aa",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.2)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#a1a1aa";
                    }}
                    aria-label="Close app"
                >
                    <X style={{ width: 16, height: 16 }} />
                </button>
            </div>

            {/* iframe fills the rest */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <GameIframe isVisible={isOpen} />
            </div>
        </div>
    );
}
