"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";

// ============================================================
// TileReactionCanvas — Per-tile canvas overlay
// Renders tile-clipped animations for a single participant.
// Mounted inside each VideoCard; naturally clips to tile bounds.
// ============================================================

export type ReactionType = "hearts" | "balloons" | "confetti" | "firecracker";

export interface TileReactionCanvasHandle {
    playReaction: (reaction: ReactionType, originX?: number, originY?: number) => void;
}

// ---- Color Palettes ----
const HEART_COLORS = ["#E11D48", "#FB7185", "#FECDD3", "#F43F5E"];
const BALLOON_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#FF85A2", "#A8E6CF"];
const CONFETTI_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"];
const SPARK_COLORS = ["#FFD700", "#FF4500", "#FF6347", "#FFA500"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number) { return min + Math.random() * (max - min); }

// ---- Heart drawing helper ----
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, opacity: number, scale: number) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.3);
    ctx.bezierCurveTo(size * 0.5, -size * 0.8, size, -size * 0.3, 0, size * 0.5);
    ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.5, -size * 0.8, 0, -size * 0.3);
    ctx.fill();
    ctx.restore();
}

// ---- Animation Spawners ----

interface AnimationState {
    particles: any[];
    frame: number;
    maxFrames: number;
    type: ReactionType;
}

function spawnHearts(ox: number, oy: number): AnimationState {
    const HEART_COUNT = 10;
    const particles = [];
    for (let i = 0; i < HEART_COUNT; i++) {
        const angle = (Math.PI * 2 / HEART_COUNT) * i + (Math.random() - 0.5) * 0.4;
        particles.push({
            x: ox, y: oy, angle,
            speed: 2.5 + Math.random() * 2,
            scale: 0, opacity: 1,
            colour: pick(HEART_COLORS),
            size: 22 + Math.random() * 14,
            age: 0,
        });
    }
    const GROW = 12, RADIATE = 20, VANISH = 22;
    return { particles, frame: 0, maxFrames: GROW + RADIATE + VANISH, type: "hearts" };
}

function spawnBalloons(ox: number, oy: number): AnimationState {
    const count = Math.floor(rand(3, 6));
    const particles = [];
    for (let i = 0; i < count; i++) {
        particles.push({
            x: ox + rand(-30, 30), y: oy,
            vx: rand(-0.3, 0.3), vy: rand(-2, -1.5),
            size: rand(30, 40), color: pick(BALLOON_COLORS),
            wobblePhase: Math.random() * Math.PI * 2,
            popped: false, popFrame: 0,
            popParticles: [] as any[],
            age: 0,
        });
    }
    return { particles, frame: 0, maxFrames: 240, type: "balloons" }; // ~4s
}

function spawnConfetti(w: number): AnimationState {
    const count = Math.floor(rand(80, 120));
    const particles = [];
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * w, y: rand(-20, 0),
            vy: rand(2, 4), vx: rand(-1, 1),
            size: Math.random() > 0.5 ? { w: 6, h: 10 } : { r: 5 },
            color: pick(CONFETTI_COLORS),
            rotation: Math.random() * 360, rotSpeed: rand(2, 5),
            spawnDelay: Math.floor(rand(0, 40)),
            age: 0, maxAge: 200,
        });
    }
    return { particles, frame: 0, maxFrames: 240, type: "confetti" };
}

function spawnFirecracker(ox: number, oy: number): AnimationState {
    // 2 rockets for richer effect
    const particles = [];
    for (let r = 0; r < 2; r++) {
        particles.push({
            x: ox + (r === 0 ? -20 : 20), y: oy,
            vx: 0, vy: -18,
            phase: "rocket" as "rocket" | "burst" | "done",
            age: 0, color: "#FFD700", size: 8,
            trail: [] as { x: number; y: number; opacity: number }[],
        });
    }
    return { particles, frame: 0, maxFrames: 150, type: "firecracker" };
}

