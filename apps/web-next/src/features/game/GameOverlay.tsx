"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { GameIframe } from "./GameIframe";

interface GameOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GameOverlay({ isOpen, onClose }: GameOverlayProps) {
    const [score, setScore] = useState(0);
    const [animState, setAnimState] = useState<"entering" | "visible" | "exiting" | "hidden">("hidden");

    // Open/close animation state machine
    useEffect(() => {
        if (isOpen) {
            setScore(0);
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

    const handleScore = useCallback((s: number) => {
        setScore(s);
    }, []);

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
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    flexShrink: 0,
                }}
            >
                {/* Left: Trial badge + Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                        className="game-trial-badge"
                        style={{
                            padding: "2px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#f59e0b",
                            background: "rgba(245,158,11,0.12)",
                            border: "1px solid rgba(245,158,11,0.2)",
                            letterSpacing: 0.5,
                        }}
                    >
                        Trial
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: 0.3 }}>
                        Runner
                    </span>
                </div>

                {/* Center: Score */}
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#fff",
                        letterSpacing: 2,
                        textShadow: "0 0 20px rgba(99,102,241,0.5)",
                    }}
                >
                    {score}
                </div>

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
                    aria-label="Close game"
                >
                    <X style={{ width: 16, height: 16 }} />
                </button>
            </div>

            {/* Game iframe fills the rest */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <GameIframe isVisible={isOpen} onScore={handleScore} />
            </div>
        </div>
    );
}
