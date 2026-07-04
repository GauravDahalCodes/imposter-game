"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, Link2, Sparkles } from "lucide-react";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError]           = useState("");

  const generateRoomId = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let r = "";
    for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
  };

  const handleCreateRoom = () => {
    if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    router.push(`/room/${generateRoomId()}?isHost=true`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inviteLink.trim();
    if (!raw) { setError("Paste an invite link above"); return; }

    if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    try {
      // Accept full URL or bare host param
      let url: URL;
      if (raw.startsWith("http")) {
        url = new URL(raw);
      } else {
        // Maybe they pasted just a path like /room/ABC123?host=xyz
        url = new URL(raw, window.location.origin);
      }
      const pathParts = url.pathname.split("/").filter(Boolean);
      const roomId    = pathParts[1]; // /room/<roomId>
      const hostParam = url.searchParams.get("host");

      if (!roomId) { setError("Couldn't find a room in that link"); return; }
      const dest = hostParam
        ? `/room/${roomId}?host=${hostParam}`
        : `/room/${roomId}`;
      router.push(dest);
    } catch {
      setError("That doesn't look like a valid link — try again");
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-4 relative min-h-screen overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[300px] h-[300px] bg-rose-500/6 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm glass-panel p-7 rounded-2xl border border-emerald-500/20 shadow-2xl scanline overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />

        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-8 relative z-10 gap-3">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-emerald-500/30 shadow-lg neon-border-green">
            <Image src="/icon-512.png" alt="Undercover Imposter" width={80} height={80} className="w-full h-full object-cover" priority />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-wider text-slate-100 uppercase font-mono leading-tight">
              Undercover <span className="text-emerald-400 neon-text-green">Imposter</span>
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-5 relative z-10">
          <button
            onClick={handleCreateRoom}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-900/30 border border-emerald-500/30 hover:border-emerald-400/50 flex items-center justify-center gap-2 uppercase tracking-wider text-sm cursor-pointer font-mono"
          >
            <Swords className="w-5 h-5" />
            Create Game Lobby 🚀
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-800" />
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono whitespace-nowrap">or join existing</span>
            <div className="flex-1 border-t border-slate-800" />
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-3">
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
              <input
                type="text"
                placeholder="Paste invite link here…"
                value={inviteLink}
                onChange={(e) => { setInviteLink(e.target.value); setError(""); }}
                className="w-full pl-10 pr-4 py-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition"
              />
            </div>
            {error && <p className="text-rose-500 text-xs font-mono">⚠️ {error}</p>}
            <button
              type="submit"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold rounded-xl transition border border-emerald-500/20 hover:border-emerald-500/40 flex items-center justify-center gap-2 uppercase tracking-wider text-sm cursor-pointer font-mono shadow-inner"
            >
              <Sparkles className="w-4 h-4" />
              Join Game 📡
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
