"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";

// ============================================================
// TileReactionCanvas — Per-tile canvas overlay
// Renders tile-clipped animations for a single participant.
// Mounted inside each VideoCard; naturally clips to tile bounds.
// v5.0 — AR Depth-Illusion Reactions
// ============================================================

export type ReactionType =
    | "hearts"
    | "balloons"
    | "confetti"
    | "fireworks"
    | "laser"
    | "thumbs_up"
    | "thumbs_down";

export interface TileReactionCanvasHandle {
    playReaction: (reaction: ReactionType, originX?: number, originY?: number) => void;
}

// ---- Utility Helpers ----

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// drawBloom — draw a soft radial gradient behind a particle
function drawBloom(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    radius: number, color: string, alpha: number
) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, hexToRgba(color, alpha));
    grad.addColorStop(0.4, hexToRgba(color, alpha * 0.5));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
}

// drawHeart — centered at x,y, uses bezier curves for smooth shape
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const s = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y - s * 0.5, x - s * 1.1, y - s * 0.5, x - s, y + s * 0.1);
    ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s * 1.1, x, y + s * 0.3);
    ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s * 0.7, x + s, y + s * 0.1);
    ctx.bezierCurveTo(x + s * 1.1, y - s * 0.5, x, y - s * 0.5, x, y + s * 0.3);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ---- Animation State ----

interface AnimationState {
    particles: any[];
    frame: number;
    maxFrames: number;
    type: ReactionType;
}

// ============================================================
// 1. HEARTS — Depth-illusion hearts from hand position
// ============================================================

function spawnHearts(ox: number, oy: number, w: number, h: number): AnimationState {
    const cx = ox * w;
    const cy = oy * h;
    const COUNT = 12;
    const particles = [];

    for (let i = 0; i < COUNT; i++) {
        const angle = -Math.PI * 0.8 + (Math.PI * 0.6 / (COUNT - 1)) * i + (Math.random() - 0.5) * 0.3;
        const speed = 1.2 + Math.random() * 1.8;
        const delay = Math.floor(i * 4 + Math.random() * 8);

        particles.push({
            x: cx + (Math.random() - 0.5) * 40,
            y: cy + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.5,
            baseScale: 0.15,
            maxScale: 1.2,
            size: 24 + Math.random() * 16,
            color: pick(["#E11D48", "#FB7185", "#FECDD3", "#F43F5E", "#FF85A2"]),
            age: 0,
            maxAge: 80 + Math.floor(Math.random() * 30),
            spawnDelay: delay,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.06 + Math.random() * 0.04,
        });
    }

    return { type: "hearts", particles, frame: 0, maxFrames: 130 };
}

function renderHearts(ctx: CanvasRenderingContext2D, anim: AnimationState) {
    for (const p of anim.particles) {
        if (anim.frame < p.spawnDelay) continue;
        p.age++;

        const progress = p.age / p.maxAge;
        if (progress >= 1) continue;

        // Fade: appear in first 15%, stay, fade out last 25%
        const alpha = progress < 0.15
            ? progress / 0.15
            : progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

        // Depth scale — grows as it rises (comes toward camera)
        const depthScale = p.baseScale + (p.maxScale - p.baseScale) * easeOut(Math.min(progress * 1.5, 1));

        // Movement
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.4;
        p.y += p.vy;
        p.vy -= 0.02;

        // Blur when far (small scale), sharp when close (large scale)
        const blurPx = Math.max(0, (1 - depthScale / p.maxScale) * 5);
        if (blurPx > 0.5) ctx.filter = `blur(${blurPx.toFixed(1)}px)`;

        // Bloom glow behind heart
        drawBloom(ctx, p.x, p.y, p.size * depthScale * 2.5, p.color, alpha * 0.35);

        ctx.filter = "none";

        // Heart shape
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.scale(depthScale, depthScale);
        drawHeart(ctx, 0, 0, p.size, p.color);
        ctx.restore();
    }
}

// ============================================================
// 2. BALLOONS — Rise from bottom, pop at top
// ============================================================

