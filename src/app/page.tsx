"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Shield, Swords, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  const generateRoomId = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Easy to read characters
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    router.push(`/room/${newRoomId}?isHost=true`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }
    const cleanCode = roomCode.trim().toUpperCase();
    router.push(`/room/${cleanCode}`);
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-4 relative min-h-screen">
      {/* Glow Effects background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[300px] h-[300px] bg-rose-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative border-emerald-500/20 shadow-2xl scanline overflow-hidden">
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />
        
        {/* Header / Logo */}
        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 neon-border-green">
            <Shield className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider text-slate-100 uppercase font-mono">
            Undercover <span className="text-emerald-400 neon-text-green">Imposter</span>
          </h1>
          <p className="text-slate-400 text-xs mt-2 uppercase tracking-widest font-mono">
            Secure P2P Game Protocol
          </p>
        </div>

        {/* Actions Form */}
        <div className="space-y-6 relative z-10">
          <button
            onClick={handleCreateRoom}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl transition duration-200 shadow-lg shadow-emerald-900/30 border border-emerald-500/30 hover:border-emerald-400/50 flex items-center justify-center gap-2 uppercase tracking-wider text-sm cursor-pointer"
          >
            <Swords className="w-5 h-5" />
            Create Game Lobby 🚀
          </button>

          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-slate-800" />
            <span className="px-3 text-xs text-slate-500 uppercase tracking-widest font-mono">Or Join Existing</span>
            <div className="flex-1 border-t border-slate-800" />
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono mb-2">
                Lobby Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="E.G. AZ9K3P"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value);
                    setError("");
                  }}
                  className="w-full px-4 py-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 font-mono text-center tracking-widest focus:outline-none focus:border-emerald-500/50 transition duration-150 uppercase"
                  maxLength={10}
                />
                <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 pointer-events-none" />
              </div>
              {error && (
                <p className="text-rose-500 text-xs mt-2 font-mono uppercase tracking-wider">
                  ⚠️ {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-emerald-400 font-bold rounded-xl transition duration-150 border border-emerald-500/20 hover:border-emerald-500/40 flex items-center justify-center gap-2 uppercase tracking-wider text-sm cursor-pointer shadow-inner"
            >
              <Sparkles className="w-4 h-4" />
              Establish Uplink 📡
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-slate-900 text-center relative z-10">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
            Powered by WebRTC & PeerJS. No database. Pure P2P Encryption.
          </p>
        </div>
      </div>
    </div>
  );
}