// ---- Renderers ----

function renderHearts(ctx: CanvasRenderingContext2D, anim: AnimationState) {
    const GROW = 12, RADIATE = 20;
    for (const h of anim.particles) {
        h.age++;
        if (h.age <= GROW) {
            h.scale = h.age / GROW;
        } else if (h.age <= GROW + RADIATE) {
            const t = (h.age - GROW) / RADIATE;
            h.scale = 1 + t * 0.3;
            h.x += Math.cos(h.angle) * h.speed;
            h.y += Math.sin(h.angle) * h.speed;
        } else {
            const VANISH = 22;
            const t = (h.age - GROW - RADIATE) / VANISH;
            h.opacity = Math.max(0, 1 - t);
            h.x += Math.cos(h.angle) * h.speed * 0.5;
            h.y += Math.sin(h.angle) * h.speed * 0.5;
        }
        if (h.opacity > 0) drawHeart(ctx, h.x, h.y, h.size, h.colour, h.opacity, h.scale);
    }
}

function renderBalloons(ctx: CanvasRenderingContext2D, anim: AnimationState, canvasH: number) {
    for (const b of anim.particles) {
        b.age++;
        if (b.popped) {
            b.popFrame++;
            // Draw pop burst
            for (const pp of b.popParticles) {
                pp.x += pp.vx; pp.y += pp.vy;
                pp.opacity = Math.max(0, 1 - b.popFrame / 15);
                ctx.save();
                ctx.globalAlpha = pp.opacity;
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();
                ctx.restore();
            }
            continue;
        }

        b.wobblePhase += 0.05;
        b.x += Math.sin(b.wobblePhase) * 0.8 + b.vx;
        b.y += b.vy;

        // Pop at top 10%
        if (b.y < canvasH * 0.1) {
            b.popped = true;
            b.popFrame = 0;
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i;
                b.popParticles.push({ x: b.x, y: b.y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, opacity: 1 });
            }
            continue;
        }

        const alpha = b.age > 200 ? Math.max(0, 1 - (b.age - 200) / 40) : 1;
        ctx.save();
        ctx.globalAlpha = alpha;

        // Balloon body
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.size * 0.38, b.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();

        // Highlight
        ctx.beginPath();
        ctx.ellipse(b.x - b.size * 0.1, b.y - b.size * 0.15, b.size * 0.08, b.size * 0.12, -0.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fill();

        // String
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + b.size * 0.5);
        ctx.quadraticCurveTo(b.x + 4, b.y + b.size * 0.7, b.x - 3, b.y + b.size * 0.85);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}