function spawnBalloons(w: number, h: number): AnimationState {
    const COUNT = 8;
    const particles = [];

    for (let i = 0; i < COUNT; i++) {
        const hue = pick(["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFEAA7", "#FF85A2", "#A8E6CF", "#DDA0DD", "#87CEEB"]);
        particles.push({
            x: w * (0.1 + Math.random() * 0.8),
            y: h + 60,
            vy: -(1.2 + Math.random() * 0.8),
            vx: (Math.random() - 0.5) * 0.4,
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.03 + Math.random() * 0.02,
            baseSize: 28 + Math.random() * 12,
            baseScale: 0.3,
            maxScale: 1.4,
            color: hue,
            popped: false,
            popAge: 0,
            popParticles: [] as any[],
            age: 0,
            maxAge: 280,
            spawnDelay: Math.floor(i * 18 + Math.random() * 20),
        });
    }

    return { type: "balloons", particles, frame: 0, maxFrames: 340 };
}

function renderBalloons(ctx: CanvasRenderingContext2D, anim: AnimationState, w: number, h: number) {
    for (const b of anim.particles as any[]) {
        if (anim.frame < b.spawnDelay) continue;
        b.age++;

        if (b.popped) {
            b.popAge++;
            for (const pp of b.popParticles) {
                pp.x += pp.vx;
                pp.y += pp.vy;
                pp.vy += 0.15;
                const popAlpha = Math.max(0, 1 - b.popAge / 18);
                ctx.save();
                ctx.globalAlpha = popAlpha;
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();
                ctx.restore();
            }
            continue;
        }

        // Movement with wobble
        b.wobblePhase += b.wobbleSpeed;
        b.x += Math.sin(b.wobblePhase) * 1.2 + b.vx;
        b.y += b.vy;

        // Pop at top 15% of tile
        if (b.y < h * 0.15) {
            b.popped = true;
            b.popAge = 0;
            for (let i = 0; i < 10; i++) {
                const angle = (Math.PI * 2 / 10) * i;
                b.popParticles.push({
                    x: b.x, y: b.y,
                    vx: Math.cos(angle) * (3 + Math.random() * 3),
                    vy: Math.sin(angle) * (3 + Math.random() * 3),
                });
            }
            continue;
        }

        // Depth scale — grows as balloon rises (travels toward camera)
        const riseProgress = Math.max(0, 1 - (b.y / (h + 60)));
        const depthScale = b.baseScale + (b.maxScale - b.baseScale) * easeOut(riseProgress);
        const size = b.baseSize * depthScale;

        // Fade out near top (before pop)
        const alpha = b.y < h * 0.3 ? Math.max(0.1, (b.y - h * 0.15) / (h * 0.15)) : 1;

        // Blur when far (bottom), sharp when close (top)
        const blurPx = Math.max(0, (1 - riseProgress) * 6);
        if (blurPx > 0.5) ctx.filter = `blur(${blurPx.toFixed(1)}px)`;

        // Strong bloom glow
        drawBloom(ctx, b.x, b.y, size * 2.8, b.color, alpha * 0.5);
        ctx.filter = "none";

        ctx.save();
        ctx.globalAlpha = alpha;

        // Balloon body
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, size * 0.55, size * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner highlight (translucent sheen)
        ctx.beginPath();
        ctx.ellipse(b.x - size * 0.18, b.y - size * 0.22, size * 0.15, size * 0.22, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.fill();

        // String
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + size * 0.7);
        ctx.quadraticCurveTo(b.x + size * 0.3, b.y + size * 1.1, b.x - size * 0.1, b.y + size * 1.4);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }
}

// ============================================================
// 3. CONFETTI — Two layers (fall + burst), 3 shapes, depth
// ============================================================

