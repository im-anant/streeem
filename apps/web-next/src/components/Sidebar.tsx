"use client";

import { clsx } from "clsx";
import { Users, X } from "lucide-react";
import { Participant } from "@/types";

interface SidebarProps {
  open: boolean;
  participants: Participant[];
  onClose: () => void;
}

export function Sidebar({ open, participants, onClose }: SidebarProps) {
  return (
    <aside
      className={clsx(
        "fixed inset-y-0 right-0 z-[100] w-[340px] border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-xl transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-sm text-white">Participants</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Participants List */}
      <div className="h-[calc(100vh-56px)] overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <Users className="w-3 h-3" />
          <span>In this room ({participants.length})</span>
        </div>
        {participants.map(p => (
          <div key={p.id} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold ring-1 ring-inset ring-indigo-500/20">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm text-zinc-200 font-medium">
                  {p.name} {p.isLocal && <span className="text-zinc-500 font-normal">(You)</span>}
                </div>
                <div className="text-xs text-zinc-500">
                  {p.isSpeaking ? "Speaking..." : "Listener"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
