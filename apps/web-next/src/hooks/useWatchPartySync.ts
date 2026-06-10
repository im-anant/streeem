"use client";

import { useCallback, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────
export type SyncState = "synced" | "drifting" | "seeking";

export interface UseWatchPartySyncOptions {
  isHost: boolean;
  isActive: boolean;
  sendPlaybackState: (state: {
    playing: boolean;
    positionSec: number;
    hostTsMs: number;
  }) => void;
  remotePlaybackState: {
    playing: boolean;
    positionSec: number;
    hostTsMs: number;
  } | null;
}

export interface UseWatchPartySyncReturn {
  syncState: SyncState;
  handlePlayerEvent: (event: {
    type: string;
    positionSec: number;
    playing: boolean;
  }) => void;
}

// ─── Constants ───────────────────────────────────────────────
const THROTTLE_MS = 1000; // Max 1 progress update per second
const DRIFT_THRESHOLD_SEEK = 0.25; // >250ms → hard seek needed
const DRIFT_THRESHOLD_SYNCED = 0.05; // <50ms → perfectly synced
const DRIFTING_TIMEOUT_MS = 1500; // How long to show "drifting" state

// ─── Hook ────────────────────────────────────────────────────
export function useWatchPartySync({
  isHost,
  isActive,
  sendPlaybackState,
  remotePlaybackState,
}: UseWatchPartySyncOptions): UseWatchPartySyncReturn {
  const [syncState, setSyncState] = useState<SyncState>("synced");

  // Refs for throttling
  const lastProgressSendRef = useRef<number>(0);
  const driftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localPositionRef = useRef<number>(0);

  // ─── Host: broadcast state on player events ────────────────
  const handleHostEvent = useCallback(
    (event: { type: string; positionSec: number; playing: boolean }) => {
      if (!isActive) return;

      const now = Date.now();
      localPositionRef.current = event.positionSec;

      // Immediate events: play, pause, seek
      if (event.type === "play" || event.type === "pause" || event.type === "seek") {
        sendPlaybackState({
          playing: event.playing,
          positionSec: event.positionSec,
          hostTsMs: now,
        });
        lastProgressSendRef.current = now;
        return;
      }

      // Progress events: throttle to 1/sec
      if (event.type === "progress") {
        if (now - lastProgressSendRef.current >= THROTTLE_MS) {
          sendPlaybackState({
            playing: event.playing,
            positionSec: event.positionSec,
            hostTsMs: now,
          });
          lastProgressSendRef.current = now;
        }
      }
    },
    [isActive, sendPlaybackState]
  );

  // ─── Member: compute drift and set sync state ─────────────
  const handleMemberEvent = useCallback(
    (event: { type: string; positionSec: number; playing: boolean }) => {
      if (!isActive || !remotePlaybackState) return;

      // Update local tracking
      localPositionRef.current = event.positionSec;

      // Calculate where host should be NOW
      const elapsed = (Date.now() - remotePlaybackState.hostTsMs) / 1000;
      const hostPositionNow = remotePlaybackState.playing
        ? remotePlaybackState.positionSec + elapsed
        : remotePlaybackState.positionSec;

      const drift = Math.abs(localPositionRef.current - hostPositionNow);

      if (drift > DRIFT_THRESHOLD_SEEK) {
        // Large drift → needs hard seek
        setSyncState("seeking");

        // Clear any pending drifting timer
        if (driftTimerRef.current) {
          clearTimeout(driftTimerRef.current);
          driftTimerRef.current = null;
        }
      } else if (drift > DRIFT_THRESHOLD_SYNCED) {
        // Minor drift → show drifting briefly
        setSyncState("drifting");

        // Auto-resolve to synced after timeout
        if (driftTimerRef.current) clearTimeout(driftTimerRef.current);
        driftTimerRef.current = setTimeout(() => {
          setSyncState("synced");
          driftTimerRef.current = null;
        }, DRIFTING_TIMEOUT_MS);
      } else {
        // Perfectly synced
        setSyncState("synced");
        if (driftTimerRef.current) {
          clearTimeout(driftTimerRef.current);
          driftTimerRef.current = null;
        }
      }
    },
    [isActive, remotePlaybackState]
  );

  // ─── Route to correct handler ──────────────────────────────
  const handlePlayerEvent = useCallback(
    (event: { type: string; positionSec: number; playing: boolean }) => {
      if (!isActive) return;
      if (isHost) {
        handleHostEvent(event);
      } else {
        handleMemberEvent(event);
      }
    },
    [isActive, isHost, handleHostEvent, handleMemberEvent]
  );

  return {
    syncState: isHost ? "synced" : syncState, // Host is always "synced"
    handlePlayerEvent,
  };
}