function spawnConfetti(w: number, h: number): AnimationState {
    const particles = [];
    const FALL_COUNT = 80;
    const BURST_COUNT = 40;

    // Layer 1: falling confetti (from top)
    for (let i = 0; i < FALL_COUNT; i++) {
        particles.push({
            layer: "fall",
            x: Math.random() * w,
            y: -20 - Math.random() * 60,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 2 + Math.random() * 3,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 8,
            shape: pick(["rect", "rect", "circle", "triangle"]),
            size: 5 + Math.random() * 10,
            depthScale: 0.4 + Math.random() * 0.8,
            color: pick(["#FF6B6B", "#4ECDC4", "#45B7D1", "#F7DC6F", "#BB8FCE", "#FF85A2", "#85C1E9", "#F8C471", "#82E0AA", "#F0E68C"]),
            age: 0,
            maxAge: 180 + Math.floor(Math.random() * 60),
            spawnDelay: Math.floor(Math.random() * 30),
        });
    }

    // Layer 2: burst confetti (from center outward)
    for (let i = 0; i < BURST_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        particles.push({
            layer: "burst",
            x: w * 0.5, y: h * 0.4,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 12,
            shape: pick(["rect", "circle", "triangle"]),
            size: 8 + Math.random() * 14,
            depthScale: 0.5 + Math.random() * 0.9,
            color: pick(["#FF6B6B", "#4ECDC4", "#FFD700", "#FF1493", "#00FF7F", "#87CEEB", "#DDA0DD", "#FFA500"]),
            age: 0,
            maxAge: 100 + Math.floor(Math.random() * 40),
            spawnDelay: Math.floor(Math.random() * 10),
        });
    }

    return { type: "confetti", particles, frame: 0, maxFrames: 260 };
}

