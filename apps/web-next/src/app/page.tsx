"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Video, Zap, Users, MonitorPlay } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    const cleanName = roomName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    router.push(`/room/${cleanName}`);
  };

  return (
    <main className="min-h-dvh bg-zinc-950 overflow-hidden relative selection:bg-indigo-500/30">

      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] -z-10 mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] -z-10 mix-blend-screen" />

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">StreamSync</span>
        </div>
        <div className="flex gap-4">
          <Link href="https://github.com" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">GitHub</Link>
          <Link href="/login" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-20 pb-32 px-6 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          Sub-second Latency Engine Live
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-[1.1]">
          Real-time streaming <br />
          reimagined for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">interaction.</span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Experience the future of group calls with synchronized watch parties,
          WebRTC-powered video, and zero-download functionality.
        </p>

        {/* Room Creation Box */}
        <div className="max-w-md mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <form onSubmit={handleCreate} className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/50 shadow-2xl">
            <span className="pl-4 text-zinc-500 font-medium select-none">streeem.com/</span>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="your-room-name"
              className="flex-1 bg-transparent border-none text-white placeholder:text-zinc-600 focus:outline-none px-1 py-2"
              autoFocus
            />
            <button
              type="submit"
              disabled={!roomName}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-32 text-left">
          <FeatureCard
            icon={Zap}
            title="Instant Latency"
            desc="Powered by WebRTC for true real-time communication under 200ms."
          />
          <FeatureCard
            icon={MonitorPlay}
            title="Watch Parties"
            desc="Paste any YouTube or video link to watch in perfect sync with friends."
          />
          <FeatureCard
            icon={Users}
            title="No Limits"
            desc="Scalable SFU architecture designed to support growing communities."
          />
        </div>
      </div>

    </main>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors backdrop-blur-sm">
      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4 text-white">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{desc}</p>
    </div>
  )
}
