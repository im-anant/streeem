"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, Film } from "lucide-react";
import { clsx } from "clsx";
import { SyncIndicator } from "./SyncIndicator";

// ─── Types ───────────────────────────────────────────────────
export interface WatchPartyPlayerProps {
  embedUrl: string;
  title: string;
  isHost: boolean;
  syncState: "synced" | "drifting" | "seeking";
  onPlayerEvent?: (event: {
    type: string;
    positionSec: number;
    playing: boolean;
  }) => void;
}

// ─── Constants ───────────────────────────────────────────────
const LOAD_TIMEOUT_MS = 8000;

// ─── Component ───────────────────────────────────────────────
export function WatchPartyPlayer({
  embedUrl,
  title,
  isHost,
  syncState,
  onPlayerEvent,
}: WatchPartyPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPlayerEventRef = useRef(onPlayerEvent);
  onPlayerEventRef.current = onPlayerEvent;

  // ─── Iframe load / error handling ──────────────────────────
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset state when URL changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    // Start timeout for load detection
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Only set error if still loading
      setIsLoading((prev) => {
        if (prev) setHasError(true);
        return false;
      });
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [embedUrl, retryKey]);

  // ─── PostMessage bridge (Vidking player events) ────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only process messages that look like player events
      if (!event.data || typeof event.data !== "object") return;

      const { type, positionSec, playing, contentId } = event.data;

      // Filter: only handle known event types
      if (
        type === "play" ||
        type === "pause" ||
        type === "seek" ||
        type === "progress" ||
        type === "timeupdate"
      ) {
        onPlayerEventRef.current?.({
          type,
          positionSec: typeof positionSec === "number" ? positionSec : 0,
          playing: typeof playing === "boolean" ? playing : type === "play",
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ─── Retry handler ────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  return (
    <div className="relative flex flex-col w-full h-full">
      {/* ── Title Banner ──────────────────────────────────────── */}
      <div
        className={clsx(
          "flex items-center justify-between gap-3 px-4 py-2.5",
          "bg-neutral-900/90 backdrop-blur-md",
          "border-b border-white/5",
          "rounded-t-xl"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Film className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-sm font-medium text-white/90 truncate">
            Watching: {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isHost && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full">
              Host
            </span>
          )}
          <SyncIndicator state={syncState} />
        </div>
      </div>

      {/* ── Player Area ───────────────────────────────────────── */}
      <div className="relative flex-1 bg-black rounded-b-xl overflow-hidden">
        {/* Error State */}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-10">
            <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base mb-1.5">
                  Failed to load player
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  The video player couldn&apos;t be loaded. Check your connection and
                  try again.
                </p>
              </div>
              <button
                onClick={handleRetry}
                className={clsx(
                  "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl",
                  "bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium",
                  "transition-all hover:scale-105 active:scale-95",
                  "shadow-lg shadow-indigo-500/25"
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {/* Loading Overlay */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/90 z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <span className="text-sm text-white/60 font-medium">
                Loading player…
              </span>
            </div>
          </div>
        )}

        {/* Iframe */}
        {!hasError && (
          <iframe
            key={retryKey}
            ref={iframeRef}
            src={embedUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; fullscreen"
            onLoad={handleLoad}
            onError={handleError}
            className="w-full h-full min-h-[300px]"
            title={`Watch Party: ${title}`}
          />
        )}
      </div>
    </div>
  );
}