function renderConfetti(ctx: CanvasRenderingContext2D, anim: AnimationState, h: number) {
    for (const p of anim.particles as any[]) {
        if (anim.frame < p.spawnDelay) continue;
        p.age++;
        const progress = p.age / p.maxAge;
        if (progress >= 1) continue;

        // Physics
        p.x += p.vx;
        p.y += p.vy;
        if (p.layer === "fall") {
            p.vy += 0.04;
            p.vx += (Math.random() - 0.5) * 0.1;
        } else {
            p.vy += 0.12;
            p.vx *= 0.97;
        }
        p.rotation += p.rotSpeed;

        // Fade
        const alpha = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

        // Blur based on depth scale
        const blurPx = Math.max(0, (1 - p.depthScale) * 4);
        if (blurPx > 0.5) ctx.filter = `blur(${blurPx.toFixed(1)}px)`;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.scale(p.depthScale, p.depthScale);
        ctx.fillStyle = p.color;

        const s = p.size;
        if (p.shape === "rect") {
            ctx.fillRect(-s / 2, -s / 4, s, s / 2);
        } else if (p.shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
            ctx.fill();
        } else { // triangle
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, s / 2);
            ctx.lineTo(-s / 2, s / 2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
        ctx.filter = "none";
    }
}

// ============================================================
// 4. FIREWORKS — Rockets with trails, radial burst, screen glow
// ============================================================

function spawnFireworks(ox: number, oy: number, w: number, h: number): AnimationState {
    const particles: any[] = [];
    const ROCKET_COUNT = 3;

    for (let r = 0; r < ROCKET_COUNT; r++) {
        const targetX = w * (0.3 + r * 0.2 + (Math.random() - 0.5) * 0.1);
        const targetY = h * (0.15 + Math.random() * 0.2);
        const launchX = w * (0.3 + r * 0.2);

        particles.push({
            type: "rocket",
            x: launchX,
            y: h,
            targetX, targetY,
            vx: (targetX - launchX) / 20,
            vy: (targetY - h) / 20,
            color: pick(["#FFD700", "#FF4500", "#FF69B4", "#00FF7F", "#87CEEB", "#DDA0DD"]),
            trail: [] as { x: number; y: number; opacity: number }[],
            age: 0,
            burstDelay: 18 + r * 8,
            burst: false,
        });
    }

    return { type: "fireworks", particles, frame: 0, maxFrames: 200 };
}

function renderFireworks(ctx: CanvasRenderingContext2D, anim: AnimationState, w: number, h: number) {
    for (let i = anim.particles.length - 1; i >= 0; i--) {
        const p = anim.particles[i] as any;
        p.age++;

        if (p.type === "rocket") {
            if (anim.frame < p.burstDelay) continue;

            p.x += p.vx;
            p.y += p.vy;

            // Trail
            p.trail.push({ x: p.x, y: p.y, opacity: 0.8 });
            if (p.trail.length > 8) p.trail.shift();
            for (let t = 0; t < p.trail.length; t++) {
                const tr = p.trail[t];
                tr.opacity *= 0.75;
                ctx.save();
                ctx.globalAlpha = tr.opacity;
                ctx.beginPath();
                ctx.arc(tr.x, tr.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
                ctx.restore();
            }

            // Rocket body with glow
            drawBloom(ctx, p.x, p.y, 20, p.color, 0.4);
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            // Burst when close to target
            const dist = Math.hypot(p.x - p.targetX, p.y - p.targetY);
            if (dist < 15 && !p.burst) {
                p.burst = true;
                for (let j = 0; j < 60; j++) {
                    const angle = (j / 60) * Math.PI * 2;
                    const speed = 3 + Math.random() * 7;
                    anim.particles.push({
                        type: "spark",
                        x: p.targetX, y: p.targetY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        color: p.color,
                        size: 2 + Math.random() * 2,
                        age: 0, maxAge: 50 + Math.floor(Math.random() * 30),
                        trail: [] as { x: number; y: number }[],
                    });
                }
            }

        } else if (p.type === "spark") {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;  // gravity
            p.vx *= 0.96;  // deceleration

            const alpha = Math.max(0, 1 - p.age / p.maxAge);
            if (alpha <= 0) { anim.particles.splice(i, 1); continue; }

            // Screen blend for additive glow
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            ctx.globalAlpha = alpha * 0.8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            ctx.restore();
        }
    }
}

// ============================================================
// 5. LASER — Neon green beam with bloom, breathing pulse
// ============================================================

function spawnLaser(ox: number, oy: number, w: number, h: number): AnimationState {
    const beamY = oy * h;

    return {
        type: "laser",
        frame: 0,
        maxFrames: 150,  // ~2.5s at 60fps
        particles: [{
            beamY,
            w,
            pulsePhase: 0,
        }],
    };
}

function renderLaser(ctx: CanvasRenderingContext2D, anim: AnimationState, w: number, h: number) {
    const data = anim.particles[0] as any;
    data.pulsePhase += 0.12;

    const progress = anim.frame / anim.maxFrames;

    // Fade in (first 8%) and fade out (last 20%)
    const alpha = progress < 0.08
        ? progress / 0.08
        : progress > 0.80 ? 1 - (progress - 0.80) / 0.20 : 1;

    // Pulse intensity: breathing effect
    const pulse = 0.7 + Math.sin(data.pulsePhase) * 0.3;
    const beamAlpha = alpha * pulse;

    const y = data.beamY;

    // ── Core beam ──────────────────────────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Outer diffuse glow — wide, low alpha
    const outerGrad = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    outerGrad.addColorStop(0, `rgba(0,255,100,0)`);
    outerGrad.addColorStop(0.5, `rgba(0,255,100,${(beamAlpha * 0.25).toFixed(3)})`);
    outerGrad.addColorStop(1, `rgba(0,255,100,0)`);
    ctx.fillStyle = outerGrad;
    ctx.fillRect(0, y - 30, w, 60);

    // Mid glow — medium
    const midGrad = ctx.createLinearGradient(0, y - 10, 0, y + 10);
    midGrad.addColorStop(0, `rgba(100,255,150,0)`);
    midGrad.addColorStop(0.5, `rgba(100,255,150,${(beamAlpha * 0.6).toFixed(3)})`);
    midGrad.addColorStop(1, `rgba(100,255,150,0)`);
    ctx.fillStyle = midGrad;
    ctx.fillRect(0, y - 10, w, 20);

    // Core beam — sharp bright center
    const coreGrad = ctx.createLinearGradient(0, y - 2, 0, y + 2);
    coreGrad.addColorStop(0, `rgba(200,255,220,0)`);
    coreGrad.addColorStop(0.5, `rgba(200,255,220,${(beamAlpha * 0.95).toFixed(3)})`);
    coreGrad.addColorStop(1, `rgba(200,255,220,0)`);
    ctx.fillStyle = coreGrad;
    ctx.fillRect(0, y - 2, w, 4);

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    // ── Bloom at center ──────────────────────────────────────
    drawBloom(ctx, w * 0.5, y, 80, "#00FF64", beamAlpha * 0.3);
}

// ============================================================
// 6. THUMBS BUBBLE — Glass sphere with spring animation
// ============================================================

function spawnThumbsBubble(
    ox: number, oy: number,
    w: number, h: number,
    type: "thumbs_up" | "thumbs_down"
): AnimationState {
    const cx = ox * w;
    const cy = oy * h;

    return {
        type,
        frame: 0,
        maxFrames: 120,
        particles: [{
            x: cx,
            y: cy,
            targetY: cy - 40,
            radius: 52,
            emoji: type === "thumbs_up" ? "👍" : "👎",
            springVel: 0,
            scale: 0,
            age: 0,
            orbs: [
                { angle: Math.PI * 0.8, dist: 62, radius: 14, phase: 0 },
                { angle: Math.PI * 1.3, dist: 72, radius: 10, phase: 1.2 },
            ],
        }],
    };
}

function renderThumbsBubble(ctx: CanvasRenderingContext2D, anim: AnimationState) {
    const b = anim.particles[0] as any;
    b.age++;

    const progress = anim.frame / anim.maxFrames;

    // Spring scale animation: overshoot and settle to 1
    const springTarget = progress > 0.85 ? 0 : 1;
    b.springVel += (springTarget - b.scale) * 0.18;
    b.springVel *= 0.72;
    b.scale += b.springVel;
    b.scale = Math.max(0, b.scale);

    // Float upward gently
    b.y += (b.targetY - b.y) * 0.02;

    // Animate orbs
    for (const orb of b.orbs) {
        orb.angle += 0.015;
        orb.phase += 0.02;
        orb.dist = orb.dist + Math.sin(orb.phase) * 0.5;
    }

    const alpha = progress > 0.80 ? 1 - (progress - 0.80) / 0.20 : 1;
    const r = b.radius * b.scale;
    if (r <= 1) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // ── Glass bubble body ──────────────────────────────────────
    // Base: semi-transparent white fill
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();

    // Glass gradient: light from top-left
    const glassGrad = ctx.createRadialGradient(
        b.x - r * 0.35, b.y - r * 0.35, r * 0.05,
        b.x, b.y, r
    );
    glassGrad.addColorStop(0, "rgba(255,255,255,0.45)");
    glassGrad.addColorStop(0.35, "rgba(255,255,255,0.12)");
    glassGrad.addColorStop(0.7, "rgba(200,220,255,0.06)");
    glassGrad.addColorStop(1, "rgba(180,200,255,0.18)");
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Specular highlight — top-left bright spot
    ctx.beginPath();
    ctx.ellipse(b.x - r * 0.32, b.y - r * 0.32, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();

    // Border — subtle glass rim
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Emoji inside bubble
    ctx.font = `${Math.floor(r * 0.85)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.emoji, b.x, b.y + r * 0.05);

    // ── Orbiting small bubbles ──────────────────────────────────
    for (const orb of b.orbs) {
        const ox = b.x + Math.cos(orb.angle) * orb.dist * b.scale;
        const oy = b.y + Math.sin(orb.angle) * orb.dist * b.scale;
        const or = orb.radius * b.scale;

        ctx.beginPath();
        ctx.arc(ox, oy, or, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fill();

        // Small orb highlight
        ctx.beginPath();
        ctx.ellipse(ox - or * 0.3, oy - or * 0.3, or * 0.3, or * 0.2, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ox, oy, or, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
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
                    case "balloons": renderBalloons(ctx, anim, w, h); break;
                    case "confetti": renderConfetti(ctx, anim, h); break;
                    case "fireworks": renderFireworks(ctx, anim, w, h); break;
                    case "laser": renderLaser(ctx, anim, w, h); break;
                    case "thumbs_up": renderThumbsBubble(ctx, anim); break;
                    case "thumbs_down": renderThumbsBubble(ctx, anim); break;
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
            const ox = originX !== undefined ? originX : 0.5;
            const oy = originY !== undefined ? originY : 0.5;

            let anim: AnimationState;
            switch (reaction) {
                case "hearts": anim = spawnHearts(ox, oy, w, h); break;
                case "balloons": anim = spawnBalloons(w, h); break;
                case "confetti": anim = spawnConfetti(w, h); break;
                case "fireworks": anim = spawnFireworks(ox, oy, w, h); break;
                case "laser": anim = spawnLaser(ox, oy, w, h); break;
                case "thumbs_up": anim = spawnThumbsBubble(ox, oy, w, h, "thumbs_up"); break;
                case "thumbs_down": anim = spawnThumbsBubble(ox, oy, w, h, "thumbs_down"); break;
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
