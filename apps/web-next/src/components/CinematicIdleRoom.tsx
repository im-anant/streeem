"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Share2, Check } from "lucide-react";

// ============================================================
// CinematicIdleRoom — Immersive empty room experience
// Particles · Ambient Light · Sound Wave · Voice · CTA
// ============================================================

interface CinematicIdleRoomProps {
    roomId: string;
    voiceEnabled?: boolean;
}

// ---- Particle System ----

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    color: string;
    glowSize: number;
}

const PARTICLE_COLORS = [
    "rgba(99, 102, 241, 1)",   // indigo
    "rgba(139, 92, 246, 1)",   // purple
    "rgba(79, 70, 229, 1)",    // deeper indigo
    "rgba(167, 139, 250, 1)",  // light purple
    "rgba(255, 255, 255, 1)",  // white
    "rgba(45, 212, 191, 0.8)", // teal
];

function createParticle(w: number, h: number): Particle {
    return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 2 + Math.random() * 2,
        opacity: 0.05 + Math.random() * 0.1,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        glowSize: 4 + Math.random() * 8,
    };
}

// ---- Component ----

export function CinematicIdleRoom({ roomId, voiceEnabled = true }: CinematicIdleRoomProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const rafRef = useRef<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [ripple, setRipple] = useState(false);
    const voicePlayedRef = useRef(false);
    const prefersReducedMotion = useRef(false);

    // Check reduced motion preference
    useEffect(() => {
        if (typeof window !== "undefined") {
            prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        }
    }, []);

    // ---- AI Voice Announcement ----
    useEffect(() => {
        if (!voiceEnabled) return;
        if (voicePlayedRef.current) return;
        if (typeof window === "undefined") return;

        // Only play once per session
        const sessionKey = `streeem_voice_played_${roomId}`;
        if (sessionStorage.getItem(sessionKey)) return;

        const speak = () => {
            if (!("speechSynthesis" in window)) return;
            if (voicePlayedRef.current) return;

            voicePlayedRef.current = true;
            sessionStorage.setItem(sessionKey, "true");

            const utterance = new SpeechSynthesisUtterance("Room is live.");
            utterance.rate = 0.9;
            utterance.pitch = 0.95;
            utterance.volume = 0.4;

            // Try to pick a neutral English voice
            const voices = speechSynthesis.getVoices();
            const preferred = voices.find(
                (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel"))
            ) || voices.find((v) => v.lang.startsWith("en"));
            if (preferred) utterance.voice = preferred;

            speechSynthesis.speak(utterance);
        };

        // Voices may load async
        if (speechSynthesis.getVoices().length > 0) {
            setTimeout(speak, 1500);
        } else {
            speechSynthesis.addEventListener("voiceschanged", () => setTimeout(speak, 1500), { once: true });
        }
    }, [voiceEnabled, roomId]);

    // ---- Particle Canvas ----
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || prefersReducedMotion.current) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const isMobile = window.innerWidth < 768;
        const particleCount = isMobile ? 20 : 50;

        function resize() {
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = canvas.offsetHeight * dpr;
            ctx!.scale(dpr, dpr);
        }
        resize();

        // Init particles
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        particlesRef.current = [];
        for (let i = 0; i < particleCount; i++) {
            particlesRef.current.push(createParticle(w, h));
        }

        function frame() {
            if (!canvas || !ctx) return;
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            ctx.clearRect(0, 0, w, h);

            for (const p of particlesRef.current) {
                p.x += p.vx;
                p.y += p.vy;

                // Wrap around edges
                if (p.x < -10) p.x = w + 10;
                if (p.x > w + 10) p.x = -10;
                if (p.y < -10) p.y = h + 10;
                if (p.y > h + 10) p.y = -10;

                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = p.glowSize;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
                ctx.restore();
            }

            rafRef.current = requestAnimationFrame(frame);
        }

        rafRef.current = requestAnimationFrame(frame);
        window.addEventListener("resize", resize);

        return () => {
            window.removeEventListener("resize", resize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // ---- Invite CTA ----
    const handleInvite = useCallback(() => {
        const url = typeof window !== "undefined" ? window.location.href : "";
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setRipple(true);
            setTimeout(() => setCopied(false), 2000);
            setTimeout(() => setRipple(false), 600);
        });
    }, []);

    // Sound wave bar count
    const WAVE_BARS = 5;

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">

            {/* Layer 0: Particle Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 0 }}
            />

            {/* Layer 1: Ambient Gradient */}
            <div
                className="absolute inset-0"
                style={{
                    zIndex: 1,
                    background: "radial-gradient(ellipse at 30% 50%, rgba(79,70,229,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(45,212,191,0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(139,92,246,0.12) 0%, transparent 50%)",
                    backgroundSize: "200% 200%",
                    animation: "ambientShift 20s ease-in-out infinite",
                }}
            />

            {/* Layer 2: Sound Wave */}
            <div
                className="absolute flex items-center justify-center gap-[6px]"
                style={{
                    zIndex: 2,
                    bottom: "38%",
                    left: "50%",
                    transform: "translateX(-50%)",
                }}
            >
                {Array.from({ length: WAVE_BARS }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            width: 3,
                            height: 32,
                            borderRadius: 2,
                            background: "rgba(255,255,255,0.25)",
                            boxShadow: "0 0 8px rgba(255,255,255,0.1)",
                            animation: prefersReducedMotion.current
                                ? "none"
                                : `soundWaveBreath 2s ease-in-out infinite`,
                            animationDelay: `${i * 0.15}s`,
                            transformOrigin: "center",
                        }}
                    />
                ))}
            </div>

            {/* Layer 3: Cinematic Text + CTA */}
            <div
                className="relative flex flex-col items-center text-center px-6"
                style={{ zIndex: 3 }}
            >
                {/* Headline */}
                <h1
                    className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white tracking-tight"
                    style={{
                        animation: "cinematicFadeIn 1.2s ease-out forwards",
                        opacity: 0,
                        lineHeight: 1.3,
                    }}
                >
                    You&apos;re broadcasting into the void.
                </h1>

                {/* Subtext */}
                <p
                    className="mt-3 text-sm sm:text-base text-zinc-400 max-w-md"
                    style={{
                        animation: "cinematicFadeInDelay 1.8s ease-out forwards",
                        opacity: 0,
                    }}
                >
                    Invite someone to make it legendary.
                </p>

                {/* Live indicator */}
                <div
                    className="mt-6 flex items-center gap-2"
                    style={{
                        animation: "cinematicFadeInDelay 2s ease-out forwards",
                        opacity: 0,
                    }}
                >
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                        Live
                    </span>
                </div>

                {/* Invite CTA */}
                <div className="relative mt-8" style={{
                    animation: "cinematicFadeInDelay 2.5s ease-out forwards",
                    opacity: 0,
                }}>
                    <button
                        onClick={handleInvite}
                        className="relative flex items-center gap-3 px-6 py-3 rounded-full text-sm font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{
                            background: "rgba(255,255,255,0.08)",
                            backdropFilter: "blur(16px)",
                            WebkitBackdropFilter: "blur(16px)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            boxShadow: "0 0 20px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.3)",
                        }}
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <Share2 className="w-4 h-4 text-indigo-300" />
                        )}
                        {copied ? "Link Copied!" : "Share Invite Link"}
                    </button>

                    {/* Ripple effect */}
                    {ripple && (
                        <div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                border: "2px solid rgba(99,102,241,0.4)",
                                animation: "inviteRipple 0.6s ease-out forwards",
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
