"use client";

import React, { useEffect, useRef, useState } from "react";
import { Shield, Check, UserX } from "lucide-react";

interface Player {
  id: string; name: string; score: number; isHost: boolean; votedFor?: string | null;
}

interface VideoGridProps {
  players: Player[];
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  phase: string;
  onVote: (targetId: string) => void;
  votedFor: string | null;
  myPeerId: string;
  votesMap: Record<string, number>;
  revealedImposterId?: string;
  isHost?: boolean;
  onKick?: (peerId: string) => void;
  gridMode?: "auto" | "1" | "2" | "3" | "4";
  kickModeActive?: boolean;
}

// ─── Smart column calculator ─────────────────────────────────────────────────
function calcCols(n: number, mode: string, isPortrait: boolean): number {
  if (mode !== "auto") return Math.min(parseInt(mode), n);
  if (n === 1) return 1;
  if (n === 2) return isPortrait ? 1 : 2;
  if (n <= 4) return 2;
  if (n <= 6) return isPortrait ? 2 : 3;
  if (n <= 9) return isPortrait ? 3 : 3;
  return 4;
}

// ─── Single player video tile ─────────────────────────────────────────────────
function PlayerFeed({
  player, stream, isMe, ticks, hasVotedForThis,
  onVote, isRevealedImposter, phase, isHost, onKick, kickModeActive,
}: {
  player: Player; stream: MediaStream | null; isMe: boolean;
  ticks: number; hasVotedForThis: boolean;
  onVote: (id: string) => void; isRevealedImposter: boolean;
  phase: string; isHost: boolean; onKick?: (id: string) => void;
  kickModeActive?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!stream) { setHasVideo(false); return; }
    const check = () => {
      const t = stream.getVideoTracks()[0];
      setHasVideo(!!t && t.enabled && t.readyState === "live");
    };
    check();
    const t = stream.getVideoTracks()[0];
    if (!t) return;
    t.addEventListener("mute",   check);
    t.addEventListener("unmute", check);
    t.addEventListener("ended",  check);
    return () => {
      t.removeEventListener("mute",   check);
      t.removeEventListener("unmute", check);
      t.removeEventListener("ended",  check);
    };
  }, [stream]);

  const isClickable = phase === "voting" && !isMe;

  const handleClick = () => {
    if (isClickable) {
      onVote(player.id);
    }
  };

  // Determine borders based on game states
  let borderCls = "border border-slate-800/80";
  if (isRevealedImposter) {
    borderCls = "border-2 border-rose-500 imposter-ring shadow-lg shadow-rose-950/50";
  } else if (hasVotedForThis) {
    borderCls = "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-[1.01]";
  } else if (isClickable) {
    borderCls = "border border-dashed border-emerald-500/50 hover:border-emerald-400 hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] active:scale-95";
  }

  return (
    <div
      onClick={handleClick}
      className={`relative w-full h-full overflow-hidden rounded-xl transition-all duration-200 group
        ${borderCls} ${isClickable ? "cursor-pointer" : ""}`}
    >
      {/* ── Video ── */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay playsInline muted={isMe} disablePictureInPicture
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
            ${hasVideo ? "opacity-100" : "opacity-0"}
            ${isMe ? "-scale-x-100" : ""}`}
        />
      ) : (
        /* No stream yet — spinner */
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-1.5">
          <div className="w-5 h-5 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <span className="text-[8px] uppercase font-mono text-slate-500 tracking-widest">Connecting…</span>
        </div>
      )}

      {/* ── Camera-off avatar ── */}
      {stream && !hasVideo && (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-1.5">
          <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-black font-mono uppercase
            ${isRevealedImposter ? "bg-rose-500/15 border-rose-500/40 text-rose-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
            {player.name.slice(0, 2)}
          </div>
          <span className="text-[7px] uppercase font-mono text-slate-500">Audio Only</span>
        </div>
      )}

      {/* ── Imposter reveal tag ── */}
      {isRevealedImposter && (
        <div className="absolute top-1.5 left-1.5 right-1.5 z-10 pointer-events-none">
          <div className="bg-rose-500/25 border border-rose-500/50 text-rose-300 text-[7px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md text-center backdrop-blur-sm">
            🕵️ IMPOSTER
          </div>
        </div>
      )}

      {/* ── Host badge ── */}
      {player.isHost && !isRevealedImposter && (
        <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
          <div className="bg-slate-950/80 backdrop-blur border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Shield className="w-2 h-2 text-emerald-400" />
            <span className="text-[7px] font-mono text-slate-300 uppercase tracking-widest">Host</span>
          </div>
        </div>
      )}

      {/* ── Vote tick count (tally from others, standard top right) ── */}
      {ticks > 0 && (
        <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
          <div className="bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-bold px-1.5 py-0.5 rounded-md text-[9px] font-mono flex items-center gap-0.5 backdrop-blur-sm shadow-md">
            <Check className="w-2.5 h-2.5" /> {ticks}
          </div>
        </div>
      )}

      {/* ── Host kick button (shown ONLY when kickModeActive is enabled, permanently visible for guests) ── */}
      {isHost && !isMe && phase !== "results" && onKick && kickModeActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onKick(player.id); }}
          title={`Kick ${player.name}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-25 p-3.5 bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white rounded-full transition shadow-lg shadow-black/60 cursor-pointer animate-pulse"
        >
          <UserX className="w-6 h-6" />
        </button>
      )}

      {/* ── Name + score bar (with checkmark if voted) ── */}
      <div className={`absolute bottom-0 left-0 right-0 px-2.5 py-1.5 z-10 flex items-center justify-between border-t border-slate-900/40
        ${isRevealedImposter ? "bg-rose-950/95" : "bg-slate-950/95"}`}>
        <span className="text-[10.5px] font-bold font-mono text-slate-200 truncate uppercase leading-none flex items-center gap-1">
          {hasVotedForThis && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />}
          {player.name}{isMe && " ·you"}
        </span>
        <span className="text-[9px] font-mono text-slate-400 font-bold shrink-0 ml-1 leading-none">{player.score}p</span>
      </div>
    </div>
  );
}

