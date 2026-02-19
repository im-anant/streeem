"use client";

import { useEffect, useRef, useCallback } from "react";
import type { GestureEvent } from "@/hooks/useGestureDetection";

// ============================================================
// ReactionCanvas — 5 Apple-style canvas-based reactions
// Balloons, Confetti, Laser, Firecracker, Rain
// ============================================================

interface ReactionCanvasProps {
    /** New reactions to render. Push items here; the canvas consumes them. */
    reactions: GestureEvent[];
}

// ---- Particle types ----

interface Balloon {
    x: number; y: number; vx: number; vy: number;
    size: number; color: string; wobblePhase: number;
    life: number; maxLife: number;
}

interface ConfettiPiece {
    x: number; y: number; vy: number; vx: number;
    size: number; color: string; rotation: number; rotSpeed: number;
    life: number; maxLife: number;
}

interface LaserBeam {
    x1: number; y1: number; x2: number; y2: number;
    color: string; life: number; maxLife: number;
}

interface Spark {
    x: number; y: number; vx: number; vy: number;
    color: string; size: number;
    life: number; maxLife: number;
    phase: "rocket" | "burst";
}

interface RainDrop {
    x: number; y: number; vy: number;
    size: number; wobblePhase: number; wobbleAmp: number;
    opacity: number; emoji: string;
    life: number; maxLife: number; startDelay: number;
}

type Particle = Balloon | ConfettiPiece | LaserBeam | Spark | RainDrop;

interface ActiveEffect {
    type: string;
    particles: Particle[];
    startTime: number;
    duration: number;
}

const COLORS = {
    balloons: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#FF85A2", "#A8E6CF"],
    confetti: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#F7DC6F", "#BB8FCE", "#FF85A2", "#85C1E9", "#F8C471", "#82E0AA"],
    sparks: ["#FFD700", "#FF6347", "#FF4500", "#FFA500", "#FF1493", "#00FF7F", "#00CED1"],
    hearts: ["#FF6B6B", "#FF85A2", "#FF4757", "#E84393", "#FD79A8"],
};

function randRange(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ---- Effect Spawners ----

function spawnBalloons(ox: number, oy: number, w: number, h: number): ActiveEffect {
    const count = Math.floor(randRange(3, 6));
    const particles: Balloon[] = [];
    for (let i = 0; i < count; i++) {
        particles.push({
            x: ox * w + randRange(-30, 30),
            y: oy * h,
            vx: randRange(-0.5, 0.5),
            vy: randRange(-2.5, -1.5),
            size: randRange(28, 42),
            color: pick(COLORS.balloons),
            wobblePhase: Math.random() * Math.PI * 2,
            life: 0, maxLife: 300, // ~5s at 60fps
        });
    }
    return { type: "balloons", particles, startTime: Date.now(), duration: 5000 };
}

function spawnConfetti(_ox: number, _oy: number, w: number, _h: number): ActiveEffect {
    const count = Math.floor(randRange(80, 120));
    const particles: ConfettiPiece[] = [];
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * w,
            y: randRange(-20, 0),
            vy: randRange(1, 3),
            vx: randRange(-1, 1),
            size: randRange(6, 12),
            color: pick(COLORS.confetti),
            rotation: Math.random() * 360,
            rotSpeed: randRange(-8, 8),
            life: 0, maxLife: 240,
        });
    }
    return { type: "confetti", particles, startTime: Date.now(), duration: 4000 };
}

