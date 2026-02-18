"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Video, Zap, Users, MonitorPlay, Menu, User, X } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto relative z-50">
        <div className="flex items-center gap-2">
          {/* Replaced Icon with Logo Image */}
          <div className="relative w-20 h-20">
            <Image
              src="/logo.png"
              alt="Streeem Logo"
              fill
              className="object-contain mix-blend-screen"
              priority
            />
          </div>
          <span className="font-bold text-2xl tracking-tight text-white">Streeem</span>
        </div>

        {/* User Menu */}
        {/* User Menu */}
        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 -mr-2 text-zinc-400 hover:text-white transition-all duration-300 focus:outline-none"
          >
            <div className={`transform transition-transform duration-300 ${isMenuOpen ? "rotate-90" : "rotate-0"}`}>
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </div>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  AS
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate" title="Anant Srivastava (Owner)">
                    Anant Srivastava <span className="text-xs text-indigo-400 ml-1">(Owner 👑)</span>
                  </p>
                  <Link href="https://github.com/im-anant" target="_blank" className="text-xs text-zinc-400 hover:text-indigo-400 truncate block transition-colors">
                    github.com/im-anant
                  </Link>
                </div>
              </div>
              <div className="px-4 py-3 flex items-center gap-3 border-t border-zinc-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  SV
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate" title="Shikhar Verma (Employee of the month)">
                    Shikhar Verma <span className="text-xs text-emerald-400 ml-1 block sm:inline">(Employee of the month)</span>
                  </p>
                  <Link href="https://github.com/Shikhyy" target="_blank" className="text-xs text-zinc-400 hover:text-emerald-400 truncate block transition-colors">
                    github.com/Shikhyy
                  </Link>
                </div>
              </div>
              <div className="px-4 py-3 flex items-center gap-3 border-t border-zinc-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  AP
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate" title="Aaditya Pratap (Employee of the Minute)">
                    Aaditya Pratap <span className="text-xs text-pink-400 ml-1 block sm:inline">(Employee of the Minute)</span>
                  </p>
                  <Link href="https://github.com/2aadi" target="_blank" className="text-xs text-zinc-400 hover:text-pink-400 truncate block transition-colors">
                    github.com/2aadi
                  </Link>
                </div>
              </div>
            </div>
          )}
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
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-2 shadow-2xl space-y-3">
            {/* Create Button */}
            <button
              onClick={() => {
                const newId = Math.random().toString(36).substring(2, 8);
                router.push(`/room/${newId}`);
              }}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white p-3.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 group/btn"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>Create Instant Room</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink-0 mx-4 text-zinc-600 text-xs font-medium uppercase tracking-wider">or join with code</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            {/* Join Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!roomName.trim()) return;
              router.push(`/room/${roomName.trim()}`);
            }} className="flex items-center bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-1 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all">
              <span className="pl-3 text-zinc-500 select-none">#</span>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room code"
                className="flex-1 bg-transparent border-none text-white placeholder:text-zinc-600 focus:outline-none px-2 py-2 text-sm font-mono"
              />
              <button
                type="submit"
                disabled={!roomName}
                className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
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