// ─── Grid wrapper ─────────────────────────────────────────────────────────────
export default function VideoGrid({
  players, localStream, remoteStreams, phase, onVote,
  votedFor, myPeerId, votesMap, revealedImposterId,
  isHost = false, onKick, gridMode = "auto", kickModeActive = false,
}: VideoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 320, height: 400 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDims({
          width: entry.contentRect.width || 320,
          height: entry.contentRect.height || 400,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = players.length;
  const isPortrait = dims.height > dims.width;
  const cols = calcCols(n, gridMode, isPortrait);
  const rows = Math.ceil(n / cols);

  const gap = 6;
  const r = 3 / 4; // aspect ratio width/height

  // Fit calculations inside the container boundaries
  const wMaxByWidth = (dims.width - gap * (cols - 1)) / cols;
  const hMaxByHeight = (dims.height - gap * (rows - 1)) / rows;
  const wMaxByHeight = hMaxByHeight * r;

  let cardWidth = Math.min(wMaxByWidth, wMaxByHeight);

  // Cap maximum card width so they don't look awkwardly huge when few players
  if (n === 1) {
    cardWidth = Math.min(cardWidth, 280);
  } else if (n === 2) {
    cardWidth = Math.min(cardWidth, 240);
  } else {
    cardWidth = Math.min(cardWidth, 320); // standard cap
  }

  // Prevent negative/0 sizes
  cardWidth = Math.max(cardWidth, 40);
  const cardHeight = cardWidth / r;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden p-1"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${cardWidth}px)`,
          gridTemplateRows: `repeat(${rows}, ${cardHeight}px)`,
          gap: `${gap}px`,
          justifyContent: "center",
          alignContent: "center",
        }}
      >
        {players.map((player) => (
          <div key={player.id} style={{ width: cardWidth, height: cardHeight }}>
            <PlayerFeed
              player={player}
              stream={player.id === myPeerId ? localStream : (remoteStreams[player.id] ?? null)}
              isMe={player.id === myPeerId}
              ticks={votesMap[player.id] || 0}
              hasVotedForThis={votedFor === player.id}
              onVote={onVote}
              isRevealedImposter={phase === "results" && player.id === revealedImposterId}
              phase={phase}
              isHost={isHost}
              onKick={onKick}
              kickModeActive={kickModeActive}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
