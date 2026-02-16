"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Users, X, Send } from "lucide-react";
import { Participant } from "@/types";
import { useRoom } from "@/contexts/RoomContext";

interface SidebarProps {
  open: boolean;
  participants: Participant[];
  onClose: () => void;
}

export function Sidebar({ open, participants, onClose }: SidebarProps) {
  const [tab, setTab] = useState<"chat" | "participants">("participants");
  const { messages, sendMessage } = useRoom();
  const [inputText, setInputText] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText("");
  };

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 right-0 z-40 w-[340px] border-l border-zinc-800 bg-zinc-950/90 backdrop-blur-xl transition-transform duration-300 ease-in-out sm:relative",
        open ? "translate-x-0" : "translate-x-full",
        // Mobile handling: on small screens it slides over content, on large it can be relative if needed, 
        // but typically "classic" layout is flex row. We'll handle layout in page.tsx
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex rounded-lg bg-zinc-900 p-1">
          <button
            onClick={() => setTab("participants")}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              tab === "participants" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            People
          </button>
          <button
            onClick={() => setTab("chat")}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              tab === "chat" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Chat
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="h-[calc(100vh-64px)] overflow-y-auto">
        {tab === "participants" ? (
          <div className="p-4 space-y-3">
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
                {/* Status icons could go here */}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.length === 0 && (
                <div className="flex bg-zinc-900/50 rounded-lg p-4 justify-center items-center h-20 text-zinc-500 text-sm italic">
                  No messages yet.
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={clsx(
                  "flex flex-col",
                  msg.isSystem ? "items-center" : "items-start"
                )}>
                  {msg.isSystem ? (
                    <span className="text-xs text-zinc-500 my-2 bg-zinc-900 px-2 py-1 rounded-full">{msg.text}</span>
                  ) : (
                    <div className="bg-zinc-800/80 rounded-xl rounded-tl-none p-3 max-w-[85%]">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-bold text-indigo-400">{msg.sender}</span>
                        <span className="text-[10px] text-zinc-500">{msg.timestamp}</span>
                      </div>
                      <p className="text-sm text-zinc-200 leading-snug">{msg.text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/5 bg-zinc-950">
              <form onSubmit={handleSend} className="relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Send a message..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="absolute right-2 top-2 p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:bg-zinc-800"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
