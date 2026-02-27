"use client";

import { useEffect, useRef } from "react";

interface GameIframeProps {
    isVisible: boolean;
    onScore?: (score: number) => void;
}

export function GameIframe({ isVisible, onScore }: GameIframeProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handleMsg = (e: MessageEvent) => {
            if (e.data?.type === "GAME_SCORE") {
                onScore?.(e.data.score);
            }
        };
        window.addEventListener("message", handleMsg);
        return () => window.removeEventListener("message", handleMsg);
    }, [onScore]);

    // Destroy iframe when overlay closes — frees all Three.js memory
    const src = isVisible ? "/features/game/game.html" : "";

    return (
        <iframe
            ref={iframeRef}
            src={src}
            title="Streeem Runner"
            style={{ width: "100%", height: "100%", border: "none" }}
            sandbox="allow-scripts"
        // allow-scripts only — no allow-same-origin, no allow-forms
        // The game cannot access Streeem's DOM, cookies, or localStorage
        />
    );
}
