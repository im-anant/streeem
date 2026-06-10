"use client";

import { clsx } from "clsx";

export interface SyncIndicatorProps {
  state: "synced" | "drifting" | "seeking";
}

const config = {
  synced: {
    label: "In Sync",
    dotClass: "bg-emerald-400 shadow-emerald-400/50",
    textClass: "text-emerald-400",
    pulseClass: "",
  },
  drifting: {
    label: "Syncing…",
    dotClass: "bg-amber-400 shadow-amber-400/50",
    textClass: "text-amber-400",
    pulseClass: "animate-pulse",
  },
  seeking: {
    label: "Re-syncing…",
    dotClass: "bg-red-400 shadow-red-400/50",
    textClass: "text-red-400",
    pulseClass: "animate-[pulse_0.6s_ease-in-out_infinite]",
  },
} as const;

export function SyncIndicator({ state }: SyncIndicatorProps) {
  const { label, dotClass, textClass, pulseClass } = config[state];

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "bg-white/5 backdrop-blur-md border border-white/10",
        "select-none transition-colors duration-300"
      )}
    >
      {/* Animated dot */}
      <span className="relative flex h-2 w-2">
        {pulseClass && (
          <span
            className={clsx(
              "absolute inline-flex h-full w-full rounded-full opacity-60",
              dotClass,
              pulseClass
            )}
          />
        )}
        <span
          className={clsx(
            "relative inline-flex h-2 w-2 rounded-full shadow-lg",
            dotClass
          )}
        />
      </span>

      {/* Label */}
      <span className={clsx("text-[11px] font-medium leading-none", textClass)}>
        {label}
      </span>
    </div>
  );
}