function spawnLaser(ox: number, oy: number, w: number, h: number, landmarks?: any): ActiveEffect {
    const beams: LaserBeam[] = [];
    if (landmarks?.indexTip && landmarks?.middleTip) {
        // Two beams from fingertip positions
        const tips = [landmarks.indexTip, landmarks.middleTip];
        for (const tip of tips) {
            const x1 = tip.x * w;
            const y1 = tip.y * h;
            const angle = randRange(-0.3, 0.3);
            const len = Math.max(w, h) * 0.8;
            beams.push({
                x1, y1,
                x2: x1 + Math.cos(angle - Math.PI / 2) * len,
                y2: y1 + Math.sin(angle - Math.PI / 2) * len,
                color: "#FF0066",
                life: 0, maxLife: 90,
            });
        }
    } else {
        // Fallback: two beams from origin
        for (let i = 0; i < 2; i++) {
            const x1 = ox * w + (i === 0 ? -10 : 10);
            const y1 = oy * h;
            const angle = randRange(-0.2, 0.2);
            const len = Math.max(w, h) * 0.8;
            beams.push({
                x1, y1,
                x2: x1 + Math.cos(angle - Math.PI / 2) * len,
                y2: y1 + Math.sin(angle - Math.PI / 2) * len,
                color: "#FF0066",
                life: 0, maxLife: 90,
            });
        }
    }
    return { type: "laser", particles: beams, startTime: Date.now(), duration: 1500 };
}

function spawnFirecracker(ox: number, oy: number, w: number, h: number): ActiveEffect {
    // Start with a single rocket particle, will burst into sparks
    const particles: Spark[] = [{
        x: ox * w, y: oy * h,
        vx: 0, vy: -8,
        color: "#FFD700", size: 4,
        life: 0, maxLife: 150,
        phase: "rocket",
    }];
    return { type: "firecracker", particles, startTime: Date.now(), duration: 2500 };
}

function spawnRain(_ox: number, _oy: number, w: number, _h: number): ActiveEffect {
    const count = Math.floor(randRange(60, 80));
    const particles: RainDrop[] = [];
    const emojis = ["❤️", "💕", "💗", "✨", "⭐"];
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * w,
            y: randRange(-40, -10),
            vy: randRange(1.5, 3),
            size: randRange(20, 36),
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleAmp: randRange(4, 8),
            opacity: 1,
            emoji: pick(emojis),
            life: 0, maxLife: 300,
            startDelay: Math.floor(randRange(0, 120)),
        });
    }
    return { type: "rain", particles, startTime: Date.now(), duration: 5000 };
}

// ---- Renderers ----

