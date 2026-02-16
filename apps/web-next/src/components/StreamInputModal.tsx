"use client";

import { useState } from "react";
import { Play, Link as LinkIcon, X } from "lucide-react";
import { clsx } from "clsx";

interface StreamInputModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (url: string) => void;
}

export function StreamInputModal({ open, onClose, onSubmit }: StreamInputModalProps) {
    const [url, setUrl] = useState("");

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onSubmit(url);
            onClose();
            setUrl("");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                        <Play className="w-5 h-5 ml-0.5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Start Watch Party</h3>
                        <p className="text-sm text-zinc-400">Paste a link to stream directly to the room.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-3.5 w-5 h-5 text-zinc-500" />
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-black/20 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!url}
                            className={clsx(
                                "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all shadow-lg shadow-indigo-500/20",
                                url ? "bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02]" : "bg-zinc-800 cursor-not-allowed opacity-50"
                            )}
                        >
                            Start Stream
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
