"use client";

import { useRef } from "react";

interface GameIframeProps {
    isVisible: boolean;
}

export function GameIframe({ isVisible }: GameIframeProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Destroy iframe when overlay closes
    const src = isVisible ? "/features/index.html" : null;

    if (!src) return null;

    return (
        <iframe
            ref={iframeRef}
            src={src}
            title="App"
            style={{ width: "100%", height: "100%", border: "none" }}
            sandbox="allow-scripts allow-same-origin"
        />
    );
}