function renderBalloons(ctx: CanvasRenderingContext2D, p: Balloon) {
    const progress = p.life / p.maxLife;
    const alpha = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Balloon body
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size * 0.5, p.size * 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.ellipse(p.x - p.size * 0.15, p.y - p.size * 0.2, p.size * 0.12, p.size * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fill();

    // String
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.size * 0.65);
    ctx.quadraticCurveTo(p.x + 5, p.y + p.size * 0.9, p.x - 3, p.y + p.size * 1.1);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

function renderConfetti(ctx: CanvasRenderingContext2D, p: ConfettiPiece) {
    const progress = p.life / p.maxLife;
    const alpha = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
}

function renderLaser(ctx: CanvasRenderingContext2D, b: LaserBeam) {
    const progress = b.life / b.maxLife;
    const alpha = 1 - progress;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    // Core (bright white)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();

    ctx.restore();
}

function renderSpark(ctx: CanvasRenderingContext2D, s: Spark) {
    const progress = s.life / s.maxLife;
    const alpha = s.phase === "rocket" ? 1 : Math.max(0, 1 - progress * 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.phase === "rocket" ? 8 : 4;
    ctx.fill();
    ctx.restore();
}

function renderRainDrop(ctx: CanvasRenderingContext2D, r: RainDrop) {
    if (r.life < r.startDelay) return;
    const progress = (r.life - r.startDelay) / (r.maxLife - r.startDelay);
    const alpha = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = alpha * r.opacity;
    ctx.font = `${r.size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(r.emoji, r.x, r.y);
    ctx.restore();
}

// ============================================================
// Component
// ============================================================

export function ReactionCanvas({ reactions }: ReactionCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const effectsRef = useRef<ActiveEffect[]>([]);
    const rafRef = useRef<number | null>(null);
    const prevReactionsLenRef = useRef(0);

    // Spawn effects when new reactions arrive
    useEffect(() => {
        if (reactions.length <= prevReactionsLenRef.current) {
            prevReactionsLenRef.current = reactions.length;
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const w = canvas.width;
        const h = canvas.height;

        // Process only new reactions
        const newReactions = reactions.slice(prevReactionsLenRef.current);
        prevReactionsLenRef.current = reactions.length;

        for (const r of newReactions) {
            const ox = r.origin?.x ?? 0.5;
            const oy = r.origin?.y ?? 0.5;

            switch (r.gesture) {
                case "balloons":
                    effectsRef.current.push(spawnBalloons(ox, oy, w, h));
                    break;
                case "confetti":
                    effectsRef.current.push(spawnConfetti(ox, oy, w, h));
                    break;
                case "laser":
                    effectsRef.current.push(spawnLaser(ox, oy, w, h, r.landmarks));
                    break;
                case "firecracker":
                    effectsRef.current.push(spawnFirecracker(ox, oy, w, h));
                    break;
                case "rain":
                    effectsRef.current.push(spawnRain(ox, oy, w, h));
                    break;
            }
        }
    }, [reactions]);

    // Animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        function resize() {
            if (!canvas) return;
            canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
            canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        }
        resize();
        window.addEventListener("resize", resize);

        function frame() {
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            ctx.clearRect(0, 0, w, h);

            const now = Date.now();
            effectsRef.current = effectsRef.current.filter(eff => now - eff.startTime < eff.duration + 500);

            for (const eff of effectsRef.current) {
                for (const p of eff.particles) {
                    (p as any).life++;

                    switch (eff.type) {
                        case "balloons": {
                            const b = p as Balloon;
                            b.wobblePhase += 0.05;
                            b.x += Math.sin(b.wobblePhase) * 0.8 + b.vx;
                            b.y += b.vy;
                            b.vy *= 0.998; // slow deceleration
                            if (b.life < b.maxLife) renderBalloons(ctx, b);
                            break;
                        }
                        case "confetti": {
                            const c = p as ConfettiPiece;
                            c.x += c.vx;
                            c.y += c.vy;
                            c.vy += 0.05; // gravity
                            c.rotation += c.rotSpeed;
                            if (c.life < c.maxLife) renderConfetti(ctx, c);
                            break;
                        }
                        case "laser": {
                            const l = p as LaserBeam;
                            if (l.life < l.maxLife) renderLaser(ctx, l);
                            break;
                        }
                        case "firecracker": {
                            const s = p as Spark;
                            if (s.phase === "rocket") {
                                s.x += s.vx;
                                s.y += s.vy;
                                // After 12 frames, burst
                                if (s.life > 12) {
                                    s.phase = "burst";
                                    s.life = 0;
                                    // Spawn 24 radial sparks
                                    const cx = s.x, cy = s.y;
                                    for (let i = 0; i < 24; i++) {
                                        const angle = (i / 24) * Math.PI * 2;
                                        const speed = randRange(2, 5);
                                        (eff.particles as Spark[]).push({
                                            x: cx, y: cy,
                                            vx: Math.cos(angle) * speed,
                                            vy: Math.sin(angle) * speed,
                                            color: pick(COLORS.sparks),
                                            size: randRange(2, 4),
                                            life: 0, maxLife: 50,
                                            phase: "burst",
                                        });
                                    }
                                }
                            }
                            if (s.phase === "burst") {
                                s.x += s.vx;
                                s.y += s.vy;
                                s.vy += 0.08; // gravity
                                s.vx *= 0.97; // deceleration
                            }
                            if (s.life < s.maxLife) renderSpark(ctx, s);
                            break;
                        }
                        case "rain": {
                            const r = p as RainDrop;
                            if (r.life >= r.startDelay) {
                                r.wobblePhase += 0.03;
                                r.x += Math.sin(r.wobblePhase) * r.wobbleAmp * 0.1;
                                r.y += r.vy;
                            }
                            if (r.life < r.maxLife) renderRainDrop(ctx, r);
                            break;
                        }
                    }
                }

                // Clean up dead particles
                eff.particles = eff.particles.filter((p: any) => p.life < p.maxLife);
            }

            rafRef.current = requestAnimationFrame(frame);
        }

        rafRef.current = requestAnimationFrame(frame);

        return () => {
            window.removeEventListener("resize", resize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 200,
            }}
        />
    );
}
