"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Participant } from "@/types";
import { VideoCard } from "./VideoCard";
import { TileReactionCanvasHandle } from "./TileReactionCanvas";

// ============================================================
// PipTile — Draggable local-user Picture-in-Picture tile
// Snaps to nearest corner on release (desktop)
// Hides with dock on mobile
// ============================================================

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const MARGIN = 16;
const TOP_MARGIN = 80;

const CORNER_POSITIONS: Record<Corner, React.CSSProperties> = {
    "bottom-right": { bottom: MARGIN, right: MARGIN, top: "auto", left: "auto" },
    "bottom-left": { bottom: MARGIN, left: MARGIN, top: "auto", right: "auto" },
    "top-right": { top: TOP_MARGIN, right: MARGIN, bottom: "auto", left: "auto" },
    "top-left": { top: TOP_MARGIN, left: MARGIN, bottom: "auto", right: "auto" },
};

function getClosestCorner(cx: number, cy: number): Corner {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const corners: { id: Corner; x: number; y: number }[] = [
        { id: "bottom-right", x: w, y: h },
        { id: "bottom-left", x: 0, y: h },
        { id: "top-right", x: w, y: 0 },
        { id: "top-left", x: 0, y: 0 },
    ];
    let closest: Corner = "bottom-right";
    let minDist = Infinity;
    for (const corner of corners) {
        const dist = Math.hypot(cx - corner.x, cy - corner.y);
        if (dist < minDist) { minDist = dist; closest = corner.id; }
    }
    return closest;
}

interface PipTileProps {
    participant: Participant;
    canvasRef: React.RefObject<TileReactionCanvasHandle | null>;
    dockVisible: boolean;  // for mobile dock-ride sync
}

export function PipTile({ participant, canvasRef, dockVisible }: PipTileProps) {
    const pipRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isMobile, setIsMobile] = useState(false);
    const [corner, setCorner] = useState<Corner>(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("pip-corner") as Corner) || "bottom-right";
        }
        return "bottom-right";
    });
    const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
    const [draggingState, setDraggingState] = useState(false);
    const [labelVisible, setLabelVisible] = useState(false);

    // Track mobile via matchMedia so it works on desktop with narrow viewport too
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    // ---- Desktop drag handlers ----
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isMobile) return;      // no drag on mobile
        e.preventDefault();
        const pip = pipRef.current;
        if (!pip) return;

        isDragging.current = true;
        setDraggingState(true);
        const rect = pip.getBoundingClientRect();
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setDragPos({ left: rect.left, top: rect.top });
        document.body.style.userSelect = "none";
    }, [isMobile]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            setDragPos({
                left: e.clientX - dragOffset.current.x,
                top: e.clientY - dragOffset.current.y,
            });
        };

        const handleMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            setDraggingState(false);
            document.body.style.userSelect = "";

            const pip = pipRef.current;
            if (!pip) return;
            const rect = pip.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const closest = getClosestCorner(cx, cy);
            setCorner(closest);
            setDragPos(null);
            localStorage.setItem("pip-corner", closest);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    // ---- Mobile tap-to-reveal label ----
    const handleTap = useCallback(() => {
        if (!isMobile) return;
        setLabelVisible(true);
        if (labelTimer.current) clearTimeout(labelTimer.current);
        labelTimer.current = setTimeout(() => setLabelVisible(false), 2000);
    }, [isMobile]);

    // Compute positioning style
    let style: React.CSSProperties;

    if (dragPos) {
        // Actively dragging — free position
        style = { left: dragPos.left, top: dragPos.top, right: "auto", bottom: "auto" };
    } else if (isMobile) {
        // Mobile: fixed bottom-right, bottom changes based on dock visibility
        // dock visible → PiP sits above dock (80px), dock hidden → settles to bottom (8px)
        style = {
            bottom: dockVisible ? 80 : 8,
            right: 16,
            top: "auto",
            left: "auto",
            transition: "bottom 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        };
    } else {
        // Desktop: snap-to-corner position
        style = { ...CORNER_POSITIONS[corner] };
    }

    return (
        <div
            ref={pipRef}
            className={`pip-tile ${draggingState ? "dragging" : ""} ${labelVisible ? "label-visible" : ""}`}
            style={style}
            onMouseDown={handleMouseDown}
            onClick={handleTap}
        >
            <VideoCard
                participant={participant}
                className="w-full h-full rounded-none border-0"
                canvasRef={canvasRef}
            />
        </div>
    );
}
