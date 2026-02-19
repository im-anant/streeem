"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================
// Gesture Detection Hook — v3 (State Machine)
// IDLE → CONFIRMING → ACTIVE → COOLDOWN
// Fire-once, reset gate, hand-anchored origin
// ============================================================

export type GestureLabel = "balloons" | "confetti" | "laser" | "firecracker" | "rain";

export interface GestureEvent {
    gesture: GestureLabel;
    origin: { x: number; y: number }; // normalized 0-1 coords
    landmarks?: any; // raw landmarks for laser fingertips
}

interface UseGestureDetectionProps {
    videoElement: HTMLVideoElement | null;
    enabled: boolean;
    hasVideo: boolean;
    onGesture: (event: GestureEvent) => void;
}

interface UseGestureDetectionReturn {
    isSupported: boolean;
    isRunning: boolean;
    error: string | null;
}

// Landmark indices
const WRIST = 0;
const THUMB_TIP = 4;
const THUMB_MCP = 2;
const INDEX_TIP = 8;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const RING_TIP = 16;
const RING_MCP = 13;
const RING_PIP = 14;
const PINKY_TIP = 20;
const PINKY_MCP = 17;
const PINKY_PIP = 18;

type Lm = { x: number; y: number; z: number };
type Hand = Lm[];

// Finger helpers
const ext = (h: Hand, tip: number, mcp: number) => h[tip].y < h[mcp].y;
const curl = (h: Hand, tip: number, pip: number) => h[tip].y > h[pip].y;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Midpoint helper
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Palm center (average of wrist + MCP joints)
function palmCenter(h: Hand): { x: number; y: number } {
    const pts = [h[WRIST], h[INDEX_MCP], h[MIDDLE_MCP], h[RING_MCP], h[PINKY_MCP]];
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x, y };
}

// ---- Gesture Classifiers → returns { label, origin, landmarks } ----

interface ClassifyResult {
    label: GestureLabel;
    origin: { x: number; y: number };
    landmarks?: any;
}

function classify(hands: Hand[]): ClassifyResult | null {
    if (hands.length === 0) return null;

    // Two-hand gestures
    if (hands.length >= 2) {
        const h1 = hands[0], h2 = hands[1];

        // RAIN (heart shape) — thumb+index tips proximity
        if (dist(h1[THUMB_TIP], h2[THUMB_TIP]) < 0.08 && dist(h1[INDEX_TIP], h2[INDEX_TIP]) < 0.08) {
            return { label: "rain", origin: midpoint(palmCenter(h1), palmCenter(h2)) };
        }

        // BALLOONS (two thumbs up)
        const thumbOnly = (h: Hand) =>
            ext(h, THUMB_TIP, THUMB_MCP) &&
            curl(h, INDEX_TIP, INDEX_PIP) && curl(h, MIDDLE_TIP, MIDDLE_PIP) &&
            curl(h, RING_TIP, RING_PIP) && curl(h, PINKY_TIP, PINKY_PIP);
        if (thumbOnly(h1) && thumbOnly(h2) &&
            h1[THUMB_TIP].y < h1[WRIST].y && h2[THUMB_TIP].y < h2[WRIST].y) {
            return { label: "balloons", origin: midpoint(palmCenter(h1), palmCenter(h2)) };
        }

        // CONFETTI (jazz hands — both open)
        const allOpen = (h: Hand) =>
            ext(h, INDEX_TIP, INDEX_MCP) && ext(h, MIDDLE_TIP, MIDDLE_MCP) &&
            ext(h, RING_TIP, RING_MCP) && ext(h, PINKY_TIP, PINKY_MCP) &&
            ext(h, THUMB_TIP, THUMB_MCP);
        if (allOpen(h1) && allOpen(h2)) {
            return { label: "confetti", origin: midpoint(palmCenter(h1), palmCenter(h2)) };
        }
    }

    // One-hand gestures
    const h = hands[0];

    // LASER (peace sign)
    if (ext(h, INDEX_TIP, INDEX_MCP) && ext(h, MIDDLE_TIP, MIDDLE_MCP) &&
        curl(h, RING_TIP, RING_PIP) && curl(h, PINKY_TIP, PINKY_PIP)) {
        return {
            label: "laser",
            origin: midpoint(h[INDEX_TIP], h[MIDDLE_TIP]),
            landmarks: { indexTip: h[INDEX_TIP], middleTip: h[MIDDLE_TIP] },
        };
    }

    // FIRECRACKER (rock on)
    if (ext(h, INDEX_TIP, INDEX_MCP) && ext(h, PINKY_TIP, PINKY_MCP) &&
        curl(h, MIDDLE_TIP, MIDDLE_PIP) && curl(h, RING_TIP, RING_PIP)) {
        return { label: "firecracker", origin: palmCenter(h) };
    }

    return null;
}

// ---- State Machine ----
const S_IDLE = 0, S_CONFIRMING = 1, S_ACTIVE = 2, S_COOLDOWN = 3;
const HOLD_FRAMES = 6;       // ~400ms at 15fps
const COOLDOWN_MS = 2500;
const NEUTRAL_REQUIRED = 4;  // null frames before IDLE restored

