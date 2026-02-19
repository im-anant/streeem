"use client";

import { useEffect, useState } from "react";
import { IncomingReaction } from "@/contexts/RoomContext";

interface ReactionOverlayProps {
  reactions: IncomingReaction[];
}

// Map reaction labels to emoji
const EMOJI_MAP: Record<string, string> = {
  thumbsup: "👍",
  hearts: "❤️",
  confetti: "🎉",
  thumbsdown: "👎",
  sparkles: "✌️",
  fire: "🤘",
  wave: "👋",
  ok: "👌",
};

// Each animation particle
interface Particle {
  id: string;
  emoji: string;
  displayName: string;
  x: number; // horizontal position (%)
  direction: "up" | "down";
  delay: number; // stagger delay (ms)
}

export function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (reactions.length === 0) return;

    // Get the newest reaction(s) - only process ones we haven't made particles for
    const latestReaction = reactions[reactions.length - 1];

    const emoji = EMOJI_MAP[latestReaction.reaction] || "🎉";
    const isDown = latestReaction.reaction === "thumbsdown";

    // Create multiple particles for a burst effect
    const count = latestReaction.reaction === "confetti" ? 12 : 5;
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: `${latestReaction.id}-${i}`,
      emoji,
      displayName: latestReaction.displayName,
      x: 20 + Math.random() * 60, // 20-80% range
      direction: isDown ? "down" : "up",
      delay: i * 100, // stagger
    }));

    setParticles(prev => [...prev, ...newParticles]);

    // Remove these particles after animation completes
    const timeout = setTimeout(() => {
      setParticles(prev =>
        prev.filter(p => !newParticles.some(np => np.id === p.id))
      );
    }, 3500);

    return () => clearTimeout(timeout);
  }, [reactions.length]); // Only trigger on new reactions

  if (particles.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            bottom: p.direction === "up" ? "-60px" : undefined,
            top: p.direction === "down" ? "-60px" : undefined,
            animation: `${p.direction === "up" ? "reactionFloatUp" : "reactionFloatDown"} 3s ease-out ${p.delay}ms forwards`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: 0,
          }}
        >
          <span style={{ fontSize: 36, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
            {p.emoji}
          </span>
          {p.delay === 0 && (
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.7)",
                background: "rgba(0,0,0,0.4)",
                padding: "1px 6px",
                borderRadius: 6,
                marginTop: 2,
                whiteSpace: "nowrap",
                backdropFilter: "blur(4px)",
              }}
            >
              {p.displayName}
            </span>
          )}
        </div>
      ))}

      <style jsx>{`
        @keyframes reactionFloatUp {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.5) rotate(0deg);
          }
          10% {
            opacity: 1;
            transform: translateY(-40px) scale(1.1) rotate(-5deg);
          }
          50% {
            opacity: 1;
            transform: translateY(-40vh) scale(1) rotate(5deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-80vh) scale(0.6) rotate(-10deg);
          }
        }
        @keyframes reactionFloatDown {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.5);
          }
          10% {
            opacity: 1;
            transform: translateY(40px) scale(1.1);
          }
          50% {
            opacity: 1;
            transform: translateY(40vh) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(80vh) scale(0.6);
          }
        }
      `}</style>
    </div>
  );
}