function renderConfetti(ctx: CanvasRenderingContext2D, anim: AnimationState, canvasH: number) {
    anim.particles = anim.particles.filter(c => c.y < canvasH + 20);
    for (const c of anim.particles) {
        if (anim.frame < c.spawnDelay) continue;
        c.age++;
        c.x += c.vx; c.y += c.vy;
        c.vy += 0.05; // gravity
        c.rotation += c.rotSpeed;

        const fadeStart = c.maxAge - 30;
        const alpha = c.age > fadeStart ? Math.max(0, 1 - (c.age - fadeStart) / 30) : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rotation * Math.PI) / 180);
        ctx.fillStyle = c.color;
        if (c.size.w) {
            ctx.fillRect(-c.size.w / 2, -c.size.h / 2, c.size.w, c.size.h);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, c.size.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

function renderFirecracker(ctx: CanvasRenderingContext2D, anim: AnimationState) {
    for (let i = anim.particles.length - 1; i >= 0; i--) {
        const s = anim.particles[i];
        s.age++;

        if (s.phase === "rocket") {
            s.x += s.vx; s.y += s.vy;

            // Trail
            s.trail.push({ x: s.x, y: s.y, opacity: 0.8 });
            if (s.trail.length > 6) s.trail.shift();
            for (const t of s.trail) {
                t.opacity *= 0.7;
                ctx.save();
                ctx.globalAlpha = t.opacity;
                ctx.beginPath();
                ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = "#FFD700";
                ctx.fill();
                ctx.restore();
            }

            // Draw rocket
            ctx.save();
            ctx.fillStyle = s.color;
            ctx.shadowColor = "#FFD700";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, 4, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Burst after 12 frames
            if (s.age > 12) {
                s.phase = "done";
                const cx = s.x, cy = s.y;
                for (let j = 0; j < 24; j++) {
                    const angle = (j / 24) * Math.PI * 2;
                    const speed = rand(6, 10);
                    anim.particles.push({
                        x: cx, y: cy,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        phase: "burst", age: 0,
                        color: pick(SPARK_COLORS), size: rand(2, 4),
                        trail: [],
                    });
                }
            }
        } else if (s.phase === "burst") {
            s.x += s.vx; s.y += s.vy;
            s.vy += 0.4; // gravity
            s.vx *= 0.85; // decelerate

            const alpha = Math.max(0, 1 - s.age / 25);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 4;
            ctx.fill();
            ctx.restore();
        }
    }
    // Clean up dead sparks
    anim.particles = anim.particles.filter(s => s.phase !== "burst" || s.age < 30);
}

// ============================================================
// Component
// ============================================================

export const TileReactionCanvas = forwardRef<TileReactionCanvasHandle>(function TileReactionCanvas(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animsRef = useRef<AnimationState[]>([]);
    const rafRef = useRef<number | null>(null);
    const runningRef = useRef(false);

    // ResizeObserver to keep canvas pixel dimensions in sync with tile
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.parentElement) return;

        const resize = () => {
            if (!canvas.parentElement) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        };
        resize();

        const ro = new ResizeObserver(resize);
        ro.observe(canvas.parentElement);
        return () => ro.disconnect();
    }, []);

    // Animation loop — starts on demand, stops when no active animations
    const startLoop = useCallback(() => {
        if (runningRef.current) return;
        runningRef.current = true;

        function frame() {
            const canvas = canvasRef.current;
            if (!canvas) { runningRef.current = false; return; }
            const ctx = canvas.getContext("2d");
            if (!ctx) { runningRef.current = false; return; }

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // Render all active animations
            for (const anim of animsRef.current) {
                anim.frame++;
                switch (anim.type) {
                    case "hearts": renderHearts(ctx, anim); break;
                    case "balloons": renderBalloons(ctx, anim, h); break;
                    case "confetti": renderConfetti(ctx, anim, h); break;
                    case "firecracker": renderFirecracker(ctx, anim); break;
                }
            }

            // Remove finished animations
            animsRef.current = animsRef.current.filter(a => a.frame < a.maxFrames);

            if (animsRef.current.length > 0) {
                rafRef.current = requestAnimationFrame(frame);
            } else {
                runningRef.current = false;
                // Clear canvas when done
                ctx.clearRect(0, 0, w, h);
            }
        }

        rafRef.current = requestAnimationFrame(frame);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // Expose playReaction via ref
    useImperativeHandle(ref, () => ({
        playReaction(reaction: ReactionType, originX?: number, originY?: number) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const w = canvas.width;
            const h = canvas.height;
            // Default origin = center of tile
            const ox = originX !== undefined ? originX * w : w / 2;
            const oy = originY !== undefined ? originY * h : h / 2;

            let anim: AnimationState;
            switch (reaction) {
                case "hearts": anim = spawnHearts(ox, oy); break;
                case "balloons": anim = spawnBalloons(ox, oy); break;
                case "confetti": anim = spawnConfetti(w); break;
                case "firecracker": anim = spawnFirecracker(ox, oy); break;
                default: return;
            }
            animsRef.current.push(anim);
            startLoop();
        },
    }), [startLoop]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100%", height: "100%",
                pointerEvents: "none",
                zIndex: 10,
                borderRadius: "inherit",
            }}
        />
    );
});
