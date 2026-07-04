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
}

// ─── Smart column calculator ─────────────────────────────────────────────────
// Returns the number of columns that best fills the container without overflow.
// Priority: fill the viewport height, keep cells roughly portrait on mobile.
function calcCols(n: number, mode: string): number {
  if (mode !== "auto") return Math.min(parseInt(mode), n);
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  if (n <= 9) return 3;
  return 4;
}

// ─── Single player video tile ─────────────────────────────────────────────────
function PlayerFeed({
  player, stream, isMe, ticks, hasVotedForThis,
  showVoteOverlay, onVote, isRevealedImposter, phase, isHost, onKick,
}: {
  player: Player; stream: MediaStream | null; isMe: boolean;
  ticks: number; hasVotedForThis: boolean; showVoteOverlay: boolean;
  onVote: (id: string) => void; isRevealedImposter: boolean;
  phase: string; isHost: boolean; onKick?: (id: string) => void;
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

  return (
    // Cell fills 100% of its grid cell (grid-auto-rows: 1fr handles equal heights)
    <div className={`relative w-full h-full overflow-hidden rounded-xl transition-all duration-300 group
      ${isRevealedImposter
        ? "border-2 border-rose-500 imposter-ring shadow-lg shadow-rose-950/50"
        : "border border-slate-800/80"
      }`}
    >
      {/* ── Video ── */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay playsInline muted={isMe}
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

      {/* ── Vote tick count ── */}
      {ticks > 0 && (
        <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
          <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold px-1.5 py-0.5 rounded-md text-[9px] font-mono flex items-center gap-0.5 backdrop-blur-sm">
            <Check className="w-2.5 h-2.5" /> {ticks}
          </div>
        </div>
      )}

      {/* ── Host kick button (hover) ── */}
      {isHost && !isMe && phase !== "results" && onKick && (
        <button
          onClick={() => onKick(player.id)}
          title={`Kick ${player.name}`}
          className="absolute top-1.5 right-1.5 z-20 p-1 bg-rose-900/70 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
        >
          <UserX className="w-3 h-3" />
        </button>
      )}

      {/* ── Vote overlay ── */}
      {showVoteOverlay && (
        <div className="absolute inset-0 bg-black/50 flex items-end p-1.5 opacity-0 hover:opacity-100 transition-opacity duration-200 z-20">
          <button
            onClick={() => onVote(player.id)}
            className={`w-full py-1.5 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-widest cursor-pointer transition
              ${hasVotedForThis
                ? "bg-emerald-600 border-emerald-400 text-white"
                : "bg-slate-950/85 border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400"}`}
          >
            {hasVotedForThis ? "✅ Voted" : "Vote"}
          </button>
        </div>
      )}

      {/* ── Name + score bar ── */}
      <div className={`absolute bottom-0 left-0 right-0 px-2 py-1 z-10 flex items-center justify-between
        ${isRevealedImposter ? "bg-rose-950/90" : "bg-slate-950/85"}`}>
        <span className="text-[9px] font-bold font-mono text-slate-200 truncate uppercase leading-none">
          {player.name}{isMe && " ·you"}
        </span>
        <span className="text-[8px] font-mono text-slate-400 font-bold shrink-0 ml-1 leading-none">{player.score}p</span>
      </div>
    </div>
  );
}

// ─── Grid wrapper ─────────────────────────────────────────────────────────────
export default function VideoGrid({
  players, localStream, remoteStreams, phase, onVote,
  votedFor, myPeerId, votesMap, revealedImposterId,
  isHost = false, onKick, gridMode = "auto",
}: VideoGridProps) {
  const n    = players.length;
  const cols = calcCols(n, gridMode);
  const rows = Math.ceil(n / cols);

  return (
    // h-full + grid-auto-rows makes every cell an equal share of the container height
    <div
      className="w-full h-full"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: "6px",
      }}
    >
      {players.map((player) => (
        <PlayerFeed
          key={player.id}
          player={player}
          stream={player.id === myPeerId ? localStream : (remoteStreams[player.id] ?? null)}
          isMe={player.id === myPeerId}
          ticks={votesMap[player.id] || 0}
          hasVotedForThis={votedFor === player.id}
          showVoteOverlay={phase === "voting" && player.id !== myPeerId}
          onVote={onVote}
          isRevealedImposter={phase === "results" && player.id === revealedImposterId}
          phase={phase}
          isHost={isHost}
          onKick={onKick}
        />
      ))}
    </div>
  );
}