// ---- CDN Script Loader ----
function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src; s.crossOrigin = "anonymous";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(s);
    });
}

function checkCapabilities() {
    const wasm = typeof WebAssembly !== "undefined";
    let webgl = false;
    try { const c = document.createElement("canvas"); webgl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { }
    return { wasm, webgl, mobile: navigator.maxTouchPoints > 0 };
}

// ============================================================
// Hook
// ============================================================

export function useGestureDetection({
    videoElement, enabled, hasVideo, onGesture,
}: UseGestureDetectionProps): UseGestureDetectionReturn {
    const [isSupported, setIsSupported] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handsRef = useRef<any>(null);
    const rafRef = useRef<number | null>(null);
    const onGestureRef = useRef(onGesture);
    onGestureRef.current = onGesture;

    useEffect(() => {
        if (!enabled || !hasVideo || !videoElement) { setIsRunning(false); return; }

        const caps = checkCapabilities();
        if (!caps.wasm || !caps.webgl) { setIsSupported(false); return; }

        const fps = caps.mobile ? 10 : 15;
        const interval = 1000 / fps;
        let cancelled = false;

        // State machine variables
        let state = S_IDLE;
        let holdFrames = 0;
        let activeGesture: string | null = null;
        let activeResult: ClassifyResult | null = null;
        let neutralFrames = 0;
        let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

        async function init() {
            try {
                await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js");
                if (cancelled) return;

                const win = window as any;
                if (!win.Hands) throw new Error("MediaPipe Hands not found");

                const hands = new win.Hands({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
                });

                hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });

                hands.onResults((results: any) => {
                    if (cancelled) return;
                    const landmarks: Hand[] = results.multiHandLandmarks || [];
                    const result = classify(landmarks);

                    // ---- State Machine ----
                    if (state === S_COOLDOWN) {
                        if (!result) {
                            neutralFrames++;
                            if (neutralFrames >= NEUTRAL_REQUIRED) {
                                if (cooldownTimer) clearTimeout(cooldownTimer);
                                state = S_IDLE;
                                activeGesture = null;
                                activeResult = null;
                                neutralFrames = 0;
                            }
                        }
                        return;
                    }

                    if (state === S_ACTIVE) return; // already fired, wait for hand to leave

                    if (!result) {
                        if (state === S_CONFIRMING) { holdFrames = 0; state = S_IDLE; }
                        // If ACTIVE and no hands → enter cooldown
                        if (landmarks.length === 0 && state === S_ACTIVE) {
                            state = S_COOLDOWN;
                            neutralFrames = 0;
                            cooldownTimer = setTimeout(() => { state = S_IDLE; activeGesture = null; }, COOLDOWN_MS);
                        }
                        return;
                    }

                    if (state === S_IDLE) {
                        activeGesture = result.label;
                        activeResult = result;
                        holdFrames = 1;
                        state = S_CONFIRMING;
                        return;
                    }

                    if (state === S_CONFIRMING) {
                        if (result.label !== activeGesture) {
                            // Different gesture — reset and start confirming the new one
                            activeGesture = result.label;
                            activeResult = result;
                            holdFrames = 1;
                            return;
                        }
                        holdFrames++;
                        activeResult = result; // keep latest origin
                        if (holdFrames >= HOLD_FRAMES) {
                            state = S_ACTIVE;
                            onGestureRef.current({
                                gesture: activeResult!.label,
                                origin: activeResult!.origin,
                                landmarks: activeResult!.landmarks,
                            });
                            // After firing, wait for hand to leave → cooldown
                            // Auto-transition after a timeout in case hand stays
                            cooldownTimer = setTimeout(() => {
                                state = S_COOLDOWN;
                                neutralFrames = 0;
                            }, 500);
                        }
                    }
                });

                await hands.initialize();
                if (cancelled) { hands.close(); return; }

                handsRef.current = hands;
                setIsRunning(true);
                console.log("[GestureDetection] v3 state machine initialized");

                let lastTime = 0;
                async function loop() {
                    if (cancelled) return;
                    const now = performance.now();
                    if (now - lastTime >= interval && !document.hidden && videoElement && videoElement.readyState >= 2) {
                        lastTime = now;
                        try { await hands.send({ image: videoElement }); } catch { }
                    }
                    rafRef.current = requestAnimationFrame(loop);
                }
                loop();
            } catch (e: any) {
                if (!cancelled) {
                    console.error("[GestureDetection] Init failed:", e);
                    setError(e.message); setIsSupported(false); setIsRunning(false);
                }
            }
        }

        init();

        return () => {
            cancelled = true; setIsRunning(false);
            if (cooldownTimer) clearTimeout(cooldownTimer);
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            if (handsRef.current) { try { handsRef.current.close(); } catch { } handsRef.current = null; }
        };
    }, [enabled, hasVideo, videoElement]);

    return { isSupported, isRunning, error };
}
